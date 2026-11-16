/**
 * #207: 844×390（横持ち）の結果画面で、4ボタンがスクロールなしで見えて押せること。
 *
 * - 成功（10マス）: 「工房にもどる」「次の注文へ」「注文選択」「タイトル」の4つ
 * - 失敗（9マス）: 「最初にずれたのは」が入っても、3つのボタンが見えること
 *
 * タイトル → 注文選択 → 工房 → マスをクリックして配置 → 実行、の流れでテストする。
 */
import { expect, test, type Page } from "@playwright/test";

async function waitForIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__qa !== undefined);
  await page.evaluate(() => window.__qa?.waitForIdle());
}

async function openOrder01(page: Page): Promise<void> {
  await page.goto("/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await waitForIdle(page);
}

async function placeBeltsAndRun(page: Page, last: number): Promise<void> {
  for (let x = 1; x <= last; x++) {
    await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  }
  await page.getByRole("button", { name: "実行" }).click();
  await waitForIdle(page);
  await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
}

test.use({ viewport: { width: 844, height: 390 } });
// #207: 横持ち結果画面は重いため、テストタイムアウトを 90s に延長
test.setTimeout(90_000);

test("#207: 成功時、結果画面の4ボタンがスクロールなしで見える", async ({ page }) => {
  await openOrder01(page);
  await placeBeltsAndRun(page, 10);
  const buttons = page.locator(".rs-actions button");
  await expect(buttons).toHaveCount(4);
  for (const b of await buttons.all()) {
    await expect(b).toBeInViewport();
  }
  expect(await page.locator("#rs-overlay").evaluate((el) => el.scrollTop)).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("#207: 失敗時（「最初にずれたのは」あり）もボタンが見える", async ({ page }) => {
  await openOrder01(page);
  await placeBeltsAndRun(page, 9);
  await expect(page.locator(".rs-fm")).toBeVisible();
  const buttons = page.locator(".rs-actions button");
  await expect(buttons).toHaveCount(3);
  for (const b of await buttons.all()) {
    await expect(b).toBeInViewport();
  }
});
