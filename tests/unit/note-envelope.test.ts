// @ts-expect-error 計測スクリプトは .mjs（型なし）
import { NOTE_FREQS, measureNotes } from "../../scripts/note-loudness.mjs";
import { describe, expect, it } from "vitest";
import {
  NOTE_END_GAIN,
  NOTE_LENGTH_S,
  NOTE_RELEASE_S,
  NOTE_START_GAIN,
  NOTE_SUSTAIN_END_GAIN,
  noteEnvelopePoints,
  noteGainAt,
} from "../../src/fx/note-envelope";

interface M {
  rms: number;
  peak: number;
}

describe("実行音符のエンベロープ（#218）", () => {
  it("開始 0.22・リリース開始 0.05・終端 0.001 の指数減衰", () => {
    expect(noteGainAt(0)).toBeCloseTo(NOTE_START_GAIN);
    expect(noteGainAt(NOTE_LENGTH_S - NOTE_RELEASE_S)).toBeCloseTo(NOTE_SUSTAIN_END_GAIN);
    expect(noteGainAt(NOTE_LENGTH_S)).toBeCloseTo(NOTE_END_GAIN);
    // 途中は指数（幾何平均）
    const mid = (NOTE_LENGTH_S - NOTE_RELEASE_S) / 2;
    expect(noteGainAt(mid)).toBeCloseTo(Math.sqrt(NOTE_START_GAIN * NOTE_SUSTAIN_END_GAIN));
  });

  it("終端は短いリリース（10〜20ms）で 0.001 へ。急に止めない", () => {
    expect(NOTE_RELEASE_S).toBeGreaterThanOrEqual(0.01);
    expect(NOTE_RELEASE_S).toBeLessThanOrEqual(0.02);
    expect(noteEnvelopePoints().map((p) => p[2])).toEqual(["set", "exp", "exp"]);
    expect(noteGainAt(NOTE_LENGTH_S - 0.001)).toBeLessThan(NOTE_SUSTAIN_END_GAIN);
  });

  it("262/330/392Hz とも RMS -21dBFS ±1dB、ピークは SE の最大 -12.5dBFS 以下", () => {
    const rows = measureNotes() as { freq: number; before: M; after: M }[];
    expect(rows.map((r) => r.freq)).toEqual(NOTE_FREQS);
    for (const r of rows) {
      expect(r.after.rms, `${r.freq}Hz rms`).toBeGreaterThanOrEqual(-22);
      expect(r.after.rms, `${r.freq}Hz rms`).toBeLessThanOrEqual(-20);
      expect(r.after.peak, `${r.freq}Hz peak`).toBeLessThanOrEqual(-12.5);
      expect(r.before.rms).toBeCloseTo(-24, 0); // 変更前（#135 の近似）
    }
  });
});
