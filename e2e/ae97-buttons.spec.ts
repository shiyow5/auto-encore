/**
 * AE#97: 結果画面・注文選択のボタンを共通の .ae-btn（高さ44px・隣接 gap 12px以上・Primary は1つ）にそろえる。
 */
import { expect, test, type Page } from "@playwright/test";

async function waitForIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__qa !== undefined);
  await page.evaluate(() => window.__qa?.waitForIdle());
}

async function toOrderSelect(page: Page): Promise<void> {
  await page.goto("/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
}

for (const vp of [
  { width: 1280, height: 720, stacked: false },
  { width: 390, height: 844, stacked: true },
]) {
  test.describe(`AE#97 ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("成功結果: ボタンは高さ44px以上・間隔12px以上・Primary は1つ", async ({ page }) => {
      await toOrderSelect(page);
      await page.getByRole("button", { name: "開店前の試し弾き" }).click();
      await waitForIdle(page);
      for (let x = 1; x <= 10; x++) {
        await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
      }
      await page.getByRole("button", { name: "実行" }).click();
      await waitForIdle(page);
      await expect(page.locator("body")).toHaveAttribute("data-scene", "result");

      const back = page.getByRole("button", { name: "工房にもどる" });
      const next = page.getByRole("button", { name: "次の注文へ" });
      const b = await back.boundingBox();
      const n = await next.boundingBox();
      if (!b || !n) throw new Error("ボタンの位置が取れない");
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(n.height).toBeGreaterThanOrEqual(44);
      expect(Math.round(b.width)).toBe(Math.round(n.width));
      if (vp.stacked) {
        expect(n.y).toBeLessThan(b.y); // Primary が上
        expect(b.y - (n.y + n.height)).toBeGreaterThanOrEqual(12);
      } else {
        expect(b.x).toBeLessThan(n.x); // [工房にもどる] [次の注文へ]
        expect(n.x - (b.x + b.width)).toBeGreaterThanOrEqual(16 - 0.5);
        expect(Math.round(b.width)).toBe(160);
      }
      await expect(page.locator("#rs-overlay .ae-btn-primary")).toHaveCount(1);
      await expect(next).toHaveClass(/ae-btn-primary/);
      await expect(back).toHaveClass(/ae-btn-secondary/);
    });

    test("注文選択: 「タイトルへ戻る」は 44px 以上で左下 16px", async ({ page }) => {
      await toOrderSelect(page);
      const box = await page.getByRole("button", { name: "タイトルへ戻る" }).boundingBox();
      if (!box) throw new Error("ボタンの位置が取れない");
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeCloseTo(16, 0);
      expect(vp.height - (box.y + box.height)).toBeCloseTo(16, 0);
    });
  });
}
