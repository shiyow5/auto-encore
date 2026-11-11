import { test, expect } from "@playwright/test";

/** AE#165 / #161: スマホ横 844×390 の工房。棚ボタン 44px 以上・説明はタッチ向け・価格は枠内・注文票は切れず実行ボタンが見える。 */
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

test("AE#165: 844×390 で棚ボタン 44px 以上・価格は枠内・説明はスマホ向け", async ({ page }) => {
  await page.goto("/?fx=0");
  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  await expect(page.locator("#ws-overlay.ws-compact")).toBeVisible();

  const r = await page.evaluate(() => {
    const ov = document.getElementById("ws-overlay")!;
    const rect = (el: Element) => el.getBoundingClientRect();
    const buttons = [
      ...ov.querySelectorAll<HTMLElement>(".ws-palette .ws-btn, .ws-actions .ws-btn"),
    ];
    const cost = [...ov.querySelectorAll<HTMLElement>(".ws-tool")].map((b) => {
      const c = rect(b.querySelector(".ws-tool-cost")!);
      const o = rect(b);
      return {
        t: b.dataset.machine,
        gap: Math.min(c.left - o.left, o.right - c.right, c.top - o.top, o.bottom - c.bottom),
      };
    });
    const shelf = rect(ov.querySelector(".ws-shelf")!);
    const grid = rect(ov.querySelector(".ws-grid")!);
    const card = rect(ov.querySelector(".ws-order")!);
    const run = rect(ov.querySelector(".ws-run")!);
    return {
      heights: buttons.map((b) => ({ t: b.textContent, h: rect(b).height, w: rect(b).width })),
      cost,
      help: ov.querySelector(".ws-help-line")?.textContent ?? "",
      shelfRight: shelf.right,
      gridLeft: grid.left - 8,
      gridRight: grid.right + 8,
      cardLeft: card.left,
      cardBottom: card.bottom,
      runBottom: run.bottom,
      runH: run.height,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  for (const b of r.heights) {
    expect(b.h, b.t ?? "").toBeGreaterThanOrEqual(44);
    expect(b.w, b.t ?? "").toBeGreaterThanOrEqual(44);
  }
  for (const c of r.cost) expect(c.gap, c.t ?? "").toBeGreaterThanOrEqual(0);
  expect(r.help).not.toContain("右クリック");
  expect(r.help).toContain("タップ");
  expect(r.gridLeft).toBeGreaterThanOrEqual(r.shelfRight);
  expect(r.gridRight).toBeLessThanOrEqual(r.cardLeft);
  expect(r.runH).toBeGreaterThanOrEqual(44);
  expect(r.runBottom).toBeLessThanOrEqual(r.cardBottom);
  expect(r.cardBottom).toBeLessThanOrEqual(390);
  expect(r.pageOverflow).toBe(false);
});
