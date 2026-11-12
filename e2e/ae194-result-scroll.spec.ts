import { expect, test, type Page } from "@playwright/test";

/** Issue #194: 結果画面を開いた直後に見出しと3指標表が見える（overlay が勝手にスクロールしない） */
async function openResult(page: Page) {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await page.evaluate(() => window.__qa?.waitForIdle());
  for (let x = 1; x <= 10; x++) {
    await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  }
  await page.getByRole("button", { name: "実行" }).click();
  await page.evaluate(() => window.__qa?.waitForIdle());
  expect(await page.evaluate(() => window.__qa?.scene())).toBe("result");
}

async function check(page: Page) {
  const r = await page.evaluate(() => {
    const ov = document.getElementById("rs-overlay")!;
    const inView = (el: Element) => {
      const b = el.getBoundingClientRect();
      return (
        b.top >= 0 && b.bottom <= window.innerHeight && b.left >= 0 && b.right <= window.innerWidth
      );
    };
    const bottomOf = (sel: string) => ov.querySelector(sel)!.getBoundingClientRect().bottom;
    return {
      tableBottom: bottomOf("table"),
      costBottom: bottomOf('[data-next-medal="cost"]'),
      vh: window.innerHeight,
      top: ov.scrollTop,
      h2: inView(ov.querySelector("h2")!),
      // 表全体（下端まで）とコスト行の「最高」が画面内にあること（#198）
      table: (() => {
        const b = ov.querySelector("table")!.getBoundingClientRect();
        return b.top >= 0 && b.bottom <= window.innerHeight;
      })(),
      costNext: inView(ov.querySelector('[data-next-medal="cost"]')!),
      active: document.activeElement?.classList.contains("rs-back") ?? false,
    };
  });
  if (process.env.AE198_LOG) {
    console.log(`AE198 vh=${r.vh} table.bottom=${r.tableBottom} cost.bottom=${r.costBottom}`);
  }
  const { tableBottom: _t, costBottom: _c, vh: _v, ...rest } = r;
  expect(rest).toEqual({ top: 0, h2: true, table: true, costNext: true, active: true });
}

for (const [w, h] of [
  [844, 390],
  [390, 844],
  [1280, 720],
] as const) {
  test(`AE#194: 結果画面を開いた直後 ${w}x${h}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await openResult(page);
    await page.waitForTimeout(100);
    if (process.env.AE194_SHOT) {
      await page.screenshot({
        path: `docs/screenshots/ae194/${process.env.AE194_SHOT}-result-${w}x${h}.png`,
      });
    }
    await check(page);
    await page.waitForTimeout(1400);
    await check(page);
  });
}
