/**
 * 音の再生（Issue #46）。Web Audio API の OscillatorNode（+エンベロープ）で音符を鳴らす。
 *
 * - 音源ファイルは使わない（ライセンス・容量の判断を後回し）
 * - AudioContext はユーザー操作後に resume（自動再生制限対策）
 * - ミュートは localStorage に保存
 * - ?fx=0 / headless で AudioContext が無い/失敗しても例外にしない
 */

// ---------- 定数 ----------

/** 音高（0=do, 1=mi, 2=so）を周波数（Hz）に変換する純関数。 */
export function pitchToFrequency(pitch: number): number {
  // A4 = 440Hz を基準に、半音単位で計算
  // do=C4(60), mi=E4(64), so=G4(67) — MIDIノート番号
  const midi: Record<number, number> = { 0: 60, 1: 64, 2: 67 };
  const note = midi[pitch] ?? 60;
  return 440 * Math.pow(2, (note - 69) / 12);
}

// ---------- ミュート状態 ----------

const MUTE_KEY = "auto-encore-mute";

function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function toggleMute(): boolean {
  const next = !isMuted();
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    // localStorageが使えない場合は無視
  }
  return next;
}

// ---------- AudioContext ----------

let ctx: AudioContext | null = null;

/**
 * AudioContext を取得する。無ければ作る。
 * ?fx=0 または headless であれば null を返す（例外は投げない）。
 */
function getContext(): AudioContext | null {
  if (ctx) return ctx;
  // ?fx=0 の場合は音を出さない
  if (typeof location !== "undefined" && new URLSearchParams(location.search).get("fx") === "0") {
    return null;
  }
  // headless 環境ではAudioContextがundefinedの場合がある
  if (typeof AudioContext === "undefined") {
    return null;
  }
  try {
    ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * AudioContext を resume する（ユーザー操作が必要）。
 * 既にactiveなら何もしない。失敗しても例外を投げない。
 */
export async function ensureAudioContext(): Promise<AudioContext | null> {
  const c = getContext();
  if (!c) return null;
  if (c.state === "running") return c;
  try {
    await c.resume();
    return c;
  } catch {
    return null;
  }
}

// ---------- 音の再生 ----------

/** NoteLength (0=short, 1=long) を文字列に変換。 */
export function noteLengthStr(length: number): "short" | "long" {
  return length === 1 ? "long" : "short";
}

/**
 * 1音鳴らす。エンベロープ（attack 10ms, decay 40ms, sustain 60%, release 30ms）付き。
 * length: "short"=0.2s, "long"=0.4s。
 * lengthNum: 0=short, 1=long（SimNote.length 形式）。
 */
export function playNote(pitch: number, length?: "short" | "long"): void;
export function playNote(pitch: number, lengthNum?: 0 | 1): void;
export function playNote(pitch: number, length?: "short" | "long" | 0 | 1): void {
  if (isMuted()) return;
  const c = getContext();
  if (!c || c.state !== "running") return;

  const duration = length === 1 || length === "long" ? 0.4 : 0.2;
  const freq = pitchToFrequency(pitch);
  const now = c.currentTime;

  // OscillatorNode
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;

  // GainNode for envelope
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.01); // attack 10ms
  gain.gain.linearRampToValueAtTime(0.18, now + 0.05); // decay → sustain (60% of 0.3)
  gain.gain.setValueAtTime(0.18, now + duration - 0.03); // sustain
  gain.gain.linearRampToValueAtTime(0, now + duration); // release 30ms

  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

/**
 * 音符のリストを再生する。framesの各tickで出口に届いた音符を鳴らす用。
 */
export function playNotes(notes: { pitch: number; length: "short" | "long" }[]): void {
  for (const n of notes) {
    playNote(n.pitch, n.length);
  }
}
