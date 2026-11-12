/**
 * AE#114: 文字可読性。タイトル・注文選択・工房・結果の全テキストについて
 * - 本文 16px 以上。補足（.ae-footnote の価格・.rs-footer の脚注）も 14px 以上
 * - 文字色と実効背景のコントラスト 4.5:1 以上（ロック・無効の文字も含める）
 * を 1280×720 / 390×844 / 844×390 で確かめる。
 * 背景は祖先の background-color を重ねて求め、透明なら canvas 側の地色 --ae-bg とみなす。
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "@playwright/test";
import { fnv1a } from "../src/core/checksum";

const SOL = JSON.parse(
  fs.readFileSync(
    fileURLToPath(new URL("../src/data/solutions/order-01-frugal.json", import.meta.url)),
    "utf8",
  ),
) as {
  placements: {
    machine: "belt" | "merger" | "tuner";
    pos: [number, number];
    dir: "N" | "E" | "S" | "W";
  }[];
};
const NAME = { belt: "ベルト", merger: "合流機", tuner: "調律機" } as const;
const ROT = ["E", "S", "W", "N"] as const;

async function audit(page: Page, screen: string): Promise<string[]> {
  return page.evaluate((screen) => {
    type RGBA = [number, number, number, number];
    const parse = (s: string): RGBA => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1]!
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
    };
    const over = (top: RGBA, under: RGBA): RGBA => {
      const a = top[3];
      return [
        top[0] * a + under[0] * (1 - a),
        top[1] * a + under[1] * (1 - a),
        top[2] * a + under[2] * (1 - a),
        1,
      ];
    };
    const lum = (c: RGBA) => {
      const f = (v: number) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const ratio = (a: RGBA, b: RGBA) => {
      const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (l1! + 0.05) / (l2! + 0.05);
    };
    const base = parse(
      `rgb(${getComputedStyle(document.documentElement)
        .getPropertyValue("--ae-bg")
        .trim()
        .replace("#", "")
        .match(/../g)!
        .map((h) => parseInt(h, 16))
        .join(",")})`,
    );
    const bgOf = (el: Element): RGBA => {
      const layers: RGBA[] = [];
      for (let e: Element | null = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] >= 1) break;
      }
      let bg = base;
      for (const l of layers.reverse()) bg = over(l, bg);
      return bg;
    };
    const bad: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent ?? "").trim())
        .join("");
      // 絵文字だけ（🔒 など）はアイコン扱い
      if (!own || /^[\p{Extended_Pictographic}️\s]+$/u.test(own)) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || cs.visibility === "hidden") continue;
      if (el.closest("[hidden], [aria-hidden='true'], .sr-only, .visually-hidden")) continue;
      const px = parseFloat(cs.fontSize);
      const small = el.closest(".ae-footnote, .rs-footer") !== null;
      const min = small ? 14 : 16;
      const fg = over(parse(cs.color), bgOf(el));
      const cr = ratio(fg, bgOf(el));
      const tag = `${screen} ${el.tagName.toLowerCase()}.${String(el.className).trim().replace(/\s+/g, ".")} "${own.slice(0, 16)}"`;
      if (px < min) bad.push(`${tag} font=${px}px (<${min})`);
      if (cr < 4.5) bad.push(`${tag} contrast=${cr.toFixed(2)} ${cs.color}`);
    }
    return bad;
  }, screen);
}

async function idle(page: Page) {
  await page.waitForFunction(() => window.__qa !== undefined);
  await page.evaluate(() => window.__qa?.waitForIdle());
}

for (const [w, h] of [
  [1280, 720],
  [390, 844],
  [844, 390],
] as const) {
  test(`AE#114: 全画面の文字 16px(補足14px)以上・4.5:1 以上 ${w}×${h}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/?fx=0");
    const ids = ["order-01", "order-02"];
    await page.evaluate(
      ([k, v]) => {
        localStorage.clear();
        localStorage.setItem(k!, v!);
      },
      ["ae-order-unlocked", JSON.stringify({ v: 1, sum: fnv1a(JSON.stringify(ids)), data: ids })],
    );
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
    const bad: string[] = [];
    bad.push(...(await audit(page, "title")));

    await page.getByRole("button", { name: "はじめる" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select");
    bad.push(...(await audit(page, "order-select")));

    await page.locator('[data-order-id="order-01"] button').click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    await idle(page);
    bad.push(...(await audit(page, "workshop")));

    let cur: string | null = null;
    let dir = "E";
    for (const p of SOL.placements) {
      if (p.machine !== cur) {
        await page.getByRole("button", { name: new RegExp(`${NAME[p.machine]}を選ぶ`) }).click();
        cur = p.machine;
      }
      while (dir !== p.dir) {
        await page.getByRole("button", { name: /^次に置く向き/ }).click();
        dir = ROT[(ROT.indexOf(dir as (typeof ROT)[number]) + 1) % 4]!;
      }
      await page.getByRole("button", { name: `マス ${p.pos[0]},${p.pos[1]}: 空き` }).click();
    }
    await page.getByRole("button", { name: "実行" }).click();
    await idle(page);
    await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
    bad.push(...(await audit(page, "result")));

    expect(bad).toEqual([]);
  });
}
