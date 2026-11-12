import { test, expect } from "@playwright/test";

/** AE#101: 盤面の外周・グリッド線・カーソル枠・棚ボタンの枠線(minori 指定値)。1280×720。 */
test("AE#101: board frame, grid lines, cursor and shelf borders", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  await expect(page.locator("#ws-overlay")).toBeVisible();

  const grid = page.locator(".ws-grid");
  const shadow = await grid.evaluate((el) => getComputedStyle(el).boxShadow);
  // 内側 2px #7A6888 / 外枠 5px(=3px) #F3E9DC / 台座 21px(=16px) #2A2030
  expect(shadow).toContain("rgb(122, 104, 136) 0px 0px 0px 2px");
  expect(shadow).toContain("rgb(243, 233, 220) 0px 0px 0px 5px");
  expect(shadow).toContain("rgb(42, 32, 48) 0px 0px 0px 21px");

  const cell = page.locator(".ws-cell").nth(5);
  expect(await cell.evaluate((el) => getComputedStyle(el).boxShadow)).toContain(
    "rgb(122, 104, 136) 0px 0px 0px 1px inset",
  );
  await cell.hover();
  expect(await cell.evaluate((el) => getComputedStyle(el).boxShadow)).toContain(
    "rgb(243, 233, 220) 0px 0px 0px 2px inset",
  );

  // 棚ボタン: 破線なし（AE#111）。選択中は琥珀地
  const tools = await page.locator(".ws-tool").evaluateAll((els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      return {
        allowed: (el as HTMLElement).dataset.allowed,
        style: cs.borderTopStyle,
        pressed: el.getAttribute("aria-pressed"),
        bg: cs.backgroundColor,
        color: cs.color,
      };
    }),
  );
  expect(tools.length).toBeGreaterThan(0);
  for (const t of tools) {
    // AE#111: 破線は廃止。使えない機械も実線（暗枠＋鍵で区別）
    expect(t.style).toBe("solid");
    if (t.pressed === "true") {
      expect(t.bg).toBe("rgb(242, 180, 90)");
      expect(t.color).toBe("rgb(30, 23, 34)");
    }
  }
});
