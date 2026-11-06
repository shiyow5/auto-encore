/**
 * Auto Encore のシミュレーション（review-e-tech.md (b)(c)、spec-e-mvp.md v0.3 §2〜§4）。
 *
 * 1 tick の順番（前の状態 S を読み、新しい状態 S' を作る。S は書き換えない）:
 *   1. 移動の希望: 盤上の各音符と、出す番の入口が行き先のマスを1つ出す
 *   2. 取り合い: 同じマスに複数来たら受け側の規則で1つに決める（負けた側は待つ）
 *   3. 下流から解決: 行き先が空いている、または行き先の音符も今 tick で動けるなら成功。
 *      動く音符だけで一周するループは全員成功
 *   4. 書き込み: 成功した移動をまとめて反映。出口は受けた音符を順に記録
 *   5. 停止判定: completed / stuck / loop / maxTicks
 *
 * tick の数え方: 初期状態が tick 0。step() を1回呼ぶと tick 1。入口は tick 1 に最初の1音を出す。
 * 速度 = 全出口が期待数を受けた tick。
 *
 * 対応機械: ベルト・仕分け機・合流機・調律機・回収箱。
 *
 * 回収箱（bin, Issue #41）: 後ろから受けた音符をその tick で消す。マスに音符は残らないので
 * 詰まらず、いつでも受ける。消した音符は出口に届いていないので正確さには数えない。
 *
 * 調律機（processTicks 2）: 入った tick を t とすると t+2 に前へ出る。出るときに音高を1段上げる
 * （ド→ミ→ソ→ド）。処理中・出口詰まり中は次を受けない（中の音符が動けないので後ろは待つ）。
 * 中の音符が出る tick には、後ろの音符が同じ tick に入れる（ベルトと同じ）。
 *
 * 合流機の交互（Issue #3）: 同じ tick に左右から来たら、前回通した側の反対を通す（初回は左）。
 * 「前回」は同時のときだけでなく、片側だけで通ったときも含めて直前に通した側で決める。
 * 片方だけ来たらその tick で通す（相手を待たない）。片側が尽きたら残りはそのまま流れる。
 */
import { DIRS, DIR_VEC, opposite, step as stepPoint, type Dir, type Point } from "../grid";
import { MAX_TICKS_CAP, totalCost } from "./load";
import { stableStringify, stateHash } from "./hash";
import type {
  MachineDef,
  MachineTable,
  Note,
  Order,
  Pitch,
  Placement,
  Side,
  SimResult,
  StopReason,
} from "./types";

// ---------- 状態（素の JSON。複製・ハッシュ・保存ができる形） ----------

export interface SimNote extends Note {
  /** 出た順の連番（同じ tick なら入口の並び順）。 */
  readonly id: number;
}

/** 盤上の1マスにいる音符。マスのキーは y * width + x。 */
export interface CellNote {
  readonly key: number;
  readonly note: SimNote;
  /** 調律機の処理の残り tick（0 なら出られる）。0 のときは載せない（ハッシュを変えないため）。 */
  readonly wait?: number;
}

export interface InputState {
  /** 次に出す音符の番号（notes の添字）。 */
  readonly next: number;
  /** 次を出せるまでの残り tick（0 なら今 tick 出せる）。 */
  readonly wait: number;
}

export interface OutputState {
  readonly received: readonly SimNote[];
}

export interface SimState {
  readonly tick: number;
  readonly nextNoteId: number;
  /** key 昇順。1マスに音符は1つまで。 */
  readonly cells: readonly CellNote[];
  /** order.inputs と同じ並び。 */
  readonly inputs: readonly InputState[];
  /** order.outputs と同じ並び。 */
  readonly outputs: readonly OutputState[];
  /**
   * 合流機ごとの直前に通した側（key 昇順。まだ何も通していない合流機は載せない）。
   * 合流機の無い盤では undefined（ハッシュを変えないため）。
   */
  readonly mergers?: readonly MergerState[];
}

export interface MergerState {
  readonly key: number;
  readonly last: MergeSide;
}

export type MergeSide = "left" | "right";

// ---------- 盤（注文＋配置から作る、変わらない部分） ----------

interface PlacedMachine {
  readonly placement: Placement;
  readonly def: MachineDef;
}

interface Port {
  readonly kind: "input" | "output";
  readonly index: number;
}

export interface World {
  readonly order: Order;
  readonly machines: MachineTable;
  readonly placements: readonly Placement[];
  readonly width: number;
  readonly height: number;
  /** key → 機械。 */
  readonly machineAt: ReadonlyMap<number, PlacedMachine>;
  /** key → 入口・出口。 */
  readonly portAt: ReadonlyMap<number, Port>;
  readonly maxTicks: number;
}

const SUPPORTED: ReadonlySet<string> = new Set(["belt", "sorter", "merger", "tuner", "bin"]);

/** 配置は validatePlacements（load.ts）を通したものを渡す前提。 */
export function buildWorld(
  order: Order,
  placements: readonly Placement[],
  machines: MachineTable,
): World {
  const { width, height } = order.board;
  const key = (p: Point): number => p.y * width + p.x;
  const machineAt = new Map<number, PlacedMachine>();
  for (const p of placements) {
    if (!SUPPORTED.has(p.machine)) throw new Error(`未対応の機械: ${p.machine}`);
    machineAt.set(key(p.pos), { placement: p, def: machines[p.machine] });
  }
  const portAt = new Map<number, Port>();
  order.inputs.forEach((_, index) =>
    portAt.set(key(order.inputs[index]!.pos), { kind: "input", index }),
  );
  order.outputs.forEach((_, index) =>
    portAt.set(key(order.outputs[index]!.pos), { kind: "output", index }),
  );
  return {
    order,
    machines,
    placements,
    width,
    height,
    machineAt,
    portAt,
    maxTicks: Math.min(order.limits.maxTicks, MAX_TICKS_CAP),
  };
}

export function initialState(world: World): SimState {
  return {
    tick: 0,
    nextNoteId: 0,
    cells: [],
    inputs: world.order.inputs.map(() => ({ next: 0, wait: 0 })),
    outputs: world.order.outputs.map(() => ({ received: [] })),
    mergers: hasMerger(world) ? [] : undefined,
  };
}

function hasMerger(world: World): boolean {
  for (const m of world.machineAt.values()) if (m.def.id === "merger") return true;
  return false;
}

// ---------- 向き ----------

/** 向き d の機械から見て、絶対方向 abs はどの辺か。 */
export function sideOf(d: Dir, abs: Dir): Side {
  const diff = (DIRS.indexOf(abs) - DIRS.indexOf(d) + 4) % 4;
  return (["front", "right", "back", "left"] as const)[diff]!;
}

/** 向き d の機械の辺 side は、絶対方向でどちらか。 */
export function absOf(d: Dir, side: Side): Dir {
  const off = { front: 0, right: 1, back: 2, left: 3 }[side];
  return DIRS[(DIRS.indexOf(d) + off) % 4]!;
}

/** p から q（隣）への絶対方向。 */
function dirBetween(p: Point, q: Point): Dir {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const d = DIRS.find((k) => DIR_VEC[k].x === dx && DIR_VEC[k].y === dy);
  if (!d) throw new Error(`not adjacent: ${p.x},${p.y} → ${q.x},${q.y}`);
  return d;
}

// ---------- 1 tick ----------

/** 音高を1段上げる（ド→ミ→ソ→ド）。 */
export function tuneUp(p: Pitch): Pitch {
  return ((p + 1) % 3) as Pitch;
}

/** 移動の希望。from が -1 のときは入口 input から出る音符。 */
interface Move {
  readonly from: number;
  /** 出る元のマス（入口なら入口の位置）。 */
  readonly fromP: Point;
  readonly to: number;
  readonly note: SimNote;
  readonly input?: number;
}

function pointOf(world: World, key: number): Point {
  return { x: key % world.width, y: Math.floor(key / world.width) };
}

function inBounds(world: World, p: Point): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < world.width && p.y < world.height;
}

/**
 * 音符が今いる機械から出たい絶対方向。
 * 仕分け機は設定音高に一致→前、不一致→右。行き先が詰まっても逃がさず待つ（spec-e v0.3 §2）。
 */
function emitDir(m: PlacedMachine, note: Note): Dir {
  if (m.def.id === "sorter") {
    const pitch = m.placement.config?.pitch;
    if (pitch === undefined)
      throw new Error("仕分け機に config.pitch が無い（validatePlacements を通すこと）");
    return absOf(m.placement.dir, note.pitch === pitch ? "front" : "right");
  }
  return absOf(m.placement.dir, "front");
}

/**
 * from（隣）から to のマスへ入れるか（取り合い・空き具合は見ない、受け口の向きだけ）。
 * 出口は dir の反対側の隣から受け、期待数に達していたら受けない。
 */
function canEnter(world: World, s: SimState, fromP: Point, to: number): boolean {
  const toP = pointOf(world, to);
  const m = world.machineAt.get(to);
  if (m) {
    const side = sideOf(m.placement.dir, dirBetween(toP, fromP));
    return m.def.accepts.includes(side);
  }
  const port = world.portAt.get(to);
  if (port?.kind === "output") {
    const out = world.order.outputs[port.index]!;
    if (s.outputs[port.index]!.received.length >= out.expect.length) return false;
    const back = stepPoint(toP, opposite(out.dir));
    return back.x === fromP.x && back.y === fromP.y;
  }
  return false;
}

function wantedMoves(world: World, s: SimState): Move[] {
  const moves: Move[] = [];
  for (const c of s.cells) {
    const m = world.machineAt.get(c.key);
    if (!m) throw new Error(`機械の無いマスに音符がある: ${c.key}`);
    if ((c.wait ?? 0) > 0) continue; // 調律機の処理中
    const p = pointOf(world, c.key);
    const q = stepPoint(p, emitDir(m, c.note));
    if (!inBounds(world, q)) continue;
    const to = q.y * world.width + q.x;
    if (canEnter(world, s, p, to)) moves.push({ from: c.key, fromP: p, to, note: c.note });
  }
  let nextId = s.nextNoteId;
  world.order.inputs.forEach((inp, i) => {
    const st = s.inputs[i]!;
    if (st.wait > 0 || st.next >= inp.notes.length) return;
    const q = stepPoint(inp.pos, inp.dir);
    if (!inBounds(world, q)) return;
    const to = q.y * world.width + q.x;
    if (!canEnter(world, s, inp.pos, to)) return;
    const n = inp.notes[st.next]!;
    // 音符 ID は実際に出られたときだけ確定させる（下の解決で失敗したら捨てる）。
    moves.push({
      from: -1,
      fromP: inp.pos,
      to,
      note: { id: nextId++, pitch: n.pitch, length: n.length },
      input: i,
    });
  });
  return moves;
}

/** 合流機 m に fromP から入るとき、どちらの辺から入るか。 */
function mergeSideOf(world: World, m: PlacedMachine, to: number, fromP: Point): MergeSide {
  const side = sideOf(m.placement.dir, dirBetween(pointOf(world, to), fromP));
  if (side !== "left" && side !== "right") throw new Error(`合流機の受け口ではない辺: ${side}`);
  return side;
}

/** 合流機 key が次に同時になったとき優先する側。前回の反対、初回は左。 */
function mergerPriority(s: SimState, key: number): MergeSide {
  const last = s.mergers?.find((g) => g.key === key)?.last;
  return last === "left" ? "right" : "left";
}

/**
 * 同じ行き先に複数来たら1つに決める。負けた側はその場で待つ。
 * 複数来うるのは合流機（左・右）だけ。ベルト・仕分け機・調律機・出口は受け口が1つなので起きない。
 */
function arbitrate(world: World, s: SimState, moves: Move[]): Move[] {
  const byTo = new Map<number, Move[]>();
  for (const mv of moves) {
    const list = byTo.get(mv.to);
    if (list) list.push(mv);
    else byTo.set(mv.to, [mv]);
  }
  const winners: Move[] = [];
  for (const mv of moves) {
    const list = byTo.get(mv.to)!;
    if (list.length === 1) {
      winners.push(mv);
      continue;
    }
    if (list[0] !== mv) continue;
    const m = world.machineAt.get(mv.to);
    if (m?.def.arbitration !== "alternate")
      throw new Error(`同じマスへの取り合い（受け口が1つのはず）: ${mv.to}`);
    const want = mergerPriority(s, mv.to);
    const win = list.find((x) => mergeSideOf(world, m, mv.to, x.fromP) === want);
    if (!win) throw new Error(`合流機に同じ辺から2つ来た: ${mv.to}`);
    winners.push(win);
  }
  return winners;
}

/** 下流から解決。行き先が空き、出口、または行き先の音符も動けるなら成功。一周するループは全員成功。 */
function resolve(world: World, s: SimState, moves: Move[]): Move[] {
  const occupied = new Set(s.cells.map((c) => c.key));
  const fromCell = new Map<number, Move>();
  for (const mv of moves) if (mv.from >= 0) fromCell.set(mv.from, mv);
  const memo = new Map<Move, "visiting" | boolean>();

  const ok = (mv: Move): boolean => {
    const known = memo.get(mv);
    if (known === "visiting") return true; // ループ: 全員で回る
    if (known !== undefined) return known;
    memo.set(mv, "visiting");
    let result: boolean;
    if (world.portAt.get(mv.to)?.kind === "output" || !occupied.has(mv.to)) result = true;
    else {
      const ahead = fromCell.get(mv.to);
      result = ahead !== undefined && ok(ahead);
    }
    memo.set(mv, result);
    return result;
  };
  return moves.filter(ok);
}

/** 1 tick 進めた新しい状態を返す（s は変えない）。 */
export function step(world: World, s: SimState): SimState {
  const moves = resolve(world, s, arbitrate(world, s, wantedMoves(world, s)));

  const moved = new Set<number>();
  const cells = new Map<number, SimNote>();
  const waits = new Map<number, number>();
  for (const c of s.cells) {
    cells.set(c.key, c.note);
    // 動かなかった音符の処理は1 tick 進む（今 tick に動く音符は下で消える）
    if ((c.wait ?? 0) > 1) waits.set(c.key, c.wait! - 1);
  }
  const received = s.outputs.map((o) => o.received.slice());
  const inputs = s.inputs.map((st) => ({ ...st, wait: Math.max(0, st.wait - 1) }));
  let nextNoteId = s.nextNoteId;

  // 入口の音符 ID は、成功した入口だけで入口の並び順に振り直す（失敗した入口に番号を使わない）。
  const ordered = moves.slice().sort((a, b) => (a.input ?? -1) - (b.input ?? -1));
  for (const mv of ordered) {
    let note = mv.note;
    if (mv.input !== undefined) {
      note = { ...note, id: nextNoteId++ };
      const inp = world.order.inputs[mv.input]!;
      inputs[mv.input] = { next: inputs[mv.input]!.next + 1, wait: inp.interval - 1 };
    } else {
      moved.add(mv.from);
      // 調律機は出るときに音高を1段上げる（ド→ミ→ソ→ド）
      if (world.machineAt.get(mv.from)?.def.id === "tuner")
        note = { ...note, pitch: tuneUp(note.pitch) };
    }
    const port = world.portAt.get(mv.to);
    if (port?.kind === "output") received[port.index]!.push(note);
    else if (world.machineAt.get(mv.to)?.def.id === "bin") {
      // 回収箱: 入った音符は消える（マスに載せない）
    } else {
      cells.set(mv.to, note);
      // 入った tick を数えて processTicks 後に出られる。残り = processTicks - 1（0 なら載せない）
      const hold = world.machineAt.get(mv.to)!.def.processTicks - 1;
      if (hold > 0) waits.set(mv.to, hold);
      else waits.delete(mv.to);
    }
  }
  // 動いた元のマスを空ける（ただし今 tick に別の音符が入ったマスは残す）。
  const entered = new Set(
    moves.filter((m) => world.portAt.get(m.to)?.kind !== "output").map((m) => m.to),
  );
  for (const k of moved) if (!entered.has(k)) cells.delete(k);

  // 合流機: 実際に通した側を「前回」として残す（同時かどうかに関わらず）。
  let mergers = s.mergers;
  if (mergers !== undefined) {
    const last = new Map(mergers.map((g) => [g.key, g.last] as const));
    for (const mv of moves) {
      const m = world.machineAt.get(mv.to);
      if (m?.def.id === "merger") last.set(mv.to, mergeSideOf(world, m, mv.to, mv.fromP));
    }
    mergers = [...last.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([key, side]) => ({ key, last: side }));
  }

  return {
    tick: s.tick + 1,
    nextNoteId,
    cells: [...cells.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([key, note]) =>
        waits.has(key) ? { key, note, wait: waits.get(key)! } : { key, note },
      ),
    inputs,
    outputs: received.map((r) => ({ received: r })),
    mergers,
  };
}

// ---------- 停止判定と結果 ----------

function isComplete(world: World, s: SimState): boolean {
  return world.order.outputs.every((o, i) => s.outputs[i]!.received.length >= o.expect.length);
}

/** tick を除いた状態（詰まり・ループの比較用）。 */
function shape(s: SimState): string {
  return stableStringify({ ...s, tick: 0 });
}

/** 出口が受けた数と入口が出した数の合計。増えたら「進んだ」とみなす。 */
function progress(s: SimState): number {
  let n = 0;
  for (const o of s.outputs) n += o.received.length;
  for (const i of s.inputs) n += i.next;
  return n;
}

export interface Score {
  readonly matched: number;
  readonly total: number;
  readonly firstMismatch: number | null;
}

/** 正確さ: 全出口の位置一致数 ÷ 期待数の合計。出口は ID 昇順に並べて数える。 */
export function scoreAccuracy(world: World, s: SimState): Score {
  const idx = world.order.outputs
    .map((o, i) => ({ id: o.id, i }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let matched = 0;
  let total = 0;
  let firstMismatch: number | null = null;
  for (const { i } of idx) {
    const expect = world.order.outputs[i]!.expect;
    const got = s.outputs[i]!.received;
    expect.forEach((e, j) => {
      total++;
      const g = got[j];
      if (g && g.pitch === e.pitch && g.length === e.length) matched++;
      else if (firstMismatch === null) firstMismatch = total;
    });
  }
  return { matched, total, firstMismatch };
}

export interface RunOptions {
  /** true なら全 tick の状態を frames に入れる（画面の再生用）。 */
  readonly recordFrames?: boolean;
  /** 途中の状態から回す（テスト用）。省略時は initialState。 */
  readonly start?: SimState;
}

export interface RunOutput {
  readonly result: SimResult;
  /** frames[0] が初期状態、frames[t] が tick t の状態。recordFrames のときだけ。 */
  readonly frames: readonly SimState[];
  readonly final: SimState;
}

/** 止まるまで回す。止まる理由は completed / stuck / loop / maxTicks のどれか。 */
export function run(world: World, opts: RunOptions = {}): RunOutput {
  let s = opts.start ?? initialState(world);
  const frames: SimState[] = opts.recordFrames ? [s] : [];
  let prevShape = shape(s);
  let seen = new Map<string, number>([[prevShape, s.tick]]);
  let lastProgress = progress(s);
  let reason: StopReason;

  for (;;) {
    s = step(world, s);
    if (opts.recordFrames) frames.push(s);
    if (isComplete(world, s)) {
      reason = "completed";
      break;
    }
    const sh = shape(s);
    if (sh === prevShape) {
      reason = "stuck";
      break;
    }
    const p = progress(s);
    if (p !== lastProgress) {
      lastProgress = p;
      seen = new Map();
    } else if (seen.has(sh)) {
      reason = "loop";
      break;
    }
    seen.set(sh, s.tick);
    prevShape = sh;
    if (s.tick >= world.maxTicks) {
      reason = "maxTicks";
      break;
    }
  }

  const sc = scoreAccuracy(world, s);
  const result: SimResult = {
    result: reason,
    ticks: reason === "completed" ? s.tick : null,
    matched: sc.matched,
    total: sc.total,
    cost: totalCost(world.placements, world.order, world.machines),
    firstMismatch: sc.firstMismatch,
    finalHash: stateHash(s),
  };
  return { result, frames, final: s };
}

/** 整数 %（切り捨て）。閾値との比較は matched*100 >= 閾値*total で行うこと。 */
export function accuracyPercent(r: Pick<SimResult, "matched" | "total">): number {
  return r.total === 0 ? 0 : Math.floor((r.matched * 100) / r.total);
}

/** 注文と配置から結果まで（画面の「実行」ボタン用）。 */
export function simulate(
  order: Order,
  placements: readonly Placement[],
  machines: MachineTable,
  opts: RunOptions = {},
): RunOutput {
  return run(buildWorld(order, placements, machines), opts);
}
