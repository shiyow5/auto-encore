import { expect, test } from "@playwright/test";

function collectErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

test("起動してキャンバスが表示され、タイトル→工房に進む（演出あり）", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.locator("#game canvas")).toBeVisible();
  // タイトル画面経由 → はじめるで工房へ
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  expect(errors).toEqual([]);
});

// 工房の配置操作（K2）。
test("?fx=0: 入口・出口が見え、ベルトを置く・回す・消す", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/?fx=0");
  // ?fx=0 でもタイトル画面経由
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 10_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
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
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 10_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  const start = page.getByRole("button", { name: /^マス 1,3:/ });
  await start.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "マス 2,3: ベルト 東向き" })).toBeFocused();
  await page.keyboard.press("r");
  await expect(page.getByRole("button", { name: "マス 2,3: ベルト 南向き" })).toBeFocused();
  await page.keyboard.press("Delete");
  await expect(page.getByRole("button", { name: "マス 2,3: 空き" })).toBeVisible();
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 1台 / 1G");
});

// 実行 → 結果（K4）。step() を最後まで回して、3指標（正確さ・速度・コスト）を数値で出す。
async function placeStraightBelts(page: import("@playwright/test").Page): Promise<void> {
  for (let x = 1; x <= 10; x++) {
    await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  }
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 10台 / 10G");
}

test("?fx=0: ベルト10本 → 実行 → 結果に3指標が数値で出る → 工房にもどると配置が残る", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 10_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await placeStraightBelts(page);
  await page.getByRole("button", { name: "実行" }).click();

  await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
  await expect(page.getByRole("heading", { name: "結果: アンコール！" })).toBeVisible();
  const table = page.getByRole("table", { name: "3指標" });
  await expect(table.getByRole("row", { name: /^正確さ/ })).toHaveAccessibleName(
    "正確さ 100%（8/8） 金",
  );
  await expect(table.getByRole("row", { name: /^速度/ })).toHaveAccessibleName("速度 18 tick 金");
  await expect(table.getByRole("row", { name: /^コスト/ })).toHaveAccessibleName("コスト 10G 金");
  const back = page.getByRole("button", { name: "工房にもどる" });
  await expect(back).toBeFocused();

  await back.click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 10台 / 10G");
  await expect(page.getByRole("button", { name: "マス 10,3: ベルト 東向き" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("?fx=0: 途中が切れていると詰まって「もう一歩」・速度は記録なし", async ({ page }) => {
  await page.goto("/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 10_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await placeStraightBelts(page);
  await page.getByRole("button", { name: "マス 6,3: ベルト 東向き" }).click({ button: "right" });
  await page.getByRole("button", { name: "実行" }).click();
  await expect(page.getByRole("heading", { name: "結果: もう一歩" })).toBeVisible();
  const table = page.getByRole("table", { name: "3指標" });
  await expect(table.getByRole("row", { name: /^正確さ/ })).toHaveAccessibleName(
    "正確さ 0%（0/8） なし",
  );
  await expect(table.getByRole("row", { name: /^速度/ })).toHaveAccessibleName(
    "速度 記録なし なし",
  );
  await expect(table.getByRole("row", { name: /^コスト/ })).toHaveAccessibleName("コスト 9G 金");
});

test("演出あり: 実行すると音符を tick ごとに動かしてから結果へ（スキップもできる）", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/");
  // タイトル画面経由
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await placeStraightBelts(page);
  await page.getByRole("button", { name: "実行" }).click();
  const overlay = page.locator("#ws-overlay");
  await expect(overlay).toHaveAttribute("data-running", "true");
  await expect(page.getByRole("button", { name: "結果へスキップ" })).toBeVisible();
  await expect(page.getByRole("button", { name: /ベルトを選ぶ/ })).toBeDisabled();
  await expect(overlay).toHaveAttribute("data-tick", /^[1-9]/);
  // 18 tick × 110ms ≒ 2秒で結果へ
  await expect(page.locator("body")).toHaveAttribute("data-scene", "result", { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "結果: アンコール！" })).toBeVisible();

  // もどってすぐスキップ
  await page.getByRole("button", { name: "工房にもどる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await page.getByRole("button", { name: "実行" }).click();
  await page.getByRole("button", { name: "結果へスキップ" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
  expect(errors).toEqual([]);
});

test("?fx=0: マウス操作中の R はホバー中のマスを回し、矢印で動いた後はフォーカスのマスを回す", async ({
  page,
}) => {
  await page.goto("/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 10_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  for (let x = 1; x <= 3; x++) {
    await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  }
  // 3,3 をクリックしたのでフォーカスは 3,3 に残っている。ホバー中の 1,3 が回る
  await page.getByRole("button", { name: /^マス 1,3:/ }).hover();
  await page.keyboard.press("r");
  await expect(page.getByRole("button", { name: /^マス 1,3:/ })).toHaveAccessibleName(
    "マス 1,3: ベルト 南向き",
  );
  await expect(page.getByRole("button", { name: /^マス 3,3:/ })).toHaveAccessibleName(
    "マス 3,3: ベルト 東向き",
  );
  // 矢印で 2,3 へ移るとキーボード操作に戻り、マウスが 1,3 の上にあってもフォーカスの 2,3 が回る
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("r");
  await expect(page.getByRole("button", { name: /^マス 2,3:/ })).toHaveAccessibleName(
    "マス 2,3: ベルト 南向き",
  );
  await expect(page.getByRole("button", { name: /^マス 1,3:/ })).toHaveAccessibleName(
    "マス 1,3: ベルト 南向き",
  );
});

// 棚の機械（K5・回収箱 #41）と仕分け機の音高。
test("?fx=0: 棚の仕分け機・合流機・調律機・回収箱を置ける。仕分け機は P で音高が巡回する", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 10_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  const shelf = page.getByRole("region", { name: "パーツ棚" });
  await expect(shelf.getByRole("button", { name: /を選ぶ/ })).toHaveCount(5);

  // 仕分け機（machines.json: 6G・候補の先頭=ド）
  await page.getByRole("button", { name: /仕分け機を選ぶ（6G/ }).click();
  await page.getByRole("button", { name: "マス 2,3: 空き" }).click();
  const sorter = page.getByRole("button", { name: /^マス 2,3:/ });
  await expect(sorter).toHaveAccessibleName("マス 2,3: 仕分け機 東向き・音高 ド");
  await sorter.focus();
  await page.keyboard.press("p");
  await expect(sorter).toHaveAccessibleName("マス 2,3: 仕分け機 東向き・音高 ミ");
  await page.keyboard.press("p");
  await page.keyboard.press("p");
  await expect(sorter).toHaveAccessibleName("マス 2,3: 仕分け機 東向き・音高 ド");
  await page.keyboard.press("r");
  await expect(sorter).toHaveAccessibleName("マス 2,3: 仕分け機 南向き・音高 ド");
  // Shift+クリックでも巡回
  await sorter.click({ modifiers: ["Shift"] });
  await expect(sorter).toHaveAccessibleName("マス 2,3: 仕分け機 南向き・音高 ミ");

  // 棚の「音高」で次に置く音高を変える
  await page.getByRole("button", { name: /次に置く仕分け機の音高: ド/ }).click();
  await page.getByRole("button", { name: "マス 3,3: 空き" }).click();
  await expect(page.getByRole("button", { name: /^マス 3,3:/ })).toHaveAccessibleName(
    "マス 3,3: 仕分け機 東向き・音高 ミ",
  );

  // 合流機・調律機
  await page.getByRole("button", { name: /合流機を選ぶ（4G/ }).click();
  await page.getByRole("button", { name: "マス 4,3: 空き" }).click();
  await page.getByRole("button", { name: /調律機を選ぶ（8G/ }).click();
  await page.getByRole("button", { name: "マス 5,3: 空き" }).click();
  await expect(page.getByRole("button", { name: "マス 5,3: 調律機 東向き" })).toBeVisible();
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 4台 / 24G");
  await page.getByRole("button", { name: "マス 4,3: 合流機 東向き" }).click({ button: "right" });
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 3台 / 20G");

  // 回収箱（#41）: 0G。置いても合計は増えない
  await page.getByRole("button", { name: /回収箱を選ぶ（0G/ }).click();
  await page.getByRole("button", { name: "マス 6,3: 空き" }).click();
  await expect(page.getByRole("button", { name: "マス 6,3: 回収箱 東向き" })).toBeVisible();
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 4台 / 20G");

  // 注文1 では使えない機械 → 実行しても落ちずに検証エラーを出す
  await page.getByRole("button", { name: "実行" }).click();
  await expect(page.getByRole("status")).toHaveText(/^✕ 実行できない: .*置けない/);
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  expect(errors).toEqual([]);
});
