import { expect, test, type Page } from "@playwright/test";

/** Issue #220: prefers-reduced-motion: reduce のとき、動き（位置移動・拡大縮小・点滅・降下）を出さず、結果は文字と形で分かる */
async function toResult(page: Page, xs: number[]) {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await page.evaluate(() => window.__qa?.waitForIdle());
  for (const x of xs) await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  await page.getByRole("button", { name: "実行" }).click();
  await page.evaluate(() => window.__qa?.waitForIdle());
  expect(await page.evaluate(() => window.__qa?.scene())).toBe("result");
}

const running = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === "running" && (a.effect?.getTiming().duration as number) > 150)
      .map((a) => (a as CSSAnimation).animationName ?? a.constructor.name),
  );

for (const [name, xs, text] of [
  ["成功", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], /./],
  ["失敗", [1, 2, 3, 4, 5], /ずれ/],
] as const) {
  test(`AE#220: reduce の結果画面(${name})は動かず、文字・形で状態が分かる`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await toResult(page, [...xs]);
    expect(await running(page)).toEqual([]);
    expect(await page.locator(".rs-conf").count()).toBe(0);
    await expect(page.locator("#rs-overlay")).toContainText(text);
    await expect(page.locator("#rs-overlay h2")).toBeVisible();
  });
}
