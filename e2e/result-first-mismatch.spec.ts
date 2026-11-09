/**
 * spec-e §2: 結果画面に「最初にずれた位置」が表示されることを確認する。
 *
 * - 模範解（ずれなし）: data-first-mismatch の行が出ない
 * - ベルトを1マス欠かす（音が届かない）: 「最初にずれた位置: 1音目」が出る
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

/** ベルトを x=1..last, y=3 に置いて実行し、結果画面まで進む。 */
async function placeBeltsAndRun(page: Page, last: number): Promise<void> {
  for (let x = 1; x <= last; x++) {
    await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  }
  await page.getByRole("button", { name: "実行" }).click();
  await waitForIdle(page);
  await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
}

test.describe("spec-e §2: 最初にずれた位置", () => {
  test("模範解では firstMismatch の行が出ない（ずれなし）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openOrder01(page);
    await placeBeltsAndRun(page, 10);
    await expect(page.locator("[data-first-mismatch]")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("ベルトを1マス欠かすと「最初にずれた位置: 1音目」が出る", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openOrder01(page);
    await placeBeltsAndRun(page, 9);
    const fm = page.locator("[data-first-mismatch]");
    await expect(fm).toHaveAttribute("data-first-mismatch", "1");
    await expect(fm).toContainText("最初にずれた位置: 1音目");
    expect(errors).toEqual([]);
  });
});
