import { describe, expect, it } from "vitest";
import { shouldRotateOnTap } from "../../src/scenes/workshop/tap";
import { tutorialText, TUTORIAL_TEXT } from "../../src/scenes/workshop/tutorial";

describe("shouldRotateOnTap (Issue #140)", () => {
  const belt = { machine: "belt" as const };
  it("タッチで、選択中と同じ種類の機械があるマスなら回す", () => {
    expect(shouldRotateOnTap("touch", belt, "belt")).toBe(true);
  });
  it("違う種類なら従来どおり置き換え（回さない）", () => {
    expect(shouldRotateOnTap("touch", belt, "sorter")).toBe(false);
  });
  it("sorter・音高違いなら置き換え（音高変更）", () => {
    const sorter = { machine: "sorter" as const, config: { pitch: 0 as const } };
    expect(shouldRotateOnTap("touch", sorter, "sorter", 2 as never)).toBe(false);
  });
  it("sorter・音高同じなら回す", () => {
    const sorter = { machine: "sorter" as const, config: { pitch: 2 as never } };
    expect(shouldRotateOnTap("touch", sorter, "sorter", 2 as never)).toBe(true);
  });
  it("空きマスは置く", () => {
    expect(shouldRotateOnTap("touch", undefined, "belt")).toBe(false);
  });
  it("マウス・ペン・キーボード(undefined)は従来どおり置く", () => {
    for (const t of ["mouse", "pen", undefined])
      expect(shouldRotateOnTap(t, belt, "belt")).toBe(false);
  });
});

describe("tutorialText", () => {
  it("PC は従来文言のまま", () => {
    for (const s of ["place", "rotate", "run"] as const)
      expect(tutorialText(s, false)).toBe(TUTORIAL_TEXT[s]);
  });
  it("タッチは手順2だけタップ文言", () => {
    expect(tutorialText("rotate", true)).toContain("タップして向きを回します");
    expect(tutorialText("rotate", true)).not.toContain("R で");
    expect(tutorialText("place", true)).toBe(TUTORIAL_TEXT.place);
    expect(tutorialText("run", true)).toBe(TUTORIAL_TEXT.run);
  });
});
