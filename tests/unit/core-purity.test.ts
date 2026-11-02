import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** src/core は決定的でなければならない（CONTRIBUTING.md「ルール（src/core）の約束」）。 */
const CORE = join(__dirname, "../../src/core");
const FORBIDDEN: readonly [RegExp, string][] = [
  [/\bMath\.random\b/, "Math.random"],
  [/\bDate\b/, "Date"],
  [/\bperformance\b/, "performance"],
  [/from\s+["']phaser["']/, 'from "phaser"'],
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

/** コメントと文字列の中身は見ない（説明文に「Math.random を使わない」と書けるように）。 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
}

describe("src/core の禁止語", () => {
  it.each(files(CORE).map((f) => [relative(CORE, f), f]))("%s", (_name, file) => {
    const code = codeOnly(readFileSync(file, "utf8"));
    const hits = FORBIDDEN.filter(([re]) => re.test(code)).map(([, label]) => label);
    expect(hits).toEqual([]);
  });
});
