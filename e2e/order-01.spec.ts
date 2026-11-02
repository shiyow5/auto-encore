/**
 * 縦切り §3-1 の E2E（Issue #7・AE-17 の前段）:
 *   注文1 を開く → 模範解を置く → 再生 → 完成表示。コンソールエラー0。
 *
 * 画面とテスト用フック（Issue #13: window.__qa.waitForIdle() / loadSolution() / stateHash()、data-scene）が
 * まだ無いので test.fixme にしてある。縦切り判定（11/04）までに fixme を外し、下の「合わせる所」を実装に合わせる。
 * sleep / waitForTimeout は使わない。待ちは waitForIdle() と data-scene だけ。
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const SOLUTION = JSON.parse(
  fs.readFileSync(
    fileURLToPath(new URL("../tests/fixtures/solutions/order-01-frugal.json", import.meta.url)),
    "utf8",
  ),
) as { orderId: string; expected: { result: string; accuracy: number; cost: number } };

/** Issue #13 で提案しているフックの形。名前が変わったらここだけ直す。 */
interface QaHooks {
  waitForIdle(): Promise<void>;
  loadSolution(json: unknown): void;
  stateHash(): string;
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

test.describe("縦切り: 注文1 が機械で完成する（AE-17 前段）", () => {
  test.fixme("注文1 を開く → 模範解を置く → 再生 → 完成表示・コンソールエラー0", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    // 1. 起動 → 注文1 を開く（合わせる所: シーン名・ボタンの名前）
    await page.goto("/?fx=0");
    await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
    await page.getByRole("button", { name: /注文1|開店前の試し弾き/ }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "order");
    await waitForIdle(page);

    // 2. 模範解を置く（loadSolution が無ければ、盤のマスをクリックして10本置く操作に差し替える）
    await page.evaluate(
      (json) => (window as unknown as { __qa: QaHooks }).__qa.loadSolution(json),
      SOLUTION,
    );
    await waitForIdle(page);

    // 3. 再生 → 止まるまで待つ
    await page.getByRole("button", { name: /再生|実行/ }).click();
    await waitForIdle(page);

    // 4. 完成表示（合わせる所: 結果画面の文言・data-scene）
    await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
    await expect(page.getByText(/完成|completed/)).toBeVisible();
    await expect(page.getByText(`${SOLUTION.expected.accuracy}%`)).toBeVisible();
    await expect(page.getByText(`${SOLUTION.expected.cost}G`)).toBeVisible();

    expect(errors).toEqual([]);
  });

  // AE-17（D6）本体: Vitest 側のゴールデン finalHash と、ブラウザで再生した stateHash が一致する。
  // finalHash はシミュ核（#18）の src/data/solutions/order-01-frugal.json にあるので、#18 が main に入ってから書く。
  test.fixme("Node とブラウザで注文1 模範解の stateHash が一致する（AE-17 D6）", async () => {});
});
