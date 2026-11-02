/**
 * 状態の比較・ゴールデン用の文字列化とハッシュ。
 * JSON.stringify はキーの並びで結果が変わるので、キーを昇順に並べてから文字列にする。
 */
import { fnv1a } from "../checksum";

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") {
    if (typeof v === "number" && !Number.isFinite(v)) throw new RangeError(`not finite: ${v}`);
    if (v === undefined) throw new TypeError("undefined は文字列化できない");
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

/** FNV-1a 32bit を2本（元の文字列と、前に区切りを足した文字列）つないだ 64bit 相当の16桁。 */
export function hash64(text: string): string {
  return fnv1a(text) + fnv1a(`\u0001${text}`);
}

export function stateHash(v: unknown): string {
  return hash64(stableStringify(v));
}
