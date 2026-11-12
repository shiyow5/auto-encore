import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "@playwright/test";
import { fnv1a } from "../src/core/checksum";
const SOL = JSON.parse(
  fs.readFileSync(
    fileURLToPath(new URL("../src/data/solutions/order-03-frugal.json", import.meta.url)),
    "utf8",
  ),
) as {
  placements: {
    machine: "belt" | "merger" | "tuner";
    pos: [number, number];
    dir: "N" | "E" | "S" | "W";
  }[];
};
/** Issue #171 */
const NAME = { belt: "ベルト", merger: "合流機", tuner: "調律機" } as const;
const ROT = ["E", "S", "W", "N"] as const;
async function idle(page: Page) {
  await page.waitForFunction(() => window.__qa !== undefined);
  await page.evaluate(() => window.__qa?.waitForIdle());
}
for (const [w, h, tag] of [
  [1280, 720, "pc"],
  [390, 844, "sp"],
] as const) {
  test(`AE#171: 結果画面 5 秒後、見出し・ボタンに演出が重ならない ${tag}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    const ids = ["order-01", "order-02", "order-03"];
    await page.evaluate(
      ([k, v]) => {
        localStorage.clear();
        localStorage.setItem(k!, v!);
      },
      ["ae-order-unlocked", JSON.stringify({ v: 1, sum: fnv1a(JSON.stringify(ids)), data: ids })],
    );
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15000 });
    await page.getByRole("button", { name: "はじめる" }).click();
    await page.getByRole("button", { name: "三つの音を一本に" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    await idle(page);
    let cur: string | null = null;
    let dir = "E";
    for (const p of SOL.placements) {
      if (p.machine !== cur) {
        await page.getByRole("button", { name: new RegExp(`${NAME[p.machine]}を選ぶ`) }).click();
        cur = p.machine;
      }
      while (dir !== p.dir) {
        await page.getByRole("button", { name: /^次に置く向き/ }).click();
        dir = ROT[(ROT.indexOf(dir as (typeof ROT)[number]) + 1) % 4]!;
      }
      await page.getByRole("button", { name: `マス ${p.pos[0]},${p.pos[1]}: 空き` }).click();
    }
    await page.getByRole("button", { name: "実行" }).click();
    await idle(page);
    await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
    // 演出（紙吹雪など）は 2.5 秒ほどで消える。5 秒後に overlay canvas の不透明ピクセルが
    // 見出し・ボタンに重なっていないこと（Issue #171）。LEVEL UP! は出さない。
    const targets = [
      page.getByRole("columnheader", { name: "指標" }),
      page.getByRole("rowheader", { name: "正確さ" }),
      page.getByRole("button", { name: "工房にもどる" }),
    ];
    for (const t of targets) await expect(t).toBeVisible();
    const rects = await Promise.all(targets.map((t) => t.boundingBox()));
    const sample = () =>
      page.evaluate((rs) => {
        const c = document.querySelector<HTMLCanvasElement>("canvas[data-fx-layer]");
        if (!c) return [0, 0, 0];
        const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        const g = c.getBoundingClientRect();
        return rs.map((r) => {
          if (!r) return -1;
          let n = 0;
          for (let y = 0; y < c.height; y++)
            for (let x = 0; x < c.width; x++) {
              const px = g.left + ((x + 0.5) * g.width) / c.width;
              const py = g.top + ((y + 0.5) * g.height) / c.height;
              if (
                px >= r.x &&
                px <= r.x + r.width &&
                py >= r.y &&
                py <= r.y + r.height &&
                d[(y * c.width + x) * 4 + 3]! > 128
              )
                n++;
            }
          return n;
        });
      }, rects);
    // 演出中（0〜3 秒）も 5 秒後も、毎回 0
    const t0 = Date.now();
    for (const t of [0, 400, 800, 1200, 1600, 2000, 2400, 3000, 5000]) {
      const wait = t0 + t - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
      expect(await sample(), `${t}ms`).toEqual([0, 0, 0]);
      // 撮影用（PR のスクショ）。通常の実行では SHOT_PREFIX を付けない
      if (process.env.SHOT_PREFIX && [800, 2000].includes(t))
        await page.screenshot({
          path: `${process.env.SHOT_DIR}/${process.env.SHOT_PREFIX}-${t}ms-${tag}.png`,
        });
    }
    if (process.env.SHOT_PREFIX)
      await page.screenshot({
        path: `${process.env.SHOT_DIR}/${process.env.SHOT_PREFIX}-${tag}.png`,
      });
  });
}
