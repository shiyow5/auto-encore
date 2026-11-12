import { test, expect } from "@playwright/test";

/** AE#191: ドラッグ配置の「置く」SE。1マス目で2発同時に鳴らず、連続発音は 80ms 以上空く。 */
test.use({ viewport: { width: 1280, height: 720 } });

test("10マスドラッグの発音: 最初の2発の差が 20ms 以上または1発、連続発音はすべて 80ms 以上", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __seStarts: number[] };
    w.__seStarts = [];
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a: Parameters<typeof orig>) {
      w.__seStarts.push(performance.now());
      return orig.apply(this, a);
    };
  });
  await page.goto("/");
  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  await expect(page.locator("#ws-overlay")).toBeVisible();
  // 音の読み込み（初回の遅延）を済ませてから測る
  await page
    .locator(".ws-cell")
    .nth(5 * 12)
    .click();
  await page.waitForTimeout(500);
  await page.evaluate(
    () => ((window as unknown as { __seStarts: number[] }).__seStarts.length = 0),
  );

  const center = async (x: number, y: number) => {
    const b = (await page
      .locator(".ws-cell")
      .nth(y * 12 + x)
      .boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const a = await center(1, 3);
  const z = await center(10, 3);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(z.x, z.y, { steps: 25 });
  await page.mouse.up();
  await expect(page.locator("#ws-overlay")).toContainText("機械 11台");

  const t = await page.evaluate(() => (window as unknown as { __seStarts: number[] }).__seStarts);
  const rel = t.map((v) => Math.round(v - t[0]!));
  console.log("start times(ms):", JSON.stringify(rel));
  expect(t.length).toBeGreaterThanOrEqual(1);
  if (t.length >= 2) expect(t[1]! - t[0]!).toBeGreaterThanOrEqual(20);
  for (let i = 1; i < t.length; i++) expect(t[i]! - t[i - 1]!).toBeGreaterThanOrEqual(80);
});
