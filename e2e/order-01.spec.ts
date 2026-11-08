/**
 * 縦切り §3-1 の E2E（Issue #7・AE-17 の前段）:
 *   注文1 を開く → 模範解を置く → 再生 → 完成表示。コンソールエラー0。
 *
 * QA フック（Issue #13: window.__qa.waitForIdle() / stateHash() / scene()、data-scene）は実装済み。
 * `loadSolution()` は未実装なので、模範解の配置はベルト x=1..10,y=3 を個別クリックで再現。
 * sleep / waitForTimeout は使わない。待ちは waitForIdle() と data-scene だけ。
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

/** Issue #13 のフック形。 */
interface QaHooks {
  waitForIdle(): Promise<void>;
  stateHash(): string | null;
  scene(): string | null;
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function waitForIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __qa?: QaHooks }).__qa !== undefined);
  await page.evaluate(() => (window as unknown as { __qa: QaHooks }).__qa.waitForIdle());
}

/** 注文1 模範解: ベルト x=1..10, y=3, 東向きを個別クリックで配置 */
async function placeOrder01Frugal(page: Page): Promise<void> {
  for (let x = 1; x <= 10; x++) {
    await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  }
}

test.describe("縦切り: 注文1 が機械で完成する（AE-17 前段）", () => {
  // loadSolution() 未実装のため、ベルト個別配置で再現。order scene 非存在のため workshop 経由。
  test("注文1 模範解（ベルト10本）を workshop で配置 → 再生 → 完成表示・コンソールエラー0", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.goto("/?fx=0");
    await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
    await page.getByRole("button", { name: "はじめる" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    await waitForIdle(page);

    // 注文1 模範解を配置（ベルト x=1..10,y=3）
    await placeOrder01Frugal(page);
    await waitForIdle(page);

    // 再生
    await page.getByRole("button", { name: "実行" }).click();
    await waitForIdle(page);

    // 完成表示
    await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
    expect(errors).toEqual([]);
  });

  // AE-17（D6）: Node の simulate とブラウザの stateHash を比較。
  test("Node とブラウザで注文1 模範解の stateHash が一致する（AE-17 D6）", async ({ page }) => {
    // Node 側: order-01-frugal を simulate
    const { parseMachines, parseOrder, parseSolution } = await import(
      "../../src/core/sim/load"
    );
    const { simulate } = await import("../../src/core/sim/sim");
    const nodesolRaw = JSON.parse(
      fs.readFileSync(
        fileURLToPath(
          new URL("../../tests/fixtures/solutions/order-01-frugal.json", import.meta.url),
        ),
        "utf8",
      ),
    );
    const orderRaw = JSON.parse(
      fs.readFileSync(
        fileURLToPath(new URL("../../src/data/orders/order-01.json", import.meta.url)), "utf8",
      ),
    );
    const machinesRaw = JSON.parse(
      fs.readFileSync(
        fileURLToPath(new URL("../../src/data/machines.json", import.meta.url)), "utf8",
      ),
    );
    const order = parseOrder(orderRaw, "orders/order-01.json");
    const machines = parseMachines(machinesRaw);
    const sol = parseSolution(nodesolRaw, "solutions/order-01-frugal.json", order, machines);
    const nodeResult = simulate(order, sol.placements, machines);
    const nodeHash = nodeResult.result.finalHash;

    // ブラウザ側: 同じ配置を置いて stateHash を取る
    await page.goto("/");
    await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
    await page.getByRole("button", { name: "はじめる" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    await page.evaluate(() => (window as unknown as { __qa?: QaHooks }).__qa?.waitForIdle());
    await placeOrder01Frugal(page);
    await page.getByRole("button", { name: "実行" }).click();
    await page.evaluate(() => (window as unknown as { __qa?: QaHooks }).__qa?.waitForIdle());

    const browserHash = await page.evaluate(
      () => (window as unknown as { __qa?: QaHooks }).__qa?.stateHash(),
    );

    expect(browserHash).toBe(nodeHash);
  });
});
