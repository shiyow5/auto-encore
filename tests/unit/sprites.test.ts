import { describe, expect, it } from "vitest";
import { PALETTE, SPRITES, TILE } from "../../src/art/sprites";

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
});

import { NOTE_SIZE } from "../../src/art/sprites";
describe("音符・音アイコンのドット絵", () => {
  it("音符の絵は 10x10 で全行同じ幅", async () => {
    const mod = await import("../../src/art/sprites");
    expect(NOTE_SIZE).toBe(10);
    for (const n of ["note-on", "note-off"] as const) {
      const rows = mod.SPRITES[n];
      expect(rows.length).toBe(12);
      for (const r of rows) expect(r.length).toBe(12);
    }
  });
});
