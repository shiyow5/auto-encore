/**
 * AE#119: ?fx=0 でも実行中は音符の位置を tick ごとに見せる（装飾だけ切る）。
 *  - 成功: 実行中に stateHash（=盤面の音符位置）が tick ごとに変わる。結果へ飛ばない
 *  - 失敗（詰まり）: 途中までの配置でも、詰まるまで tick ごとに見える
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { fnv1a } from "../src/core/checksum";

interface P {
  machine: "belt" | "merger" | "tuner";
  pos: [number, number];
  dir: "N" | "E" | "S" | "W";
}
const SOL = JSON.parse(
  fs.readFileSync(
    fileURLToPath(new URL("../src/data/solutions/order-03-frugal.json", import.meta.url)),
    "utf8",
  ),
) as { placements: P[] };
const NAME = { belt: "ベルト", merger: "合流機", tuner: "調律機" } as const;
const ROT = ["E", "S", "W", "N"] as const;
const IDS = ["order-01", "order-02", "order-03"];

async function openWorkshop(page: Page): Promise<void> {
  await page.goto("/?fx=0");
  await page.evaluate(
    ([k, v]) => {
      localStorage.clear();
      localStorage.setItem(k!, v!);
    },
    ["ae-order-unlocked", JSON.stringify({ v: 1, sum: fnv1a(JSON.stringify(IDS)), data: IDS })],
  );
  await page.reload();
  await page.getByRole("button", { name: "はじめる" }).click();
  await page.getByRole("button", { name: "三つの音を一本に" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await page.waitForFunction(() => window.__qa !== undefined);
  await page.evaluate(() => window.__qa?.waitForIdle());
}

async function place(page: Page, list: P[]): Promise<void> {
  let cur: P["machine"] | null = null;
  let dir: P["dir"] = "E";
  for (const p of list) {
    if (p.machine !== cur) {
      await page.getByRole("button", { name: new RegExp(`${NAME[p.machine]}を選ぶ`) }).click();
      cur = p.machine;
    }
    while (dir !== p.dir) {
      await page.getByRole("button", { name: /^次に置く向き/ }).click();
      dir = ROT[(ROT.indexOf(dir) + 1) % 4]!;
    }
    await page.getByRole("button", { name: `マス ${p.pos[0]},${p.pos[1]}: 空き` }).click();
  }
}

/** 実行を押し、結果画面へ移るまでの tick と stateHash を記録する。 */
async function runAndSample(page: Page, shot: string): Promise<Map<string, string | null>> {
  await page.getByRole("button", { name: "実行" }).click();
  const seen = new Map<string, string | null>();
  let shotTaken = 0;
  for (let i = 0; i < 400; i++) {
    const r = await page.evaluate(() => ({
      scene: document.body.dataset.scene,
      tick: document.getElementById("ws-overlay")?.dataset.tick ?? null,
      hash: window.__qa?.stateHash() ?? null,
    }));
    if (r.scene === "result") break;
    if (r.tick !== null && !seen.has(r.tick)) {
      seen.set(r.tick, r.hash);
      if (shotTaken < 3 && Number(r.tick) >= 2 + shotTaken * 3) {
        await page.screenshot({ path: `${shot}-tick${r.tick}.png` });
        shotTaken++;
      }
    }
    await page.waitForTimeout(20);
  }
  await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
  return seen;
}

test.describe("AE#119: ?fx=0 でも実行中の音符の流れが見える", () => {
  test("成功: 実行中に音符位置が tick ごとに変わる", async ({ page }) => {
    await openWorkshop(page);
    await place(page, SOL.placements);
    const seen = await runAndSample(page, test.info().outputPath("success"));
    expect(seen.size).toBeGreaterThanOrEqual(3);
    expect(new Set(seen.values()).size).toBeGreaterThanOrEqual(3);
  });

  test("失敗(詰まり): 途中までの配置でも詰まるまで tick ごとに見える", async ({ page }) => {
    await openWorkshop(page);
    await place(page, SOL.placements.slice(0, Math.ceil(SOL.placements.length / 2)));
    const seen = await runAndSample(page, test.info().outputPath("stuck"));
    expect(seen.size).toBeGreaterThanOrEqual(2);
    expect(new Set(seen.values()).size).toBeGreaterThanOrEqual(2);
  });
});
