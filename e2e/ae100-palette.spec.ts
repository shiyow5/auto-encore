import { test, expect } from "@playwright/test";

/** AE#100: 全画面の背景が --ae-bg (#1E1722) で、トークンが定義されていること。 */
test("AE#100: palette tokens and background on title / order / workshop", async ({ page }) => {
  await page.goto("/");
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await expect(page.getByLabel("はじめる")).toBeVisible();
  expect(await bodyBg()).toBe("rgb(30, 23, 34)");

  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return ["--ae-bg", "--ae-line", "--ae-text-muted", "--ae-medal-gold"].map((k) =>
      cs.getPropertyValue(k).trim(),
    );
  });
  expect(tokens).toEqual(["#1e1722", "#7a6888", "#9a88a8", "#ffd27a"]);

  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  await expect(page.locator("#ws-overlay")).toBeVisible();
  expect(await bodyBg()).toBe("rgb(30, 23, 34)");
});
