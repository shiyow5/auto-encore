/**
 * ZzFX/ZzFXM 音声モジュール (Issue #46 統合)。
 *
 * - ZzFX (MIT) で操作SE、ZzFXM (MIT) でBGMを再生
 * - 既存の src/fx/audio.ts (OscillatorNode) を壊さない。両方共存。
 * - AudioContext は最初のユーザー操作で resume。?fx=0・e2e でも例外を出さない。
 * - 音量は localStorage (ae-audio-enabled) で保存。デフォルト on。
 * - SE/BGM は名前付きで再生: playSe("click") / playBgm() / stopBgm()
 */

// @ts-expect-error vendor JS has no type declarations
import { zzfx, ZZFX } from "./vendor/zzfx.js";
// @ts-expect-error vendor JS has no type declarations
import { zzfxM } from "./vendor/zzfxm.js";

const ZZFXR = ZZFX.sampleRate;
const ZZFXG = ZZFX.buildSamples.bind(ZZFX);

// ---------- SE定義 ----------

/** SEパラメータ表。ZzFX: [volume, randomness, frequency, attack, sustain, release, shape, curve, slide, delta, jump, jumpTime, repeat, noise, modulation, crush, delay, sustainVol, decay, tremolo, filter] */

const SE_DEFS: Record<string, Parameters<typeof zzfx>> = {
  // ボタン操作
  click: [0.8, 0, 600, 0, 0, 0.05, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  select: [0.6, 0, 800, 0, 0, 0.08, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],

  // 決定/キャンセル
  confirm: [0.8, 0, 1000, 0, 0, 0.1, 0, 1, 300, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  cancel: [0.6, 0, 400, 0, 0, 0.15, 0, 1, -200, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],

  // 移動
  move: [0.4, 0, 200, 0, 0, 0.03, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],

  // 攻撃・被弾・撃破
  attack: [0.7, 0, 300, 0, 0, 0.05, 5, 1, 200, 0, 0, 0, 0, 0.5, 0, 0, 0, 1, 0, 0, 0],
  hit: [0.8, 0, 150, 0, 0, 0.1, 3, 1, -50, 0, 0, 0, 0, 0.3, 0, 0, 0, 1, 0, 0, 0],
  destroy: [0.9, 0, 100, 0, 0.05, 0.3, 0, 2, -80, 0, 0, 0, 0, 0.2, 0, 0, 0, 1, 0, 0.5, 0],

  // 宝箱
  treasure: [0.7, 0, 1200, 0, 0, 0.2, 0, 1, 400, 200, 0, 0.01, 0, 0, 0, 0, 0, 1, 0, 0, 0],

  // 階段
  stairs: [0.4, 0, 300, 0, 0, 0.05, 2, 1, 100, 0, 0, 0, 0, 0, 0, 0, 0.1, 1, 0, 0, 0],

  // 機械の配置/実行
  place: [0.5, 0, 500, 0, 0, 0.06, 6, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  execute: [0.7, 0, 600, 0, 0, 0.1, 0, 1, 200, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],

  // エラー
  error: [0.8, 0, 200, 0, 0, 0.2, 5, 1, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 1, 0, 0, 0],

  // 結果表示
  result: [0.6, 0, 800, 0, 0, 0.15, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
};

// ---------- BGM定義 ----------

/**
 * BGM曲データ (ZzFXM)。
 * instruments: ZzFXパラメータの配列（音源定義）
 * patterns: [channel, pan, note, ...notes] の配列
 * sequence: パターンインデックスの配列
 */
const BGM_INSTRUMENTS: number[][] = [
  // 0: メロディ用 (sin波)
  [0.8, 0, 440, 0.01, 0.1, 0.3, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  // 1: ベース用 (saw)
  [0.5, 0, 110, 0.01, 0.1, 0.4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0.3, 0],
];

const BGM_PATTERNS: number[][][] = [
  // パターン0: メロディ 4小節
  [
    [0, 0, 12, 0, 16, 0, 19, 0, 0, 0], // C4, E4, G4, rest
    [1, -0.3, 0, 0, 0, 0, 0, 0, 0, 0], // C2 bass
  ],
  // パターン1: メロディ 4小節
  [
    [0, 0, 19, 0, 17, 0, 16, 0, 0, 0], // G4, F4, E4, rest
    [1, -0.3, 5, 0, 5, 0, 5, 0, 0, 0], // F2 bass
  ],
  // パターン2: メロディ 4小節
  [
    [0, 0, 19, 0, 22, 0, 24, 0, 22, 0], // G4, B4, C5, B4
    [1, -0.3, 7, 0, 7, 0, 7, 0, 7, 0], // G2 bass
  ],
  // パターン3: メロディ 4小節
  [
    [0, 0, 19, 0, 17, 0, 16, 0, 0, 0], // G4, F4, E4, rest
    [1, -0.3, 0, 0, 0, 0, 0, 0, 0, 0], // C2 bass
  ],
];

const BGM_SEQUENCE = [0, 1, 2, 3] as number[];

// ---------- 再生 ----------

let currentBgmSource: ReturnType<ZZFX["playSamples"]> | null = null;

/** SEを再生。存在しない名前の場合は無視。失敗しても例外にしない。 */
export function playSe(name: string): void {
  const enabled =
    typeof globalThis !== "undefined" &&
    (globalThis as Record<string, unknown>).__aeAudioEnabled !== false;
  if (!enabled) return;
  const def = SE_DEFS[name];
  if (!def) return;
  try {
    const ctx = ZZFX.audioContext;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    zzfx(...(def as Parameters<typeof zzfx>));
  } catch {
    // 失敗しても無視
  }
}

/** BGMを再生（ループ）。既に再生中なら何もしない。 */
export function playBgm(): void {
  const enabled =
    typeof globalThis !== "undefined" &&
    (globalThis as Record<string, unknown>).__aeAudioEnabled !== false;
  if (!enabled) return;
  if (currentBgmSource) return;
  try {
    const ctx = ZZFX.audioContext;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    // ZzFXM からステレオサンプルデータを生成
    const samples = zzfxM(BGM_INSTRUMENTS, BGM_PATTERNS, BGM_SEQUENCE, 125, ZZFXR, ZZFXG);
    // loop 再生
    const source = ZZFX.playSamples(samples, 1, 1, 0, true);
    currentBgmSource = source;
  } catch {
    currentBgmSource = null;
  }
}

/** BGMを停止。 */
export function stopBgm(): void {
  if (currentBgmSource) {
    try {
      currentBgmSource.stop();
    } catch {
      // ignore
    }
    currentBgmSource = null;
  }
}

/** AudioContext を resume するリスナーを登録。 */
export function initAudio(): void {
  document.addEventListener(
    "click",
    () => {
      const ctx = ZZFX.audioContext;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    },
    { once: true },
  );
  document.addEventListener(
    "keydown",
    () => {
      const ctx = ZZFX.audioContext;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    },
    { once: true },
  );
}
