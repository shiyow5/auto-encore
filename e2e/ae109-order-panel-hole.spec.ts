/**
 * AE#109: 844×390（DPR2）の工房で、注文票の直下に「何も描かれない穴（白い矩形）」が出ない。
 * 原因は .ws-order（overflow:auto）の単色背景。画面の画素が不透明かを見る。
 */
import { expect, test } from "@playwright/test";
import { fnv1a } from "../src/core/checksum";

const ids = ["order-01", "order-02", "order-03"];
const unlockAll = JSON.stringify({ v: 1, sum: fnv1a(JSON.stringify(ids)), data: ids });

for (const fx of ["", "?fx=0"]) {
  test(`AE#109 844×390 DPR2 ${fx || "演出あり"}: 注文票の下に透明な穴がない`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.addInitScript((v) => localStorage.setItem("ae-order-unlocked", v), unlockAll);
    await page.goto(`/${fx}`);
    await page.getByRole("button", { name: "はじめる" }).click();
    await page.locator('button[data-order-id="order-03"]').click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    const panel = page.locator("#ws-overlay .ws-order");
    await expect(panel).toBeVisible();
    await page.waitForTimeout(800);
    const b = await panel.boundingBox();
    expect(b).not.toBeNull();
    const box = b as { x: number; y: number; width: number; height: number };
    const shot = (await page.screenshot()).toString("base64");
    // 撮った画像をページ内の canvas に読み込み、画素の alpha を見る（PNG デコーダを足さない）
    const bad = await page.evaluate(
      async ({ data, r }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d", { willReadFrequently: true });
        if (!g) return ["no-2d"];
        g.drawImage(img, 0, 0);
        const out: string[] = [];
        // 注文票の真下 4〜30px（CSS px）の帯を見る。撮影は DPR2
        for (let y = Math.round(r.y + r.height + 4); y < r.y + r.height + 30; y += 2) {
          for (let x = Math.round(r.x + 4); x < r.x + r.width - 4; x += 4) {
            if ((g.getImageData(x * 2, y * 2, 1, 1).data[3] ?? 0) < 255) out.push(`${x},${y}`);
          }
        }
        return out;
      },
      { data: shot, r: box },
    );
    expect(bad.slice(0, 5)).toEqual([]);
    await ctx.close();
  });
}
