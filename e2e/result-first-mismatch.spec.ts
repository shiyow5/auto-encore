/**
 * spec-e §2: 結果画面に「最初にずれた位置」が表示されることを確認する。
 *
 * - 模範解（ずれなし）: firstMismatch 要素が出ない
 * - ずれる配置（1つでも外す）: data-first-mismatch 属性と「最初にずれた位置」テキストが出る
 *
 * 既存の order-01.spec.ts が test.fixme であるため、独立した spec として書く。
 */
import { expect, test } from "@playwright/test";

interface QaHooks {
  waitForIdle(): Promise<void>;
  loadSolution(json: unknown): void;
}

function collectErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function waitForIdle(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __qa?: QaHooks }).__qa !== undefined);
  await page.evaluate(
    () =>
      (window as unknown as { __qa: QaHooks }).__qa.waitForIdle(),
  );
}

test.describe("spec-e §2: 最初にずれた位置", () => {
  test("模範解では firstMismatch 要素が出ない（ずれなし）", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/?fx=0");
    await expect(page.locator("body")).toHaveAttribute("data-scene", "title", {
      timeout: 15_000,
    });

    // 模範解を適用
    await page.getByRole("button", { name: /注文1|開店前の試し弾き/ }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "order");
    await waitForIdle(page);

    await page.evaluate((json) => (window as unknown as { __qa: QaHooks }).__qa.loadSolution(json), {
      orderId: "order-01",
      name: "frugal",
      placements: [
        { kind: "belt", x: 0, y: 3, dir: "east" },
        { kind: "belt", x: 4, y: 3, dir: "east" },
        { kind: "belt", x: 8, y: 3, dir: "east" },
        { kind: "output", x: 12, y: 3, dir: "east", notes: ["do", "do", "mi"] },
        { kind: "output", x: 14, y: 3, dir: "east", notes: ["so", "so"] },
      ],
    });
    await waitForIdle(page);

    // 実行
    await page.getByRole("button", { name: /再生|実行/ }).click();
    await waitForIdle(page);

    // 結果画面で firstMismatch 要素が出ていないことを確認
    const fm = page.locator("[data-first-mismatch]");
    await expect(fm).toBeHidden();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "result");

    expect(errors).toEqual([]);
  });

  test("ずれる配置では data-first-mismatch 属性とテキストが出る", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/?fx=0");
    await expect(page.locator("body")).toHaveAttribute("data-scene", "title", {
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /注文1|開店前の試し弾き/ }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "order");
    await waitForIdle(page);

    // 意図的に1つずらす: 最初の出力に "do" ではなく "mi" を入れる
    await page.evaluate((json) => (window as unknown as { __qa: QaHooks }).__qa.loadSolution(json), {
      orderId: "order-01",
      name: "bad",
      placements: [
        { kind: "belt", x: 0, y: 3, dir: "east" },
        { kind: "belt", x: 4, y: 3, dir: "east" },
        { kind: "belt", x: 8, y: 3, dir: "east" },
        { kind: "output", x: 12, y: 3, dir: "east", notes: ["mi", "do", "mi"] }, // 1つ目ずらし
        { kind: "output", x: 14, y: 3, dir: "east", notes: ["so", "so"] },
      ],
    });
    await waitForIdle(page);

    await page.getByRole("button", { name: /再生|実行/ }).click();
    await waitForIdle(page);

    // firstMismatch 要素が出る
    const fm = page.locator("[data-first-mismatch]");
    await expect(fm).toBeVisible();
    const attr = await fm.getAttribute("data-first-mismatch");
    expect(attr).not.toBeNull();
    expect(attr).not.toBe("none");
    // テキストに「最初にずれた位置」と数字が含まれる
    const text = await fm.textContent();
    expect(text).toMatch(/^最初にずれた位置: \d+音目$/);

    await expect(page.locator("body")).toHaveAttribute("data-scene", "result");

    expect(errors).toEqual([]);
  });
});
