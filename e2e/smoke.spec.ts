import { expect, test } from "@playwright/test";

function collectErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

test("起動してキャンバスが表示され、工房に進む（演出あり）", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.locator("#game canvas")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop", { timeout: 15_000 });
  expect(errors).toEqual([]);
});

// 工房の配置操作（K2）。実行・結果は K4 で core につないでから（T4 の smoke）。
test("?fx=0: 入口・出口が見え、ベルトを置く・回す・消す", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  const grid = page.getByRole("group", { name: /工房 12×8/ });
  await expect(grid.getByRole("button")).toHaveCount(96);
  await expect(page.getByRole("button", { name: "マス 0,3: 入口 A" })).toBeVisible();
  await expect(page.getByRole("button", { name: "マス 11,3: 出口 OUT" })).toBeVisible();
  await expect(page.getByRole("button", { name: /ベルトを選ぶ/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // ベルト10本を 1,3〜10,3 に東向きで置く
  for (let x = 1; x <= 10; x++) {
    await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  }
  await expect(page.getByRole("button", { name: "マス 10,3: ベルト 東向き" })).toBeVisible();
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 10台 / 10G");

  // 入口には置けない
  await page.getByRole("button", { name: "マス 0,3: 入口 A" }).click();
  await expect(page.getByRole("status")).toHaveText("✕ 入口のマスには置けない");

  // R で回す（フォーカスしたマス）
  const cell = page.getByRole("button", { name: /^マス 5,3:/ });
  await cell.focus();
  await page.keyboard.press("r");
  await expect(cell).toHaveAccessibleName("マス 5,3: ベルト 南向き");

  // 右クリックで消す
  await page.getByRole("button", { name: "マス 2,3: ベルト 東向き" }).click({ button: "right" });
  await expect(page.getByRole("button", { name: "マス 2,3: 空き" })).toBeVisible();
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 9台 / 9G");

  // 空きマスで R → 次に置く向きが回る
  await page.getByRole("button", { name: /次に置く向き: 東/ }).click();
  await page.getByRole("button", { name: "マス 2,3: 空き" }).click();
  await expect(page.getByRole("button", { name: "マス 2,3: ベルト 南向き" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("?fx=0: キーボードだけで置ける（矢印で移動・Enter で置く・Delete で消す）", async ({
  page,
}) => {
  await page.goto("/?fx=0");
  const start = page.getByRole("button", { name: /^マス 1,3:/ });
  await start.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "マス 2,3: ベルト 東向き" })).toBeFocused();
  await page.keyboard.press("Delete");
  await expect(page.getByRole("button", { name: "マス 2,3: 空き" })).toBeVisible();
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 1台 / 1G");
});
