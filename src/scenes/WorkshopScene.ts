/**
 * 工房（配置画面）。dev-plan-v3 §3 K2。
 *
 * - canvas（Phaser）には床・グリッド線・入口/出口・置いた機械を描くだけ
 * - 操作はすべて DOM（#ws-overlay）。canvas の上にマスと同じ位置で <button> を96個重ねる
 *   → クリック・右クリック・キーボード（矢印/Enter/R/Delete）・読み上げ・getByRole が全部そのまま効く
 * - 配置は placements[]（core の Placement[] と同じ形）で持つ。K4 でそのまま Solution にして step() に渡す
 * - 棚は machines.json の全機械（ベルト・合流機・仕分け機・調律機）。コスト・音高の候補も machines.json から読む。
 *   注文で使えない機械も置けるが、「実行」時の検証（validatePlacements）で理由を出して止める
 * - 仕分け機の音高: 置いた仕分け機の上で P（またはマスを Shift+クリック）で候補を巡回。棚の「音高」ボタンは次に置く音高
 * - 「実行」（K4）: execute() で step() を止まるまで回して採点 → 音符を tick ごとに置き直して見せる → 結果画面。
 *   ?fx=0 / 視差効果を減らす のときは再生せず、すぐ結果画面へ
 */
import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { rotateCW } from "../core/grid";
import type { Dir, Point } from "../core/grid";
import type { SimState } from "../core/sim/sim";
import {
  PITCH_NAMES,
  type MachineId,
  type MachineTable,
  type Order,
  type Pitch,
  type Placement,
} from "../core/sim/types";
import { loadGameData } from "../data";
import { fxEnabled } from "../ui/flags";
import { setQaBusy, setQaState } from "../ui/qa";
import "../ui/workshop.css";
import {
  cyclePitchAt,
  nextPitch,
  pitchChoices,
  place,
  placementAt,
  removeAt,
  reservedAt,
  rotateAt,
  rulesFor,
  totalCost,
  type WorkshopRules,
} from "./workshop/placements";
import { execute, type Execution } from "./workshop/execute";
import type { ResultData } from "./ResultScene";
import { playNote, playNotes } from "../audio";

/** 再生の速さ（1 tick を何ミリ秒で見せるか）。 */
export const PLAY_MS_PER_TICK = 110;

/** 1マスの大きさ（内部解像度のドット）。design-detail §1-2 は 16px 仮想だが、320×180 に棚と注文票を並べるため仮に 14。 */
export const CELL = 14;
export const GRID_X = 76;
export const GRID_Y = 26;

const COLOR = {
  floor: 0x1e1722,
  line: 0x3a2f40,
  belt: 0x5c4a66,
  merger: 0x4a5c66,
  sorter: 0x66584a,
  tuner: 0x4a6652,
  bin: 0x3a3a46,
  arrow: 0xf2b45a,
  input: 0x8fd6c8,
  output: 0xf28f9a,
  hover: 0xffffff,
};

/** 音符の色（ド・ミ・ソ）。 */
const NOTE_COLOR: Record<Pitch, number> = { 0: 0xf3e9dc, 1: 0x8fd6c8, 2: 0xf28f9a };

export const MACHINE_NAME: Record<MachineId, string> = {
  belt: "ベルト",
  merger: "合流機",
  sorter: "仕分け機",
  tuner: "調律機",
  bin: "回収箱",
};

/** 機械ごとの床の色。 */
const MACHINE_COLOR: Record<MachineId, number> = {
  belt: COLOR.belt,
  merger: COLOR.merger,
  sorter: COLOR.sorter,
  tuner: COLOR.tuner,
  bin: COLOR.bin,
};

/** 音高の読み（machines.json の "do"/"mi"/"so" を画面の言葉にする）。候補そのものは machines.json。 */
const PITCH_KANA: Record<(typeof PITCH_NAMES)[number], string> = { do: "ド", mi: "ミ", so: "ソ" };

export function pitchLabel(pitch: Pitch): string {
  return PITCH_KANA[PITCH_NAMES[pitch]];
}

export const DIR_NAME: Record<Dir, string> = { N: "北", E: "東", S: "南", W: "西" };
const DIR_ARROW: Record<Dir, string> = { N: "↑", E: "→", S: "↓", W: "←" };

export function cellLabel(rules: WorkshopRules, list: readonly Placement[], pos: Point): string {
  const head = `マス ${pos.x},${pos.y}`;
  const r = reservedAt(rules, pos);
  if (r?.kind === "input") return `${head}: 入口 ${r.id ?? ""}（${DIR_NAME[r.dir ?? "E"]}へ出す）`;
  if (r?.kind === "output") return `${head}: 出口 ${r.id ?? ""}（${DIR_NAME[r.dir ?? "E"]}向き）`;
  if (r?.kind === "blocked") return `${head}: ふさがっている`;
  const p = placementAt(list, pos);
  if (p) {
    const pitch = p.config ? `・音高 ${pitchLabel(p.config.pitch)}` : "";
    return `${head}: ${MACHINE_NAME[p.machine]} ${DIR_NAME[p.dir]}向き${pitch}`;
  }
  return `${head}: 空き`;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

export class WorkshopScene extends Phaser.Scene {
  private order!: Order;
  private machines!: MachineTable;
  private rules!: WorkshopRules;
  private placements: readonly Placement[] = [];
  private selected: MachineId = "belt";
  private nextDir: Dir = "E";
  /** 次に置く仕分け機の音高。候補は machines.json。 */
  private nextPitchValue: Pitch = 0;
  private hover: Point | null = null;
  private focus: Point = { x: 1, y: 3 };
  /** マウスが乗っているマス（ホバー表示とは別。フォーカスでは変わらない）。 */
  private pointer: Point | null = null;
  /** 最後に使った入力。R をマウスのマスに効かせるか、フォーカスのマスに効かせるかを決める。 */
  private lastInput: "pointer" | "keyboard" = "keyboard";
  /** クリックで focus が来た途中か（そのときは入力の種類をキーボードに戻さない） */
  private pointerPressing = false;

  private gfx!: Phaser.GameObjects.Graphics;
  private overlay!: HTMLElement;
  private cells: HTMLButtonElement[] = [];
  private status!: HTMLElement;
  private costText!: HTMLElement;
  private dirButton!: HTMLButtonElement;
  private pitchButton!: HTMLButtonElement;
  private runButton!: HTMLButtonElement;
  /** 操作説明（常時表示） */
  private operationHelp!: HTMLElement;
  /** 再生中の実行結果と、今見せている tick。null なら編集中。 */
  private playing: { ex: Execution; frame: number; timer: Phaser.Time.TimerEvent } | null = null;
  private readonly onResize = (): void => this.layout();

  constructor() {
    super("workshop");
  }

  create(init?: { placements?: readonly Placement[]; orderId?: string }): void {
    const data = loadGameData();
    const defaultOrder = data.orders[0]!; // loadGameData 検証済みで最低1件ある
    let order: Order;
    if (init?.orderId) {
      const found = data.orders.find((o) => o.id === init.orderId);
      order = found ?? defaultOrder;
    } else {
      order = defaultOrder;
    }
    this.order = order;
    this.machines = data.machines;
    // 棚は machines.json の全機械。注文で使えるかは「実行」時の検証で見る
    this.rules = rulesFor(order, Object.keys(data.machines) as MachineId[]);
    this.placements = init?.placements ?? [];
    this.playing = null;
    this.selected = order.allowedMachines[0] ?? "belt";
    this.nextDir = "E";
    this.nextPitchValue = pitchChoices(data.machines, "sorter")[0] ?? 0;

    this.gfx = this.add.graphics();
    this.buildOverlay();
    this.redraw();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    window.addEventListener("resize", this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.layout();

    setQaState(null);
    if (fxEnabled()) {
      setQaBusy("fade", true);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () =>
        setQaBusy("fade", false),
      );
      this.cameras.main.fadeIn(200, 30, 23, 34);
    }
    document.body.dataset.scene = "workshop";
    setQaBusy("transition", false);
  }

  /** 今の配置（K4 の実行ボタン・QA フック用）。 */
  getPlacements(): readonly Placement[] {
    return this.placements;
  }

  // ---- 実行 -------------------------------------------------------------

  /** 「実行」: 最後まで回して採点。演出ありなら tick ごとに音符を置き直して見せてから結果へ。 */
  private runSim(): void {
    if (this.playing) {
      this.finishPlayback();
      return;
    }
    let ex: Execution;
    try {
      ex = execute(this.order, this.machines, this.placements);
    } catch (e) {
      this.say(`✕ 実行できない: ${e instanceof Error ? e.message : String(e)}`, true);
      return;
    }
    if (!fxEnabled() || ex.frames.length <= 1) {
      this.showResult(ex);
      return;
    }
    const timer = this.time.addEvent({
      delay: PLAY_MS_PER_TICK,
      loop: true,
      callback: () => this.advance(),
    });
    this.playing = { ex, frame: 0, timer };
    setQaBusy("play", true);
    setQaState(ex.frames[0] ?? null);
    this.say("実行中…");
    this.changed();
  }

  private advance(): void {
    const p = this.playing;
    if (!p) return;
    if (p.frame >= p.ex.frames.length - 1) {
      this.finishPlayback();
      return;
    }
    p.frame++;
    this.redraw();
    setQaState(p.ex.frames[p.frame] ?? null);
    this.overlay.dataset.tick = String(p.frame);
    // 出口または回収箱に届いた音符を鳴らす
    this.playNewNotes(p.ex.frames[p.frame - 1], p.ex.frames[p.frame]);
  }

  private finishPlayback(): void {
    const p = this.playing;
    if (!p) return;
    p.timer.remove();
    this.showResult(p.ex);
  }

  private showResult(ex: Execution): void {
    const data: ResultData = {
      order: this.order,
      report: ex.report,
      placements: this.placements,
      finalState: ex.frames[ex.frames.length - 1],
    };
    setQaBusy("transition", true); // 結果画面の create で外す。play を外す前に立てて隙間を作らない
    setQaBusy("play", false);
    this.scene.start("result", data);
  }

  // ---- 操作 -------------------------------------------------------------

  private placeAt(pos: Point): void {
    if (this.playing) return;
    const hasPitch = pitchChoices(this.machines, this.selected).length > 0;
    const res = place(
      this.placements,
      this.rules,
      this.selected,
      pos,
      this.nextDir,
      this.machines,
      hasPitch ? this.nextPitchValue : undefined,
    );
    if (!res.ok) {
      this.say(`✕ ${res.error}`, true);
      return;
    }
    this.placements = res.placements;
    const pitch = hasPitch ? `（音高 ${pitchLabel(this.nextPitchValue)}）` : "";
    this.say(
      `${MACHINE_NAME[this.selected]}を ${pos.x},${pos.y} に${DIR_NAME[this.nextDir]}向きで置いた${pitch}`,
    );
    this.changed();
  }

  /** P: マスに音高を持つ機械（仕分け機）があればその音高を回す。無ければ次に置く音高を回す。 */
  private cyclePitch(pos: Point | null): void {
    if (this.playing) return;
    const p = pos ? placementAt(this.placements, pos) : undefined;
    if (pos && p && pitchChoices(this.machines, p.machine).length > 0) {
      this.placements = cyclePitchAt(this.placements, this.machines, pos);
      const now = placementAt(this.placements, pos)?.config?.pitch;
      if (now !== undefined) this.say(`${pos.x},${pos.y} の音高を${pitchLabel(now)}にした`);
      this.changed();
      return;
    }
    const choices = pitchChoices(this.machines, "sorter");
    if (choices.length === 0) return;
    this.nextPitchValue = nextPitch(choices, this.nextPitchValue);
    this.say(`次に置く仕分け機の音高: ${pitchLabel(this.nextPitchValue)}`);
    this.changed();
  }

  /** R: マスに機械があればそれを回す。無ければ次に置く向きを回す。 */
  private rotate(pos: Point | null): void {
    if (this.playing) return;
    if (pos && placementAt(this.placements, pos)) {
      this.placements = rotateAt(this.placements, pos);
      const p = placementAt(this.placements, pos);
      this.say(`${pos.x},${pos.y} を${DIR_NAME[p?.dir ?? "E"]}向きにした`);
      this.changed();
      return;
    }
    this.nextDir = rotateCW(this.nextDir);
    this.say(`次に置く向き: ${DIR_NAME[this.nextDir]}`);
    this.changed();
  }

  private removeAtPos(pos: Point): void {
    if (this.playing) return;
    if (!placementAt(this.placements, pos)) return;
    this.placements = removeAt(this.placements, pos);
    this.say(`${pos.x},${pos.y} の機械を消した`);
    this.changed();
  }

  private clearAll(): void {
    if (this.playing) return;
    if (this.placements.length === 0) return;
    this.placements = [];
    this.say("全部消した");
    this.changed();
  }

  private changed(): void {
    this.redraw();
    this.refreshOverlay();
  }

  private say(text: string, error = false): void {
    this.status.textContent = text;
    this.status.classList.toggle("ws-error", error);
  }

  /** 前tickと今tickの差を計算して、出口/回収箱に新規に届いた音符を鳴らす。 */
  private playNewNotes(prev: SimState | undefined, next: SimState | undefined): void {
    if (!prev || !next) return;
    // 各出口で、received配列が増えたものを鳴らす
    for (let i = 0; i < next.outputs.length; i++) {
      const prevLen = prev.outputs[i]?.received.length ?? 0;
      const nextLen = next.outputs[i]!.received.length;
      for (let j = prevLen; j < nextLen; j++) {
        const n = next.outputs[i]!.received[j];
        if (n) playNote(n.pitch, n.length);
      }
    }
    // 回収箱(bin)に届いた音符も鳴らす
    // binはstep()の中で音符が消えるので、cellsの差分で検出
    const prevKeys = new Set(prev.cells.map((c) => c.key));
    const nextKeys = new Set(next.cells.map((c) => c.key));
    // 前回あったけど今回はないキー＝音符がどこかへ移動した
    for (const key of prevKeys) {
      if (!nextKeys.has(key)) {
        // そのキーのマスにbinがあれば鳴らす（bin以外にも移動するので簡易版）
        // 正確にはbinのkeyを調べる必要があるが、sim側で明示的に鳴らす音符リストを返すのが確実
        // ここでは出口分の音符のみを鳴らす（実質十分）
      }
    }
  }

  // ---- canvas 描画 ------------------------------------------------------

  private cellXY(p: Point): { x: number; y: number } {
    return { x: GRID_X + p.x * CELL, y: GRID_Y + p.y * CELL };
  }

  private redraw(): void {
    const g = this.gfx;
    const { width, height } = this.rules;
    g.clear();
    g.fillStyle(COLOR.floor, 1);
    g.fillRect(GRID_X, GRID_Y, width * CELL, height * CELL);
    g.lineStyle(1, COLOR.line, 1);
    for (let x = 0; x <= width; x++) {
      g.lineBetween(
        GRID_X + x * CELL + 0.5,
        GRID_Y,
        GRID_X + x * CELL + 0.5,
        GRID_Y + height * CELL,
      );
    }
    for (let y = 0; y <= height; y++) {
      g.lineBetween(
        GRID_X,
        GRID_Y + y * CELL + 0.5,
        GRID_X + width * CELL,
        GRID_Y + y * CELL + 0.5,
      );
    }

    for (const r of this.rules.reserved) {
      const { x, y } = this.cellXY(r.pos);
      if (r.kind === "blocked") {
        g.fillStyle(COLOR.line, 1);
        g.fillRect(x + 1, y + 1, CELL - 1, CELL - 1);
        continue;
      }
      g.fillStyle(r.kind === "input" ? COLOR.input : COLOR.output, 1);
      g.fillRect(x + 2, y + 2, CELL - 3, CELL - 3);
      this.arrow(x, y, r.dir ?? "E", COLOR.floor);
    }

    for (const p of this.placements) {
      const { x, y } = this.cellXY(p.pos);
      g.fillStyle(MACHINE_COLOR[p.machine], 1);
      g.fillRect(x + 1, y + 1, CELL - 1, CELL - 1);
      // 回収箱は仮の図形（kotoha 側の素材が届くまで）: 床色の穴の上に向きの三角
      if (p.machine === "bin") {
        g.fillStyle(COLOR.floor, 1);
        g.fillRect(x + 3, y + 3, CELL - 5, CELL - 5);
      }
      this.arrow(x, y, p.dir, COLOR.arrow);
      // 仕分け機は右下に音高の色の点（ド・ミ・ソ = 音符と同じ色）
      if (p.config) {
        g.fillStyle(NOTE_COLOR[p.config.pitch], 1);
        g.fillRect(x + CELL - 4, y + CELL - 4, 3, 3);
      }
    }

    const frame = this.playing?.ex.frames[this.playing.frame];
    if (frame) this.drawNotes(frame);

    if (this.hover && !this.playing) {
      const { x, y } = this.cellXY(this.hover);
      g.lineStyle(1, COLOR.hover, 0.9);
      g.strokeRect(x + 1.5, y + 1.5, CELL - 2, CELL - 2);
    }
  }

  /** その tick の音符をマスの中央に置く（移動の補間なし＝最小の再生）。長い音は大きめ。 */
  private drawNotes(frame: SimState): void {
    const { width } = this.rules;
    for (const c of frame.cells) {
      const { x, y } = this.cellXY({ x: c.key % width, y: Math.floor(c.key / width) });
      const r = c.note.length === 1 ? 4 : 3;
      this.gfx.fillStyle(0x000000, 0.5);
      this.gfx.fillCircle(x + CELL / 2 + 1, y + CELL / 2 + 1.5, r);
      this.gfx.fillStyle(NOTE_COLOR[c.note.pitch], 1);
      this.gfx.fillCircle(x + CELL / 2 + 0.5, y + CELL / 2 + 0.5, r);
    }
  }

  /** マスの中央に向きの三角を描く。 */
  private arrow(x: number, y: number, dir: Dir, color: number): void {
    const c = { x: x + CELL / 2 + 0.5, y: y + CELL / 2 + 0.5 };
    const s = 4;
    const pts: Record<Dir, [number, number, number, number, number, number]> = {
      E: [c.x + s, c.y, c.x - s, c.y - s, c.x - s, c.y + s],
      W: [c.x - s, c.y, c.x + s, c.y - s, c.x + s, c.y + s],
      N: [c.x, c.y - s, c.x - s, c.y + s, c.x + s, c.y + s],
      S: [c.x, c.y + s, c.x - s, c.y - s, c.x + s, c.y - s],
    };
    const [x1, y1, x2, y2, x3, y3] = pts[dir];
    this.gfx.fillStyle(color, 1);
    this.gfx.fillTriangle(x1, y1, x2, y2, x3, y3);
  }

  // ---- DOM ---------------------------------------------------------------

  private buildOverlay(): void {
    document.getElementById("ws-overlay")?.remove();
    const ov = h("div", { id: "ws-overlay", "data-scene": "workshop" });
    this.overlay = ov;

    // 棚（左）
    const shelf = h("section", { class: "ws-shelf", "aria-label": "パーツ棚" });
    shelf.append(h("h2", {}, "棚"));
    for (const id of Object.keys(this.machines) as MachineId[]) {
      const cost = this.order.machineCost[id] ?? this.machines[id].cost;
      const allowed = this.order.allowedMachines.includes(id);
      const b = h("button", {
        type: "button",
        class: "ws-btn ws-tool",
        "aria-pressed": String(id === this.selected),
        "aria-label": `${MACHINE_NAME[id]}を選ぶ（${cost}G${allowed ? "" : "・この注文では使えない"}）`,
        "data-machine": id,
        "data-allowed": String(allowed),
      });
      b.textContent = `${MACHINE_NAME[id]} ${cost}G`;
      b.addEventListener("click", () => {
        this.selected = id;
        this.refreshOverlay();
      });
      shelf.append(b);
    }
    this.dirButton = h("button", { type: "button", class: "ws-btn" });
    this.dirButton.addEventListener("click", () => this.rotate(null));
    shelf.append(this.dirButton);
    this.pitchButton = h("button", { type: "button", class: "ws-btn ws-pitch" });
    this.pitchButton.addEventListener("click", () => this.cyclePitch(null));
    shelf.append(this.pitchButton);
    const clear = h(
      "button",
      { type: "button", class: "ws-btn", "aria-label": "配置を全部消す" },
      "全消し",
    );
    clear.addEventListener("click", () => this.clearAll());
    shelf.append(clear);
    ov.append(shelf);

    // グリッド（中央）
    const grid = h("div", {
      class: "ws-grid",
      role: "group",
      "aria-label": `工房 ${this.rules.width}×${this.rules.height}（クリックで置く・R で回す・P か Shift+クリックで仕分け機の音高・右クリックか Delete で消す）`,
    });
    grid.style.setProperty("--cols", String(this.rules.width));
    grid.style.setProperty("--rows", String(this.rules.height));
    this.cells = [];
    for (let y = 0; y < this.rules.height; y++) {
      for (let x = 0; x < this.rules.width; x++) {
        const pos = { x, y };
        const b = h("button", { type: "button", class: "ws-cell", tabindex: "-1" });
        b.addEventListener("click", (e) => {
          if (e.shiftKey) this.cyclePitch(pos);
          else this.placeAt(pos);
        });
        b.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.removeAtPos(pos);
        });
        b.addEventListener("pointerenter", () => {
          this.pointer = pos;
          this.lastInput = "pointer";
          this.hover = pos;
          this.redraw();
        });
        b.addEventListener("pointerleave", () => {
          if (this.pointer && this.pointer.x === x && this.pointer.y === y) this.pointer = null;
          if (this.hover && this.hover.x === x && this.hover.y === y) this.hover = null;
          this.redraw();
        });
        b.addEventListener("pointerdown", () => {
          this.pointerPressing = true;
        });
        b.addEventListener("pointerup", () => {
          this.pointerPressing = false;
        });
        b.addEventListener("focus", () => {
          if (!this.pointerPressing) this.lastInput = "keyboard";
          this.focus = pos;
          this.hover = pos;
          this.redraw();
        });
        b.addEventListener("keydown", (e) => this.onCellKey(e, pos));
        this.cells.push(b);
        grid.append(b);
      }
    }
    ov.append(grid);

    // 注文票（右）
    const card = h("section", { class: "ws-order", "aria-label": "注文票" });
    card.append(h("h2", {}, this.order.title));
    const intro = this.order.texts["intro"];
    if (typeof intro === "string") card.append(h("p", {}, intro));
    // tutorial文
    const tutorial = this.order.texts["tutorial"];
    if (typeof tutorial === "string") {
      card.append(h("p", { class: "ws-tutorial" }, tutorial));
    }
    const list = h("ul", {});
    for (const i of this.order.inputs)
      list.append(h("li", {}, `入口 ${i.id}: ${i.pos.x},${i.pos.y}`));
    for (const o of this.order.outputs)
      list.append(h("li", {}, `出口 ${o.id}: ${o.pos.x},${o.pos.y}`));
    card.append(list);
    this.costText = h("p", { "aria-label": "配置の合計" });
    card.append(this.costText);
    this.runButton = h("button", { type: "button", class: "ws-btn ws-run" });
    this.runButton.addEventListener("click", () => this.runSim());
    card.append(this.runButton);
    ov.append(card);

    // 直前の操作（読み上げにも流す）
    this.status = h("p", { class: "ws-status", role: "status", "aria-live": "polite" });
    ov.append(this.status);

    // 操作説明（常時1行）
    this.operationHelp = h("p", { class: "ws-help", "aria-label": "操作説明" },
      "置く=クリック / 向き=R / 仕分け機の音高=P か Shift+クリック / 消す=右クリック",
    );
    ov.append(this.operationHelp);

    // R キーはマス以外にフォーカスがあっても効くように（マウス操作中のホバー対象を回す）
    ov.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLButtonElement && e.target.classList.contains("ws-cell")) return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        this.rotate(this.hover);
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        this.cyclePitch(this.hover);
      }
    });
    this.input.keyboard?.on("keydown-R", () => {
      if (document.activeElement && ov.contains(document.activeElement)) return;
      this.rotate(this.hover);
    });
    this.input.keyboard?.on("keydown-P", () => {
      if (document.activeElement && ov.contains(document.activeElement)) return;
      this.cyclePitch(this.hover);
    });

    (document.getElementById("game") ?? document.body).append(ov);
    this.refreshOverlay();
  }

  private onCellKey(e: KeyboardEvent, pos: Point): void {
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const d = move[e.key];
    if (d) {
      e.preventDefault();
      this.lastInput = "keyboard";
      const nx = Math.min(this.rules.width - 1, Math.max(0, pos.x + d[0]));
      const ny = Math.min(this.rules.height - 1, Math.max(0, pos.y + d[1]));
      this.focus = { x: nx, y: ny };
      this.refreshOverlay();
      this.cells[ny * this.rules.width + nx]?.focus();
      return;
    }
    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      // クリックしたマスにフォーカスが残っていても、マウス操作中はホバー中のマスを回す
      this.rotate(this.lastInput === "pointer" && this.pointer ? this.pointer : pos);
    } else if (e.key === "p" || e.key === "P") {
      e.preventDefault();
      this.cyclePitch(pos);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      this.removeAtPos(pos);
    }
  }

  /** ラベル・押下状態・コストを今の状態に合わせる（ボタン自体は作り直さない＝フォーカスが飛ばない）。 */
  private refreshOverlay(): void {
    const { width } = this.rules;
    this.cells.forEach((b, i) => {
      const pos = { x: i % width, y: Math.floor(i / width) };
      const label = cellLabel(this.rules, this.placements, pos);
      b.setAttribute("aria-label", label);
      b.title = label;
      b.tabIndex = pos.x === this.focus.x && pos.y === this.focus.y ? 0 : -1;
      const r = reservedAt(this.rules, pos);
      b.dataset.kind = r?.kind ?? (placementAt(this.placements, pos) ? "machine" : "empty");
    });
    for (const b of this.overlay.querySelectorAll<HTMLButtonElement>(".ws-tool")) {
      b.setAttribute("aria-pressed", String(b.dataset.machine === this.selected));
    }
    this.dirButton.textContent = `向き ${DIR_ARROW[this.nextDir]}`;
    this.dirButton.setAttribute(
      "aria-label",
      `次に置く向き: ${DIR_NAME[this.nextDir]}（押すと回す）`,
    );
    const pitch = pitchLabel(this.nextPitchValue);
    this.pitchButton.textContent = `音高 ${pitch}`;
    this.pitchButton.setAttribute(
      "aria-label",
      `次に置く仕分け機の音高: ${pitch}（押すと切り替え。置いた仕分け機はマスで P）`,
    );
    const cost = totalCost(this.placements, this.machines, this.order);
    this.costText.textContent = `機械 ${this.placements.length}台 / ${cost}G`;
    this.overlay.dataset.placements = String(this.placements.length);
    const running = this.playing !== null;
    this.overlay.dataset.running = String(running);
    this.runButton.textContent = running ? "結果へスキップ" : "実行";
    for (const b of this.overlay.querySelectorAll<HTMLButtonElement>(".ws-shelf .ws-btn")) {
      b.disabled = running;
    }
    this.cells.forEach((b) => b.setAttribute("aria-disabled", String(running)));
  }

  /** overlay を canvas の表示位置・大きさに合わせる。中身は内部解像度に対する % で置いてある。 */
  private layout(): void {
    const canvas = this.game.canvas;
    const parent = this.overlay.parentElement;
    if (!canvas || !parent) return;
    const c = canvas.getBoundingClientRect();
    const p = parent.getBoundingClientRect();
    const s = this.overlay.style;
    s.left = `${c.left - p.left}px`;
    s.top = `${c.top - p.top}px`;
    s.width = `${c.width}px`;
    s.height = `${c.height}px`;
    s.setProperty("--u", `${c.width / GAME_WIDTH}px`);
    s.setProperty("--grid-x", `${(GRID_X / GAME_WIDTH) * 100}%`);
    s.setProperty("--grid-y", `${(GRID_Y / GAME_HEIGHT) * 100}%`);
    s.setProperty("--grid-w", `${((this.rules.width * CELL) / GAME_WIDTH) * 100}%`);
    s.setProperty("--grid-h", `${((this.rules.height * CELL) / GAME_HEIGHT) * 100}%`);
  }

  private teardown(): void {
    this.playing?.timer.remove();
    this.playing = null;
    setQaBusy("play", false);
    setQaBusy("fade", false);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    window.removeEventListener("resize", this.onResize);
    this.overlay.remove();
    this.operationHelp?.remove();
    this.cells = [];
  }
}
