import { expect, test, type Page } from "@playwright/test";

/** AE#188: 実行中の「実行中…(tick N)」が「結果へスキップ」ボタンに重ならず、隙間に本文が透けない（複数サイズ）。 */
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

/** 帯の文字の実矩形（Range。p の枠は折り返しで溢れても高さが変わらない）と実行ボタンの重なり。再生が終わっていれば null。 */
async function measure(page: Page): Promise<{ tick: number; hit: string | null } | null> {
  return page.evaluate(() => {
    const st = document.querySelector<HTMLElement>(".ws-run-status");
    const run = document.querySelector<HTMLElement>(".ws-run");
    if (!st || st.hidden || !run) return null;
    const rg = document.createRange();
    rg.selectNodeContents(st);
    const b = run.getBoundingClientRect();
    let hit: string | null = null;
    for (const a of rg.getClientRects()) {
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (a.width > 0 && ox > 1 && oy > 1)
        hit = `${st.textContent}: ${ox.toFixed(0)}x${oy.toFixed(0)}`;
    }
    return { tick: Number(/tick (\d+)/.exec(st.textContent ?? "")?.[1] ?? 0), hit };
  });
}

for (const size of SIZES) {
  test(`AE#188 ${size.width}×${size.height}: tick 表示とスキップボタンが重ならず、隙間に本文が透けない`, async ({
    page,
  }) => {
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
    let leakChecked = false;
    for (let i = 0; i < 40; i++) {
      await page.clock.runFor(110);
      const m = await measure(page);
      if (!m) break;
      maxTick = Math.max(maxTick, m.tick);
      if (m.hit) hits.push(m.hit);
      if (m.tick >= 10 && !leakChecked) {
        leakChecked = true;
        if (process.env.SHOT_DIR)
          await page.screenshot({
            path: `${process.env.SHOT_DIR}/${size.width}x${size.height}.png`,
          });
        // 帯とボタンの隙間に、スクロール中の本文が透けて見えない（#188 の「2 行目」の正体）。
        // 隙間の画素を、本文を隠した状態の画素と比べる（同じなら透けていない）。
        // 対象は帯と実行ボタンが同じ注文票の中で縦に並ぶ配置（縦持ち・横長コンパクトは隙間が本文の外）
        const strip = await page.evaluate(() => {
          const ov = document.querySelector("#ws-overlay")!;
          if (ov.classList.contains("ws-portrait") || ov.classList.contains("ws-compact"))
            return null;
          const st = document.querySelector<HTMLElement>(".ws-run-status")!.getBoundingClientRect();
          const run = document.querySelector<HTMLElement>(".ws-run")!.getBoundingClientRect();
          const r = { x: run.x, width: run.width, y: st.bottom, height: run.top - st.bottom };
          return r.height >= 1 ? r : null;
        });
        if (strip) {
          const withBody = await page.screenshot({ clip: strip });
          await page.addStyleTag({
            content: ".ws-order-body > :not(.ws-order-total) { visibility: hidden !important; }",
          });
          const withoutBody = await page.screenshot({ clip: strip });
          expect(
            withBody.equals(withoutBody),
            `隙間 ${JSON.stringify(strip)} に本文が透けている`,
          ).toBe(true);
        }
      }
    }
    expect(maxTick).toBeGreaterThanOrEqual(10); // 2 桁の tick まで見た
    expect(hits).toEqual([]);
  });
}
