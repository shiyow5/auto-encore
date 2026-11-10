import { test, expect } from "@playwright/test";

/** AE#95: スマホ縦 390×844 の工房。受入条件（minori 指定値）を DOM で検証する。 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("AE#95: 390×844 で本文 16px 以上・操作 44×44px 以上・盤面 30px/マス", async ({ page }) => {
  await page.goto("/?fx=0");
  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  const overlay = page.locator("#ws-overlay.ws-portrait");
  await expect(overlay).toBeVisible();

  const r = await page.evaluate(() => {
    const ov = document.getElementById("ws-overlay")!;
    const fonts: number[] = [];
    const small: string[] = [];
    for (const el of ov.querySelectorAll<HTMLElement>("*")) {
      const hasText = [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "",
      );
      if (!hasText) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      fonts.push(fs);
      if (fs < 16) small.push(`${el.tagName}:${fs}`);
    }
    const tapTargets = [...ov.querySelectorAll<HTMLElement>(".ws-actions .ws-btn, .ws-run")].map(
      (b) => {
        const { width, height } = b.getBoundingClientRect();
        return { t: b.textContent, width, height };
      },
    );
    const cell = ov.querySelector<HTMLElement>(".ws-cell")!.getBoundingClientRect();
    const grid = ov.querySelector<HTMLElement>(".ws-grid")!.getBoundingClientRect();
    const run = ov.querySelector<HTMLElement>(".ws-run")!.getBoundingClientRect();
    const hint = ov.querySelector<HTMLElement>(".ws-help-line")!;
    return {
      small,
      minFont: Math.min(...fonts),
      tapTargets,
      cell: { w: cell.width, h: cell.height },
      grid: { x: grid.x, y: grid.y, w: grid.width },
      run: { w: run.width, h: run.height, bottom: run.bottom },
      hintFits: hint.scrollHeight <= hint.clientHeight && hint.scrollWidth <= hint.clientWidth,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  expect(r.small).toEqual([]);
  expect(r.minFont).toBeGreaterThanOrEqual(16);
  for (const t of r.tapTargets) {
    expect(t.width, t.t ?? "").toBeGreaterThanOrEqual(44);
    expect(t.height, t.t ?? "").toBeGreaterThanOrEqual(44);
  }
  expect(r.cell.w).toBe(30);
  expect(r.grid.w).toBe(360);
  expect(r.grid.y).toBe(56);
  expect(r.run.w).toBe(358);
  expect(r.run.h).toBe(52);
  expect(r.run.bottom).toBeLessThanOrEqual(844);
  expect(r.hintFits).toBe(true);
  expect(r.pageOverflow).toBe(false);
});

test("AE#95: 縦持ちでタップして置ける・消すモードで消せる・実行が押せる", async ({ page }) => {
  await page.goto("/?fx=0");
  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  const ov = page.locator("#ws-overlay");
  await expect(ov).toHaveAttribute("data-placements", "0");
  await page.locator(".ws-cell").nth(14).tap();
  await expect(ov).toHaveAttribute("data-placements", "1");
  await page.getByRole("button", { name: /消すモード/ }).tap();
  await page.locator(".ws-cell").nth(14).tap();
  await expect(ov).toHaveAttribute("data-placements", "0");
  await expect(page.locator(".ws-run")).toBeVisible();
});
