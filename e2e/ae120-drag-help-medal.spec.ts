import { test, expect, type Page } from "@playwright/test";

/** AE#120: ドラッグで連続配置・右ドラッグで連続削除、操作説明の常設（16px・4.5:1）、結果の次のメダル基準。 */
async function open(page: Page): Promise<void> {
  await page.goto("/?fx=0");
  await page.getByLabel("はじめる").click();
  await page.locator('[data-order-id="order-01"] button').click();
  await expect(page.locator("#ws-overlay")).toBeVisible();
}

const center = async (page: Page, x: number, y: number) => {
  const b = (await page
    .locator(".ws-cell")
    .nth(y * 12 + x)
    .boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test.describe("PC 1280×720", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("左ドラッグで10マスに連続配置・右ドラッグで連続削除・クリック1回は1台", async ({ page }) => {
    await open(page);
    await page
      .locator(".ws-cell")
      .nth(3 * 12 + 1)
      .click();
    await expect(page.locator("#ws-overlay")).toContainText("機械 1台");

    const a = await center(page, 1, 3);
    const z = await center(page, 10, 3);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(z.x, z.y, { steps: 25 });
    await page.mouse.up();
    await expect(page.locator("#ws-overlay")).toContainText("機械 10台"); // 二重配置なし

    // ドラッグ直後のクリック扱いで余計な操作が起きない
    await expect(page.locator("#ws-overlay")).toContainText("機械 10台");

    const c = await center(page, 3, 3);
    const d = await center(page, 7, 3);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(d.x, d.y, { steps: 15 });
    await page.mouse.up({ button: "right" });
    await expect(page.locator("#ws-overlay")).toContainText("機械 5台");
  });

  test("操作説明が左下に常設・16px 以上・コントラスト 4.5:1 以上・ドラッグの説明あり", async ({
    page,
  }) => {
    await open(page);
    const r = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".ws-help-panel")!;
      const cs = getComputedStyle(el);
      const lum = (rgb: string): number => {
        const [r, g, b] = rgb
          .match(/\d+(\.\d+)?/g)!
          .slice(0, 3)
          .map(Number) as [number, number, number];
        const f = (v: number): number => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const l1 = lum(cs.color);
      const l2 = lum(cs.backgroundColor);
      const box = el.getBoundingClientRect();
      const kids = [...el.children].map((k) => parseFloat(getComputedStyle(k).fontSize));
      return {
        font: parseFloat(cs.fontSize),
        kids,
        ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
        box: { x: box.x, y: box.y, r: box.right, b: box.bottom },
        text: el.textContent ?? "",
        shelfBottom: document.querySelector(".ws-shelf")!.getBoundingClientRect().bottom,
        gridLeft: document.querySelector(".ws-grid")!.getBoundingClientRect().left,
      };
    });
    expect(r.font).toBeGreaterThanOrEqual(16);
    for (const k of r.kids) expect(k).toBeGreaterThanOrEqual(16);
    expect(r.ratio).toBeGreaterThanOrEqual(4.5);
    expect(r.box.y).toBeGreaterThan(r.shelfBottom); // 左下（棚の下）
    expect(r.box.r).toBeLessThanOrEqual(r.gridLeft); // 盤面に重ならない
    expect(r.box.b).toBeLessThanOrEqual(720);
    for (const w of ["クリック", "R", "P", "Shift+クリック", "右クリック", "なぞる"]) {
      expect(r.text).toContain(w);
    }
  });

  test("結果の表に次のメダル基準が出る（金なら「最高」）", async ({ page }) => {
    await open(page);
    // 模範解と同じ 10 個をなぞって置く → 3指標とも金
    const row = async (y: number, x0: number, x1: number) => {
      const a = await center(page, x0, y);
      const z = await center(page, x1, y);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(z.x, z.y, { steps: 20 });
      await page.mouse.up();
    };
    await row(3, 1, 10);
    await page.locator(".ws-run").click();
    await page.waitForSelector("#rs-overlay");
    await expect(page.locator('#rs-overlay [data-next-medal="ticks"]')).toHaveText("最高");
    await expect(page.locator('#rs-overlay [data-next-medal="cost"]')).toHaveText("最高");
    await expect(page.locator('#rs-overlay [data-next-medal="accuracy"]')).toHaveText("最高");
  });
});

test.describe("スマホ縦 390×844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("操作説明が16px以上で見え、タップ1回は1台（従来どおり）", async ({ page }) => {
    await open(page);
    const help = page.locator(".ws-help-line");
    await expect(help).toBeVisible();
    expect(
      await help.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    await expect(help).toContainText("なぞる");
    await page
      .locator(".ws-cell")
      .nth(3 * 12 + 2)
      .tap();
    await expect(page.locator("#ws-overlay")).toContainText("機械 1台");
  });
});
