import { expect, test, type Page } from "@playwright/test";

// QA フック（Issue #13）: window.__qa.stateHash() / waitForIdle() / scene()
async function placeStraightBelts(page: Page): Promise<void> {
  for (let x = 1; x <= 10; x++) {
    await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  }
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 10台 / 10G");
}

async function runAndHash(page: Page, url: string): Promise<string> {
  await page.goto(url);
  // タイトル画面経由
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.locator("#title-overlay").click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await page.evaluate(() => window.__qa?.waitForIdle());
  expect(await page.evaluate(() => window.__qa?.stateHash())).toBeNull(); // 実行前は null
  await placeStraightBelts(page);
  await page.getByRole("button", { name: "実行" }).click();
  await page.evaluate(() => window.__qa?.waitForIdle());
  expect(await page.evaluate(() => window.__qa?.scene())).toBe("result");
  const hash = await page.evaluate(() => window.__qa?.stateHash());
  expect(hash).toMatch(/^[0-9a-f]{16}$/);
  return hash as string;
}

test("__qa: ?fx=0 と演出ありで結果の stateHash が同じ（waitForIdle で再生の終わりを待てる）", async ({
  page,
}) => {
  const quiet = await runAndHash(page, "/?fx=0");
  const fancy = await runAndHash(page, "/");
  expect(fancy).toBe(quiet);
});

test("__qa: 再生中は waitForIdle が待ち、終わると結果画面", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.locator("#title-overlay").click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await placeStraightBelts(page);
  await page.getByRole("button", { name: "実行" }).click();
  await expect(page.locator("#ws-overlay")).toHaveAttribute("data-running", "true");
  expect(await page.evaluate(() => window.__qa?.scene())).toBe("workshop");
  await page.evaluate(() => window.__qa?.waitForIdle());
  expect(await page.evaluate(() => window.__qa?.scene())).toBe("result");
});

test("__qa: 「工房にもどる」直後の waitForIdle は工房が開くまで待つ", async ({ page }) => {
  await page.goto("/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.locator("#title-overlay").click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await placeStraightBelts(page);
  await page.getByRole("button", { name: "実行" }).click();
  await page.evaluate(() => window.__qa?.waitForIdle());
  expect(await page.evaluate(() => window.__qa?.scene())).toBe("result");
  // クリックと waitForIdle を同じタスク内で呼ぶ（scene.start が実際に切り替わる前の隙間を突く）
  const sceneAfter = await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>(".rs-back")?.click();
    await window.__qa?.waitForIdle();
    return window.__qa?.scene();
  });
  expect(sceneAfter).toBe("workshop");
});
