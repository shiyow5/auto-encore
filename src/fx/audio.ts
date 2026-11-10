/**
 * 音声関連 (Issue #46)。Web Audio API の OscillatorNode で音符を鳴らす。
 *
 * - 音源ファイルは使わない。周波数は純関数 pitchToFreq() で計算。
 * - AudioContext は最初のユーザー操作（クリック/キー入力）で resume する。
 * - ?fx=0 / e2e (headless) で AudioContext が無い/失敗しても例外にしない。
 * - 音量は localStorage で保存。デフォルト on。
 */

import { getVolume } from "../audio/volume";

// ---------- 定数 ----------

/** ピッチ (0=do, 1=mi, 2=so) を周波数 (Hz) に変換する純関数。 */
export function pitchToFreq(pitch: number): number {
  // do=C4=262, mi=E4=330, so=G4=392
  const freqs = [262, 330, 392];
  return freqs[pitch] ?? 440;
}

/** 音の長さ（ミリ秒）。短いビープ音。 */
const NOTE_LENGTH_MS = 200;

/** 音量。0〜1。 */
const STORAGE_KEY = "ae-audio-enabled";

function getAudioEnabled(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

function setAudioEnabled(val: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, val ? "1" : "0");
  } catch {
    // localStorage が使えない場合は無視
  }
}

// ---------- AudioContext (シングルトン) ----------

let ctx: AudioContext | null = null;
let gainNode: GainNode | null = null;

/** AudioContext を取得する。既に作ってあればそれを返す。 */
function getContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    updateGain();
  } catch {
    // AudioContext が作れない場合は null
    return null;
  }
  return ctx;
}

/** 現在のミュート状態に合わせて gain を設定する。 */
function updateGain(): void {
  if (!gainNode) return;
  gainNode.gain.value = getAudioEnabled() ? getVolume("sfx") : 0;
}

/** 音量の設定が変わったときに、鳴らす音符の音量へ反映する。 */
export function refreshNoteGain(): void {
  updateGain();
}

// ---------- 再生 ----------

/** 音符を鳴らす。pitch: 0(do)/1(mi)/2(so)。失敗しても例外にしない。 */
export function playNote(pitch: number): void {
  const enabled = getAudioEnabled();
  if (!enabled) return;

  const context = getContext();
  if (!context) return;

  // resume (自動再生制限対策)
  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  try {
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.value = pitchToFreq(pitch);

    // エンベロープ: 急峻に立ち上がり、徐々に減衰
    const env = context.createGain();
    env.gain.setValueAtTime(0.3, context.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, context.currentTime + NOTE_LENGTH_MS / 1000);

    osc.connect(env);
    env.connect(gainNode ?? context.destination);

    osc.start();
    osc.stop(context.currentTime + NOTE_LENGTH_MS / 1000);
  } catch {
    // 失敗しても無視
  }
}

/** 音声をオン/オフにする。 */
export function toggleAudio(): boolean {
  const next = !getAudioEnabled();
  setAudioEnabled(next);
  updateGain();
  return next;
}

/** 現在のミュート状態を返す。 */
export function isAudioEnabled(): boolean {
  return getAudioEnabled();
}

// ---------- 初期化フック ----------

/**
 * AudioContext の resume を登録する。
 * クリック・キー入力・タッチのいずれかで context.resume() を呼ぶ。
 * ?fx=0 の場合は何もしない。
 */
export function initAudio(resumeOnFirstInteraction: (ctx: AudioContext) => void): void {
  if (getAudioEnabled() && !getContext()) {
    // AudioContext が既に作れない状態なら何もしない
    return;
  }

  const tryResume = (): void => {
    const context = getContext();
    if (context && context.state === "suspended") {
      context
        .resume()
        .then(() => resumeOnFirstInteraction(context))
        .catch(() => {});
    }
  };

  document.addEventListener("click", tryResume, { once: true });
  document.addEventListener("keydown", tryResume, { once: true });
  document.addEventListener("touchstart", tryResume, { once: true });
}
