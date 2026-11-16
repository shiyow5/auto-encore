/**
 * AE#137: 注文3（最後の注文）をクリアしても行き止まりにならない。
 *  - 結果画面に「注文選択」「タイトル」ボタンが出て、押すとそれぞれへ遷移する
 *  - 全クリア時だけ締めの一文が出る（注文3 の模範解 20台/42G）
 *  - 注文票に依頼人が出る
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

function unlockedEnvelope(ids: string[]): string {
  return JSON.stringify({ v: 1, sum: fnv1a(JSON.stringify(ids)), data: ids });
}

async function waitForIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__qa !== undefined);
  await page.evaluate(() => window.__qa?.waitForIdle());
}

async function clearOrder3(page: Page, unlocked: string[]): Promise<void> {
  await page.goto("/?fx=0");
  await page.evaluate(
    ([k, v]) => {
      localStorage.clear();
      localStorage.setItem(k!, v!);
    },
    ["ae-order-unlocked", unlockedEnvelope(unlocked)],
  );
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select");
  await page.getByRole("button", { name: "三つの音を一本に" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
  await waitForIdle(page);

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
  await expect(page.getByLabel("配置の合計")).toHaveText("機械 20台 / 42G");
  await page.getByRole("button", { name: "実行" }).click();
  await waitForIdle(page);
  await expect(page.locator("body")).toHaveAttribute("data-scene", "result");
}

test.describe("AE#137: 注文3クリア後の行き止まり解消", () => {
  test("注文票に依頼人（ミスズ師匠）と2行の intro が出る", async ({ page }) => {
    await page.goto("/?fx=0");
    await page.evaluate(
      ([k, v]) => localStorage.setItem(k!, v!),
      ["ae-order-unlocked", unlockedEnvelope(["order-01", "order-02", "order-03"])],
    );
    await page.reload();
    await page.getByRole("button", { name: "はじめる" }).click();
    await page.getByRole("button", { name: "三つの音を一本に" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop");
    const card = page.getByRole("region", { name: "注文票" });
    await expect(card).toContainText("依頼人: ミスズ師匠");
    await expect(card).toContainText("サビ前だよ。ミを持ち上げて、");
    await expect(card).toContainText("ド・ソ・ミ・ソと並べてごらん。");
    await expect(card).toContainText("ド・ソ・ミ・ソを四回。そのあとソを八つ。");
  });

  test("全クリア: 締めの一文・注文選択へ・タイトルへ", async ({ page }) => {
    await clearOrder3(page, ["order-01", "order-02", "order-03"]);
    const ov = page.locator("#rs-overlay");
    await expect(ov.locator(".rs-msg")).toHaveText(
      "…今のは、いい音だった。昔の私の解に、少し似てたね。",
    );
    await expect(ov.locator(".rs-allclear")).toHaveText(
      "これで開店できるね。ありがとう、ミスズさん。",
    );
    await expect(ov.getByRole("button", { name: "次の注文へ" })).toHaveCount(0);
    await page.screenshot({ path: "test-results/ae137-result-allclear.png" });
    await ov.getByRole("button", { name: "注文選択" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select");

    await clearOrder3(page, ["order-01", "order-02", "order-03"]);
    await page.locator("#rs-overlay").getByRole("button", { name: "タイトル" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "title");
  });
});
