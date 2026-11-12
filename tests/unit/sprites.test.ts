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

describe("#102 指定値", () => {
  it("棚アイコン・スピーカー・鍵は 16x16。棚アイコンは 3 色（琥珀・明・影）まで", async () => {
    const mod = await import("../../src/art/sprites");
    for (const n of [
      "icon-belt",
      "icon-merger",
      "icon-sorter",
      "icon-tuner",
      "icon-bin",
    ] as const) {
      const rows = mod.SPRITES[n];
      expect(rows.length).toBe(16);
      expect(rows.every((r) => r.length === 16)).toBe(true);
      const colors = new Set(
        [...rows.join("")].filter((c) => c !== ".").map((c) => mod.PALETTE[c]),
      );
      expect([...colors].every((c) => ["#f2b45a", "#f3e9dc", "#7a6888"].includes(c ?? ""))).toBe(
        true,
      );
    }
    for (const n of ["speaker-on", "speaker-off", "lock"] as const) {
      expect(mod.SPRITES[n].length).toBe(16);
      expect(mod.SPRITES[n].every((r) => r.length === 16)).toBe(true);
    }
  });
  it("床タイルは地 #2A2030 + 木目 #3A2D42 の 2 点", async () => {
    const mod = await import("../../src/art/sprites");
    const all = mod.SPRITES.floor.join("");
    expect(mod.PALETTE.t).toBe("#2a2030");
    expect(mod.PALETTE.T).toBe("#3a2d42");
    expect([...all].filter((c) => c === "T").length).toBe(2);
    expect([...all].every((c) => c === "t" || c === "T")).toBe(true);
  });
});
