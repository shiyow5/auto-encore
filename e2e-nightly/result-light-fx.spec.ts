/**
 * #207 軽量 spec（nightly 専用・必須 CI には入れない）
 *
 * fx 未指定（?fx=0 を付けない）で、注文1を最短で通して結果画面まで行く。
 * 演出ありの経路でも結果画面に着き、ボタンが見えることだけを確認する。
 * タイムアウトは 90s（暫定採用の ① と同じ値）。
 */
import { expect, test, type Page } from "@playwright/test";

async function waitForIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__qa !== undefined);
  await page.evaluate(() => window.__qa?.waitForIdle());
}

test.use({ viewport: { width: 844, height: 390 } });
test.setTimeout(90_000);

test("#207(nightly): fx 未指定でも結果画面に着き、4ボタンが見える", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await waitForIdle(page);
  for (let x = 1; x <= 10; x++) {
    await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  }
  await page.getByRole("button", { name: "実行" }).click();
  await waitForIdle(page);
  await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
  await expect(page.locator(".rs-actions button")).toHaveCount(4);
});
