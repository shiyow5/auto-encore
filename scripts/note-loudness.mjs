/* global process, console */
import { legacyNoteGainAt, noteGainAt, NOTE_LENGTH_S } from "../src/fx/note-envelope.ts";

/** 実行音符の周波数（do / mi / so）。 */
export const NOTE_FREQS = [262, 330, 392];
const RATE = 44100;
const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

/** sine × エンベロープを 0.2 秒ぶんオフラインで作って RMS / ピーク（dBFS）を測る（#135 と同じ近似）。 */
export function measureNote(freq, gainAt) {
  const n = Math.round(NOTE_LENGTH_S * RATE);
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const s = Math.sin(2 * Math.PI * freq * t) * gainAt(t);
    peak = Math.max(peak, Math.abs(s));
    sum += s * s;
  }
  return { rms: db(Math.sqrt(sum / n)), peak: db(peak) };
}

export function measureNotes() {
  return NOTE_FREQS.map((freq) => ({
    freq,
    before: measureNote(freq, legacyNoteGainAt),
    after: measureNote(freq, noteGainAt),
  }));
}

if (process.argv[1]?.endsWith("note-loudness.mjs")) {
  console.log("freq | before RMS/peak | after RMS/peak (dBFS)");
  for (const r of measureNotes()) {
    const f = (m) => `${m.rms.toFixed(1)} / ${m.peak.toFixed(1)}`;
    console.log(`${r.freq}Hz | ${f(r.before)} | ${f(r.after)}`);
  }
}
