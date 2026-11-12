import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { fnv1a } from "../src/core/checksum";

/** AE#190: 844×390 の注文票で、各テキスト行(bbox)が互いに交差しない。注文1〜3 × 待機中/実行中。 */
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

const IDS = ["order-01", "order-02", "order-03"];
const unlockAll = JSON.stringify({ v: 1, sum: fnv1a(JSON.stringify(IDS)), data: IDS });

type Sol = {
  placements: { machine: string; pos: [number, number]; dir: string }[];
};
const ROT = ["E", "S", "W", "N"];
const loadSol = (id: string): Sol =>
  JSON.parse(
    fs.readFileSync(
      fileURLToPath(new URL(`../src/data/solutions/${id}-frugal.json`, import.meta.url)),
      "utf8",
    ),
  );

/** 模範解（frugal）を UI で置く */
async function place(page: Page, sol: Sol) {
  let cur: string | null = null;
  let dir = "E";
  for (const p of sol.placements) {
    if (p.machine !== cur) {
      await page.locator(`.ws-tool[data-machine="${p.machine}"]`).click();
      cur = p.machine;
    }
    while (dir !== p.dir) {
      await page.getByRole("button", { name: /^次に置く向き/ }).click();
      dir = ROT[(ROT.indexOf(dir) + 1) % 4]!;
    }
    await page.getByRole("button", { name: `マス ${p.pos[0]},${p.pos[1]}: 空き` }).click();
  }
}

for (const id of IDS) {
  for (const running of [false, true]) {
    test(`AE#190 ${id} 844×390 ${running ? "実行中" : "待機中"}: 注文票のテキスト行が交差しない`, async ({
      page,
    }) => {
      // 演出ありの CI では 20 台前後の配置クリックに時間がかかる
      test.setTimeout(150_000);
      await page.addInitScript((v) => localStorage.setItem("ae-order-unlocked", v), unlockAll);
      // 実行中の表示は演出あり(?fx なし)のときだけ出る（?fx=0 は再生せず結果へ）
      await page.goto(running ? "/" : "/?fx=0");
      await page.getByRole("button", { name: "はじめる" }).click();
      await page.locator(`button[data-order-id="${id}"]`).click();
      await expect(page.locator("#ws-overlay.ws-compact")).toBeVisible();
      await place(page, loadSol(id));
      if (running) {
        await page.locator(".ws-run").click();
        await expect(page.locator(".ws-run-status")).toContainText("実行中…(tick");
      }
      const res = await page.evaluate(() => {
        const body = document.querySelector<HTMLElement>(".ws-order-body")!;
        const card = document.querySelector(".ws-order")!.getBoundingClientRect();
        const lines = () => {
          const out: { t: string; r: DOMRect }[] = [];
          const w = document.createTreeWalker(
            document.querySelector(".ws-order")!,
            NodeFilter.SHOW_TEXT,
          );
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            const el = n.parentElement!;
            if (!n.textContent!.trim() || el.closest("[hidden]")) continue;
            const rg = document.createRange();
            rg.selectNodeContents(n);
            for (const r of rg.getClientRects()) {
              if (r.width > 0 && r.height > 0)
                out.push({ t: n.textContent!.trim().slice(0, 12), r });
            }
          }
          return out;
        };
        const hits: string[] = [];
        const check = (label: string) => {
          const L = lines();
          const bb = body.getBoundingClientRect();
          for (let i = 0; i < L.length; i++) {
            const a = L[i]!.r;
            // 本文スクロールで隠れている行は対象外（本文の可視範囲に入っているものだけ）
            const inBody = (r: DOMRect) => r.bottom > bb.top + 1 && r.top < bb.bottom - 1;
            for (let j = i + 1; j < L.length; j++) {
              const b = L[j]!.r;
              const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (ox > 1 && oy > 4 && (inBody(a) || inBody(b))) {
                hits.push(
                  `${label}: "${L[i]!.t}" x "${L[j]!.t}" ${ox.toFixed(0)}x${oy.toFixed(0)}`,
                );
              }
            }
          }
        };
        // 末尾までスクロールした状態（帯は本文の流れの末尾）で全行を検査
        body.scrollTop = body.scrollHeight;
        check("end");
        // 先頭（初期表示）: 帯（合計／実行中…）は本文の下端に付く＝帯の下に本文の行が覗かない（#161/#190）
        body.scrollTop = 0;
        const band = document.querySelector(".ws-order-total")!.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        if (Math.abs(band.bottom - bodyRect.bottom) > 1)
          hits.push(`top: 帯の下端 ${band.bottom} ≠ 本文の下端 ${bodyRect.bottom}`);
        return { hits, cardBottom: card.bottom, scrollable: body.scrollHeight > body.clientHeight };
      });
      if (process.env.SHOT_DIR)
        await page.screenshot({
          path: `${process.env.SHOT_DIR}/${id}-${running ? "run" : "idle"}.png`,
        });
      console.log(`M ${id} ${running ? "run" : "idle"} ${JSON.stringify(res)}`);
      expect(res.hits).toEqual([]);
      expect(res.cardBottom).toBeLessThanOrEqual(390);
    });
  }
}
