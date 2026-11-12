import { test, expect, type Page } from "@playwright/test";

/**
 * AE#124 再発（2026-11-12, hinata）: 1280×720 の工房で、盤面の下（y≈660–712）に白い長方形。
 * DOM の背景色ではなく、Chromium の合成で WebGL canvas の一部が描かれない「穴」（スクショでは alpha=0）。
 * 不透明な DOM（チュートリアル帯 .ws-guide, y8–60）の上下反転位置に出る。
 * DOM の背景色を見る ae124-workshop-white-rect.spec.ts では検出できないので、スクショの画素で確かめる。
 * trace（スクリーンキャスト）を録ると合成の経路が変わって穴が出なくなるため、この spec では切る。
 */
test.use({ trace: "off" });

/** スクショ全体のうち、不透明でない（alpha<255）画素の数と範囲を返す。 */
async function holeOf(page: Page): Promise<{ count: number; box: number[] | null }> {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob, { premultiplyAlpha: "none" });
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let count = 0;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i]! < 255) {
        count++;
        const p = (i - 3) / 4;
        const x = p % c.width;
        const y = Math.floor(p / c.width);
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
    return { count, box: count ? [x0, y0, x1, y1] : null };
  }, png);
}

const sizes = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "390x844", width: 390, height: 844 },
  { name: "844x390", width: 844, height: 390 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

for (const s of sizes) {
  test(`AE#124: 工房（チュートリアル帯あり）の canvas に穴がない ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto("/?fx=0", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.getByLabel("はじめる").click();
    await page.waitForTimeout(800);
    await page.locator('[data-order-id="order-01"] button').click();
    await expect(page.locator(".ws-guide")).toBeVisible();
    await page.waitForTimeout(1800);
    expect(await holeOf(page)).toEqual({ count: 0, box: null });
  });
}
