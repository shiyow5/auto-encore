/**
 * Issue #57: E2 稼働灯(fx.ae.run_lamp) / E3 合流機火花(fx.ae.merge_spark)。
 *  - 演出 ON（no-preference）: 灯は 16×16 で 4fps(0.25s)の点滅アニメがある。合流機の切替で火花が出る
 *  - ?fx=0 / prefers-reduced-motion: reduce: 灯は点灯のまま静止（アニメなし）、火花は出ない
 *  - 音符の位置は tick ごとに見える（#119 を壊さない）
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

async function openWorkshop(page: Page, query: string): Promise<void> {
  await page.goto(`/${query}`);
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
  let cur: P["machine"] | null = null;
  let dir: P["dir"] = "E";
  for (const p of SOL.placements) {
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

interface Sample {
  lampSize: { w: number; h: number } | null;
  lampAnims: number;
  lampBg: string[];
  sparks: number;
  ticks: number;
}

/** 実行を押し、結果画面へ移るまで灯と火花の状態を集める。 */
async function runAndObserve(page: Page): Promise<Sample> {
  await page.getByRole("button", { name: "実行" }).click();
  const out: Sample = { lampSize: null, lampAnims: 0, lampBg: [], sparks: 0, ticks: 0 };
  const ticks = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const r = await page.evaluate(() => {
      const lamp = document.querySelector<HTMLElement>(".ws-run-lamp");
      const ov = document.getElementById("ws-overlay");
      const box = lamp?.getBoundingClientRect();
      return {
        scene: document.body.dataset.scene,
        tick: ov?.dataset.tick ?? null,
        sparks: Number(ov?.dataset.mergeSparks ?? 0),
        anims: lamp ? lamp.getAnimations().filter((a) => a.playState === "running").length : 0,
        bg: lamp ? getComputedStyle(lamp).backgroundColor : "",
        size: box && box.width > 0 ? { w: box.width, h: box.height } : null,
      };
    });
    if (r.scene === "result") break;
    if (r.tick !== null) ticks.add(r.tick);
    if (r.size) out.lampSize = r.size;
    out.lampAnims = Math.max(out.lampAnims, r.anims);
    if (r.bg && !out.lampBg.includes(r.bg)) out.lampBg.push(r.bg);
    out.sparks = Math.max(out.sparks, r.sparks);
    await page.waitForTimeout(20);
  }
  out.ticks = ticks.size;
  await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
  return out;
}

const AMBER = "rgb(242, 180, 90)";

test.describe("AE#57: E2 稼働灯 / E3 合流機火花", () => {
  test("no-preference: 灯が 16×16 で点滅し、合流機の切替で火花が出る", async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openWorkshop(page, "");
    const s = await runAndObserve(page);
    expect(s.lampSize).toEqual({ w: 16, h: 16 });
    expect(s.lampAnims).toBeGreaterThan(0);
    expect(s.lampBg).toContain(AMBER);
    expect(s.lampBg.length).toBeGreaterThanOrEqual(2); // 点灯 / 減光の 2 フレーム
    expect(s.sparks).toBeGreaterThan(0);
  });

  test("reduce: 灯は点灯のまま静止し、火花は出ない（音符は tick ごとに見える）", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openWorkshop(page, "");
    const s = await runAndObserve(page);
    expect(s.lampSize).toEqual({ w: 16, h: 16 });
    expect(s.lampAnims).toBe(0);
    expect(s.lampBg).toEqual([AMBER]);
    expect(s.sparks).toBe(0);
    expect(s.ticks).toBeGreaterThanOrEqual(3);
  });

  test("?fx=0: 灯は点灯のまま静止し、火花は出ない（音符は tick ごとに見える）", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openWorkshop(page, "?fx=0");
    const s = await runAndObserve(page);
    expect(s.lampSize).toEqual({ w: 16, h: 16 });
    expect(s.lampAnims).toBe(0);
    expect(s.lampBg).toEqual([AMBER]);
    expect(s.sparks).toBe(0);
    expect(s.ticks).toBeGreaterThanOrEqual(3);
  });
});
