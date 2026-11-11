import type { FxInstance, FxModule, FxOptions } from "pixelfx";
import { FX_MAP, FX_PRIORITY, FX_SFX, WORKSHOP_PALETTE } from "./fx-map";
import type { FxEventName, FxSpec } from "./fx-map";
import type { SfxName } from "../audio/sounds";

/** エフェクトを描いてよい矩形（内部解像度のドット）。 */
export interface Band {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** エフェクトを描く先（実体は PixelFxLayer。テストでは差し替える）。 */
export interface FxSink {
  play(mod: FxModule, options?: FxOptions, ttlSec?: number | null): FxInstance;
  stopAll(): void;
  destroy(): void;
}

export interface FxSinks {
  back: FxSink;
  front: FxSink;
  /** DOM のカードより手前に描く透明 canvas（結果画面の "LEVEL UP!" など）。無ければ front に描く。 */
  overlay?: FxSink;
}

export interface FxDirectorOptions {
  /** 帯（band 指定の spec の基準）。無ければ band 指定の spec は出さない。 */
  band?: () => Band | null;
  /** 前景（front）の同時本数の上限。省略なら無制限。背景は数えない。 */
  frontSlots?: number;
  /** 画面（ウィンドウ）の大きさ。originFor を持つ spec の位置決めに使う。無ければ x / y を使う。 */
  viewport?: () => { w: number; h: number } | null;
}

interface Live {
  name: FxEventName;
  prio: number;
  layer: "back" | "front" | "overlay";
  fx: FxInstance;
}

/**
 * イベント名でエフェクトを呼ぶ窓口。
 * - enabled() が false（?fx=0 / 視差効果を減らす）なら何も再生しない
 * - stop(name) でループ系を止める
 * - 前景が上限に達したら、優先度の低いものから止める（同じか高い優先度は入れない）
 * - dispose() で再生中のものを止めて破棄する（背景エフェクトのリーク防止）
 */
export class FxDirector {
  private disposed = false;
  private live: Live[] = [];
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  /**
   * sinks が null（?fx=0 など）でも、sfx があれば SE は鳴らす。
   * opts は帯と前景の上限。sfx は SE を鳴らす関数（本番は playSfx）。
   */
  constructor(
    private readonly sinks: FxSinks | null,
    private readonly enabled: () => boolean,
    private readonly opts: FxDirectorOptions = {},
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
    const sinks = this.sinks;
    if (!sinks || !this.enabled()) return false;
    this.prune();
    let played = false;
    FX_MAP[name].forEach((spec: FxSpec, i) => {
      if (spec.exclusive) this.stop(name);
      const at = this.place(spec);
      if (!at) return;
      if (spec.layer === "front" && !this.admit(FX_PRIORITY[name])) return;
      // palette は既定で工房トーン。spec / extra で上書きできる
      const opts: FxOptions = {
        seed: seed + i,
        palette: WORKSHOP_PALETTE,
        ...spec.options,
        ...this.specOptionsFor(spec),
        ...extra,
      };
      opts.x = at.x;
      opts.y = at.y;
      const fx = (sinks[spec.layer] ?? sinks.front).play(spec.mod, opts, spec.ttl ?? null);
      this.live.push({ name, prio: FX_PRIORITY[name], layer: spec.layer, fx });
      played = true;
    });
    return played;
  }

  /** そのイベントで再生中のものを止める（フェードアウトして消える）。 */
  stop(name: FxEventName): void {
    this.live = this.live.filter((l) => {
      if (l.name !== name) return true;
      l.fx.stop();
      return false;
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.live = [];
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.sinks?.back.destroy();
    this.sinks?.front.destroy();
    this.sinks?.overlay?.destroy();
  }

  /** 画面の大きさに応じた追加オプション（optionsFor）。画面が分からなければ空。 */
  private specOptionsFor(spec: FxSpec): FxOptions {
    if (!spec.optionsFor) return {};
    const vp = this.opts.viewport?.();
    return vp ? spec.optionsFor(vp.w, vp.h) : {};
  }

  /** 位置を決める。band 指定は帯の割合から、無ければ x / y。帯が無ければ null（出さない）。 */
  private place(spec: FxSpec): { x: number; y: number } | null {
    if (spec.band) {
      const b = this.opts.band?.();
      if (!b) return null;
      return { x: b.x + b.w * spec.band.fx, y: b.y + b.h * spec.band.fy };
    }
    const vp = spec.originFor ? this.opts.viewport?.() : null;
    if (spec.originFor && vp) return spec.originFor(vp.w, vp.h);
    return { x: spec.x ?? 0, y: spec.y ?? 0 };
  }

  /** 前景に 1 本入れてよいか。上限なら優先度の低いものを止めて空ける。空けられなければ false。 */
  private admit(prio: number): boolean {
    const limit = this.opts.frontSlots;
    if (limit === undefined) return true;
    for (;;) {
      const front = this.live.filter((l) => l.layer === "front");
      if (front.length < limit) return true;
      const lowest = front.reduce((a, b) => (b.prio < a.prio ? b : a));
      if (lowest.prio >= prio) return false;
      lowest.fx.stop();
      this.live = this.live.filter((l) => l !== lowest);
    }
  }

  /** 終わったものを一覧から外す。 */
  private prune(): void {
    this.live = this.live.filter((l) => !l.fx.done());
  }
}
