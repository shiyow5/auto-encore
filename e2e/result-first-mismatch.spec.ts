/**
 * spec-e §2: 結果画面に「最初にずれた位置」が表示されることを確認する。
 *
 * - 模範解（ずれなし）: data-first-mismatch の行が出ない
 * - ベルトを1マス欠かす（音が届かない）: 「最初にずれたのは 1音目」が出る
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

  test("グラフとフッターの帰属表示（Lightweight Charts, Apache-2.0）が出る", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openOrder01(page);
    await placeBeltsAndRun(page, 10);
    await expect(page.locator(".rs-chart-box canvas").first()).toBeVisible();
    const credit = page.locator(".rs-footer").getByRole("link", {
      name: "Powered by TradingView Lightweight Charts",
    });
    await expect(credit).toHaveAttribute("href", "https://www.tradingview.com/");
    for (const f of ["LICENSE", "NOTICE"]) {
      const href = await page
        .locator(".rs-footer")
        .getByRole("link", { name: f, exact: true })
        .getAttribute("href");
      const res = await page.request.get(new URL(href ?? "", page.url()).toString());
      expect(res.status()).toBe(200);
    }
    expect(errors).toEqual([]);
  });

  test("グラフは role=img で名前があり、Tab で止まるロゴのリンクにも名前が付く", async ({
    page,
  }) => {
    await openOrder01(page);
    await placeBeltsAndRun(page, 10);
    const box = page.locator(".rs-chart-box");
    await expect(box).toHaveAttribute("role", "img");
    await expect(box).toHaveAttribute("aria-label", /グラフ/);
    await expect(box).not.toHaveAttribute("aria-hidden", /.*/);
    const logo = page.locator("#tv-attr-logo");
    await expect(logo).toBeAttached();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      if (await logo.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(logo).toBeFocused();
    const name = await logo.evaluate(
      (el) => el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent?.trim(),
    );
    expect(name).toBeTruthy();
  });

  test("ベルトを1マス欠かすと「最初にずれたのは 1音目」が出る", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openOrder01(page);
    await placeBeltsAndRun(page, 9);
    const fm = page.locator("[data-first-mismatch]");
    await expect(fm).toHaveAttribute("data-first-mismatch", "1");
    await expect(fm).toHaveText("最初にずれたのは 1音目");
    expect(errors).toEqual([]);
  });

  for (const vp of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    test(`#96: 失敗時の表は折り返さず二重表記もない (${vp.width}×${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await openOrder01(page);
      await placeBeltsAndRun(page, 9);
      const cells = page.locator(".rs-table th, .rs-table td");
      const n = await cells.count();
      for (let i = 0; i < n; i++) {
        const c = await cells.nth(i).evaluate((el) => ({
          clipped: el.scrollWidth > el.clientWidth,
          lines: Math.round(
            el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || "24"),
          ),
        }));
        expect(c.clipped).toBe(false);
        expect(c.lines).toBeLessThanOrEqual(3); // padding 込みで 1 行 = 40px 前後。メダル列は次の基準の行で +1（#120）
      }
      for (const th of await page.locator(".rs-table thead th").all()) {
        expect((await th.boundingBox())?.height ?? 99).toBeLessThanOrEqual(44);
      }
      await expect(page.locator(".rs-table")).not.toContainText("最初にずれた");
      await expect(page.locator(".rs-fm")).toHaveCount(1);
    });
  }

  // #113: 失敗理由は初見で見える位置に出す。横持ち 844×390 で表の下に出て画面外に切れていた
  for (const vp of [
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    test(`#113: 失敗時「最初にずれたのは」がスクロールなしで見える (${vp.width}×${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await openOrder01(page);
      await placeBeltsAndRun(page, 9);
      const fm = page.locator(".rs-fm");
      await expect(fm).toBeVisible();
      // 変更前後の比較用（PR 添付）。CI では撮らない
      if (process.env.AE_SHOT) {
        await page.screenshot({ path: `${process.env.AE_SHOT}-${vp.width}x${vp.height}.png` });
      }
      expect(await page.locator("#rs-overlay").evaluate((el) => el.scrollTop)).toBe(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      const box = await fm.boundingBox();
      expect(box).not.toBeNull();
      if (!box) return;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
      // 結果画面の枠（overflow:auto）からもはみ出していない
      const ov = await page.locator("#rs-overlay").boundingBox();
      expect(ov).not.toBeNull();
      if (ov) expect(box.y + box.height).toBeLessThanOrEqual(ov.y + ov.height);
      // 表の上に入れたぶん表が押し出されて切れないこと（#198 の「表の下端まで初期表示」を失敗時も保つ）
      const table = await page.locator(".rs-table").boundingBox();
      expect(table).not.toBeNull();
      if (table) expect(table.y + table.height).toBeLessThanOrEqual(vp.height);
    });
  }
});
