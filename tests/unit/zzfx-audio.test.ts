import { describe, expect, it } from "vitest";
import {
  BGM_BPM,
  BGM_INSTRUMENTS,
  BGM_PATTERNS,
  BGM_SEQUENCE,
  SFX,
  sfxForReport,
} from "../../src/audio/sounds";
import { renderSong } from "../../src/audio/zzfxm";

describe("SE", () => {
  it("結果画面: アンコール > 合格 > 不合格", () => {
    expect(sfxForReport({ passed: true, encore: true })).toBe("encore");
    expect(sfxForReport({ passed: true, encore: false })).toBe("pass");
    expect(sfxForReport({ passed: false, encore: false })).toBe("fail");
  });

  it("どの SE も ZzFX のパラメータ数（21）以内で、音量と周波数がある", () => {
    for (const [name, p] of Object.entries(SFX)) {
      expect(p.length, name).toBeLessThanOrEqual(21);
      expect(p[0], name).toBeGreaterThan(0);
      expect(p[2], name).toBeGreaterThan(0);
    }
  });
});

describe("BGM", () => {
  it("パターンの中のチャンネルは同じ長さ", () => {
    for (const p of BGM_PATTERNS) {
      for (const ch of p) expect(ch.length).toBe(p[0]!.length);
    }
  });

  it("楽器番号と並びが範囲内", () => {
    for (const p of BGM_PATTERNS) for (const ch of p) expect(BGM_INSTRUMENTS[ch[0]!]).toBeDefined();
    for (const i of BGM_SEQUENCE) expect(BGM_PATTERNS[i]).toBeDefined();
  });

  it("renderSong: 長さが曲の長さに合い、NaN が無い", () => {
    const rate = 8000;
    const build = () => new Array(100).fill(0.5);
    const [l, r] = renderSong(BGM_INSTRUMENTS, BGM_PATTERNS, BGM_SEQUENCE, BGM_BPM, rate, build);
    const beat = ((rate / BGM_BPM) * 60) >> 2;
    const steps = BGM_SEQUENCE.reduce((n, i) => n + BGM_PATTERNS[i]![0]!.length - 2, 0);
    expect(l.length).toBe(r.length);
    expect(l.length).toBeGreaterThanOrEqual((steps - 1) * beat);
    expect(l.length).toBeLessThanOrEqual((steps + 1) * beat);
    expect(l.some((v) => v !== 0)).toBe(true);
    expect([...l, ...r].every((v) => Number.isFinite(v))).toBe(true);
  });

  it("renderSong: 音符の高さは基準 12 から半音ずつ", () => {
    const freqs: number[] = [];
    const build = (...p: (number | undefined)[]) => {
      freqs.push(p[2]!);
      return [0];
    };
    renderSong([[1, 0, 440]], [[[0, 0, 12, 24, 0]]], [0], 120, 8000, build);
    expect(freqs[0]).toBeCloseTo(440);
    expect(freqs[1]).toBeCloseTo(880);
  });
});
