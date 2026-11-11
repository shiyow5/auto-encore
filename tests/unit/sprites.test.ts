import { describe, expect, it } from "vitest";
import { labelDots, PALETTE, SPRITES, TILE } from "../../src/art/sprites";

describe("ドット絵スプライト", () => {
  for (const [name, rows] of Object.entries(SPRITES)) {
    it(`${name}: 全行の幅が同じで、使う文字はすべてパレットにある`, () => {
      const w = rows[0]?.length;
      expect(rows.every((r) => r.length === w)).toBe(true);
      for (const ch of rows.join("")) if (ch !== ".") expect(PALETTE[ch]).toBeDefined();
    });
  }
  it("盤面のスプライトは 1 マス（14x14）", () => {
    for (const n of ["floor", "blocked", "belt", "merger", "sorter", "tuner", "bin"] as const) {
      expect(SPRITES[n].length).toBe(TILE);
      expect(SPRITES[n][0]?.length).toBe(TILE);
    }
  });
  it("入口・出口のラベル（A, B, C1, C2, P, OUT, HI, LO）がマスに収まる", () => {
    for (const t of ["A", "B", "C1", "C2", "P", "OUT", "HI", "LO"]) {
      expect(labelDots(t).w).toBeLessThanOrEqual(TILE - 2);
      expect(labelDots(t).dots.length).toBeGreaterThan(0);
    }
  });
});
