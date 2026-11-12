import { expect, test, type Page } from "@playwright/test";

/** AE#188: 実行中の「実行中…(tick N)」が「結果へスキップ」ボタンに重ならない（複数サイズ）。 */
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

for (const size of SIZES) {
  test(`AE#188 ${size.width}×${size.height}: tick 表示とスキップボタンの bbox が交差しない`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    // 実行中の表示は演出あり(?fx なし)のときだけ出る
    await page.goto("/");
    await page.getByRole("button", { name: "はじめる" }).click();
    await page.getByRole("button", { name: "開店前の試し弾き" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    await placeStraightBelts(page);
    await page.locator(".ws-run").click();
    const status = page.locator(".ws-run-status");
    await expect(status).toContainText("実行中…(tick");
    await expect(page.locator(".ws-run")).toHaveText("結果へスキップ");
    if (process.env.SHOT_DIR) {
      await page.waitForFunction(() =>
        /tick 1\d/.test(document.querySelector(".ws-run-status")?.textContent ?? ""),
      );
      await page.screenshot({ path: `${process.env.SHOT_DIR}/${size.width}x${size.height}.png` });
    }
    // 帯とボタンの隙間・ボタンの下に、スクロール中の本文が透けて見えない（#188 の「2 行目」の正体）。
    // 隙間の画素を、本文を隠した状態の画素と比べる（同じなら透けていない）
    // 対象は帯と実行ボタンが同じ注文票の中で縦に並ぶ配置（縦持ち・横長コンパクトは隙間が本文の外）
    const strips = await page.evaluate(() => {
      const ov = document.querySelector("#ws-overlay")!;
      if (ov.classList.contains("ws-portrait") || ov.classList.contains("ws-compact")) return [];
      const st = document.querySelector<HTMLElement>(".ws-run-status")!.getBoundingClientRect();
      const run = document.querySelector<HTMLElement>(".ws-run")!.getBoundingClientRect();
      return [{ x: run.x, width: run.width, y: st.bottom, height: run.top - st.bottom }].filter(
        (r) => r.height >= 1,
      );
    });
    if (strips.length === 0) test.info().annotations.push({ type: "leak", description: "対象外" });
    const shoot = () => Promise.all(strips.map((clip) => page.screenshot({ clip })));
    const withBody = await shoot();
    await page.addStyleTag({
      content: ".ws-order-body > :not(.ws-order-total) { visibility: hidden !important; }",
    });
    const withoutBody = await shoot();
    withBody.forEach((buf, i) => {
      expect(
        buf.equals(withoutBody[i]!),
        `隙間 ${JSON.stringify(strips[i])} に本文が透けている`,
      ).toBe(true);
    });
    // 再生が終わるまで毎フレーム測る（折り返しは tick が 2 桁になってから起きる）。
    // p の枠は折り返しで溢れても高さが変わらないので、文字そのものの矩形(Range)と比べる
    const res = await page.evaluate(
      () =>
        new Promise<{ hits: string[]; maxTick: number; frames: number }>((resolve) => {
          const hits: string[] = [];
          let maxTick = 0;
          let frames = 0;
          const step = () => {
            const st = document.querySelector<HTMLElement>(".ws-run-status");
            const run = document.querySelector<HTMLElement>(".ws-run");
            if (!st || st.hidden || !run) return resolve({ hits, maxTick, frames });
            frames++;
            maxTick = Math.max(maxTick, Number(/tick (\d+)/.exec(st.textContent ?? "")?.[1] ?? 0));
            const rg = document.createRange();
            rg.selectNodeContents(st);
            const b = run.getBoundingClientRect();
            for (const a of rg.getClientRects()) {
              const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (a.width > 0 && ox > 1 && oy > 1)
                hits.push(`${st.textContent}: ${ox.toFixed(0)}x${oy.toFixed(0)}`);
            }
            requestAnimationFrame(step);
          };
          step();
        }),
    );
    expect(res.maxTick).toBeGreaterThanOrEqual(10); // 2 桁の tick まで見た
    expect(res.hits).toEqual([]);
  });
}
