import { describe, expect, it } from "vitest";
import { isPortrait } from "../../src/ui/rotate-hint";

describe("isPortrait（縦持ち判定, Issue #123）", () => {
  it("幅より高さが大きいときだけ縦持ち。横持ち・正方形は対象外", () => {
    expect(isPortrait(390, 844)).toBe(true);
    expect(isPortrait(844, 390)).toBe(false);
    expect(isPortrait(500, 500)).toBe(false);
  });
});
