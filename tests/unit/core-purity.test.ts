import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** src/core は決定的でなければならない（CONTRIBUTING.md「ルール（src/core）の約束」）。 */
const CORE = join(__dirname, "../../src/core");
const FORBIDDEN: readonly [RegExp, string][] = [
  [/\bMath\.random\b/, "Math.random"],
  [/\bDate\b/, "Date"],
  [/\bperformance\b/, "performance"],
  [/\bwindow\b/, "window"],
  [/\bdocument\b/, "document"],
  [/\blocaleCompare\b/, "localeCompare"],
];

function files(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
    });
}

/** import 先は文字列なので、文字列を消す前の（コメントだけ除いた）ソースで見る。 */
const FORBIDDEN_IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*["']phaser(?:\/[^"']*)?["']/;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * コメントと '…' "…" の中身は見ない（説明文に「Math.random を使わない」と書けるように）。
 * テンプレート文字列は `${…}` に実行されるコードが入るので消さない。
 */
function codeOnly(src: string): string {
  return stripComments(src).replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
}

describe("src/core の禁止語", () => {
  it.each(files(CORE).map((f) => [relative(CORE, f), f]))("%s", (_name, file) => {
    const src = readFileSync(file, "utf8");
    const code = codeOnly(src);
    const hits = FORBIDDEN.filter(([re]) => re.test(code)).map(([, label]) => label);
    if (FORBIDDEN_IMPORT.test(stripComments(src))) hits.push('import "phaser"');
    expect(hits).toEqual([]);
  });
});

describe("禁止語の検出そのもの", () => {
  it("phaser の import を見逃さない（静的・動的・サブパス）", () => {
    for (const src of [
      'import Phaser from "phaser";',
      "import { Scene } from 'phaser';",
      'const P = await import("phaser");',
      'import "phaser/src/core";',
    ]) {
      expect(FORBIDDEN_IMPORT.test(stripComments(src)), src).toBe(true);
    }
    expect(FORBIDDEN_IMPORT.test(stripComments('// import Phaser from "phaser"'))).toBe(false);
  });

  it("テンプレート文字列の ${} の中のコードは見る・普通の文字列とコメントは見ない", () => {
    const hit = (src: string): boolean => FORBIDDEN.some(([re]) => re.test(codeOnly(src)));
    expect(hit("const s = `t=${Date.now()}`;")).toBe(true);
    expect(hit("const s = `${Math.random()}`;")).toBe(true);
    expect(hit('const s = "Math.random を使わない";')).toBe(false);
    expect(hit("// Date を使わない")).toBe(false);
    expect(hit('const url = "http://example.com"; const n = 1;')).toBe(false);
  });
});
