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
});
