/**
 * 結果画面グラフの縦軸（autoscaleInfoProvider）。目標線は autoscale の対象外なので、
 * 累計が全部 0 でも目標が範囲に入ることを確かめる。
 */
import { describe, expect, it } from "vitest";
import { targetAutoscale } from "../../src/ui/resultChart";

describe("targetAutoscale", () => {
  it("累計が全部 0 で目標 8 → maxValue は 8（目標線が見える）", () => {
    const r = targetAutoscale(8, () => ({ priceRange: { minValue: 0, maxValue: 0 } }));
    expect(r.priceRange).toEqual({ minValue: 0, maxValue: 8 });
  });

  it("データが無く base が null でも目標まで出る", () => {
    expect(targetAutoscale(8, () => null).priceRange.maxValue).toBe(8);
  });

  it("累計が目標を超えたら累計の最大値に合わせる", () => {
    const r = targetAutoscale(8, () => ({ priceRange: { minValue: 0, maxValue: 12 } }));
    expect(r.priceRange.maxValue).toBe(12);
  });
});
