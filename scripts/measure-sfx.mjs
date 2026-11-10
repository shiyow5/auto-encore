/**
 * 全 SE のピークと RMS（dBFS）をオフラインで計測する。
 *   node --experimental-strip-types scripts/measure-sfx.mjs [--json]
 * ZzFX のパラメータから波形を作り（ZZFX.volume=0.3 ＝ 実機と同じマスター音量）、
 * ffmpeg の volumedetect と同じ定義（全サンプルの二乗平均）で測る。
 * 幅（最大 − 最小）が LOUDNESS_SPREAD_DB 以内かをテスト（tests/unit/sfx-loudness.test.ts）が見る。
 */
/* global process, console */
import { measureAll, summarize } from "./sfx-loudness.mjs";

const rows = await measureAll();
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log("name\tsec\tpeak_dBFS\trms_dBFS");
  for (const r of rows) {
    console.log(`${r.name}\t${r.sec.toFixed(3)}\t${r.peak.toFixed(1)}\t${r.rms.toFixed(1)}`);
  }
  const s = summarize(rows);
  console.log(
    `min ${s.min.name} ${s.min.rms.toFixed(1)} / max ${s.max.name} ${s.max.rms.toFixed(1)} / spread ${s.spread.toFixed(1)} dB`,
  );
}
