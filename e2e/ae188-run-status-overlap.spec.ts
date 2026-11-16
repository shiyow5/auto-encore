import { expect, test, type Page } from "@playwright/test";

/** AE#188 / #103: 実行中の表示（「実行中 ♪」+ 進行バー + tick N/M）が「結果へスキップ」・盤面・注文票に重ならない（複数サイズ）。 */
const SIZES = [
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1280, height: 720 },
];

async function placeStraightBelts(page: Page): Promise<void> {
  for (let x = 1; x <= 10; x++) {
    await page.getByRole("button", { name: `マス ${x},3: 空き` }).click();
  }
}

/** 実行中の表示の文字・バーの実矩形が、実行ボタンと盤面に重ならないか。再生が終わっていれば null。 */
async function measure(page: Page): Promise<{ tick: number; hit: string | null } | null> {
  return page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>(".ws-runbar");
    const run = document.querySelector<HTMLElement>(".ws-run");
    const grid = document.querySelector<HTMLElement>(".ws-grid");
    if (!bar || bar.hidden || !run || !grid) return null;
    const rg = document.createRange();
    rg.selectNodeContents(bar);
    const targets = { 実行ボタン: run.getBoundingClientRect(), 盤面: grid.getBoundingClientRect() };
    let hit: string | null = null;
    for (const a of rg.getClientRects()) {
      for (const [name, b] of Object.entries(targets)) {
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (a.width > 0 && ox > 1 && oy > 1)
          hit = `${name}と重なる: ${ox.toFixed(0)}x${oy.toFixed(0)}`;
      }
    }
    const tick = Number(
      /tick (\d+)/.exec(document.querySelector(".ws-runbar-tick")?.textContent ?? "")?.[1] ?? 0,
    );
    return { tick, hit };
  });
}

for (const size of SIZES) {
  test(`AE#188 ${size.width}×${size.height}: 実行中の表示が実行ボタン・盤面に重ならない`, async ({
    page,
  }) => {
    test.setTimeout(90_000); // CI のスマホ幅は配置クリックが遅い
    await page.setViewportSize(size);
    // 実行中の表示は演出あり(?fx なし)のときだけ出る
    await page.goto("/");
    await page.getByRole("button", { name: "はじめる" }).click();
    await page.getByRole("button", { name: "開店前の試し弾き" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    await placeStraightBelts(page);
    // 再生（1 tick = 110ms）の時計を止めて、CI が遅くても tick 10 以上の状態を確実に測る
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
    await page.locator(".ws-run").click();
    await expect(page.locator(".ws-run")).toHaveText("結果へスキップ");

    const hits: string[] = [];
    let maxTick = 0;
    for (let i = 0; i < 8; i++) {
      await page.clock.runFor(i === 0 ? 1200 : 110); // 1 tick = 110ms。最初に tick 10 まで進める
      const m = await measure(page);
      if (!m) break;
      maxTick = Math.max(maxTick, m.tick);
      if (m.hit) hits.push(m.hit);
    }
    expect(maxTick).toBeGreaterThanOrEqual(10); // 2 桁の tick まで見た
    expect(hits).toEqual([]);
  });
}
