import { describe, expect, it, vi } from "vitest";
import { FxDirector } from "../../src/fx/FxDirector";
import type { FxSink } from "../../src/fx/FxDirector";
import { FX_MAP, FX_SFX } from "../../src/fx/fx-map";
import { SFX } from "../../src/audio/sounds";
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

describe("演出 → SE の対応（FX_SFX）", () => {
  it("紙吹雪・メダル・失敗に SE があり、すべて実在する SE", () => {
    for (const n of ["comboMilestone", "medalEarned", "medalSilver", "runError"] as const) {
      expect(FX_SFX[n], n).toBeDefined();
    }
    for (const s of Object.values(FX_SFX)) expect(SFX[s.sfx]).toBeDefined();
    expect(FX_SFX.medalEarned?.sfx).not.toBe(FX_SFX.medalSilver?.sfx);
  });

  it("emit すると対応する SE を鳴らす。演出が切られていても SE は鳴る", () => {
    const sfx = vi.fn();
    const d = new FxDirector(null, () => false, sfx);
    expect(d.emit("comboMilestone")).toBe(false);
    expect(sfx).toHaveBeenCalledWith("confetti");
    d.emit("runError");
    expect(sfx).toHaveBeenCalledWith("runError");
    d.emit("ambient");
    expect(sfx).toHaveBeenCalledTimes(2);
  });

  it("メダルの SE は結果の音（最長 0.7 秒）の後にずらし、破棄したら鳴らさない", () => {
    vi.useFakeTimers();
    try {
      const sfx = vi.fn();
      const d = new FxDirector(null, () => true, sfx);
      d.emit("medalEarned");
      expect(sfx).not.toHaveBeenCalled();
      vi.advanceTimersByTime(FX_SFX.medalEarned!.delayMs!);
      expect(sfx).toHaveBeenCalledWith("medalGold");
      sfx.mockClear();
      d.emit("medalSilver");
      d.dispose();
      vi.advanceTimersByTime(2000);
      expect(sfx).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
