import { expect, test } from "@playwright/test";

// 音量スライダー（BGM / SE を別々に 0〜100%）。保存・復元・ミュートとの両立・スマホ縦で重ならないことを見る。

test("音量: 変更して再読み込みしても残る。0% にしてもミュート表示と矛盾しない", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.locator("#volume-toggle").click();
  const sfx = page.locator("#volume-sfx");
  const bgm = page.locator("#volume-bgm");
  await expect(sfx).toHaveValue("100");
  await sfx.fill("40");
  await bgm.fill("0");
  await expect(page.locator("#audio-toggle")).toHaveAttribute("aria-pressed", "false");
  await sfx.fill("0");
  // 両方 0% は「音が出ない」表示
  await expect(page.locator("#audio-toggle")).toHaveAttribute("aria-pressed", "true");
  await sfx.fill("40");
  await expect(page.locator("#audio-toggle")).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.locator("#volume-toggle").click();
  await expect(page.locator("#volume-sfx")).toHaveValue("40");
  await expect(page.locator("#volume-bgm")).toHaveValue("0");
});

test("音量: スマホ縦(390×844)でも押せて、♪ボタン・パネルが画面内に収まり重ならない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.locator("#volume-toggle").click();
  const boxes = [];
  for (const sel of ["#audio-toggle", "#volume-toggle", "#volume-panel"]) {
    const b = await page.locator(sel).boundingBox();
    expect(b, sel).not.toBeNull();
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(390);
    boxes.push(b!);
  }
  const [a, v, p] = boxes as [DOMRect, DOMRect, DOMRect];
  expect(a.x).toBeGreaterThanOrEqual(v.x + v.width); // ♪ と 音量 が並ぶ（重ならない）
  expect(p.y).toBeGreaterThanOrEqual(Math.max(a.y + a.height, v.y + v.height));
  await page.locator("#volume-sfx").fill("50");
  await expect(page.locator("#volume-panel output").nth(1)).toHaveText("50%");
});
