/**
 * 縦切り §3-1 の E2E（Issue #7・AE-17・Issue #47）:
 *   タイトル → 注文選択 → 工房（注文1）→ 模範解を置く → 実行 → 結果（完成）。コンソールエラー0。
 *   ブラウザの stateHash がシミュ核のゴールデン finalHash と一致する（AE-17 D6）。
 *   クリアで注文2 が解放され、リロード後も残る（Issue #47）。
 *
 * loadSolution() フックは無いので、模範解（ベルト x=1..10, y=3, 東向き）はマスのクリックで置く。
 * sleep / waitForTimeout は使わない。待ちは waitForIdle() と data-scene だけ。
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

/** シミュ核のゴールデン（Vitest 側と同じファイル）。 */
const GOLDEN = JSON.parse(
  fs.readFileSync(
    fileURLToPath(new URL("../src/data/solutions/order-01-frugal.json", import.meta.url)),
    "utf8",
  ),
) as { expected: { result: string; finalHash: string } };

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function waitForIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__qa !== undefined);
  await page.evaluate(() => window.__qa?.waitForIdle());
}

/** タイトル → 注文選択 → 指定の注文で工房を開く。 */
async function openOrder(page: Page, title: string): Promise<void> {
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: title }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await waitForIdle(page);
}

/** 注文1 の模範解（倹約型）: ベルト x=1..10, y=3, 東向き。 */
async function placeOrder01Frugal(page: Page): Promise<void> {
  for (let x = 1; x <= 10; x++) {
    await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  }
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 10台 / 10G");
}

test.describe("縦切り: 注文1 が機械で完成する（AE-17）", () => {
  test("タイトル → 注文選択 → 工房で模範解 → 実行 → 完成。stateHash がゴールデンと一致", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/?fx=0");
    await openOrder(page, "開店前の試し弾き");

    await placeOrder01Frugal(page);
    await page.getByRole("button", { name: "実行" }).click();
    await waitForIdle(page);

    await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
    expect(await page.evaluate(() => window.__qa?.stateHash())).toBe(GOLDEN.expected.finalHash);
    expect(errors).toEqual([]);
  });

  test("クリアで注文2 が解放され、「次の注文へ」で注文2 の工房が開く。リロード後も解放が残る（#47）", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/?fx=0");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await openOrder(page, "開店前の試し弾き");

    await placeOrder01Frugal(page);
    await page.getByRole("button", { name: "実行" }).click();
    await waitForIdle(page);
    await expect(page.locator("body")).toHaveAttribute("data-scene", "result");

    await page.getByRole("button", { name: "次の注文へ" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    await waitForIdle(page);
    // 前の注文の配置は持ち込まない
    await expect(page.getByLabel("配置の合計")).toHaveText(/機械 0台/);

    await page.reload();
    await openOrder(page, "高い音と低い音");
    expect(errors).toEqual([]);
  });
});
