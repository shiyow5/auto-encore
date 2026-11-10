import * as aurora from "pixelfx/fx/weather/aurora";
import * as shootingStars from "pixelfx/fx/weather/shooting-stars";
import * as achievement from "pixelfx/fx/ui/achievement";
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
import type { SfxName } from "../audio/sounds";

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
  | "medalSilver"
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
  // 銀・銅メダルだけのとき（見た目は金と同じ。音だけ変える）
  medalSilver: [
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
  result: [
    { mod: achievement, x: 160, y: 12, layer: "front" },
    { mod: levelUp, x: 160, y: 118, layer: "front" },
  ],
};

/** 演出に付ける SE。「演出 → 音」の対応はここだけ（シーンは playSfx を呼ばず emit するだけ）。 */
export interface FxSfx {
  sfx: SfxName;
  /** 演出の開始からの遅れ（ミリ秒）。結果画面の pass/encore（〜0.7秒）と重ならないようにずらす */
  delayMs?: number;
}

export const FX_SFX: Readonly<Partial<Record<FxEventName, FxSfx>>> = {
  comboMilestone: { sfx: "confetti" },
  // 結果画面は pass / encore（最長 0.7 秒）が先に鳴るので、メダルはその後
  medalEarned: { sfx: "medalGold", delayMs: 750 },
  medalSilver: { sfx: "medalSilver", delayMs: 750 },
  runError: { sfx: "runError" },
};
