/**
 * 工房の「元に戻す」履歴（#139）。純関数・Phaser 非依存。
 * 配置は不変データ（毎回新しい配列に置き換わる）なので、変更直前の配列をそのまま積めば戻せる。
 */

import type { Placement } from "./sim/types";

type Point = Placement["pos"];

/** 履歴の上限。超えたら古いものから捨てる。 */
export const UNDO_LIMIT = 50;

/** prev を積んだ新しいスタックを返す（元のスタックは変えない）。limit を超えた分は古い順に捨てる。 */
export function pushHistory<T>(
  stack: readonly (readonly T[])[],
  prev: readonly T[],
  limit: number = UNDO_LIMIT,
): readonly (readonly T[])[] {
  const next = [...stack, prev];
  return limit > 0 && next.length > limit ? next.slice(next.length - limit) : next;
}

/** 一番新しい履歴を取り出す。空なら prev は null でスタックはそのまま。 */
export function popHistory<T>(stack: readonly (readonly T[])[]): {
  stack: readonly (readonly T[])[];
  prev: readonly T[] | null;
} {
  if (stack.length === 0) return { stack, prev: null };
  return { stack: stack.slice(0, -1), prev: stack[stack.length - 1] ?? null };
}

/** 2つの配置の間で内容（機械・向き・音高）が違うマスの座標。undo で戻したマスを光らせるのに使う。 */
export function changedCells(
  before: readonly Placement[],
  after: readonly Placement[],
): readonly Point[] {
  const key = (p: Placement): string => `${p.machine}|${p.dir}|${p.config?.pitch ?? ""}`;
  const at = (list: readonly Placement[]): Map<string, string> =>
    new Map(list.map((p) => [`${p.pos.x},${p.pos.y}`, key(p)]));
  const a = at(before);
  const b = at(after);
  const out: Point[] = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if (a.get(k) === b.get(k)) continue;
    const [x, y] = k.split(",").map(Number);
    out.push({ x: x as number, y: y as number });
  }
  return out;
}
