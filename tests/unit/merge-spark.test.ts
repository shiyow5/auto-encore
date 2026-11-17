import { describe, expect, it, vi } from "vitest";
import { createFrame, createFx } from "pixelfx";
import * as hitSpark from "pixelfx/fx/impacts/hit-spark";
import { FxDirector } from "../../src/fx/FxDirector";
import type { FxSink } from "../../src/fx/FxDirector";
import { MERGE_SPARK, MergeSparkGate, mergerSwitches } from "../../src/fx/merge-spark";
import { scaledFx } from "../../src/fx/scaled-fx";
import type { SimState } from "../../src/core/sim/sim";

const st = (...mergers: Array<[number, "left" | "right"]>): SimState =>
  ({ mergers: mergers.map(([key, last]) => ({ key, last })) }) as unknown as SimState;

describe("E3 merge_spark: 最小間隔ゲート", () => {
  it("250ms 未満の連続切替では 2 回目を出さない", () => {
    const g = new MergeSparkGate();
    expect(g.fire(1000, true)).toBe(true);
    expect(g.fire(1110, true)).toBe(false); // 1 tick = 110ms
    expect(g.fire(1249, true)).toBe(false);
  });

  it("250ms ちょうど以上なら出す。間引かれた分は間隔を延ばさない", () => {
    const g = new MergeSparkGate();
    expect(g.fire(1000, true)).toBe(true);
    expect(g.fire(1200, true)).toBe(false);
    expect(g.fire(1250, true)).toBe(true);
  });

  it("演出 OFF（?fx=0 / reduce）では出さず、間隔も消費しない", () => {
    const g = new MergeSparkGate();
    expect(g.fire(1000, false)).toBe(false);
    expect(g.fire(1010, true)).toBe(true);
  });

  it("既定の間隔は MERGE_SPARK.minIntervalMs（250）", () => {
    expect(MERGE_SPARK.minIntervalMs).toBe(250);
    expect(MERGE_SPARK.scale).toBe(0.6);
  });

  it("reset() で最初から出せる", () => {
    const g = new MergeSparkGate();
    g.fire(1000, true);
    g.reset();
    expect(g.fire(1001, true)).toBe(true);
  });
});

describe("E3 merge_spark: 切替の検出（★仮ロジック）", () => {
  it("left↔right が変わった合流機だけ返す。初回・同じ側は返さない", () => {
    expect(mergerSwitches(st(), st([5, "left"]))).toEqual([]);
    expect(mergerSwitches(st([5, "left"]), st([5, "left"]))).toEqual([]);
    expect(mergerSwitches(st([5, "left"]), st([5, "right"]))).toEqual([5]);
    expect(mergerSwitches(st([5, "left"], [9, "right"]), st([5, "right"], [9, "right"]))).toEqual([
      5,
    ]);
  });

  it("合流機の無い盤・前 tick なしでは空", () => {
    expect(mergerSwitches(undefined, st([5, "left"]))).toEqual([]);
    expect(mergerSwitches({} as SimState, {} as SimState)).toEqual([]);
  });
});

function fakeSink(): FxSink & { play: ReturnType<typeof vi.fn> } {
  return {
    play: vi.fn(() => ({ update() {}, draw() {}, stop: vi.fn(), done: () => false })),
    stopAll: vi.fn(),
    destroy: vi.fn(),
  };
}
const BAND = { x: 76, y: 141, w: 168, h: 37 };

describe("E3 merge_spark: FxDirector", () => {
  it("演出 ON なら front に 1 本。bandFx で帯の横位置が合流機の列になる", () => {
    const front = fakeSink();
    const d = new FxDirector({ back: fakeSink(), front }, () => true, { band: () => BAND });
    expect(d.emit("mergeSpark", 1, {}, 0.25)).toBe(true);
    const opts = front.play.mock.calls[0]?.[1] as { x: number; y: number };
    expect(opts.x).toBeCloseTo(BAND.x + BAND.w * 0.25);
    expect(opts.y).toBeCloseTo(BAND.y + BAND.h * 0.5);
  });

  it("演出 OFF（enabled() = false）なら発火しない", () => {
    const front = fakeSink();
    const d = new FxDirector({ back: fakeSink(), front }, () => false, { band: () => BAND });
    expect(d.emit("mergeSpark", 1, {}, 0.25)).toBe(false);
    expect(front.play).not.toHaveBeenCalled();
  });
});

describe("scaledFx（pixelfx に縮小が無いための縮小ラッパー）", () => {
  function bbox(mod: Parameters<typeof createFx>[0]) {
    const f = createFrame(200, 140, -100, -100);
    const fx = createFx(mod, { x: 0, y: 0, seed: 3 });
    for (let i = 0; i < 6; i++) fx.update(1 / 60);
    fx.draw(f);
    let x0 = 1e9,
      x1 = -1e9,
      y0 = 1e9,
      y1 = -1e9,
      n = 0;
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        if (!f.color[y * f.w + x]) continue;
        n++;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    return { w: x1 - x0 + 1, h: y1 - y0 + 1, n };
  }

  it("0.6 倍にすると描かれる範囲が元より小さくなり、何かは描く", () => {
    const orig = bbox(hitSpark);
    const small = bbox(scaledFx(hitSpark, 0.6));
    expect(small.n).toBeGreaterThan(0);
    expect(small.w).toBeLessThanOrEqual(Math.ceil(orig.w * 0.6) + 2);
    expect(small.h).toBeLessThanOrEqual(Math.ceil(orig.h * 0.6) + 2);
  });

  it("範囲外の倍率は拒否する", () => {
    expect(() => scaledFx(hitSpark, 0)).toThrow(RangeError);
    expect(() => scaledFx(hitSpark, 1.5)).toThrow(RangeError);
  });
});
