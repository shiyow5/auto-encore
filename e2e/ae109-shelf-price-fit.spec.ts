import { test, expect } from "@playwright/test";

/** AE#109 / #186: 1280×720 の棚で機械ボタンの価格ラベル（1G/4G/6G 等）が
 * ボタンの枠の外へはみ出さないことを確認する（はみ出すと隣のボタンの縁と重なる）。 */
test("AE#109: shelf machine buttons keep price labels inside the button box at 1280x720", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.waitForTimeout(3000);
  await page.getByLabel("はじめる").click();
  await page.waitForTimeout(500);
  await page.locator('[data-order-id="order-01"] button').click();
  await page.waitForTimeout(1500);

  const rows = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("#ws-overlay .ws-palette .ws-btn")).map(
      (b) => {
        const btn = b.getBoundingClientRect();
        const cost = b.querySelector<HTMLElement>(".ws-tool-cost")!.getBoundingClientRect();
        const icon = b.querySelector<HTMLElement>(".ae-icon")!.getBoundingClientRect();
        return {
          id: b.dataset.machine ?? "",
          btnTop: btn.top,
          btnBottom: btn.bottom,
          iconTop: icon.top,
          costBottom: cost.bottom,
        };
      },
    ),
  );

  expect(rows.length).toBeGreaterThan(0);
  for (const r of rows) {
    // 枠の境界線（上下 2px）の内側に、絵と価格の両方が収まること
    expect(r.costBottom, `${r.id} price bottom`).toBeLessThanOrEqual(r.btnBottom - 2);
    expect(r.iconTop, `${r.id} icon top`).toBeGreaterThanOrEqual(r.btnTop + 2);
  }
});
