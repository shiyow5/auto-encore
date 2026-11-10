/**
 * 注文1 のインタラクティブ・チュートリアル（Issue #50）。
 * 初回は 手順1→2→3 と進んで結果へ。2回目は出ない。スキップ後も出ない。
 */
import { expect, test, type Page } from "@playwright/test";

async function openOrder01(page: Page): Promise<void> {
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await page.waitForFunction(() => window.__qa !== undefined);
  await page.evaluate(() => window.__qa?.waitForIdle());
}

test("チュートリアル: 初回は3手順で結果へ。2回目は出ない", async ({ page }) => {
  await page.goto("/?fx=0");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openOrder01(page);

  const panel = page.locator(".ws-guide");
  await expect(panel).toContainText("手順1/3");
  await page.getByRole("button", { name: "マス 1,3: 空き" }).click();
  await expect(panel).toContainText("手順2/3");
  await page.getByRole("button", { name: "マス 1,3: ベルト 東向き" }).hover();
  await page.keyboard.press("r");
  await expect(panel).toContainText("手順3/3");
  await expect(panel).toContainText("失敗しても置き直せます");
  await page.getByRole("button", { name: "実行" }).click();
  await page.evaluate(() => window.__qa?.waitForIdle());
  await expect(page.locator("body")).toHaveAttribute("data-scene", "result");

  // 2回目は出ない
  await page.reload();
  await openOrder01(page);
  await expect(page.locator(".ws-guide")).toHaveCount(0);
});

test("チュートリアル: スキップすると次回以降も出ない", async ({ page }) => {
  await page.goto("/?fx=0");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openOrder01(page);
  await expect(page.locator(".ws-guide")).toBeVisible();
  await page.getByRole("button", { name: "スキップ" }).click();
  await expect(page.locator(".ws-guide")).toHaveCount(0);

  await page.reload();
  await openOrder01(page);
  await expect(page.locator(".ws-guide")).toHaveCount(0);
});
