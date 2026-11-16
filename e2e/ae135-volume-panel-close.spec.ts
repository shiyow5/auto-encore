import { expect, test } from "@playwright/test";

// #135: 音量パネルが外側タップ / Esc（フォーカスが body）/ ボタン再タップで閉じる。
const SIZES = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "390x844", width: 390, height: 844 },
  { name: "844x390", width: 844, height: 390 },
];

for (const s of SIZES) {
  test.describe(`音量パネルの閉じ方 ${s.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: s.width, height: s.height });
      await page.goto("/");
      await expect(page.locator("body")).toHaveAttribute("data-scene", "title", {
        timeout: 15_000,
      });
      await page.locator("#volume-toggle").click();
      await expect(page.locator("#volume-panel")).toBeVisible();
      await page.screenshot({ path: `test-results/ae135-${s.name}-1-open.png` });
    });

    test("外側タップで閉じる", async ({ page }) => {
      await page.mouse.click(5, s.height - 5);
      await expect(page.locator("#volume-panel")).toBeHidden();
      await expect(page.locator("#volume-toggle")).toHaveAttribute("aria-expanded", "false");
      await page.screenshot({ path: `test-results/ae135-${s.name}-2-after-outside.png` });
    });

    test("フォーカスが body でも Esc で閉じ、音量ボタンにフォーカスが戻る", async ({ page }) => {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press("Escape");
      await expect(page.locator("#volume-panel")).toBeHidden();
      await expect(page.locator("#volume-toggle")).toBeFocused();
      await page.screenshot({ path: `test-results/ae135-${s.name}-3-after-esc.png` });
    });

    test("パネル内のスライダー操作では閉じず、ボタン再タップで閉じる", async ({ page }) => {
      await page.locator("#volume-sfx").fill("40");
      await expect(page.locator("#volume-panel")).toBeVisible();
      await page.locator("#volume-toggle").click();
      await expect(page.locator("#volume-panel")).toBeHidden();
      await page.locator("#volume-toggle").click();
      await expect(page.locator("#volume-panel")).toBeVisible();
    });
  });
}
