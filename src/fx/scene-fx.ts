import type Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { fxEnabled, onReducedMotion } from "../ui/flags";
import { FxDirector } from "./FxDirector";
import { FX_BOARD_MAX_ALPHA } from "./fx-map";

export { FX_BOARD_MAX_ALPHA };
import { PixelFxLayer } from "./PixelFxLayer";

export interface SceneFxOptions {
  /** 前面/背面レイヤーの不透明度の上限（0〜1）。省略は 1 */
  maxAlpha?: number;
}

/**
 * シーン用の FxDirector を作る。シーンが閉じる/再起動するときに自動で破棄する。
 * ?fx=0 のときは canvas も作らない。途中で「視差効果を減らす」にされたら再生中のものを止める。
 */
export function createSceneFx(
  scene: Phaser.Scene,
  keyPrefix: string,
  opts: SceneFxOptions = {},
): FxDirector {
  if (!fxEnabled()) return new FxDirector(null, fxEnabled);
  const back = new PixelFxLayer(scene, `${keyPrefix}-back`, GAME_WIDTH, GAME_HEIGHT);
  back.sprite.setDepth(-10);
  const front = new PixelFxLayer(scene, `${keyPrefix}-front`, GAME_WIDTH, GAME_HEIGHT);
  front.sprite.setDepth(10);
  const cap = Math.min(1, Math.max(0, opts.maxAlpha ?? 1));
  back.sprite.setAlpha(cap);
  front.sprite.setAlpha(cap);
  const director = new FxDirector({ back, front }, fxEnabled);
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
    director.dispose();
  });
  return director;
}
