/**
 * 採点（spec-e-mvp.md v0.3 §4）。3指標（正確さ・速度・コスト）を出し、金銀銅を閾値で判定する。
 *
 * - すべて純粋関数。シミュレーションは回さない（結果の SimResult を受け取るだけ）。
 * - 閾値の値はここに書かない。注文 JSON の scoring か、引数で渡されたものだけを使う。
 * - 正確さの判定は整数のまま `matched*100 >= 閾値*total` で比べる（% の丸めで判定がずれないように）。
 */
import type {
  EncoreRule,
  ExpectedResult,
  MedalThresholds,
  Order,
  PassRule,
  Scoring,
  SimResult,
  Solution,
  StopReason,
} from "./sim/types";

export type Medal = "gold" | "silver" | "bronze" | "none";

/** 3指標の値。accuracy は表示用の整数 %（切り捨て）。判定には matched / total を使う。 */
export interface Metrics {
  readonly result: StopReason;
  readonly accuracy: number;
  readonly matched: number;
  readonly total: number;
  /** completed のときだけ整数。止まったら null（速度なし）。 */
  readonly ticks: number | null;
  readonly cost: number;
  readonly firstMismatch: number | null;
}

export interface Medals {
  readonly accuracy: Medal;
  readonly ticks: Medal;
  readonly cost: Medal;
}

export interface ScoreReport {
  readonly metrics: Metrics;
  readonly medals: Medals;
  /** passRule を満たした（最小版: 3指標すべて銅以上）。 */
  readonly passed: boolean;
  /** encoreRule を満たした（最小版: 合格かつ金が2つ以上）。 */
  readonly encore: boolean;
}

/** 整数 %（切り捨て）。total が 0 のときは 0。 */
export function accuracyPercent(matched: number, total: number): number {
  return total === 0 ? 0 : Math.floor((matched * 100) / total);
}

/**
 * シミュレーション結果から3指標を出す。
 * solution は order の解であること（orderId が違えば Error）。コストは SimResult.cost を使う
 * （T2 の run() が totalCost(placements, order, machines) で埋める）。
 */
export function measure(sim: SimResult, order: Order, solution: Solution): Metrics {
  if (solution.orderId !== order.id) {
    throw new Error(
      `score: 解 "${solution.name}" は ${solution.orderId} の解（注文は ${order.id}）`,
    );
  }
  if (sim.matched < 0 || sim.total < 0 || sim.matched > sim.total) {
    throw new Error(`score: matched=${sim.matched} total=${sim.total} が不正`);
  }
  const completed = sim.result === "completed";
  if (completed !== (sim.ticks !== null)) {
    throw new Error(`score: result=${sim.result} なのに ticks=${String(sim.ticks)}`);
  }
  return {
    result: sim.result,
    accuracy: accuracyPercent(sim.matched, sim.total),
    matched: sim.matched,
    total: sim.total,
    ticks: sim.ticks,
    cost: sim.cost,
    firstMismatch: sim.firstMismatch,
  };
}

/** 正確さのメダル。整数のまま `matched*100 >= 閾値*total` で比べる。 */
export function accuracyMedal(matched: number, total: number, th: MedalThresholds): Medal {
  const reaches = (t: number): boolean => matched * 100 >= t * total;
  if (total === 0) return "none";
  if (reaches(th.gold)) return "gold";
  if (reaches(th.silver)) return "silver";
  if (reaches(th.bronze)) return "bronze";
  return "none";
}

/** 小さいほど良い指標（速度・コスト）のメダル。null（速度なし）は none。 */
export function lowerIsBetterMedal(value: number | null, th: MedalThresholds): Medal {
  if (value === null) return "none";
  if (value <= th.gold) return "gold";
  if (value <= th.silver) return "silver";
  if (value <= th.bronze) return "bronze";
  return "none";
}

function isPassed(medals: Medals, rule: PassRule): boolean {
  switch (rule) {
    case "all-bronze-or-better":
      return medals.accuracy !== "none" && medals.ticks !== "none" && medals.cost !== "none";
  }
}

function isEncore(medals: Medals, passed: boolean, rule: EncoreRule): boolean {
  switch (rule) {
    case "two-or-more-gold": {
      const golds = [medals.accuracy, medals.ticks, medals.cost].filter((m) => m === "gold");
      return passed && golds.length >= 2;
    }
  }
}

/** 3指標を閾値で判定する。閾値は引数で受けるだけ（値は持たない）。 */
export function judge(metrics: Metrics, scoring: Scoring): ScoreReport {
  const medals: Medals = {
    accuracy: accuracyMedal(metrics.matched, metrics.total, scoring.accuracy),
    ticks: lowerIsBetterMedal(metrics.ticks, scoring.ticks),
    cost: lowerIsBetterMedal(metrics.cost, scoring.cost),
  };
  const passed = isPassed(medals, scoring.passRule);
  return { metrics, medals, passed, encore: isEncore(medals, passed, scoring.encoreRule) };
}

/** measure → judge。scoring を省くと注文の scoring を使う。 */
export function score(
  sim: SimResult,
  order: Order,
  solution: Solution,
  scoring: Scoring = order.scoring,
): ScoreReport {
  return judge(measure(sim, order, solution), scoring);
}

/** 模範解の expected と同じ形に直す（ゴールデンテスト用。finalHash は SimResult から）。 */
export function toExpected(metrics: Metrics, finalHash?: string): ExpectedResult {
  return {
    result: metrics.result,
    accuracy: metrics.accuracy,
    ticks: metrics.ticks,
    cost: metrics.cost,
    ...(finalHash !== undefined ? { finalHash } : {}),
  };
}
