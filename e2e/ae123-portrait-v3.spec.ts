import { test, expect, type Page } from "@playwright/test";

/**
 * AE#123: スマホ縦の配置 v3。実行ボタンが常に見え（幅上限 358・中央寄せ）、注文票は 96px 以内で内部スクロールなし、
 * 吹き出しは盤面に重ならず、全消しは下部固定バーの左。ヘッドレス Chromium の確認（実機 iOS/Android・WebKit は未確認）。
 */
const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
  { width: 430, height: 932 },
];

async function open(page: Page, orderId = "order-01"): Promise<void> {
  await page.goto("/?fx=0");
  const ids = ["order-01", "order-02", "order-03"];
  // 注文 2・3 の解放（保存形式は src/save の {v,sum,data}。sum は FNV-1a）
  const sum = (() => {
    let hash = 0x811c9dc5;
    for (const c of Buffer.from(JSON.stringify(ids))) {
      hash ^= c;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  })();
  const unlock = JSON.stringify({ v: 1, sum, data: ids });
  await page.evaluate((v) => {
    localStorage.clear();
    localStorage.setItem("ae-order-unlocked", v);
  }, unlock);
  await page.reload();
  await page.getByLabel("はじめる").click();
  await page.locator(`[data-order-id="${orderId}"] button`).click();
  await expect(page.locator("#ws-overlay.ws-portrait")).toBeVisible();
}

const rect = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
  }, sel);

for (const size of SIZES) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size, hasTouch: true, isMobile: true });

    test("実行は幅 358 以下・バーは中央寄せ・画面内、全消しは実行より左", async ({ page }) => {
      await open(page);
      const run = await rect(page, ".ws-run");
      const bar = await rect(page, ".ws-bar");
      const clear = await rect(page, ".ws-clear");
      expect(run.w).toBeLessThanOrEqual(358);
      expect(run.h).toBe(52);
      expect(run.b).toBeLessThanOrEqual(size.height);
      expect(Math.abs(bar.x + bar.w / 2 - size.width / 2)).toBeLessThanOrEqual(1);
      expect(bar.w).toBe(Math.min(size.width - 16, 358));
      expect(clear.w).toBeGreaterThanOrEqual(44);
      expect(clear.h).toBeGreaterThanOrEqual(44);
      expect(clear.r).toBeLessThanOrEqual(run.x);
      expect(clear.x).toBeGreaterThanOrEqual(bar.x);
      expect(run.r).toBeLessThanOrEqual(bar.r + 0.5);
    });

    test("注文票は既定で 96px 以内・内部スクロールなし（注文 1〜3）", async ({ page }) => {
      for (const id of ["order-01", "order-02", "order-03"]) {
        await open(page, id);
        const r = await page.evaluate(() => {
          const e = document.querySelector<HTMLElement>(".ws-order-body")!;
          return { h: e.getBoundingClientRect().height, sh: e.scrollHeight, ch: e.clientHeight };
        });
        expect(r.h, id).toBeLessThanOrEqual(96);
        expect(r.sh, id).toBeLessThanOrEqual(r.ch);
      }
    });

    test("吹き出しは盤面と交差しない", async ({ page }) => {
      await open(page);
      const g = await rect(page, ".ws-guide");
      const grid = await rect(page, ".ws-grid");
      const apart = g.b <= grid.y || g.y >= grid.b || g.r <= grid.x || g.x >= grid.r;
      expect(apart).toBe(true);
    });

    test("詳細▾の展開で盤面の y・マス寸法が変わらず、ボタンは 44×44 以上", async ({ page }) => {
      await open(page);
      const before = { grid: await rect(page, ".ws-grid"), cell: await rect(page, ".ws-cell") };
      const toggle = page.locator(".ws-order-toggle");
      const tr = await rect(page, ".ws-order-toggle");
      expect(tr.w).toBeGreaterThanOrEqual(44);
      expect(tr.h).toBeGreaterThanOrEqual(44);
      await expect(toggle).toHaveText(/詳細/);
      await toggle.tap();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(".ws-order-detail")).toBeVisible();
      const after = { grid: await rect(page, ".ws-grid"), cell: await rect(page, ".ws-cell") };
      expect(after.grid.y).toBe(before.grid.y);
      expect(after.grid.h).toBe(before.grid.h);
      expect(after.cell.w).toBe(before.cell.w);
      expect(after.cell.h).toBe(before.cell.h);
      const body = await page.evaluate(() => {
        const e = document.querySelector<HTMLElement>(".ws-order-body")!;
        return { sh: e.scrollHeight, ch: e.clientHeight };
      });
      expect(body.sh).toBeLessThanOrEqual(body.ch);
    });
  });
}

test.describe("使えない機械の棚ボタンの文字色", () => {
  test.use({ viewport: SIZES[0], hasTouch: true, isMobile: true });
  test("#B8A8C0（点線枠は維持）", async ({ page }) => {
    await open(page);
    const s = await page
      .locator('.ws-tool[data-allowed="false"]')
      .first()
      .evaluate((e) => ({ c: getComputedStyle(e).color, b: getComputedStyle(e).borderStyle }));
    expect(s.c).toBe("rgb(184, 168, 192)");
    expect(s.b).toBe("dashed");
  });
});
