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
import { isHoverNone, shouldRotateOnTap } from "./workshop/tap";
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
import { fxEnabled, flags } from "../ui/flags";
import {
  TUTORIAL_NEED_MACHINE,
  tutorialText,
  initialStep,
  isTutorialDone,
  markTutorialDone,
  reduce as tutorialReduce,
  type TutorialEvent,
  type TutorialStep,
} from "./workshop/tutorial";
import { isPortraitLayout, portraitMetrics } from "./workshop/portrait";
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
import { createSceneFx } from "../fx/scene-fx";
import type { FxDirector } from "../fx/FxDirector";
import { execute, throughputSeries, type Execution } from "./workshop/execute";
import {
  activeTexture,
  iconCanvas,
  noteTexture,
  portTexture,
  registerTextures,
} from "../art/sprites";
import { playNote, initAudio, isAudioEnabled } from "../fx/audio";
import { duckBgm, onSoundToggle, playSfx, toggleSound } from "../audio/player";
import type { ResultData } from "./ResultScene";

/** 再生の速さ（1 tick を何ミリ秒で見せるか）。 */
export const PLAY_MS_PER_TICK = 110;

/** 1マスの大きさ（内部解像度のドット）。design-detail §1-2 は 16px 仮想だが、320×180 に棚と注文票を並べるため仮に 14。 */
export const CELL = 14;
export const GRID_X = 76;
export const GRID_Y = 26;
/** 演出の帯（盤面の下）。盤面の下端からこの分だけ空けて、そこから高さ FX_BAND_H まで。 */
const FX_BAND_GAP = 3;
const FX_BAND_H = 37;
/** 演出レイヤー全体の不透明度の上限（音符の流れを隠さない。rio の設計 #AE121） */
const FX_ALPHA = 0.5;

const COLOR = {
  floor: 0x1e1722,
  belt: 0x5c4a66,
  merger: 0x4a5c66,
  sorter: 0x66584a,
  tuner: 0x4a6652,
  bin: 0x3a3a46,
  arrow: 0xf2b45a,
  input: 0x8fd6c8,
  output: 0xf28f9a,
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

/** 改行（\n）を <br> にして 1 つの <p> に入れる（注文票の文面用）。 */
function multiLine(text: string, cls: string): HTMLParagraphElement {
  const p = h("p", { class: cls });
  text.split("\n").forEach((line, i) => {
    if (i > 0) p.append(document.createElement("br"));
    p.append(document.createTextNode(line));
  });
  return p;
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
  /** 盤面のドット絵（床・機械・入口/出口）。再描画のたびに作り直す。gfx（線・矢印・音符）より下に置く。 */
  private tiles: Phaser.GameObjects.Image[] = [];
  private fx?: FxDirector;
  /** 再生中に bin へ入った音符の数（combo 表示用） */
  private combo = 0;
  private overlay!: HTMLElement;
  /** 縦持ち（スマホ幅）レイアウトか。create で決める。 */
  private portrait = false;
  private cell = CELL;
  private gridX = GRID_X;
  private gridY = GRID_Y;
  /** 縦持ちの「消す」モード: 入っている間はマスのタップで機械を消す（長押し・右クリックの代わり）。 */
  private eraseMode = false;
  private eraseButton!: HTMLButtonElement;
  private cells: HTMLButtonElement[] = [];
  /** Issue #50: 注文1 のチュートリアル。出さないときは "done"。 */
  private tutorial: TutorialStep = "done";
  private tutorialPanel: HTMLDivElement | null = null;
  private status!: HTMLElement;
  private costText!: HTMLElement;
  private dirButton!: HTMLButtonElement;
  private pitchButton!: HTMLButtonElement;
  private muteButton!: HTMLButtonElement;
  private unsubSound: (() => void) | null = null;
  private runButton!: HTMLButtonElement;
  /** 実行ボタンの下に出す「実行中…(tick n)」。実行中だけ見える */
  private runStatus!: HTMLElement;
  /** 再生中の実行結果と、今見せている tick。null なら編集中。 */
  private playing: { ex: Execution; frame: number; timer: Phaser.Time.TimerEvent } | null = null;
  private readonly onResize = (): void => {
    if (isPortraitLayout(window.innerWidth, window.innerHeight) !== this.portrait) {
      // 再生中は作り直さない（restart すると再生が消えて結果画面に届かない）。見た目だけ合わせ、
      // 再生は最後まで進めて結果画面へ。結果画面から戻れば新しい向きで create される。
      if (this.playing) {
        this.layout();
        return;
      }
      // 縦横が入れ替わった: 配置を引き継いでレイアウトごと作り直す
      this.scene.restart({ placements: this.placements, orderId: this.order.id });
      return;
    }
    if (this.portrait && this.applyViewport()) this.redraw();
    this.layout();
  };

  /**
   * 画面の向きに合わせて canvas の大きさと盤面の座標を決める。
   * 縦持ちは canvas を画面の CSS ピクセルと同じ大きさにして縮小しない（文字・マスを小さくしない）。変わったら true。
   */
  private applyViewport(): boolean {
    const portrait = isPortraitLayout(window.innerWidth, window.innerHeight);
    this.portrait = portrait;
    const w = portrait ? window.innerWidth : GAME_WIDTH;
    const hgt = portrait ? window.innerHeight : GAME_HEIGHT;
    const m = portrait
      ? portraitMetrics(w, this.rules.width, hgt, this.rules.height)
      : { cell: CELL, gridX: GRID_X, gridY: GRID_Y };
    const changed =
      this.scale.width !== w ||
      this.scale.height !== hgt ||
      m.cell !== this.cell ||
      m.gridX !== this.gridX;
    if (this.scale.width !== w || this.scale.height !== hgt) this.scale.setGameSize(w, hgt);
    this.cell = m.cell;
    this.gridX = m.gridX;
    this.gridY = m.gridY;
    return changed;
  }

  constructor() {
    super("workshop");
  }

  create(init?: { placements?: readonly Placement[]; orderId?: string }): void {
    const data = loadGameData();
    const orderId = init?.orderId ?? "order-01";
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`注文データが見つからない: ${orderId}`);
    this.order = order;
    this.machines = data.machines;
    // 棚は machines.json の全機械。注文で使えるかは「実行」時の検証で見る
    this.rules = rulesFor(order, Object.keys(data.machines) as MachineId[]);
    this.placements = init?.placements ?? [];
    this.playing = null;
    this.selected = order.allowedMachines[0] ?? "belt";
    this.nextDir = "E";
    this.nextPitchValue = pitchChoices(data.machines, "sorter")[0] ?? 0;
    // audio.ts の共有設定 (ae-audio-enabled) を使用する

    registerTextures(this.textures);
    this.applyViewport();
    // 演出は盤面の下の帯だけに出す。盤面・ヒント・右パネルには重ねない（縦持ちの盤面座標に合わせる）
    const board = { x: this.gridX, y: this.gridY + this.rules.height * this.cell + FX_BAND_GAP };
    this.fx = createSceneFx(this, "fx-workshop", {
      band: { ...board, w: this.rules.width * this.cell, h: FX_BAND_H },
      frontSlots: 2, // 同時 3 本 = 背景 1 + 前景 2
      alpha: FX_ALPHA,
      width: this.scale.width,
      height: this.scale.height,
    });
    this.fx.emit("ambient");
    this.combo = 0;
    this.gfx = this.add.graphics().setDepth(5);
    // ?seed= の QA 実行では出さない（押下を遮らない）
    this.tutorial = flags().seed !== null ? "done" : initialStep(orderId, isTutorialDone());
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
      this.fx?.emit("runError");
      return;
    }
    if (!fxEnabled() || ex.frames.length <= 1) {
      this.showResult(ex);
      return;
    }
    // 最初の再生で AudioContext を resume
    initAudio(() => {});
    const timer = this.time.addEvent({
      delay: PLAY_MS_PER_TICK,
      loop: true,
      callback: () => this.advance(),
    });
    this.playing = { ex, frame: 0, timer };
    this.combo = 0;
    playSfx("run");
    duckBgm(true);
    setQaBusy("play", true);
    setQaState(ex.frames[0] ?? null);
    this.say("実行中…");
    this.runStatus.textContent = "実行中…(tick 0)";
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
    // bin に入った音符を数えて combo 表示（4つごとに紙吹雪）
    for (const ev of p.ex.binEvents) {
      if (ev.tick !== p.frame) continue;
      this.combo++;
      this.fx?.emit("noteCombo", this.combo, { count: this.combo });
      // 4つごとは紙吹雪の SE のみ（見た目は出さない。fx-map の comboMilestone は空）
      if (this.combo % 4 === 0) this.fx?.emit("comboMilestone", this.combo);
      this.fx?.emit("noteArrive");
    }
    // bin に入った音符を鳴らす
    if (isAudioEnabled()) {
      const events = p.ex.binEvents.filter((ev) => ev.tick === p.frame);
      for (const ev of events) {
        playNote(ev.pitch);
      }
    }
    this.redraw();
    setQaState(p.ex.frames[p.frame] ?? null);
    this.overlay.dataset.tick = String(p.frame);
    this.runStatus.textContent = `実行中…(tick ${p.frame})`;
  }

  private finishPlayback(): void {
    const p = this.playing;
    if (!p) return;
    p.timer.remove();
    duckBgm(false);
    this.showResult(p.ex);
  }

  private showResult(ex: Execution): void {
    this.tutorialEvent("ran");
    const data: ResultData = {
      order: this.order,
      report: ex.report,
      placements: this.placements,
      finalState: ex.frames[ex.frames.length - 1],
      throughput: throughputSeries(ex.frames),
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
      this.fx?.emit("placeError");
      return;
    }
    this.placements = res.placements;
    playSfx("place");
    this.tutorialEvent("placed");
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
      playSfx("pitch");
      const now = placementAt(this.placements, pos)?.config?.pitch;
      if (now !== undefined) this.say(`${pos.x},${pos.y} の音高を${pitchLabel(now)}にした`);
      this.changed();
      return;
    }
    const choices = pitchChoices(this.machines, "sorter");
    if (choices.length === 0) return;
    this.nextPitchValue = nextPitch(choices, this.nextPitchValue);
    playSfx("pitch");
    this.say(`次に置く仕分け機の音高: ${pitchLabel(this.nextPitchValue)}`);
    this.changed();
  }

  /** R: マスに機械があればそれを回す。無ければ次に置く向きを回す。 */
  private rotate(pos: Point | null): void {
    if (this.playing) return;
    if (pos && placementAt(this.placements, pos)) {
      this.placements = rotateAt(this.placements, pos);
      playSfx("rotate");
      this.tutorialEvent("rotated");
      const p = placementAt(this.placements, pos);
      this.say(`${pos.x},${pos.y} を${DIR_NAME[p?.dir ?? "E"]}向きにした`);
      this.changed();
      return;
    }
    this.nextDir = rotateCW(this.nextDir);
    playSfx("rotate");
    this.say(`次に置く向き: ${DIR_NAME[this.nextDir]}`);
    this.changed();
  }

  private removeAtPos(pos: Point): void {
    if (this.playing) return;
    if (!placementAt(this.placements, pos)) return;
    this.placements = removeAt(this.placements, pos);
    playSfx("remove");
    this.say(`${pos.x},${pos.y} の機械を消した`);
    this.changed();
  }

  private clearAll(): void {
    if (this.playing) return;
    if (this.placements.length === 0) return;
    this.placements = [];
    playSfx("clear");
    this.say("全部消した");
    this.changed();
  }

  private changed(): void {
    this.redraw();
    this.refreshOverlay();
  }

  // ---- チュートリアル (Issue #50) ---------------------------------------

  private tutorialEvent(event: TutorialEvent): void {
    const next = tutorialReduce(this.tutorial, event);
    if (next === this.tutorial) return;
    this.tutorial = next;
    if (next === "done") markTutorialDone();
    this.renderTutorial();
  }

  /** 案内パネルと強調枠を今の手順に合わせる。 */
  private renderTutorial(): void {
    for (const e of this.overlay.querySelectorAll("[data-tutorial-focus]")) {
      e.removeAttribute("data-tutorial-focus");
    }
    if (this.tutorial === "done") {
      this.tutorialPanel?.remove();
      return;
    }
    if (!this.tutorialPanel) return;
    const text = this.tutorialPanel.querySelector(".ws-guide-text");
    let msg = tutorialText(this.tutorial, isHoverNone());
    if (this.tutorial === "rotate" && this.placements.length === 0) msg += TUTORIAL_NEED_MACHINE;
    if (text) text.textContent = msg;
    this.tutorialPanel.dataset.step = this.tutorial;
    const target =
      this.tutorial === "place"
        ? this.overlay.querySelector(".ws-shelf")
        : this.tutorial === "run"
          ? this.runButton
          : this.cells.find((b) => b.dataset.kind === "machine");
    target?.setAttribute("data-tutorial-focus", "true");
    this.overlay.dataset.tutorialStatic = String(!fxEnabled());
  }

  private buildTutorial(): void {
    if (this.tutorial === "done") return;
    const panel = h("div", { class: "ws-guide", "aria-live": "polite" });
    panel.append(h("span", { class: "ws-guide-text" }));
    const skip = h("button", { type: "button", class: "ws-guide-skip" }, "スキップ");
    skip.addEventListener("click", () => this.tutorialEvent("skip"));
    panel.append(skip);
    this.overlay.append(panel);
    this.tutorialPanel = panel;
    this.renderTutorial();
  }

  private say(text: string, error = false): void {
    if (error) playSfx("error");
    this.status.textContent = text;
    this.status.classList.toggle("ws-error", error);
  }

  // ---- canvas 描画 ------------------------------------------------------

  private cellXY(p: Point): { x: number; y: number } {
    return { x: this.gridX + p.x * this.cell, y: this.gridY + p.y * this.cell };
  }

  private redraw(): void {
    const g = this.gfx;
    const { width, height } = this.rules;
    g.clear();
    for (const t of this.tiles) t.destroy();
    this.tiles = [];
    // 画像は TILE(14px) 基準なので、盤面の cell（縦持ちで変わる）に合わせて伸縮する
    const put = (key: string, p: Point): void => {
      const { x, y } = this.cellXY(p);
      this.tiles.push(
        this.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(this.cell, this.cell).setDepth(1),
      );
    };
    // 床（木板ではなく暗い床タイル。グリッドは薄い線）
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) put("ae-floor", { x, y });
    // グリッド線・外枠・台座・カーソル枠は DOM(workshop.css .ws-grid / .ws-cell)で描く(#101: px 指定値を正確に出すため)

    for (const r of this.rules.reserved) {
      const { x, y } = this.cellXY(r.pos);
      if (r.kind === "blocked") {
        put("ae-blocked", r.pos);
        continue;
      }
      // 入口/出口: 色（ミント=入口/ピンク=出口）+ 矢印のみ。文字は右パネルの注文票に出す（#112 方針c）
      put(portTexture(this.textures, r.kind), r.pos);
      this.arrow(x, y, r.dir ?? "E", COLOR.floor);
    }

    for (const p of this.placements) {
      const { x, y } = this.cellXY(p.pos);
      const running = this.playing && p.machine !== "belt";
      put(
        running
          ? activeTexture(this.textures, p.machine, (this.playing?.frame ?? 0) % 2 === 0 ? 0 : 1)
          : `ae-${p.machine}`,
        p.pos,
      );
      this.arrow(x, y, p.dir, COLOR.arrow);
      // 仕分け機は右下に音高の色の点（ド・ミ・ソ = 音符と同じ色）
      if (p.config) {
        g.fillStyle(0x140f18, 1);
        g.fillRect(x + CELL - 5, y + CELL - 5, 5, 5);
        g.fillStyle(NOTE_COLOR[p.config.pitch], 1);
        const d = Math.round((3 * this.cell) / CELL);
        g.fillRect(x + this.cell - d - 1, y + this.cell - d - 1, d, d);
      }
    }

    const frame = this.playing?.ex.frames[this.playing.frame];
    if (frame) this.drawNotes(frame);
  }

  /** その tick の音符をマスの中央に置く（移動の補間なし＝最小の再生）。長い音は大きめ。 */
  private drawNotes(frame: SimState): void {
    const { width } = this.rules;
    for (const c of frame.cells) {
      const { x, y } = this.cellXY({ x: c.key % width, y: Math.floor(c.key / width) });
      const key = noteTexture(
        this.textures,
        c.note.length === 1 ? "short" : "long",
        NOTE_COLOR[c.note.pitch],
      );
      this.tiles.push(
        this.add
          .image(x + 2, y + 2, key)
          .setOrigin(0, 0)
          .setDepth(6), // gfx（矢印）depth 5 より上。scene-fx front(10) より下
      );
    }
  }

  /** マスの中央に向きの三角を描く。 */
  private arrow(x: number, y: number, dir: Dir, color: number): void {
    const c = { x: x + this.cell / 2 + 0.5, y: y + this.cell / 2 + 0.5 };
    const s = Math.round((4 * this.cell) / CELL);
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
    if (this.portrait) ov.classList.add("ws-portrait");
    document.body.dataset.layout = this.portrait ? "portrait" : "landscape";
    this.overlay = ov;
    this.eraseMode = false;

    // 棚（左）
    const shelf = h("section", { class: "ws-shelf", "aria-label": "パーツ棚" });
    shelf.append(h("h2", {}, "棚"));
    // 縦持ちでは palette（機械）が横スクロール、actions（向き・音高・消す…）が操作の列になる。横持ちは従来どおり縦に並ぶ（display: contents）
    const palette = h("div", { class: "ws-palette", role: "group", "aria-label": "機械を選ぶ" });
    const actions = h("div", { class: "ws-actions", role: "group", "aria-label": "操作" });
    shelf.append(palette, actions);
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
      b.append(
        iconCanvas(id),
        h("span", { class: "ws-tool-name" }, MACHINE_NAME[id]),
        h("span", { class: "ws-tool-cost ae-footnote" }, `${cost}G`),
      );
      b.addEventListener("click", () => {
        this.selected = id;
        this.refreshOverlay();
      });
      palette.append(b);
    }
    this.dirButton = h("button", { type: "button", class: "ws-btn" });
    this.dirButton.addEventListener("click", () => this.rotate(null));
    actions.append(this.dirButton);
    this.pitchButton = h("button", { type: "button", class: "ws-btn ws-pitch" });
    this.pitchButton.addEventListener("click", () => this.cyclePitch(null));
    actions.append(this.pitchButton);
    // 縦持ち専用: 長押し・右クリックの代わりに「消すモード」。入っている間はマスのタップで消す
    this.eraseButton = h("button", {
      type: "button",
      class: "ws-btn ws-erase",
      "aria-pressed": "false",
      "aria-label": "消すモード（入れるとマスをタップして機械を消す）",
    });
    this.eraseButton.textContent = "消す";
    this.eraseButton.addEventListener("click", () => {
      this.eraseMode = !this.eraseMode;
      this.refreshOverlay();
    });
    actions.append(this.eraseButton);
    // ミュートボタン (audio.ts の共有設定を使用)
    this.muteButton = h("button", {
      type: "button",
      class: "ws-btn",
      "aria-label": isAudioEnabled() ? "音を切る" : "音をオンにする",
    });
    this.setMuteLabel(isAudioEnabled());
    this.muteButton.addEventListener("click", () => this.toggleMute());
    actions.append(this.muteButton);
    // スライダーでの自動ミュート解除など、このボタン以外で音のオン/オフが変わっても表示を合わせる
    this.unsubSound = onSoundToggle((on) => this.syncMuteButton(on));

    // 全消しは棚から外し、盤面の右下に置く（#94）。押すと確認を出す
    const clear = h(
      "button",
      { type: "button", class: "ws-btn ws-clear", "aria-label": "配置を全部消す" },
      "全消し",
    );
    const confirm = h("div", {
      class: "ws-confirm",
      role: "alertdialog",
      "aria-label": "全消しの確認",
      hidden: "",
    });
    const yes = h("button", { type: "button", class: "ws-btn ws-danger" }, "はい");
    const no = h("button", { type: "button", class: "ws-btn" }, "やめる");
    confirm.append(h("p", {}, "全部消します。よろしいですか？"), yes, no);
    clear.addEventListener("click", () => {
      if (this.playing || this.placements.length === 0) return;
      confirm.hidden = false;
      no.focus();
    });
    yes.addEventListener("click", () => {
      confirm.hidden = true;
      this.clearAll();
      clear.focus();
    });
    no.addEventListener("click", () => {
      confirm.hidden = true;
      clear.focus();
    });
    actions.append(clear);
    ov.append(shelf, confirm);

    // グリッド（中央）
    const grid = h("div", {
      class: "ws-grid",
      role: "group",
      "aria-label": `工房 ${this.rules.width}×${this.rules.height}（${isHoverNone() ? "タップで置く・置いた機械をタップで回す" : "クリックで置く・R で回す"}・P か Shift+クリックで仕分け機の音高・右クリックか Delete で消す）`,
    });
    grid.style.setProperty("--cols", String(this.rules.width));
    grid.style.setProperty("--rows", String(this.rules.height));
    this.cells = [];
    for (let y = 0; y < this.rules.height; y++) {
      for (let x = 0; x < this.rules.width; x++) {
        const pos = { x, y };
        const b = h("button", { type: "button", class: "ws-cell", tabindex: "-1" });
        let tapType: string | undefined; // 直近の pointerdown の入力種別（キーボード由来の click では undefined）
        b.addEventListener("click", (e) => {
          if (e.shiftKey) this.cyclePitch(pos);
          else if (this.eraseMode) this.removeAtPos(pos);
          else if (
            shouldRotateOnTap(
              tapType,
              placementAt(this.placements, pos),
              this.selected,
              this.nextPitchValue,
            )
          ) {
            this.rotate(pos);
          } else this.placeAt(pos);
          tapType = undefined;
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
        b.addEventListener("pointerdown", (e) => {
          tapType = e.pointerType;
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
    const body = h("div", { class: "ws-order-body" });
    card.append(body);
    body.append(h("h2", {}, this.order.title));
    const intro = this.order.texts["intro"];
    if (this.order.client) {
      body.append(h("p", { class: "ws-client" }, `依頼人: ${this.order.client.name}`));
    }
    if (typeof intro === "string") body.append(multiLine(intro, "ws-intro"));
    // Issue #48: tutorial 文を表示
    const tutorial = this.order.texts["tutorial"];
    if (typeof tutorial === "string") {
      const p = multiLine(tutorial, "ws-tutorial");
      p.setAttribute(
        "style",
        "font-size: 16px; line-height: 24px; color: var(--ae-text-weak); margin: 8px 0;",
      );
      body.append(p);
    }
    const list = h("ul", {});
    // Issue #49: 座標文字は出さず、マス目上の入口・出口の記号（矢印）で示す
    for (const i of this.order.inputs)
      list.append(h("li", {}, `入口 ${i.id} ${DIR_ARROW[i.dir]}（${DIR_NAME[i.dir]}へ出す）`));
    for (const o of this.order.outputs)
      list.append(h("li", {}, `出口 ${o.id} ${DIR_ARROW[o.dir]}（${DIR_NAME[o.dir]}向き）`));
    body.append(list);
    this.costText = h("p", { "aria-label": "配置の合計" });
    // 実行中は同じ位置（実行ボタンの直上）に「実行中…(tick n)」を出す。配置の合計は実行中は隠す
    this.runStatus = h("p", { class: "ws-run-status", "aria-hidden": "true" });
    this.runStatus.hidden = true;
    // 合計と実行中表示は注文票の下端に固定（入口・出口が長くても見える。#136）
    const total = h("div", { class: "ws-order-total" });
    total.append(this.costText, this.runStatus);
    body.append(total);
    this.runButton = h("button", { type: "button", class: "ws-btn ws-run" });
    this.runButton.addEventListener("click", () => this.runSim());
    card.append(this.runButton);
    ov.append(card);

    // 直前の操作（読み上げにも流す）
    this.status = h("p", { class: "ws-status", role: "status", "aria-live": "polite" });
    ov.append(this.status);

    // Issue #48: 操作説明の常時1行
    const helpLine = h("p", {
      class: "ws-help-line",
      style: this.portrait
        ? "color: var(--ae-text-muted);"
        : "font-size: 16px; line-height: 24px; color: var(--ae-text-muted); text-align: center; margin: 4px auto; max-width: 560px;",
    });
    helpLine.textContent = this.portrait
      ? "タップ=置く／消すボタン=消す／向きボタン=向き"
      : "置く=クリック / 向き=R / 音高=P か Shift+クリック / 消す=右クリック";
    ov.append(helpLine);
    this.tutorialPanel = null;

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
    this.tutorialPanel = null;
    this.buildTutorial();
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
    this.eraseButton.setAttribute("aria-pressed", String(this.eraseMode));
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
    this.runStatus.hidden = !running;
    this.costText.hidden = running;
    for (const b of this.overlay.querySelectorAll<HTMLButtonElement>(".ws-shelf .ws-btn")) {
      b.disabled = running;
    }
    this.cells.forEach((b) => b.setAttribute("aria-disabled", String(running)));
    this.renderTutorial();
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
    s.setProperty("--u", `${c.width / this.scale.width}px`);
    s.setProperty("--grid-y-px", `${this.gridY}px`);
    s.setProperty("--grid-h-px", `${this.rules.height * this.cell}px`);
    s.setProperty("--grid-x", `${(this.gridX / this.scale.width) * 100}%`);
    s.setProperty("--grid-y", `${(this.gridY / this.scale.height) * 100}%`);
    s.setProperty("--grid-w", `${((this.rules.width * this.cell) / this.scale.width) * 100}%`);
    s.setProperty("--grid-h", `${((this.rules.height * this.cell) / this.scale.height) * 100}%`);
  }

  /** 音ボタン: ドット絵のスピーカー + 『音: ON/OFF』（絵文字・色だけに頼らない）。 */
  private setMuteLabel(enabled: boolean): void {
    this.muteButton.replaceChildren(
      iconCanvas(enabled ? "speaker-on" : "speaker-off"),
      document.createTextNode(enabled ? "音: ON" : "音: OFF"),
    );
  }

  private toggleMute(): void {
    const enabled = toggleSound();
    this.setMuteLabel(enabled);
    this.muteButton.setAttribute("aria-label", enabled ? "音を切る" : "音をオンにする");
    this.say(enabled ? "音をオンにした" : "音を切った");
  }

  private syncMuteButton(enabled: boolean): void {
    this.setMuteLabel(enabled);
    this.muteButton.setAttribute("aria-label", enabled ? "音を切る" : "音をオンにする");
  }

  private teardown(): void {
    this.unsubSound?.();
    this.unsubSound = null;
    this.playing?.timer.remove();
    this.playing = null;
    duckBgm(false);
    setQaBusy("play", false);
    setQaBusy("fade", false);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    window.removeEventListener("resize", this.onResize);
    this.overlay.remove();
    this.cells = [];
    this.tiles = [];
    // 次の画面（タイトル・結果）は 320×180 前提。縦持ちで変えた canvas の大きさを戻す
    if (this.scale.width !== GAME_WIDTH || this.scale.height !== GAME_HEIGHT) {
      this.scale.setGameSize(GAME_WIDTH, GAME_HEIGHT);
    }
    delete document.body.dataset.layout;
  }
}
