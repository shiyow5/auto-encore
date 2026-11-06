import { describe, expect, it } from "vitest";
import { pitchToFrequency } from "../../src/audio";

describe("pitchToFrequency", () => {
  it("do(0) = C4 ≈ 261.63 Hz", () => {
    expect(pitchToFrequency(0)).toBeCloseTo(261.63, 1);
  });

  it("mi(1) = E4 ≈ 329.63 Hz", () => {
    expect(pitchToFrequency(1)).toBeCloseTo(329.63, 1);
  });

  it("so(2) = G4 ≈ 392.00 Hz", () => {
    expect(pitchToFrequency(2)).toBeCloseTo(392.00, 1);
  });

  it("異なる音高は異なる周波数を返す", () => {
    const f0 = pitchToFrequency(0);
    const f1 = pitchToFrequency(1);
    const f2 = pitchToFrequency(2);
    expect(f0).toBeLessThan(f1);
    expect(f1).toBeLessThan(f2);
  });

  it("undefined 音高はデフォルト(60)を返す", () => {
    expect(pitchToFrequency(99)).toBeCloseTo(261.63, 1);
  });
});
