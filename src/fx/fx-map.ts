import * as aurora from "pixelfx/fx/weather/aurora";
import * as shootingStars from "pixelfx/fx/weather/shooting-stars";
import * as comboCounter from "pixelfx/fx/ui/combo-counter";
import * as confetti from "pixelfx/fx/ui/confetti";
import * as levelUp from "pixelfx/fx/ui/level-up";
import * as coinSpin from "pixelfx/fx/pickups/coin-spin";
import * as heartPickup from "pixelfx/fx/pickups/heart-pickup";
import * as keyGlint from "pixelfx/fx/pickups/key-glint";
import * as glitch from "pixelfx/fx/scifi/glitch";
import * as crtOff from "pixelfx/fx/transitions/crt-off";
import * as hitSpark from "pixelfx/fx/impacts/hit-spark";
import type { FxModule, FxOptions } from "pixelfx";
import type { SfxName } from "../audio/sounds";

/**
 * 工房トーン（葡萄 → 琥珀 → 白）。pixelfx の既定色（ピンク等）が出ないよう、
 * 全ての fx 呼び出しに渡す（FxDirector.emit で既定値として入れる）。
 */
export const WORKSHOP_PALETTE: string[] = [
  "#1e1722",
  "#2a2030",
  "#3a2d42",
  "#5a3f66",
  "#8a6aa0",
  "#f2b45a",
  "#f6c77f",
  "#ffffff",
];

/**
 * 「ゲーム内イベント名 → pixelfx エフェクト」の対応表（唯一の置き場）。
 * シーンはイベント名で呼ぶだけ。pixelfx を直接 import しない。
 * 演出専用。ルール(src/core)からは参照しない。
 */
export type FxEventName =
  | "boot"
  | "ambient"
  | "noteCombo"
  | "noteArrive"
  | "songComplete"
  | "medalEarned"
  | "medalSilver"
  | "comboMilestone"
  | "placeError"
  | "runError"
  | "result";

export interface FxSpec {
  mod: FxModule;
  /** 画面内ドット座標（エフェクトの origin をここに置く） */
  x?: number;
  y?: number;
  /**
   * 盤面の下帯（FX 帯）内の位置を、帯の左上を (0,0)・右下を (1,1) とした割合で指定する。
   * 指定があると x / y より優先。帯が無いシーン（結果画面など）では出さない。
   */
  band?: { fx: number; fy: number };
  /**
   * 画面（ウィンドウ）の大きさに応じて origin を決める。指定があると x / y より優先。
   * 結果画面のカード（DOM）は画面の大きさで配置が変わるため、演出の位置も合わせる（Issue #132）。
   */
  originFor?: (viewportW: number, viewportH: number) => { x: number; y: number };
  options?: FxOptions;
  /** ループ系を一発ものとして使うときの再生秒数 */
  ttl?: number;
  /** true なら、同じイベントの前回分を止めてから再生する（combo の表示を重ねない） */
  exclusive?: boolean;
  /** back = 画面の背景側レイヤー / front = 手前 / overlay = DOM のカードよりさらに手前（透明 canvas） */
  layer: "back" | "front" | "overlay";
}

/**
 * 優先度（大きいほど残す）。前景の同時本数が上限に達したとき、低いものから止める。
 * 工房の優先順: エラー > コンボ > 到達スパーク（背景は枠の数に入れない）。
 */
export const FX_PRIORITY: Readonly<Record<FxEventName, number>> = {
  boot: 0,
  ambient: 0,
  noteCombo: 2,
  noteArrive: 1,
  songComplete: 0,
  medalEarned: 0,
  medalSilver: 0,
  comboMilestone: 0,
  placeError: 3,
  runError: 3,
  result: 0,
};

/**
 * LEVEL UP! の origin（内部ドット）。画面の大きさで選ぶ（結果画面のカードの文字・バッジに重ならない位置。Issue #132）。
 * - 広い画面（幅1000px以上、1280x720 など）: 左寄り x:52。中央（x:160）は数値に重なる。
 * - 横長の狭い画面（844x390）: 右の余白側 x:292。パネルの外に置き、「メダル」見出しに被せない。
 * - 縦長（390x844）: x:268, y:70。柱の下端がグラフの「目標」バッジに届かない高さに上げる。
 *   上げすぎると canvas の上端で切れるので、これより上には動かさない。
 */
export function levelUpOrigin(viewportW: number, viewportH: number): { x: number; y: number } {
  if (viewportW >= 1000) return { x: 52, y: 118 };
  if (viewportH > viewportW) return { x: 268, y: 70 };
  return { x: 292, y: 118 };
}

export const FX_MAP: Readonly<Record<FxEventName, readonly FxSpec[]>> = {
  boot: [{ mod: glitch, x: 160, y: 90, ttl: 0.6, layer: "front" }],
  ambient: [
    { mod: aurora, x: 160, y: 180, layer: "back" },
    { mod: shootingStars, x: 160, y: 180, layer: "back" },
  ],
  // 工房: 盤面の下帯の中央。帯は盤面の外なので音符や盤面を隠さない
  noteCombo: [{ mod: comboCounter, band: { fx: 0.5, fy: 0.5 }, exclusive: true, layer: "front" }],
  // 出口に音符が届いた 1 発。出口マーカーの真下（帯の右側）
  noteArrive: [{ mod: hitSpark, band: { fx: 0.9, fy: 0.5 }, layer: "front" }],
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
  // 見た目は出さない（盤面を覆わないため）。SE だけ FX_SFX から鳴る
  comboMilestone: [],
  placeError: [{ mod: glitch, band: { fx: 0.5, fy: 0.5 }, ttl: 0.5, layer: "front" }],
  runError: [
    { mod: glitch, band: { fx: 0.5, fy: 0.5 }, ttl: 0.6, layer: "front" },
    { mod: crtOff, x: 0, y: 0, layer: "front" },
  ],
  // 結果は日本語のカードが主役。pixelfx の文字は英数字のみ（日本語不可）で、ACHIEVEMENT バナーは
  // 画面上端で切れてカードに重なっていたので外した（AE#128）。メダル演出は medalEarned が担う。
  // LEVEL UP! はカード（DOM）の後ろに隠れないよう overlay。文言・座標はそのまま（Issue #132 案A）
  result: [{ mod: levelUp, x: 160, y: 118, layer: "overlay", originFor: levelUpOrigin }],
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
