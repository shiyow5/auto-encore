/**
 * Issue #46: 音高→周波数変換のユニットテスト。
 */
import { describe, expect, it } from "vitest";
import { pitchToFreq } from "../../src/fx/audio";

describe("pitchToFreq", () => {
  it("do (0) → 262Hz", () => {
    expect(pitchToFreq(0)).toBe(262);
  });

  it("mi (1) → 330Hz", () => {
    expect(pitchToFreq(1)).toBe(330);
  });

  it("so (2) → 392Hz", () => {
    expect(pitchToFreq(2)).toBe(392);
  });

  it("範囲外の pitch は 440Hz を返す", () => {
    expect(pitchToFreq(-1)).toBe(440);
    expect(pitchToFreq(3)).toBe(440);
  });

  it("周波数は正の数", () => {
    for (let i = -10; i <= 10; i++) {
      expect(pitchToFreq(i)).toBeGreaterThan(0);
    }
  });
});
