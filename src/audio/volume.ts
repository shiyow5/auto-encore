/**
 * 音量（BGM と SE を別々に）。0〜100% を 10% 刻みで、localStorage に保存する。
 *
 * - ミュート（ae-audio-enabled・♪ボタン）とは別の設定。ミュート中は音量にかかわらず鳴らさない。
 * - 音量 0 は「その種類だけ無音」。BGM も SE も 0 のときは、画面の表示は「音なし」と同じにする（isSilentByVolume）。
 * - localStorage が使えない環境では、そのページを開いている間だけ覚える。
 */

export type VolumeKind = "bgm" | "sfx";

export const VOLUME_STEP = 10;
export const VOLUME_DEFAULT = 100;

const KEYS: Record<VolumeKind, string> = { bgm: "ae-bgm-volume", sfx: "ae-sfx-volume" };
const memory: Record<VolumeKind, number> = { bgm: VOLUME_DEFAULT, sfx: VOLUME_DEFAULT };
const listeners = new Set<() => void>();

/** 0〜100 の整数に丸めて 10 刻みに寄せる。数値でなければ既定値。 */
export function normalizeVolume(v: unknown): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return VOLUME_DEFAULT;
  const clamped = Math.min(100, Math.max(0, n));
  return Math.round(clamped / VOLUME_STEP) * VOLUME_STEP;
}

/** 保存されている音量（%）。 */
export function getVolumePercent(kind: VolumeKind): number {
  try {
    const v = localStorage.getItem(KEYS[kind]);
    if (v !== null) return normalizeVolume(v);
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
  const v = normalizeVolume(percent);
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
