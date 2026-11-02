/**
 * 工房の「実行」（dev-plan-v3 §3 K4）。画面から core を呼ぶ薄い層。
 *
 * - simulate()（中で step() を止まるまで回す）→ score()（S3 の measure → judge）
 * - 画面に出す文（3指標・止まった理由・メダル）もここで作る（Phaser に依存しないのでユニットテストできる）
 */
import { score, type Medal, type ScoreReport } from "../../core/score";
import { simulate, type SimState } from "../../core/sim/sim";
import { validatePlacements } from "../../core/sim/load";
import type { MachineTable, Order, Placement, Solution, StopReason } from "../../core/sim/types";

export interface Execution {
  readonly report: ScoreReport;
  /** frames[0] が初期状態、frames[t] が tick t。ベルト上の音符の再描画に使う。 */
  readonly frames: readonly SimState[];
  /** 止まったときの状態（stateHash(final) === finalHash）。 */
  readonly final: SimState;
  readonly finalHash: string;
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
  return { report, frames: out.frames, final: out.final, finalHash: out.result.finalHash };
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
  none: "なし",
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
      value: m.ticks === null ? "記録なし" : `${m.ticks} tick`,
      medal: r.medals.ticks,
    },
    { key: "cost", label: "コスト", value: `${m.cost}G`, medal: r.medals.cost },
  ];
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
