import { test, expect, type Page } from "@playwright/test";

/** AE#99: タイポスケール。全テキスト要素の font-size ∈ {12,16,24,32}、12px は脚注/凡例クラスのみ。 */
const ALLOWED = [12, 16, 24, 32];

async function badFonts(page: Page): Promise<string[]> {
  return page.evaluate((allowed) => {
    const bad: string[] = [];
    const roots = ["title-overlay", "ws-overlay", "rs-overlay"]
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => e !== null);
    for (const root of roots) {
      for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
        const hasText = Array.from(el.childNodes).some(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "",
        );
        if (!hasText) continue;
        const px = parseFloat(getComputedStyle(el).fontSize);
        const foot = el.closest(".rs-footer, .ae-footnote, .ae-legend") !== null;
        if (!allowed.includes(px) || (px === 12 && !foot)) {
          bad.push(
            `${el.tagName}.${el.className}=${px}px "${(el.textContent ?? "").slice(0, 20)}"`,
          );
        }
      }
    }
    return bad;
  }, ALLOWED);
}

test("AE#99: タイトルと工房の文字サイズは 12/16/24/32 のみ", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.getByLabel("はじめる")).toBeVisible({ timeout: 10_000 });
  expect(await badFonts(page)).toEqual([]);
  const h1 = await page.locator("#title-overlay h1").evaluate((e) => getComputedStyle(e).fontSize);
  expect(h1).toBe("32px");

  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  await expect(page.locator("#ws-overlay")).toBeVisible();
  expect(await badFonts(page)).toEqual([]);
});
