import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const zzfx = vi.fn();
vi.mock("zzfx", () => ({
  zzfx,
  ZZFX: { audioContext: { state: "running" }, sampleRate: 44100 },
}));

function stubStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
}

describe("player", () => {
  beforeEach(() => {
    vi.resetModules();
    zzfx.mockClear();
    stubStorage();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("読み込み待ちの間に音を切ったら、待っていた SE は鳴らさない", async () => {
    const p = await import("../../src/audio/player");
    p.playSfx("click");
    expect(p.toggleSound()).toBe(false);
    await vi.dynamicImportSettled();
    expect(zzfx).not.toHaveBeenCalled();
  });

  it("音が出る設定なら鳴らす", async () => {
    const p = await import("../../src/audio/player");
    p.playSfx("click");
    await vi.dynamicImportSettled();
    expect(zzfx).toHaveBeenCalledTimes(1);
  });

  it("SE は SE 音量をかけて鳴らす。0% なら鳴らさない", async () => {
    const p = await import("../../src/audio/player");
    const { SFX } = await import("../../src/audio/sounds");
    p.setVolume("sfx", 50);
    p.playSfx("click");
    await vi.dynamicImportSettled();
    expect(zzfx.mock.calls[0]![0]).toBeCloseTo(SFX.click[0]! * 0.5);
    zzfx.mockClear();
    p.setVolume("sfx", 0);
    p.playSfx("click");
    expect(zzfx).not.toHaveBeenCalled();
  });

  it("ミュートしていても音量を上げるとミュートが解ける。音量 0% とミュートは別の設定", async () => {
    const p = await import("../../src/audio/player");
    const a = await import("../../src/fx/audio");
    expect(p.toggleSound()).toBe(false);
    p.setVolume("sfx", 0);
    expect(a.isAudioEnabled()).toBe(false);
    p.setVolume("sfx", 30);
    expect(a.isAudioEnabled()).toBe(true);
  });

  it("BGM も SE も 0% のとき「音を出す」で既定の音量に戻る", async () => {
    const p = await import("../../src/audio/player");
    const v = await import("../../src/audio/volume");
    p.toggleSound(); // ミュート
    v.setVolumePercent("bgm", 0);
    v.setVolumePercent("sfx", 0);
    expect(p.toggleSound()).toBe(true);
    expect(v.getVolumePercent("sfx")).toBe(100);
  });

  it("ミュートしていないのに BGM も SE も 0% なら、1回の操作で既定の音量に戻って鳴る", async () => {
    const p = await import("../../src/audio/player");
    const v = await import("../../src/audio/volume");
    const a = await import("../../src/fx/audio");
    v.setVolumePercent("bgm", 0);
    v.setVolumePercent("sfx", 0);
    expect(a.isAudioEnabled()).toBe(true);
    expect(p.toggleSound()).toBe(true);
    expect(a.isAudioEnabled()).toBe(true);
    expect(v.getVolumePercent("bgm")).toBe(100);
    expect(v.getVolumePercent("sfx")).toBe(100);
  });
});
