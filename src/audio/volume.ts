/**
 * 音量（BGM と SE を別々に）。0〜100% を 10% 刻みで、localStorage に保存する。
 *
 * - ミュート（ae-audio-enabled・♪ボタン）とは別の設定。ミュート中は音量にかかわらず鳴らさない。
 * - 音量 0 は「その種類だけ無音」。BGM も SE も 0 のときは、画面の表示は「音なし」と同じにする（isSilentByVolume）。
 * - localStorage が使えない環境では、そのページを開いている間だけ覚える。
 */

export type VolumeKind = "bgm" | "sfx";

export const VOLUME_STEP = 10;
/** 種類別の既定値。BGM は 100% のゲインが旧 100% の2倍（+6dB）なので、既定 50% で旧既定と同じ聞こえ方（Issue #218）。 */
export const VOLUME_DEFAULTS: Record<VolumeKind, number> = { bgm: 50, sfx: 100 };
/** 旧定数（SE の既定値）。 */
export const VOLUME_DEFAULT = VOLUME_DEFAULTS.sfx;

/** BGM は #218 で上げ側を +6dB 広げたので、保存キーを分ける（旧キーの値は換算して引き継ぐ）。 */
const KEYS: Record<VolumeKind, string> = { bgm: "ae-bgm-volume-v2", sfx: "ae-sfx-volume" };
const LEGACY_BGM_KEY = "ae-bgm-volume";
const memory: Record<VolumeKind, number> = { ...VOLUME_DEFAULTS };
const listeners = new Set<() => void>();

/** 0〜100 の整数に丸めて 10 刻みに寄せる。数値でなければ既定値。 */
export function normalizeVolume(v: unknown, fallback: number = VOLUME_DEFAULT): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  const clamped = Math.min(100, Math.max(0, n));
  return Math.round(clamped / VOLUME_STEP) * VOLUME_STEP;
}

/**
 * 旧 BGM 音量（ae-bgm-volume・旧ゲイン基準）を新基準へ換算する。聞こえ方を保つため半分にして 10 刻みに丸め、
 * 0 より大きければ最小 10%（無音にしない）。数値でなければ BGM の既定値。
 */
export function migrateLegacyBgm(v: unknown): number {
  const old = normalizeVolume(v, VOLUME_DEFAULT);
  if (old === 0) return 0;
  return Math.max(VOLUME_STEP, Math.round(old / 2 / VOLUME_STEP) * VOLUME_STEP);
}

/** 保存されている音量（%）。 */
export function getVolumePercent(kind: VolumeKind): number {
  try {
    const v = localStorage.getItem(KEYS[kind]);
    if (v !== null) return normalizeVolume(v, VOLUME_DEFAULTS[kind]);
    if (kind === "bgm") {
      const legacy = localStorage.getItem(LEGACY_BGM_KEY);
      if (legacy !== null) return migrateLegacyBgm(legacy);
    }
  } catch {
    // 使えないときはメモリの値
  }
  return memory[kind];
}

/** 音量の倍率（0〜1）。 */
export function getVolume(kind: VolumeKind): number {
  return getVolumePercent(kind) / 100;
}

export function setVolumePercent(kind: VolumeKind, percent: number): number {
  const v = normalizeVolume(percent, VOLUME_DEFAULTS[kind]);
  memory[kind] = v;
  try {
    localStorage.setItem(KEYS[kind], String(v));
  } catch {
    // 保存できないだけ
  }
  for (const l of listeners) l();
  return v;
}

/** BGM も SE も 0%（ミュートしていなくても無音）。 */
export function isSilentByVolume(): boolean {
  return getVolumePercent("bgm") === 0 && getVolumePercent("sfx") === 0;
}

/** 音量が変わったときに呼ばれる。戻り値で解除。 */
export function onVolumeChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
