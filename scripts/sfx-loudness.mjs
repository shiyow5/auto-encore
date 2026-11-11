import { SFX } from "../src/audio/sounds.ts";

/** 実機の ZZFX.volume（zzfx の既定値）。 */
export const MASTER_VOLUME = 0.3;

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

/** ZzFX のパラメータから SE の波形を作る（ブラウザ API はダミーで足りる）。 */
export async function buildSfx(params) {
  globalThis.AudioContext ??= class {};
  globalThis.StereoPannerNode ??= class {};
  const { ZZFX } = await import("zzfx");
  return ZZFX.buildSamples(...params);
}

export function measure(samples) {
  let peak = 0;
  let sum = 0;
  for (const v of samples) {
    const s = v * MASTER_VOLUME;
    peak = Math.max(peak, Math.abs(s));
    sum += s * s;
  }
  return { peak: db(peak), rms: db(Math.sqrt(sum / samples.length)), sec: samples.length / 44100 };
}

export async function measureAll() {
  const rows = [];
  for (const [name, params] of Object.entries(SFX)) {
    rows.push({ name, ...measure(await buildSfx(params)) });
  }
  return rows;
}

export function summarize(rows) {
  const sorted = [...rows].sort((a, b) => a.rms - b.rms);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { min, max, spread: max.rms - min.rms };
}
