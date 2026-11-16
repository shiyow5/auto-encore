import { expect, test } from "@playwright/test";

/** AE#103: 工房の実行中は、進行バーが見え、Primary（琥珀塗り）のボタンが 0 になる。 */
const SIZES = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

for (const size of SIZES) {
  test(`AE#103 ${size.width}×${size.height}: 実行中は進行バーが見えて Primary 琥珀ボタンが 0`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: "はじめる" }).click();
    await page.getByRole("button", { name: "開店前の試し弾き" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    for (let x = 1; x <= 10; x++) {
      await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
    }
    if (process.env.SHOT_DIR)
      await page.screenshot({
        path: `${process.env.SHOT_DIR}/${size.width}x${size.height}-before-run.png`,
      });

    // 実行前は Primary（琥珀塗り）の「実行」がある
    const amberButtons = (): Promise<number> =>
      page.evaluate(() => {
        let n = 0;
        for (const b of document.querySelectorAll<HTMLElement>("#ws-overlay button")) {
          const r = b.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const bg = getComputedStyle(b).backgroundColor;
          if (bg === "rgb(242, 180, 90)" && b.getAttribute("aria-pressed") !== "true") n++;
        }
        return n;
      });
    expect(await amberButtons()).toBe(1);

    // 再生の時計を止めて、途中の tick で測る（1 tick = 110ms）
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
    await page.locator(".ws-run").click();
    await expect(page.locator(".ws-run")).toHaveText("結果へスキップ");
    await page.clock.runFor(1200);
    await page.mouse.move(0, 0); // ホバーの色を測らない
    await page.waitForTimeout(300); // 背景色の transition(120ms) が終わるのを待つ

    const bar = page.locator(".ws-runbar");
    await expect(bar).toBeVisible();
    await expect(bar.locator(".ws-runbar-title")).toHaveText("実行中 ♪");
    const m = await page.evaluate(() => {
      const q = (s: string): HTMLElement => document.querySelector<HTMLElement>(s)!;
      const track = q(".ws-runbar-track").getBoundingClientRect();
      const fill = q(".ws-runbar-fill").getBoundingClientRect();
      const grid = q(".ws-grid").getBoundingClientRect();
      const run = getComputedStyle(q(".ws-run"));
      return {
        trackH: track.height,
        trackW: track.width,
        fillW: fill.width,
        trackBg: getComputedStyle(q(".ws-runbar-track")).backgroundColor,
        fillBg: getComputedStyle(q(".ws-runbar-fill")).backgroundColor,
        tick: q(".ws-runbar-tick").textContent,
        barBottom: q(".ws-runbar").getBoundingClientRect().bottom,
        barTop: q(".ws-runbar").getBoundingClientRect().top,
        gridTop: grid.top,
        runBg: run.backgroundColor,
        runBorder: run.borderTopColor,
        note: document.querySelector<HTMLElement>(".ws-shelf-note")!.hidden,
        shelfOpacity: getComputedStyle(q(".ws-palette")).opacity,
      };
    });
    expect(m.trackH).toBe(8);
    expect(m.trackBg).toBe("rgb(58, 45, 66)"); // #3A2D42
    expect(m.fillBg).toBe("rgb(242, 180, 90)"); // #F2B45A
    expect(m.fillW).toBeGreaterThan(0);
    expect(m.fillW).toBeLessThanOrEqual(m.trackW);
    expect(m.tick).toMatch(/^tick \d+\/\d+$/);
    expect(m.barTop).toBeGreaterThanOrEqual(0);
    expect(m.barBottom).toBeLessThanOrEqual(m.gridTop); // 盤面の上
    // 他の要素（実行ボタン・音量・出口の表示など）と重ならない
    const overlaps = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>(".ws-runbar")!.getBoundingClientRect();
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(
        "#ws-overlay button, #volume-toggle, .ws-help-line, .ws-guide",
      )) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (getComputedStyle(el).visibility === "hidden") continue;
        if (r.left < bar.right && r.right > bar.left && r.top < bar.bottom && r.bottom > bar.top)
          out.push(el.className || el.id);
      }
      return out;
    });
    expect(overlaps).toEqual([]);
    expect(m.runBg).toBe("rgba(0, 0, 0, 0)"); // Secondary（塗りなし）
    expect(m.runBorder).toBe("rgb(122, 104, 136)"); // #7A6888
    expect(m.note).toBe(false); // 「実行中は編集できません」
    expect(m.shelfOpacity).toBe("0.6");
    expect(await amberButtons()).toBe(0); // 受入条件: Primary 琥珀ボタンが 0
    if (process.env.SHOT_DIR)
      await page.screenshot({
        path: `${process.env.SHOT_DIR}/${size.width}x${size.height}-running.png`,
      });
  });
}
