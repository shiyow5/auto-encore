import { test, expect } from "@playwright/test";

/** #139: 「元に戻す」。置く→回す→2回で配置0 / ドラッグ3マス→1回で0 / 実行中は disabled / Ctrl+Z */
test.use({ viewport: { width: 1280, height: 720 } });

async function openWorkshop(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  await expect(page.locator("#ws-overlay")).toBeVisible();
}

const cell = (page: import("@playwright/test").Page, x: number, y: number) =>
  page.locator(".ws-cell").nth(y * 12 + x);

test("元に戻す: 置く→回す→2回で0、ドラッグ3マス→1回で0、Ctrl+Z、実行中は無効", async ({ page }) => {
  await openWorkshop(page);
  const ov = page.locator("#ws-overlay");
  const undo = page.getByRole("button", { name: "直前の操作を元に戻す" });
  await expect(undo).toBeDisabled();

  // 置く → 回す
  await cell(page, 5, 3).click();
  await expect(ov).toHaveAttribute("data-placements", "1");
  await page.keyboard.press("r");
  await expect(ov).toHaveAttribute("data-undo", "2");
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(ov).toHaveAttribute("data-placements", "1");
  await undo.click();
  await expect(ov).toHaveAttribute("data-placements", "0");
  await expect(ov.locator(".ws-status")).toHaveText("元に戻した");
  await expect(undo).toBeDisabled();

  // ドラッグで3マス → 1回で0
  const center = async (x: number, y: number) => {
    const b = (await cell(page, x, y).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const a = await center(2, 5);
  const z = await center(4, 5);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(z.x, z.y, { steps: 10 });
  await page.mouse.up();
  await expect(ov).toHaveAttribute("data-placements", "3");
  await expect(ov).toHaveAttribute("data-undo", "1");
  await undo.click();
  await expect(ov).toHaveAttribute("data-placements", "0");

  // Ctrl+Z（二重に発火せず 1 回で 1 件だけ戻る）
  await cell(page, 1, 1).click();
  await cell(page, 2, 1).click();
  await expect(ov).toHaveAttribute("data-placements", "2");
  await page.keyboard.press("Control+z");
  await expect(ov).toHaveAttribute("data-placements", "1");

  // 実行中は無効（実行が終わると結果画面へ移るので、押した同じ tick の中で確かめる）
  const disabledWhileRunning = await page.evaluate(() => {
    const run = document.querySelector<HTMLButtonElement>(".ws-run")!;
    run.click();
    const ovEl = document.getElementById("ws-overlay")!;
    const u = document.querySelector<HTMLButtonElement>(".ws-undo")!;
    return { running: ovEl.dataset.running, disabled: u.disabled };
  });
  expect(disabledWhileRunning).toEqual({ running: "true", disabled: true });
});
