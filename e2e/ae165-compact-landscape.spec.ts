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

test("AE#165: 844×300 でも棚が画面内に収まり、全消しに届く", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 300 });
  await page.goto("/?fx=0");
  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  await expect(page.locator("#ws-overlay.ws-compact")).toBeVisible();

  const r = await page.evaluate(() => {
    const shelf = document.querySelector(".ws-shelf")!.getBoundingClientRect();
    return {
      shelfBottom: shelf.bottom,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight,
    };
  });
  expect(r.shelfBottom).toBeLessThanOrEqual(300);
  expect(r.pageScrolls).toBe(false);

  const clear = page.locator(".ws-clear");
  await clear.scrollIntoViewIfNeeded();
  await clear.click();
});

test("AE#161: 844×390 注文1で合計の帯は本文の下端に付き、本文・実行ボタンに重ならない", async ({
  page,
}) => {
  await page.goto("/?fx=0");
  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  await expect(page.locator("#ws-overlay.ws-compact")).toBeVisible();

  const r = await page.evaluate(() => {
    const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const body = document.querySelector<HTMLElement>(".ws-order-body")!;
    const b = rect(".ws-order-body");
    const t = rect(".ws-order-total");
    const run = rect(".ws-run");
    // 本文の末尾までスクロールしたとき、最後の行が帯の上に出る
    body.scrollTop = body.scrollHeight;
    const last = body
      .querySelector(".ws-order-total")!
      .previousElementSibling!.getBoundingClientRect();
    return {
      bodyBottom: b.bottom,
      totalBottom: t.bottom,
      runTop: run.top,
      runBottom: run.bottom,
      orderBottom: rect(".ws-order").bottom,
      lastBottom: last.bottom,
      totalTopAtEnd: document.querySelector(".ws-order-total")!.getBoundingClientRect().top,
    };
  });
  // 帯は本文の下端（= 実行ボタンの直上）。本文の中ほどに浮かない
  expect(Math.abs(r.totalBottom - r.bodyBottom)).toBeLessThanOrEqual(1);
  expect(r.runTop).toBeGreaterThanOrEqual(r.bodyBottom);
  expect(r.runBottom).toBeLessThanOrEqual(r.orderBottom);
  expect(r.lastBottom).toBeLessThanOrEqual(r.totalTopAtEnd + 1);
});

test("AE#161: 390×844 縦持ちは崩れない（合計の帯が本文の外へ出ない）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?fx=0");
  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  await expect(page.locator("#ws-overlay.ws-portrait")).toBeVisible();
  const r = await page.evaluate(() => {
    const run = document.querySelector(".ws-run")!.getBoundingClientRect();
    return {
      runBottom: run.bottom,
      runH: run.height,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(r.runBottom).toBeLessThanOrEqual(844);
  expect(r.runH).toBeGreaterThanOrEqual(44);
  expect(r.overflow).toBe(false);
});
