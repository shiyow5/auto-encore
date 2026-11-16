import { expect, test } from "@playwright/test";

/** AE#103 P2（案2）: 実行中も操作列は動かず、「音: ON」ヘルプと重ならない。はみ出しもない。 */
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
];

for (const size of SIZES) {
  test(`AE#103 ${size.width}×${size.height}: 実行中も操作列が動かない`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: "はじめる" }).click();
    await page.getByRole("button", { name: "開店前の試し弾き" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    for (let x = 1; x <= 10; x++) {
      await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
    }
    const measure = (): Promise<{
      boxes: number[][];
      shelfBottom: number;
      helpTop: number | null;
      overlapY: number;
      overflowX: number;
    }> =>
      page.evaluate(() => {
        const rect = (e: Element): DOMRect => e.getBoundingClientRect();
        const btns = [...document.querySelectorAll(".ws-actions .ws-btn")]
          .map(rect)
          .filter((r) => r.width > 0);
        const shelf = rect(document.querySelector(".ws-shelf")!);
        const help = document.querySelector(".ws-help-panel");
        const hr = help ? rect(help) : null;
        let overlapY = 0;
        if (hr && hr.width > 0 && getComputedStyle(help!).visibility !== "hidden") {
          for (const b of btns) {
            const x = Math.min(b.right, hr.right) - Math.max(b.left, hr.left);
            const y = Math.min(b.bottom, hr.bottom) - Math.max(b.top, hr.top);
            if (x > 0 && y > 0) overlapY = Math.max(overlapY, y);
          }
        }
        const over = Math.max(
          0,
          ...btns.map((b) =>
            Math.max(b.right - innerWidth, b.bottom - innerHeight, -b.left, -b.top),
          ),
        );
        return {
          boxes: btns.map((b) => [b.left, b.top, b.width, b.height].map(Math.round)),
          shelfBottom: Math.round(shelf.bottom),
          helpTop: hr ? Math.round(hr.top) : null,
          overlapY: Math.round(overlapY),
          overflowX: Math.round(over),
        };
      });
    const before = await measure();
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
    await page.locator(".ws-run").click();
    await expect(page.locator(".ws-run")).toHaveText("結果へスキップ");
    await page.clock.runFor(1200);
    const during = await measure();
    console.log(`${size.width}x${size.height}`, JSON.stringify({ before, during }));
    expect(during.boxes).toEqual(before.boxes);
    expect(during.shelfBottom).toBe(before.shelfBottom);
    expect(during.helpTop).toBe(before.helpTop);
    expect(during.overlapY).toBe(0);
    expect(during.overflowX).toBeLessThanOrEqual(0);
  });
}
