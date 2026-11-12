/**
 * 工房の「実行」（dev-plan-v3 §3 K4）。画面から core を呼ぶ薄い層。
 *
 * - simulate()（中で step() を止まるまで回す）→ score()（S3 の measure → judge）
 * - 画面に出す文（3指標・止まった理由・メダル）もここで作る（Phaser に依存しないのでユニットテストできる）
 * - binEvents: tick ごとの bin 入り音符（音出し用）。frames[t] の音符が tick t に bin に入ったもの。
 * - throughputSeries: tick ごとの「出口に届いた音符の累計」（結果画面のグラフ用）。
 */
import { score, type Medal, type ScoreReport } from "../../core/score";
import { simulate, type SimState } from "../../core/sim/sim";
import { validatePlacements } from "../../core/sim/load";
import type { MachineTable, Order, Placement, Solution, StopReason } from "../../core/sim/types";

export interface BinEvent {
  /** tick 番号。 */
  readonly tick: number;
  /** bin に入った音符の pitch (0=do, 1=mi, 2=so)。 */
  readonly pitch: number;
}

export interface Execution {
  readonly report: ScoreReport;
  /** frames[0] が初期状態、frames[t] が tick t。ベルト上の音符の再描画に使う。 */
  readonly frames: readonly SimState[];
  readonly finalHash: string;
  /** tick ごとの bin 入り音符。frames[t] が tick t の音符を bin に入れたもの（tick 1 以上）。 */
  readonly binEvents: readonly BinEvent[];
}

/** プレイヤーの配置を Solution の形にする（保存・採点で共通の形）。 */
export function toSolution(order: Order, placements: readonly Placement[]): Solution {
  return { schemaVersion: 1, orderId: order.id, name: "player", placements: [...placements] };
}

/** 配置を検証して、止まるまで回して、採点する。配置が置けない形なら DataError を投げる。 */
export function execute(
  order: Order,
  machines: MachineTable,
  placements: readonly Placement[],
): Execution {
  validatePlacements(placements, order);
  const out = simulate(order, placements, machines, { recordFrames: true });
  const report = score(out.result, order, toSolution(order, placements));
  const binEvents = computeBinEvents(out.frames);
  return { report, frames: out.frames, finalHash: out.result.finalHash, binEvents };
}

/** frames[t-1] から frames[t] への差分で、tick t に bin に入った音符を特定する。 */
function computeBinEvents(frames: readonly SimState[]): BinEvent[] {
  const events: BinEvent[] = [];
  for (let t = 1; t < frames.length; t++) {
    const prev = frames[t - 1]!;
    const curr = frames[t]!;
    const currKeys = new Set(curr.cells.map((c) => c.key));

    // output に入った音符の id 集合（outputs[].received の差分）
    const outputIds = new Set<number>();
    for (let i = 0; i < curr.outputs.length; i++) {
      const prevR = prev.outputs[i]!.received;
      const currR = curr.outputs[i]!.received;
      // 新規に追加された音符（received は push で追加される順序）
      for (let j = prevR.length; j < currR.length; j++) {
        outputIds.add(currR[j]!.id);
      }
    }

    // cells から消えた音符で、output に入らなかったもの = bin に入った
    const lost = prev.cells.filter((c) => !currKeys.has(c.key) && !outputIds.has(c.note.id));
    for (const note of lost) {
      events.push({ tick: t, pitch: note.note.pitch });
    }
  }
  return events;
}

/** 結果画面のグラフの1点。value は tick 時点で全出口に届いた音符の累計。 */
export interface ThroughputPoint {
  readonly tick: number;
  readonly value: number;
}

/** frames から tick ごとの「出口に届いた音符の累計」を作る（frames[0] は tick 0 で 0 個）。 */
export function throughputSeries(frames: readonly SimState[]): ThroughputPoint[] {
  return frames.map((f) => ({
    tick: f.tick,
    value: f.outputs.reduce((sum, o) => sum + o.received.length, 0),
  }));
}

export const STOP_TEXT: Record<StopReason, string> = {
  completed: "完成",
  stuck: "詰まって止まった",
  loop: "同じ動きをくり返して止まった",
  maxTicks: "時間切れ",
};

export const MEDAL_TEXT: Record<Medal, string> = {
  gold: "金",
  silver: "銀",
  bronze: "銅",
  none: "—",
};

export interface MetricRow {
  readonly key: "accuracy" | "ticks" | "cost";
  readonly label: string;
  readonly value: string;
  readonly medal: Medal;
}

/** 結果画面の表の行（正確さ・速度・コスト）。 */
export function metricRows(r: ScoreReport): readonly MetricRow[] {
  const m = r.metrics;
  return [
    {
      key: "accuracy",
      label: "正確さ",
      value: `${m.accuracy}%（${m.matched}/${m.total}）`,
      medal: r.medals.accuracy,
    },
    {
      key: "ticks",
      label: "速度",
      value: m.ticks === null ? "— (未達)" : `${m.ticks} tick`,
      medal: r.medals.ticks,
    },
    { key: "cost", label: "コスト", value: `${m.cost}G`, medal: r.medals.cost },
  ];
}

const NEXT_MEDAL: Record<Exclude<Medal, "gold">, "bronze" | "silver" | "gold"> = {
  none: "bronze",
  bronze: "silver",
  silver: "gold",
};

/** 数字は基準内なのにメダルが付かない（正確さ未達で判定対象外）ときの説明。 */
const WRONG_ANSWER_HINT = "正解すると判定";

/**
 * 結果表のメダル列に出す「次の基準」1行（#120）。金なら「最高」。
 * 正確さは % が上がると、速度は tick・コストは G が下がると次のメダルに届く。
 * 速度が未達（完走せず）のときは数字の差を出せないので、銅の基準だけ伝える。
 */
export function nextMedalHint(order: Order, r: ScoreReport, key: MetricRow["key"]): string {
  const medal = r.medals[key];
  if (medal === "gold") return "最高";
  const target = NEXT_MEDAL[medal];
  const name = MEDAL_TEXT[target];
  const th = order.scoring[key];
  const goal = th[target];
  if (key === "accuracy") return `${name}まであと${goal - r.metrics.accuracy}%`;
  if (key === "ticks") {
    if (r.metrics.ticks === null) return `${name}は${goal}tick以内`;
    if (r.metrics.ticks <= goal) return WRONG_ANSWER_HINT;
    return `${name}まであと${r.metrics.ticks - goal}tick`;
  }
  if (r.metrics.cost <= goal) return WRONG_ANSWER_HINT;
  return `${name}まであと${r.metrics.cost - goal}G`;
}

export type Verdict = "encore" | "pass" | "fail";

export function verdictOf(r: ScoreReport): Verdict {
  if (r.encore) return "encore";
  return r.passed ? "pass" : "fail";
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  encore: "アンコール！",
  pass: "合格",
  fail: "もう一歩",
};

/** 注文 JSON の texts.result.{encore,pass,fail}。無ければ null。 */
export function verdictMessage(order: Order, v: Verdict): string | null {
  const t = order.texts["result"];
  if (typeof t !== "object" || t === null) return null;
  const msg = (t as Record<string, unknown>)[v];
  return typeof msg === "string" ? msg : null;
}

/**
 * 全注文クリア（#137）。最後の注文を合格し、その前の注文もすべて解放済み（＝クリア済み）のとき true。
 * 解放は前の注文の合格でしか進まないので、解放済み一覧から判定する。
 */
export function isAllCleared(
  orders: readonly Order[],
  clearedOrderId: string,
  passed: boolean,
  unlocked: readonly string[],
): boolean {
  if (!passed || orders.length === 0) return false;
  if (orders[orders.length - 1]!.id !== clearedOrderId) return false;
  return orders.every((o) => o.id === clearedOrderId || unlocked.includes(o.id));
}

/** 全クリア時の締めの一文（texts.result.allClear）。無ければ null。 */
export function allClearMessage(order: Order): string | null {
  const t = order.texts["result"];
  if (typeof t !== "object" || t === null) return null;
  const msg = (t as Record<string, unknown>)["allClear"];
  return typeof msg === "string" ? msg : null;
}
