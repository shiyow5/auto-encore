// @ts-expect-error 計測スクリプトは .mjs（型なし）。scripts/measure-sfx.mjs と同じ関数を使う
import { measureAll, summarize } from "../../scripts/sfx-loudness.mjs";
import { describe, expect, it } from "vitest";
import { SFX } from "../../src/audio/sounds";

interface Row {
  name: string;
  peak: number;
  rms: number;
}

describe("SE のラウドネス（ZzFX をオフラインで生成して計測）", () => {
  it("全 SE の RMS の最大 − 最小が 6dB 以内（±3dB）", async () => {
    const rows: Row[] = await measureAll();
    expect(rows.map((r) => r.name).sort()).toEqual(Object.keys(SFX).sort());
    const s = summarize(rows) as { spread: number };
    expect(s.spread).toBeLessThanOrEqual(6);
  });

  it("どの SE もピークが 0dBFS を超えない（割れない）", async () => {
    const rows: Row[] = await measureAll();
    for (const r of rows) expect(r.peak, r.name).toBeLessThan(-6);
  });

  it("演出用の SE は 0.1〜0.3 秒", async () => {
    const rows: (Row & { sec: number })[] = await measureAll();
    for (const n of ["confetti", "medalGold", "medalSilver", "runError"]) {
      const r = rows.find((x) => x.name === n)!;
      expect(r.sec, n).toBeGreaterThanOrEqual(0.1);
      expect(r.sec, n).toBeLessThanOrEqual(0.3);
    }
  });
});
