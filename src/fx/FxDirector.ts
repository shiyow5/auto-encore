import type { FxInstance, FxModule, FxOptions } from "pixelfx";
import { FX_MAP, FX_SFX } from "./fx-map";
import type { FxEventName } from "./fx-map";
import type { SfxName } from "../audio/sounds";

/** エフェクトを描く先（実体は PixelFxLayer。テストでは差し替える）。 */
export interface FxSink {
  play(mod: FxModule, options?: FxOptions, ttlSec?: number | null): FxInstance;
  stopAll(): void;
  destroy(): void;
}

export interface FxSinks {
  back: FxSink;
  front: FxSink;
}

/**
 * イベント名でエフェクトを呼ぶ窓口。
 * - enabled() が false（?fx=0 / 視差効果を減らす）なら何も再生しない
 * - stop(name) でループ系（機械稼働など）を止める
 * - dispose() で再生中のものを止めて破棄する（背景エフェクトのリーク防止）
 */
export class FxDirector {
  private disposed = false;
  private readonly running = new Map<FxEventName, FxInstance[]>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  /** sfx は SE を鳴らす関数（本番は playSfx）。演出を切っていても（視差効果を減らす）音は鳴らす。 */
  constructor(
    private readonly sinks: FxSinks | null,
    private readonly enabled: () => boolean,
    private readonly sfx: ((name: SfxName) => void) | null = null,
  ) {}

  private playSfxFor(name: FxEventName): void {
    const s = FX_SFX[name];
    if (!s || !this.sfx) return;
    const play = this.sfx;
    if (!s.delayMs) return play(s.sfx);
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.disposed) play(s.sfx);
    }, s.delayMs);
    this.timers.add(t);
  }

  /** 1 つでも再生したら true。extra は全エフェクトに足すオプション（combo の count など）。 */
  emit(name: FxEventName, seed = 1, extra: FxOptions = {}): boolean {
    if (this.disposed) return false;
    this.playSfxFor(name);
    if (!this.sinks || !this.enabled()) return false;
    const specs = FX_MAP[name];
    const list = this.running.get(name) ?? [];
    specs.forEach((spec, i) => {
      if (spec.exclusive) for (const f of list.splice(0)) f.stop();
      const opts: FxOptions = { seed: seed + i, ...spec.options, ...extra };
      if (spec.x !== undefined) opts.x = spec.x;
      if (spec.y !== undefined) opts.y = spec.y;
      const fx = this.sinks?.[spec.layer].play(spec.mod, opts, spec.ttl ?? null);
      if (fx) list.push(fx);
    });
    this.running.set(name, list);
    return specs.length > 0;
  }

  /** そのイベントで再生中のものを止める（フェードアウトして消える）。 */
  stop(name: FxEventName): void {
    for (const f of this.running.get(name)?.splice(0) ?? []) f.stop();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.running.clear();
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.sinks?.back.destroy();
    this.sinks?.front.destroy();
  }
}
