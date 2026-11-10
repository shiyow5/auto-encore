import { expect, test } from "@playwright/test";

// 音（ZzFX / ZzFXM）。音そのものは聞けないので、切り替えボタンと「鳴らしてもエラーが出ない」ことを見る。

test("?fx=0 では右上の音の切り替えボタンを出さない", async ({ page }) => {
  await page.goto("/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await expect(page.locator("#audio-toggle")).toHaveCount(0);
});

test("音: 最初の操作で zzfx を読み込み、工房の棚のボタンと右上のボタンが同じ設定を使う（コンソールエラー0）", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await expect(page.locator("#audio-toggle")).toHaveAttribute("aria-label", "音を切る");

  const zzfxLoaded = page.waitForResponse((r) => /zzfx/i.test(r.url()) && r.ok());
  await page.getByRole("button", { name: "はじめる" }).click();
  await zzfxLoaded;
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");

  // 工房では右上のボタンは隠れ、棚のボタンだけ
  await expect(page.locator("#audio-toggle")).toBeHidden();
  await page.getByRole("button", { name: /^マス 1,3:/ }).click();
  await page.getByRole("button", { name: "音を切る" }).click();
  await expect(page.getByRole("button", { name: "音をオンにする" })).toBeVisible();

  // 設定は保存され、タイトルの右上ボタンにも反映される
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  const toggle = page.locator("#audio-toggle");
  await expect(toggle).toHaveAttribute("aria-label", "音を出す");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-label", "音を切る");
  expect(errors).toEqual([]);
});
