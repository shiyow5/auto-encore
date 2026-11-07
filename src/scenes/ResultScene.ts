/**
 * 結果画面（dev-plan-v3 §3 K4）。3指標（正確さ・速度・コスト）の数値とメダルだけを出す。
 *
 * - 中身は DOM（#rs-overlay）。表は <table>（caption「3指標」）なので読み上げで行ごとに読める
 * - 「工房にもどる」で配置を持ったまま工房へ戻る
 * - 演出（拍手・メダルのアニメ）は後。?fx=0 では最初から全部出す
 */
import Phaser from "phaser";
import type { ScoreReport } from "../core/score";
import type { SimState } from "../core/sim/sim";
import type { Order, Placement } from "../core/sim/types";
import { loadGameData } from "../data";
import { SaveStore, MemoryStorage } from "../core/save";
import { fxEnabled } from "../ui/flags";
import { setQaBusy, setQaState } from "../ui/qa";
import "../ui/workshop.css";
import {
  MEDAL_TEXT,
  STOP_TEXT,
  VERDICT_TEXT,
  metricRows,
  verdictMessage,
  verdictOf,
} from "./workshop/execute";

export interface ResultData {
  readonly order: Order;
  readonly report: ScoreReport;
  readonly placements: readonly Placement[];
  /** 最後の tick の状態（QA の stateHash 用）。 */
  readonly finalState?: SimState;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

export class ResultScene extends Phaser.Scene {
  private overlay?: HTMLElement;

  constructor() {
    super("result");
  }

  create(data: ResultData): void {
    const { order, report, placements } = data;
    const verdict = verdictOf(report);

    document.getElementById("rs-overlay")?.remove();
    const ov = h("section", {
      id: "rs-overlay",
      "aria-labelledby": "rs-title",
      "data-verdict": verdict,
      "data-result": report.metrics.result,
    });
    this.overlay = ov;

    ov.append(h("h2", { id: "rs-title" }, `結果: ${VERDICT_TEXT[verdict]}`));
    ov.append(h("p", { class: "rs-sub" }, `${order.title} — ${STOP_TEXT[report.metrics.result]}`));

    const table = h("table", { class: "rs-table" });
    table.append(h("caption", {}, "3指標"));
    const head = h("tr", {});
    for (const t of ["指標", "値", "メダル"]) head.append(h("th", { scope: "col" }, t));
    const thead = h("thead", {});
    thead.append(head);
    table.append(thead);
    const body = h("tbody", {});
    for (const r of metricRows(report)) {
      const tr = h("tr", { "data-metric": r.key });
      tr.append(h("th", { scope: "row" }, r.label));
      tr.append(h("td", {}, r.value));
      tr.append(h("td", { "data-medal": r.medal }, MEDAL_TEXT[r.medal]));
      body.append(tr);
    }
    table.append(body);
    ov.append(table);

    const msg = verdictMessage(order, verdict);
    if (msg) ov.append(h("p", { class: "rs-msg" }, msg));

    const back = h("button", { type: "button", class: "ws-btn rs-back" }, "工房にもどる");
    back.addEventListener("click", () => {
      setQaBusy("transition", true); // 工房の create で外す。start は次の step まで遅れるので先に立てる
      this.scene.start("workshop", { placements, orderId: order.id });
    });
    ov.append(back);

    // Issue #47: 結果が合格 (pass または encore) なら「次の注文へ」を表示
    if (report.passed) {
      const unlockStore = new SaveStore<string[]>(
        typeof localStorage !== "undefined"
          ? localStorage
          : (new MemoryStorage() as unknown as typeof localStorage),
        "ae-order-unlocked",
        1,
      );
      const loadRes = unlockStore.load();
      const unlocked: string[] = loadRes.ok ? [...loadRes.data] : ["order-01"];

      const allOrders = loadGameData().orders;
      const idx = allOrders.findIndex((o) => o.id === order.id);
      const nextOrder = allOrders[idx + 1];
      if (nextOrder) {
        const nextBtn = h("button", {
          type: "button",
          class: "ws-btn rs-next",
        });
        nextBtn.textContent = "次の注文へ";
        nextBtn.addEventListener("click", () => {
          if (!unlocked.includes(nextOrder.id)) {
            unlockStore.save([...unlocked, nextOrder.id]);
          }
          setQaBusy("transition", true);
          this.scene.start("workshop", { placements, orderId: nextOrder.id });
        });
        ov.append(nextBtn);
      }
    }

    (document.getElementById("game") ?? document.body).append(ov);
    back.focus();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.overlay?.remove());
    setQaState(data.finalState ?? null);
    if (fxEnabled()) {
      setQaBusy("fade", true);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () =>
        setQaBusy("fade", false),
      );
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setQaBusy("fade", false));
      this.cameras.main.fadeIn(200, 30, 23, 34);
    }
    document.body.dataset.scene = "result";
    setQaBusy("transition", false);
  }
}
