import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FxDirector } from "../../src/fx/FxDirector";
import { FX_MAP } from "../../src/fx/fx-map";
import type { FxEventName } from "../../src/fx/fx-map";

// 対応表に overlay の演出が無くなった（LEVEL UP! を外した, Issue #171）ので、仕組みの検証用に一時的に差し込む
const overlayEvent: FxEventName = "result";
const original = FX_MAP[overlayEvent];
beforeEach(() => {
  (FX_MAP as Record<FxEventName, unknown>)[overlayEvent] = [
    { mod: FX_MAP.songComplete[0]!.mod, x: 160, y: 100, layer: "overlay" },
  ];
});
afterEach(() => {
  (FX_MAP as Record<FxEventName, unknown>)[overlayEvent] = original;
});

const sink = () => ({
  play: vi.fn(() => ({ stop: vi.fn(), done: () => false })),
  stopAll: vi.fn(),
  destroy: vi.fn(),
});

describe("FxDirector の overlay レイヤー", () => {
  it("overlay があれば overlay に描く（front には出さない）", () => {
    const [back, front, overlay] = [sink(), sink(), sink()];
    const d = new FxDirector({ back, front, overlay } as never, () => true);
    expect(d.emit(overlayEvent)).toBe(true);
    expect(overlay.play).toHaveBeenCalled();
    expect(front.play).not.toHaveBeenCalled();
  });

  it("overlay が無ければ front に落とす", () => {
    const [back, front] = [sink(), sink()];
    const d = new FxDirector({ back, front } as never, () => true);
    expect(d.emit(overlayEvent)).toBe(true);
    expect(front.play).toHaveBeenCalled();
  });
});
