import { expect, test, type Page } from "@playwright/test";

async function openWorkshop(page: Page): Promise<void> {
  await page.goto("/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 10_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
}

// Issue #94: 工房のボタンがすべて画面内に収まる（minori の受入条件）
for (const size of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1024, height: 600 },
]) {
  test(`#94 ${size.width}×${size.height}: 工房のボタンがすべて viewport 内（全消しも）`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openWorkshop(page);
    const buttons = page.locator("#ws-overlay button:visible:not(.ws-cell)");
    expect(await buttons.count()).toBeGreaterThan(8);
    for (const b of await buttons.all()) {
      const box = await b.boundingBox();
      expect(box, await b.innerText()).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    }
    await expect(page.getByRole("button", { name: "配置を全部消す" })).toBeVisible();
  });
}

test("#94 全消しは確認を挟み、はいで消える・やめるで残る", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openWorkshop(page);
  await page.getByRole("button", { name: "マス 1,3: 空き" }).click();
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 1台 / 1G");
  const clear = page.getByRole("button", { name: "配置を全部消す" });
  await clear.click();
  await expect(page.getByText("全部消します。よろしいですか？")).toBeVisible();
  await page.getByRole("button", { name: "やめる" }).click();
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 1台 / 1G");
  await clear.click();
  await page.getByRole("button", { name: "はい" }).click();
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 0台 / 0G");
});

// kyoya 指摘(#150): スマホ横 844×390 でも「実行」が画面内（パネル内スクロールなしで押せる）
test("#99 844×390: 「実行」ボタンが viewport 内にある", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openWorkshop(page);
  const box = await page.locator("#ws-overlay .ws-run").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(390);
  expect(box!.height).toBeGreaterThanOrEqual(44); // kyoya P2: タップ目標 44px
});
