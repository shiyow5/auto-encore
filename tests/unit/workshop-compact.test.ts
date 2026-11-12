import { describe, expect, it } from "vitest";
import { compactMetrics, isCompactLandscape } from "../../src/scenes/workshop/portrait";

describe("スマホ横の工房レイアウト（#165）", () => {
  it("844×390・667×375 は専用配置、縦持ち・PC・幅の狭い横(600未満)は対象外", () => {
    expect(isCompactLandscape(844, 390)).toBe(true);
    expect(isCompactLandscape(932, 430)).toBe(true);
    expect(isCompactLandscape(390, 844)).toBe(false);
    expect(isCompactLandscape(1280, 720)).toBe(false);
    expect(isCompactLandscape(667, 375)).toBe(true);
    expect(isCompactLandscape(568, 320)).toBe(false);
  });

  it("844×390・12×8 は 1 マス 31px、盤面は棚(右端224)と注文票(左端616)の間に収まる", () => {
    const m = compactMetrics(844, 390, 12, 8);
    expect(m.cell).toBe(31);
    expect(m.gridY).toBe(56);
    expect(m.gridX - 8).toBeGreaterThanOrEqual(224);
    expect(m.gridX + 12 * m.cell + 8).toBeLessThanOrEqual(616);
  });
});
