/**
 * AE#109: 844×390（DPR2）の工房で、注文票の直下に「何も描かれない穴（白い矩形）」が出ない。
 * 原因は .ws-order（overflow:auto）の単色背景。画面の画素が不透明かを見る。
 */
import { expect, test } from "@playwright/test";
import { fnv1a } from "../src/core/checksum";

const ids = ["order-01", "order-02", "order-03"];
const unlockAll = JSON.stringify({ v: 1, sum: fnv1a(JSON.stringify(ids)), data: ids });

for (const fx of ["", "?fx=0"]) {
  test(`AE#109 844×390 DPR2 ${fx || "演出あり"}: 画面に透明な穴（白い矩形）がない`, async ({
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
    const shot = (await page.screenshot()).toString("base64");
    // 撮った画像をページ内の canvas に読み込み、画素の alpha を見る（PNG デコーダを足さない）
    const bad = await page.evaluate(
      async ({ data }) => {
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
        // 画面全体（撮影は DPR2）を 4px 刻みで見て、alpha が 255 未満の画素（描かれていない穴）を集める
        const px = g.getImageData(0, 0, c.width, c.height).data;
        for (let y = 0; y < c.height; y += 4) {
          for (let x = 0; x < c.width; x += 4) {
            if ((px[(y * c.width + x) * 4 + 3] ?? 0) < 255) out.push(`${x / 2},${y / 2}`);
          }
        }
        return out;
      },
      { data: shot },
    );
    expect(bad.slice(0, 5)).toEqual([]);
    await ctx.close();
  });
}
