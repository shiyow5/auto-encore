/**
 * 実行音符（playNote）のエンベロープ（Issue #218）。Web Audio の指数ランプを純関数で再現する。
 *
 * 目標: RMS を SE と同じ -21dBFS 付近（±1dB）、ピークは SE の最大 -12.5dBFS 以下。
 * 旧: 0.3 → 0.001 の指数減衰（ピーク対 RMS が大きく、振幅を上げるとピークが超える）。
 * 新: 0.22 → 0.05 のゆるやかな指数減衰 + 終端の短いリリース（0.05 → 0.001・クリック防止）。
 */

/** 音の長さ（秒）。 */
export const NOTE_LENGTH_S = 0.2;
/** 開始ゲイン。 */
export const NOTE_START_GAIN = 0.22;
/** リリース開始時のゲイン。 */
export const NOTE_SUSTAIN_END_GAIN = 0.05;
/** 終端のゲイン（指数ランプは 0 に出来ない）。 */
export const NOTE_END_GAIN = 0.001;
/** 終端のリリース（秒）。 */
export const NOTE_RELEASE_S = 0.015;

/** 旧エンベロープ（比較用）。 */
export const LEGACY_NOTE_START_GAIN = 0.3;

/** 指数ランプ。Web Audio の exponentialRampToValueAtTime と同じ式。 */
function expRamp(v0: number, v1: number, t0: number, t1: number, t: number): number {
  return v0 * (v1 / v0) ** ((t - t0) / (t1 - t0));
}

/** 時刻 t（秒、0〜NOTE_LENGTH_S）のゲイン。 */
export function noteGainAt(t: number): number {
  const releaseAt = NOTE_LENGTH_S - NOTE_RELEASE_S;
  if (t <= 0) return NOTE_START_GAIN;
  if (t < releaseAt) return expRamp(NOTE_START_GAIN, NOTE_SUSTAIN_END_GAIN, 0, releaseAt, t);
  if (t < NOTE_LENGTH_S) {
    return expRamp(NOTE_SUSTAIN_END_GAIN, NOTE_END_GAIN, releaseAt, NOTE_LENGTH_S, t);
  }
  return NOTE_END_GAIN;
}

/** 旧エンベロープのゲイン（0.3 → 0.001 の指数減衰）。 */
export function legacyNoteGainAt(t: number): number {
  const c = Math.min(Math.max(t, 0), NOTE_LENGTH_S);
  return expRamp(LEGACY_NOTE_START_GAIN, NOTE_END_GAIN, 0, NOTE_LENGTH_S, c);
}

/** Web Audio に渡す節目。[時刻(秒), ゲイン, 種類]。 */
export function noteEnvelopePoints(): [number, number, "set" | "exp"][] {
  return [
    [0, NOTE_START_GAIN, "set"],
    [NOTE_LENGTH_S - NOTE_RELEASE_S, NOTE_SUSTAIN_END_GAIN, "exp"],
    [NOTE_LENGTH_S, NOTE_END_GAIN, "exp"],
  ];
}
