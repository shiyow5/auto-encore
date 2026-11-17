import type { SimState } from "../core/sim/sim";

/**
 * E3 fx.ae.merge_spark（Issue #57）の定数と判定。演出専用（src/core からは参照しない）。
 * ★ 仕様書 docs/fx-e3-merge-spark.md の未決項目の暫定値（PR #57 本文の一覧を参照）。
 */
export const MERGE_SPARK = {
  /** hit-spark の縮小率。sota のデザイン採否で 0.6 据え置き（この 1 か所で切替） */
  scale: 0.6,
  /** 続けて出す最小間隔（ミリ秒）。これより短い間隔の切替では出さない */
  minIntervalMs: 250,
} as const;

/**
 * 合流機が「交互に切り替わった」マス（key = y * width + x）を返す。
 * ★仮の判定: 直前の tick と今の tick で、同じ合流機の last（最後に通した側）が left↔right に変わった瞬間。
 * 最初の 1 回（直前に last が無い）は「切替」に数えない。
 */
export function mergerSwitches(prev: SimState | undefined, cur: SimState): number[] {
  if (!prev?.mergers || !cur.mergers) return [];
  const before = new Map(prev.mergers.map((m) => [m.key, m.last] as const));
  const out: number[] = [];
  for (const m of cur.mergers) {
    const was = before.get(m.key);
    if (was !== undefined && was !== m.last) out.push(m.key);
  }
  return out;
}

/**
 * 最小間隔のゲート。fire() が true のときだけ火花を出す。
 * - 演出 OFF（?fx=0 / reduce）のときは false。間隔の記録も更新しない
 * - 前回出した時刻から minIntervalMs 未満なら false（時刻は更新しない）
 */
export class MergeSparkGate {
  private last: number | null = null;

  constructor(private readonly minIntervalMs: number = MERGE_SPARK.minIntervalMs) {}

  fire(nowMs: number, enabled: boolean): boolean {
    if (!enabled) return false;
    if (this.last !== null && nowMs - this.last < this.minIntervalMs) return false;
    this.last = nowMs;
    return true;
  }

  reset(): void {
    this.last = null;
  }
}
