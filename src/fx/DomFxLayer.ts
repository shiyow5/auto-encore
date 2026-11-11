import { clearFrame, composite, createFrame, createFx } from "pixelfx";
import type { FxInstance, FxModule, FxOptions, PixelFrame } from "pixelfx";
import type { FxSink } from "./FxDirector";

interface Entry {
  fx: FxInstance;
  age: number;
  ttl: number | null;
}

/**
 * pixelfx の描画結果を、Phaser の canvas とは別の「透明な DOM canvas」に描くレイヤー。
 * 結果画面のカード（DOM）より手前に演出（"LEVEL UP!"）を出すために使う（Issue #132 案A）。
 * Phaser の canvas は不透明なので、canvas ごと前に出すとカードが隠れる。
 *
 * - 位置と大きさは Phaser の canvas（ゲーム本体）に毎フレーム合わせる（内部座標が同じになる）
 * - クリックは通す（pointer-events: none）。z-index は音量ボタン(200)より下
 * - 演出専用。ルール(src/core)からは参照しない。
 */
export class DomFxLayer implements FxSink {
  private readonly frame: PixelFrame;
  private readonly image: ImageData;
  private readonly ctx: CanvasRenderingContext2D | null;
  private active: Entry[] = [];
  readonly canvas: HTMLCanvasElement;

  constructor(
    private readonly host: HTMLElement,
    private readonly gameCanvas: HTMLCanvasElement,
    width: number,
    height: number,
  ) {
    this.frame = createFrame(width, height);
    this.image = new ImageData(width, height);
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    c.setAttribute("aria-hidden", "true");
    c.dataset.fxLayer = "overlay";
    Object.assign(c.style, {
      position: "absolute",
      zIndex: "1",
      pointerEvents: "none",
      imageRendering: "pixelated",
    });
    this.ctx = c.getContext("2d");
    this.canvas = c;
    host.append(c);
    this.fit();
  }

  play(mod: FxModule, options: FxOptions = {}, ttlSec: number | null = null): FxInstance {
    const fx = createFx(mod, options);
    this.active.push({ fx, age: 0, ttl: ttlSec });
    return fx;
  }

  /** Phaser の canvas と同じ位置・大きさに合わせる（FIT で拡大縮小・中央寄せされるため）。 */
  private fit(): void {
    const g = this.gameCanvas.getBoundingClientRect();
    const h = this.host.getBoundingClientRect();
    const s = this.canvas.style;
    s.left = `${g.left - h.left}px`;
    s.top = `${g.top - h.top}px`;
    s.width = `${g.width}px`;
    s.height = `${g.height}px`;
  }

  /** dt は秒。 */
  update(dt: number): void {
    this.fit();
    clearFrame(this.frame);
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i] as Entry;
      e.age += dt;
      if (e.ttl !== null && e.age >= e.ttl) {
        e.fx.stop();
        e.ttl = null;
      }
      e.fx.update(dt);
      if (e.fx.done()) {
        this.active.splice(i, 1);
        continue;
      }
      e.fx.draw(this.frame, "back");
      e.fx.draw(this.frame, "front");
    }
    composite(this.frame, this.image.data, null);
    this.ctx?.putImageData(this.image, 0, 0);
  }

  stopAll(): void {
    for (const e of this.active) e.fx.stop();
  }

  destroy(): void {
    this.stopAll();
    this.active = [];
    this.canvas.remove();
  }
}
