import { describe, expect, it, vi } from "vitest";
import { FxDirector } from "../../src/fx/FxDirector";
import type { FxSink } from "../../src/fx/FxDirector";
import { FX_MAP } from "../../src/fx/fx-map";
import type { FxEventName } from "../../src/fx/fx-map";

function fakeSink(): FxSink & { play: ReturnType<typeof vi.fn> } {
  return {
    play: vi.fn(() => ({ update() {}, draw() {}, stop: vi.fn(), done: () => false })),
    stopAll: vi.fn(),
    destroy: vi.fn(),
  };
}

const NAMES = Object.keys(FX_MAP) as FxEventName[];

describe("fx-map（イベント名 → エフェクト）", () => {
  it("全イベントに 1 つ以上のエフェクトがある", () => {
    for (const n of NAMES) expect(FX_MAP[n].length).toBeGreaterThan(0);
  });
});

describe("FxDirector", () => {
  it("演出が有効なら対応表どおりのレイヤーに再生する", () => {
    const back = fakeSink();
    const front = fakeSink();
    const d = new FxDirector({ back, front }, () => true);
    expect(d.emit("ambient")).toBe(true);
    expect(back.play).toHaveBeenCalledTimes(FX_MAP.ambient.length);
    expect(front.play).not.toHaveBeenCalled();
  });

  it("enabled() が false（?fx=0 など）なら 1 つも再生しない", () => {
    const back = fakeSink();
    const front = fakeSink();
    const d = new FxDirector({ back, front }, () => false);
    for (const n of NAMES) expect(d.emit(n)).toBe(false);
    expect(back.play).not.toHaveBeenCalled();
    expect(front.play).not.toHaveBeenCalled();
  });

  it("sinks なし（?fx=0 で canvas を作らない場合）でも落ちない", () => {
    const d = new FxDirector(null, () => true);
    expect(d.emit("ambient")).toBe(false);
    expect(() => d.stop("machineRun")).not.toThrow();
    expect(() => d.dispose()).not.toThrow();
  });

  it("extra オプション（combo の count）が渡り、exclusive は前回分を止める", () => {
    const front = fakeSink();
    const d = new FxDirector({ back: fakeSink(), front }, () => true);
    d.emit("noteCombo", 1, { count: 1 });
    const first = front.play.mock.results[0]?.value as { stop: ReturnType<typeof vi.fn> };
    d.emit("noteCombo", 2, { count: 2 });
    expect(front.play.mock.calls[1]?.[1]).toMatchObject({ count: 2 });
    expect(first.stop).toHaveBeenCalledTimes(1);
  });

  it("stop(name) でそのイベントのエフェクトを止める", () => {
    const front = fakeSink();
    const d = new FxDirector({ back: fakeSink(), front }, () => true);
    d.emit("machineRun");
    const fx = front.play.mock.results[0]?.value as { stop: ReturnType<typeof vi.fn> };
    d.stop("machineRun");
    expect(fx.stop).toHaveBeenCalledTimes(1);
  });

  it("dispose() で両レイヤーを破棄し、その後は再生しない", () => {
    const back = fakeSink();
    const front = fakeSink();
    const d = new FxDirector({ back, front }, () => true);
    d.dispose();
    expect(back.destroy).toHaveBeenCalledTimes(1);
    expect(front.destroy).toHaveBeenCalledTimes(1);
    expect(d.emit("ambient")).toBe(false);
    expect(back.play).not.toHaveBeenCalled();
  });
});
