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

const BAND = { x: 76, y: 141, w: 168, h: 37 };

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
    expect(() => d.stop("noteCombo")).not.toThrow();
    expect(() => d.dispose()).not.toThrow();
  });

  it("extra オプション（combo の count）が渡り、exclusive は前回分を止める", () => {
    const front = fakeSink();
    const d = new FxDirector({ back: fakeSink(), front }, () => true, { band: () => BAND });
    d.emit("noteCombo", 1, { count: 1 });
    const first = front.play.mock.results[0]?.value as { stop: ReturnType<typeof vi.fn> };
    d.emit("noteCombo", 2, { count: 2 });
    expect(front.play.mock.calls[1]?.[1]).toMatchObject({ count: 2 });
    expect(first.stop).toHaveBeenCalledTimes(1);
  });

  it("stop(name) でそのイベントのエフェクトを止める", () => {
    const front = fakeSink();
    const d = new FxDirector({ back: fakeSink(), front }, () => true, { band: () => BAND });
    d.emit("noteCombo", 1, { count: 1 });
    const fx = front.play.mock.results[0]?.value as { stop: ReturnType<typeof vi.fn> };
    d.stop("noteCombo");
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

describe("工房の演出（帯・パレット・前景の本数）", () => {
  it("全ての呼び出しに工房の palette が入る（既定のピンクを出さない）", () => {
    const front = fakeSink();
    const d = new FxDirector({ back: fakeSink(), front }, () => true, { band: () => BAND });
    d.emit("placeError");
    expect(front.play.mock.calls[0]?.[1]).toHaveProperty("palette");
    expect((front.play.mock.calls[0]?.[1] as { palette: string[] }).palette[5]).toBe("#f2b45a");
  });

  it("band 指定の演出は帯の中の位置に置く。帯が無いシーンでは出さない", () => {
    const front = fakeSink();
    const d = new FxDirector({ back: fakeSink(), front }, () => true, { band: () => BAND });
    d.emit("noteArrive");
    expect(front.play.mock.calls[0]?.[1]).toMatchObject({ x: 76 + 168 * 0.9, y: 141 + 37 * 0.5 });
    const none = fakeSink();
    const d2 = new FxDirector({ back: fakeSink(), front: none }, () => true, { band: () => null });
    expect(d2.emit("noteArrive")).toBe(false);
    expect(none.play).not.toHaveBeenCalled();
  });

  it("前景が上限に達したら、低い優先度を止めてエラーを入れる。同じ優先度は入れない", () => {
    const front = fakeSink();
    const d = new FxDirector({ back: fakeSink(), front }, () => true, {
      band: () => BAND,
      frontSlots: 2,
    });
    d.emit("noteArrive");
    d.emit("noteArrive");
    const oldest = front.play.mock.results[0]?.value as { stop: ReturnType<typeof vi.fn> };
    // 同じ優先度（到達スパーク）は入らない
    expect(d.emit("noteArrive")).toBe(false);
    expect(oldest.stop).not.toHaveBeenCalled();
    // エラーは最低優先度（到達スパーク）を止めて入る
    d.emit("placeError");
    expect(oldest.stop).toHaveBeenCalledTimes(1);
    expect(front.play.mock.calls.at(-1)?.[0]).toBeDefined();
  });

  it("背景（back）は前景の本数に数えない", () => {
    const back = fakeSink();
    const front = fakeSink();
    const d = new FxDirector({ back, front }, () => true, { band: () => BAND, frontSlots: 1 });
    d.emit("ambient");
    expect(d.emit("noteArrive")).toBe(true);
  });
});
