/**
 * テスト用フック（Issue #13）の E2E。
 * - window.__qa は ?qa=1 のときだけ（preview は本番ビルドなので DEV ではない）
 * - ?fx=0 は演出を切るだけで、結果の stateHash は変わらない（Vitest のゴールデン finalHash と同じ）
 * sleep / waitForTimeout は使わない。待ちは waitForIdle() と data-scene だけ。
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import type { QaHooks } from "../src/ui/qa";

const SOLUTION = JSON.parse(
  fs.readFileSync(
    fileURLToPath(new URL("../src/data/solutions/order-01-frugal.json", import.meta.url)),
    "utf8",
  ),
) as { name: string; expected: { finalHash: string } };

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

const qa = (page: Page) => ({
  waitForIdle: () =>
    page.evaluate(() => (window as unknown as { __qa: QaHooks }).__qa.waitForIdle()),
  stateHash: () => page.evaluate(() => (window as unknown as { __qa: QaHooks }).__qa.stateHash()),
  scene: () => page.evaluate(() => (window as unknown as { __qa: QaHooks }).__qa.scene()),
  loadSolution: (json: unknown) =>
    page.evaluate((j) => (window as unknown as { __qa: QaHooks }).__qa.loadSolution(j), json),
});

async function openWithQa(page: Page, url: string): Promise<ReturnType<typeof qa>> {
  await page.goto(url);
  await page.waitForFunction(() => (window as { __qa?: unknown }).__qa !== undefined);
  const q = qa(page);
  await q.waitForIdle();
  return q;
}

/** 開く → 模範解を置く → 実行 → 結果画面の stateHash を返す。 */
async function runFrugal(page: Page, url: string): Promise<{ before: string; after: string }> {
  const q = await openWithQa(page, url);
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  expect(await q.scene()).toBe("workshop");

  await q.loadSolution(SOLUTION);
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 10台 / 10G");
  await expect(page.getByRole("status")).toHaveText(`解「${SOLUTION.name}」を置いた`);
  const before = await q.stateHash();

  await page.getByRole("button", { name: "実行" }).click();
  await q.waitForIdle();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
  expect(await q.scene()).toBe("result");
  await expect(page.getByRole("heading", { name: "結果: アンコール！" })).toBeVisible();
  return { before, after: await q.stateHash() };
}

test("?qa=1&fx=0: loadSolution → 実行 → waitForIdle → stateHash がゴールデン finalHash と一致", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const { before, after } = await runFrugal(page, "/?qa=1&fx=0");
  expect(after).toBe(SOLUTION.expected.finalHash);
  expect(before).toMatch(/^[0-9a-f]{16}$/);
  expect(before).not.toBe(after);
  expect(errors).toEqual([]);
});

test("?fx=0 は結果ハッシュを変えない（演出あり＝再生してから結果、と同じ stateHash）", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const fxOff = await runFrugal(page, "/?qa=1&fx=0&seed=e2e");
  const fxOn = await runFrugal(page, "/?qa=1&seed=e2e");
  expect(fxOn.before).toBe(fxOff.before);
  expect(fxOn.after).toBe(fxOff.after);
  expect(fxOn.after).toBe(SOLUTION.expected.finalHash);
  // 別シードでも同じ（シードは演出の乱数だけ）
  const otherSeed = await runFrugal(page, "/?qa=1&seed=other");
  expect(otherSeed.after).toBe(SOLUTION.expected.finalHash);
  expect(errors).toEqual([]);
});

test("演出あり: waitForIdle は再生が終わって結果画面が落ち着くまで待つ", async ({ page }) => {
  const q = await openWithQa(page, "/?qa=1");
  await q.loadSolution(SOLUTION);
  await page.getByRole("button", { name: "実行" }).click();
  await expect(page.locator("#ws-overlay")).toHaveAttribute("data-running", "true");
  await q.waitForIdle();
  // 待ち終わった時点で結果画面（再生の途中で解けていない）
  await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
  expect(await q.stateHash()).toBe(SOLUTION.expected.finalHash);
});

test("?qa=1 が無ければ window.__qa は出ない（本番ビルド）", async ({ page }) => {
  await page.goto("/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  expect(await page.evaluate(() => "__qa" in window)).toBe(false);
});

test("loadSolution は壊れた解を理由つきで弾き、盤は変えない", async ({ page }) => {
  const q = await openWithQa(page, "/?qa=1&fx=0");
  await expect(q.loadSolution({ ...SOLUTION, orderId: "order-99" })).rejects.toThrow(
    /order-01.*の解ではない/,
  );
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 0台 / 0G");
});
