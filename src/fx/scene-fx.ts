import type Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { fxEnabled, onReducedMotion } from "../ui/flags";
import { FxDirector } from "./FxDirector";
import type { Band } from "./FxDirector";
import { PixelFxLayer } from "./PixelFxLayer";

export interface SceneFxOptions {
  /** 前景の描画範囲。指定すると前景はこの矩形の中にだけ描く（盤面を覆わない）。 */
  band?: Band;
  /** 前景の同時本数の上限（背景は数えない） */
  frontSlots?: number;
  /** 演出レイヤー全体の不透明度（0〜1）。省略は 1。 */
  alpha?: number;
}

/**
 * シーン用の FxDirector を作る。シーンが閉じる/再起動するときに自動で破棄する。
 * ?fx=0 のときは canvas も作らない。途中で「視差効果を減らす」にされたら再生中のものを止める。
 */
export function createSceneFx(
  scene: Phaser.Scene,
  keyPrefix: string,
  options: SceneFxOptions = {},
): FxDirector {
  if (!fxEnabled()) return new FxDirector(null, fxEnabled);
  const back = new PixelFxLayer(scene, `${keyPrefix}-back`, GAME_WIDTH, GAME_HEIGHT);
  back.sprite.setDepth(-10);
  const front = new PixelFxLayer(scene, `${keyPrefix}-front`, GAME_WIDTH, GAME_HEIGHT);
  front.sprite.setDepth(10);
  if (options.alpha !== undefined) {
    back.sprite.setAlpha(options.alpha);
    front.sprite.setAlpha(options.alpha);
  }
  // 前景は帯の中だけに見せる（二重防御: 座標の指定と描画範囲の両方で盤面を守る）
  let clipGfx: Phaser.GameObjects.Graphics | null = null;
  const band = options.band ?? null;
  if (band) {
    clipGfx = scene.make.graphics({}, false);
    clipGfx.fillStyle(0xffffff, 1).fillRect(band.x, band.y, band.w, band.h);
    front.sprite.setMask(clipGfx.createGeometryMask());
  }
  const director = new FxDirector({ back, front }, fxEnabled, {
    band: () => band,
    frontSlots: options.frontSlots,
  });
  const tick = (_t: number, delta: number) => {
    back.update(delta / 1000);
    front.update(delta / 1000);
  };
  scene.events.on("update", tick);
  // 途中で「視差効果を減らす」にされたら、背景のループ演出も含めて止める（以後の emit は fxEnabled で止まる）
  const unwatch = onReducedMotion(() => {
    back.stopAll();
    front.stopAll();
  });
  scene.events.once("shutdown", () => {
    unwatch();
    scene.events.off("update", tick);
    clipGfx?.destroy();
    director.dispose();
  });
  return director;
}
