import type Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { playSfx } from "../audio/player";
import { fxEnabled, onReducedMotion } from "../ui/flags";
import { FxDirector } from "./FxDirector";
import { PixelFxLayer } from "./PixelFxLayer";

/**
 * シーン用の FxDirector を作る。シーンが閉じる/再起動するときに自動で破棄する。
 * ?fx=0 のときは canvas も作らない。途中で「視差効果を減らす」にされたら再生中のものを止める。
 */
export function createSceneFx(
  scene: Phaser.Scene,
  keyPrefix: string,
  width: number = GAME_WIDTH,
  height: number = GAME_HEIGHT,
): FxDirector {
  if (!fxEnabled()) {
    // 音だけの FxDirector でも、シーンを離れたら予約中の SE（medal の遅延再生など）を止める
    const soundOnly = new FxDirector(null, fxEnabled, playSfx);
    scene.events.once("shutdown", () => soundOnly.dispose());
    return soundOnly;
  }
  const back = new PixelFxLayer(scene, `${keyPrefix}-back`, width, height);
  back.sprite.setDepth(-10);
  const front = new PixelFxLayer(scene, `${keyPrefix}-front`, width, height);
  front.sprite.setDepth(10);
  const director = new FxDirector({ back, front }, fxEnabled, playSfx);
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
