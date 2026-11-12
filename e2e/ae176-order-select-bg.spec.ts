/**
 * AE#176: 注文選択は (4) overlay が背景を塗らず後ろの星空 canvas が見える、
 * (5) スマホ縦で見出しが上端付近（上の空白なし）に来る。
 */
import { expect, test } from "@playwright/test";

const sizes = [
  { name: "PC", width: 1280, height: 720 },
  { name: "SP縦", width: 390, height: 844 },
  { name: "SP横", width: 844, height: 390 },
];

for (const s of sizes) {
  test(`AE#176 ${s.name}: overlay は透明で、見出しの上に大きな空白がない`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto("/");
    await page.getByRole("button", { name: "はじめる" }).click();
    const ov = page.locator("#order-select-overlay");
    await expect(ov).toBeVisible();
    await expect(ov).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    // 文字に text-shadow（星と重なっても読める）
    await expect(ov.locator(".os-note")).not.toHaveCSS("text-shadow", "none");
    // canvas は画面を覆う（星空の左右・上下に硬いエッジが出ない）
    const box = await page.locator("#game canvas").first().boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(s.width - 1);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(s.height - 1);
    if (s.name === "SP縦") {
      const top = await page.locator(".os-heading").evaluate((e) => e.getBoundingClientRect().top);
      expect(top).toBeLessThanOrEqual(64);
    }
  });
}
