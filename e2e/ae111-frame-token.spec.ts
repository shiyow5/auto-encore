import { test, expect } from "@playwright/test";

/** AE#111: 枠トークン（外枠1px明色＋内側2px暗色＋角飾り、選択=実線＋ブラケット、ロック=暗枠）。 */
test("AE#111: panel frame token and locked border", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.getByLabel("はじめる").click();
  const locked = page.locator(".os-row-locked").first();
  expect(await locked.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(
    "rgb(90, 74, 100)",
  );
  expect(await locked.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("solid");

  await page.locator('[data-order-id="order-01"] button').click();
  for (const sel of [".ws-shelf", ".ws-order"]) {
    const shadow = await page.locator(sel).evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).toContain("rgb(18, 13, 22) 0px 0px 0px 2px inset");
    expect(shadow).toContain("rgb(196, 180, 201) 0px 0px 0px 1px");
  }
});
