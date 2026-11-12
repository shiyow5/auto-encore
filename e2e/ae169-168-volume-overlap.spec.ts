/**
 * AE#169 / #168: 実行中（演出あり）に、音量ボタンが見出し・ヒント行に重ならない。
 * 操作ボタン行（向き・音高・消す・音）の上に演出が載って、押せない・読めない状態にならない。
 * 重なりは文字の実測範囲（Range）で見る（ヒント行は箱が全幅なので箱では測らない）。
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { fnv1a } from "../src/core/checksum";

interface P {
  machine: "belt" | "merger" | "tuner";
  pos: [number, number];
  dir: "N" | "E" | "S" | "W";
}
const SOL = JSON.parse(
  fs.readFileSync(
    fileURLToPath(new URL("../src/data/solutions/order-03-frugal.json", import.meta.url)),
    "utf8",
  ),
) as { placements: P[] };
const NAME = { belt: "ベルト", merger: "合流機", tuner: "調律機" } as const;
const ROT = ["E", "S", "W", "N"] as const;

const IDS = ["order-01", "order-02", "order-03"];
const unlockAll = JSON.stringify({ v: 1, sum: fnv1a(JSON.stringify(IDS)), data: IDS });

const VIEWPORTS = [
  { name: "縦 390×844", width: 390, height: 844, mobile: true },
  { name: "横 844×390", width: 844, height: 390, mobile: true },
];

test.setTimeout(60_000);

for (const vp of VIEWPORTS) {
  test(`AE#169/#168 ${vp.name}: 実行中に音量ボタンが他要素と重ならない`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: true,
      isMobile: vp.mobile,
    });
    const page = await ctx.newPage();
    await page.addInitScript((v) => localStorage.setItem("ae-order-unlocked", v), unlockAll);
    await page.goto("/");
    await page.getByRole("button", { name: "はじめる" }).click();
    await page.locator('button[data-order-id="order-03"]').click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    // 注文3の模範解を置いて、実行が数秒続く状態にする
    let cur: P["machine"] | null = null;
    let dir: P["dir"] = "E";
    for (const p of SOL.placements) {
      if (p.machine !== cur) {
        await page.getByRole("button", { name: new RegExp(`${NAME[p.machine]}を選ぶ`) }).click();
        cur = p.machine;
      }
      while (dir !== p.dir) {
        await page.getByRole("button", { name: /^次に置く向き/ }).click();
        dir = ROT[(ROT.indexOf(dir) + 1) % 4]!;
      }
      await page.getByRole("button", { name: `マス ${p.pos[0]},${p.pos[1]}: 空き` }).click();
    }
    await page.locator("#ws-overlay .ws-run").click();
    await expect(page.locator("#ws-overlay")).toHaveAttribute("data-running", "true");
    await page.waitForTimeout(300);

    const r = await page.evaluate(() => {
      const rect = (el: Element) => el.getBoundingClientRect();
      const vol = rect(document.getElementById("volume-toggle")!);
      // 文字の実際の範囲（Range）で測る
      const textHit = (sel: string) =>
        [...document.querySelectorAll(sel)].flatMap((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...range.getClientRects()].map((b) => {
            const w = Math.min(vol.right, b.right) - Math.max(vol.left, b.left);
            const h = Math.min(vol.bottom, b.bottom) - Math.max(vol.top, b.top);
            return w > 0 && h > 0 ? `${sel} text ${Math.round(w)}x${Math.round(h)}` : null;
          });
        });
      const ov = document.getElementById("ws-overlay")!;
      const btns = [...document.querySelectorAll<HTMLElement>("#ws-overlay .ws-actions .ws-btn")];
      const covered = btns.filter((b) => {
        const q = rect(b);
        const top = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
        return top === null || !ov.contains(top);
      });
      return {
        overlaps: [...textHit("#ws-overlay h2"), ...textHit(".ws-help-line")].filter(Boolean),
        covered: covered.map((b) => b.textContent),
        nBtn: btns.length,
      };
    });
    console.log(JSON.stringify(r));
    expect(r.overlaps).toEqual([]);
    expect(r.nBtn).toBeGreaterThan(0);
    expect(r.covered).toEqual([]);
    await ctx.close();
  });
}
