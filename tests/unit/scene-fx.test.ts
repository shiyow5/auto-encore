import { afterEach, describe, expect, it, vi } from "vitest";

const playSfx = vi.fn();
vi.mock("../../src/audio/player", () => ({ playSfx }));
vi.mock("../../src/ui/flags", () => ({
  fxEnabled: () => false,
  onReducedMotion: () => () => {},
}));
vi.mock("../../src/fx/PixelFxLayer", () => ({ PixelFxLayer: class {} }));

describe("createSceneFx（演出オフ＝音のみ）", () => {
  afterEach(() => {
    vi.useRealTimers();
    playSfx.mockClear();
  });

  it("シーンが閉じたら、予約中の遅延 SE（medal）は鳴らさない", async () => {
    vi.useFakeTimers();
    const handlers: Record<string, () => void> = {};
    const scene = {
      events: { once: (n: string, f: () => void) => void (handlers[n] = f) },
    };
    const { createSceneFx } = await import("../../src/fx/scene-fx");
    const fx = createSceneFx(scene as never, "t");
    fx.emit("medalSilver");
    handlers.shutdown?.();
    vi.advanceTimersByTime(2000);
    expect(playSfx).not.toHaveBeenCalled();
  });
});
