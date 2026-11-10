import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stubStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  return store;
}

describe("volume（音量の保存と復元）", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    vi.resetModules();
    store = stubStorage();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("既定は 100%", async () => {
    const v = await import("../../src/audio/volume");
    expect(v.getVolumePercent("bgm")).toBe(100);
    expect(v.getVolumePercent("sfx")).toBe(100);
  });

  it("BGM と SE を別々に保存し、読み込み直しても残る", async () => {
    const v = await import("../../src/audio/volume");
    v.setVolumePercent("bgm", 30);
    v.setVolumePercent("sfx", 70);
    expect(store.get("ae-bgm-volume")).toBe("30");
    vi.resetModules();
    const again = await import("../../src/audio/volume");
    expect(again.getVolumePercent("bgm")).toBe(30);
    expect(again.getVolume("sfx")).toBeCloseTo(0.7);
  });

  it("10% 刻みに丸め、範囲外・不正な値は安全に扱う", async () => {
    const v = await import("../../src/audio/volume");
    expect(v.normalizeVolume(44)).toBe(40);
    expect(v.normalizeVolume(-5)).toBe(0);
    expect(v.normalizeVolume(999)).toBe(100);
    expect(v.normalizeVolume("abc")).toBe(100);
    expect(v.normalizeVolume("")).toBe(100);
  });

  it("両方 0% なら isSilentByVolume", async () => {
    const v = await import("../../src/audio/volume");
    v.setVolumePercent("bgm", 0);
    expect(v.isSilentByVolume()).toBe(false);
    v.setVolumePercent("sfx", 0);
    expect(v.isSilentByVolume()).toBe(true);
  });

  it("変更を購読できる", async () => {
    const v = await import("../../src/audio/volume");
    const cb = vi.fn();
    const off = v.onVolumeChange(cb);
    v.setVolumePercent("sfx", 50);
    off();
    v.setVolumePercent("sfx", 60);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
