import { describe, expect, it, vi } from "vitest";
import { FxDirector } from "../../src/fx/FxDirector";
import { FX_MAP } from "../../src/fx/fx-map";
import type { FxEventName } from "../../src/fx/fx-map";

const overlayEvent = (Object.keys(FX_MAP) as FxEventName[]).find((n) =>
  FX_MAP[n].some((s) => s.layer === "overlay"),
) as FxEventName;

const sink = () => ({
  play: vi.fn(() => ({ stop: vi.fn(), done: () => false })),
  stopAll: vi.fn(),
  destroy: vi.fn(),
});

describe("FxDirector の overlay レイヤー", () => {
  it("overlay の演出がある", () => {
    expect(overlayEvent).toBeDefined();
  });

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
