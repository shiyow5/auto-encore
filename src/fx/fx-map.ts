import * as aurora from "pixelfx/fx/weather/aurora";
import * as shootingStars from "pixelfx/fx/weather/shooting-stars";
import * as comboCounter from "pixelfx/fx/ui/combo-counter";
import * as confetti from "pixelfx/fx/ui/confetti";
import * as levelUp from "pixelfx/fx/ui/level-up";
import * as coinSpin from "pixelfx/fx/pickups/coin-spin";
import * as heartPickup from "pixelfx/fx/pickups/heart-pickup";
import * as keyGlint from "pixelfx/fx/pickups/key-glint";
import * as energyCore from "pixelfx/fx/scifi/energy-core";
import * as glitch from "pixelfx/fx/scifi/glitch";
import * as crtOff from "pixelfx/fx/transitions/crt-off";
import type { FxModule, FxOptions } from "pixelfx";

/**
 * 「ゲーム内イベント名 → pixelfx エフェクト」の対応表（唯一の置き場）。
 * シーンはイベント名で呼ぶだけ。pixelfx を直接 import しない。
 * 演出専用。ルール(src/core)からは参照しない。
 */
export type FxEventName =
  | "boot"
  | "ambient"
  | "noteCombo"
  | "comboMilestone"
  | "songComplete"
  | "medalEarned"
  | "machineRun"
  | "placeError"
  | "runError"
  | "result";

export interface FxSpec {
  mod: FxModule;
  /** 画面内ドット座標（エフェクトの origin をここに置く） */
  x?: number;
  y?: number;
  options?: FxOptions;
  /** ループ系を一発ものとして使うときの再生秒数 */
  ttl?: number;
  /** true なら、同じイベントの前回分を止めてから再生する（combo の表示を重ねない） */
  exclusive?: boolean;
  /** back = 画面の背景側レイヤー / front = 手前 */
  layer: "back" | "front";
}

export const FX_MAP: Readonly<Record<FxEventName, readonly FxSpec[]>> = {
  boot: [{ mod: glitch, x: 160, y: 90, ttl: 0.6, layer: "front" }],
  ambient: [
    { mod: aurora, x: 160, y: 180, layer: "back" },
    { mod: shootingStars, x: 160, y: 180, layer: "back" },
  ],
  noteCombo: [{ mod: comboCounter, x: 160, y: 20, exclusive: true, layer: "front" }],
  comboMilestone: [{ mod: confetti, x: 160, y: 100, layer: "front" }],
  songComplete: [
    { mod: confetti, x: 160, y: 100, layer: "front" },
    { mod: keyGlint, x: 284, y: 60, ttl: 2, layer: "front" },
  ],
  medalEarned: [
    { mod: coinSpin, x: 36, y: 100, ttl: 1.6, layer: "front" },
    { mod: heartPickup, x: 284, y: 100, ttl: 1.2, layer: "front" },
  ],
  // 盤面の中央を覆うので、実行の開始時に 1 拍だけ見せる（音符の流れを隠さない）
  machineRun: [{ mod: energyCore, x: 160, y: 100, ttl: 1.2, layer: "front" }],
  placeError: [{ mod: glitch, x: 160, y: 90, ttl: 0.5, layer: "front" }],
  runError: [
    { mod: glitch, x: 160, y: 90, ttl: 0.6, layer: "front" },
    { mod: crtOff, x: 0, y: 0, layer: "front" },
  ],
  // 結果は日本語のカードが主役。pixelfx の文字は英数字のみ（日本語不可）で、ACHIEVEMENT バナーは
  // 画面上端で切れてカードに重なっていたので外した（AE#128）。メダル演出は medalEarned が担う。
  result: [{ mod: levelUp, x: 160, y: 118, layer: "front" }],
};
