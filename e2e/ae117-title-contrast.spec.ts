/**
 * AE#117: タイトルの「はじめる」は琥珀塗りの主ボタン（高さ44px以上）、「遊び方」は枠のみの副ボタン。
 */
import { expect, test } from "@playwright/test";

for (const vp of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`AE#117 ${vp.width}×${vp.height}: はじめる は琥珀塗り・44px以上、遊び方は枠のみ`, async ({
    page,
  }) => {
    await page.setViewportSize(vp);
    await page.goto("/?fx=0");
    const start = page.getByRole("button", { name: "はじめる" });
    const guide = page.getByRole("button", { name: "遊び方" });
    await expect(start).toBeVisible();

    const box = await start.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    const bg = await start.evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r = 0, g = 0, b = 0] = bg.match(/\d+/g)?.map(Number) ?? [];
    // 琥珀 #f2b45a 系: R が最大・B が最小で、R-B が十分大きい
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(r - b).toBeGreaterThan(80);

    const gbg = await guide.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(gbg).toBe("rgba(0, 0, 0, 0)");
    const gbox = await guide.boundingBox();
    expect(gbox?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
}
