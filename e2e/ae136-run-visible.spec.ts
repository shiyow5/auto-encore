/**
 * AE#136: 注文1〜3の工房を開いた直後、「実行」ボタンと配置の合計が画面内にある。
 * 1280×720（横）と 390×844（スマホ縦）で確認する。
 */
import { expect, test } from "@playwright/test";
import { fnv1a } from "../src/core/checksum";

const ORDERS = [
  { id: "order-01", title: "開店前の試し弾き" },
  { id: "order-02", title: "高い音と低い音" },
  { id: "order-03", title: "三つの音を一本に" },
];
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
];

const unlockAll = JSON.stringify({
  v: 1,
  sum: fnv1a(JSON.stringify(ORDERS.map((o) => o.id))),
  data: ORDERS.map((o) => o.id),
});

for (const vp of VIEWPORTS) {
  for (const order of ORDERS) {
    test(`AE#136 ${order.id} ${vp.width}×${vp.height}: 実行ボタンと合計が初期表示で画面内`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await page.addInitScript((v) => localStorage.setItem("ae-order-unlocked", v), unlockAll);
      await page.goto("/?fx=0");
      await page.getByRole("button", { name: "はじめる" }).click();
      await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select");
      await page.locator(`button[data-order-id="${order.id}"]`).click();
      await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
      const run = page.locator("#ws-overlay .ws-run");
      await expect(run).toBeVisible();
      const total = page.getByLabel("配置の合計");
      const inView = (b: { x: number; y: number; width: number; height: number } | null) => {
        expect(b).not.toBeNull();
        expect(b!.y).toBeGreaterThanOrEqual(0);
        expect(b!.y + b!.height).toBeLessThanOrEqual(vp.height);
        expect(b!.x + b!.width).toBeLessThanOrEqual(vp.width);
      };
      const rb = await run.boundingBox();
      console.log(`RUNTOP ${order.id} ${vp.width}x${vp.height} ${rb?.y}`);
      inView(rb);
      inView(await total.boundingBox());
      // 枠内に収まっていても、スクロール領域で切れたり他の要素に隠れたりしていないか（中心点を実際に叩ける）
      for (const loc of [run, total]) {
        const hit = await loc.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return top !== null && el.contains(top);
        });
        expect(hit).toBe(true);
      }
    });
  }
}
