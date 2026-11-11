/**
 * 結果画面（dev-plan-v3 §3 K4）。3指標（正確さ・速度・コスト）の数値とメダルだけを出す。
 *
 * - 中身は DOM（#rs-overlay）。表は <table>（caption「3指標」）なので読み上げで行ごとに読める
 * - 「工房にもどる」で配置を持ったまま工房へ戻る
 * - 演出（拍手・メダルのアニメ）は後。?fx=0 では最初から全部出す
 * - 「出口に届いた音符（累計）」のグラフ（Lightweight Charts）とフッターの帰属表示（品質uplift §1.5）
 */
import Phaser from "phaser";
import type { ScoreReport } from "../core/score";
import type { SimState } from "../core/sim/sim";
import type { Order, Placement } from "../core/sim/types";
import { loadGameData } from "../data";
import { SaveStore, MemoryStorage } from "../core/save";
import { iconCanvas, type SpriteName } from "../art/sprites";
import { createSceneFx } from "../fx/scene-fx";
import { fxEnabled } from "../ui/flags";
import { setQaBusy, setQaState } from "../ui/qa";
import "../ui/workshop.css";
import { ATTRIBUTION_TEXT, TRADINGVIEW_URL, mountThroughputChart } from "../ui/resultChart";
import { playSfx } from "../audio/player";
import { sfxForReport } from "../audio/sounds";
import {
  MEDAL_TEXT,
  STOP_TEXT,
  VERDICT_TEXT,
  metricRows,
  verdictMessage,
  verdictOf,
  type ThroughputPoint,
} from "./workshop/execute";

/** 紙吹雪（決まった位置・色の小さな四角。乱数なし）。CSS アニメで落ちる。 */
function confetti(n: number): HTMLElement {
  const box = h("div", { class: "rs-confetti", "aria-hidden": "true" });
  const colors = ["#f2b45a", "#8fd6c8", "#f28f9a", "#f3e9dc"];
  for (let i = 0; i < n; i++) {
    const p = h("span", { class: "rs-conf" });
    p.style.left = `${((i * 37) % 100) + 0}%`;
    p.style.background = colors[i % colors.length] ?? "#f2b45a";
    p.style.animationDelay = `${((i * 13) % 20) / 10}s`;
    p.style.animationDuration = `${2 + (i % 5) * 0.4}s`;
    box.append(p);
  }
  return box;
}

export interface ResultData {
  readonly order: Order;
  readonly report: ScoreReport;
  readonly placements: readonly Placement[];
  /** 最後の tick の状態（QA の stateHash 用）。 */
  readonly finalState?: SimState;
  /** tick ごとの出口に届いた音符の累計（グラフ用）。無ければグラフとフッターを出さない。 */
  readonly throughput?: readonly ThroughputPoint[];
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

/**
 * グラフの枠とフッター（帰属表示）を ov の末尾に足し、グラフを描く要素を返す。
 * 数値は表で読めるので、グラフ本体は role="img" + aria-label で一言にまとめる。
 * ライブラリが差し込むロゴのリンク（#tv-attr-logo）は Tab で止まるので、aria-hidden にはしない。
 */
function appendChart(ov: HTMLElement): HTMLElement {
  const fig = h("figure", { class: "rs-chart" });
  fig.append(h("figcaption", {}, "出口に届いた音符（累計）"));
  const box = h("div", {
    class: "rs-chart-box",
    role: "img",
    "aria-label": "出口に届いた音符（累計）のグラフ。数値は上の表を参照",
  });
  fig.append(box);
  ov.append(fig);

  const footer = h("footer", { class: "rs-footer" });
  footer.append(
    h(
      "a",
      { href: TRADINGVIEW_URL, target: "_blank", rel: "noopener noreferrer" },
      ATTRIBUTION_TEXT,
    ),
    " ・ ",
    h("a", { href: "./licenses/lightweight-charts/LICENSE", target: "_blank" }, "LICENSE"),
    " ・ ",
    h("a", { href: "./licenses/lightweight-charts/NOTICE", target: "_blank" }, "NOTICE"),
  );
  ov.append(footer);
  return box;
}

export class ResultScene extends Phaser.Scene {
  private overlay?: HTMLElement;

  /** 合格なら祝い、止まった（不合格）ならエラー演出。メダルが 1 つでもあれば取得演出。 */
  private playFx(report: ScoreReport, verdict: string): void {
    const fx = createSceneFx(this, "fx-result");
    if (!report.passed) {
      fx.emit("runError", verdict.length);
      return;
    }
    fx.emit("result");
    fx.emit("songComplete");
    const medals = Object.values(report.medals);
    if (medals.includes("gold")) fx.emit("medalEarned");
    else if (medals.some((m) => m !== "none")) fx.emit("medalSilver");
  }

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
    // 合格・アンコールのときだけ、紙吹雪と星（?fx=0 や動きを減らす設定では出さない。CSS 側でも止める）
    if (verdict !== "fail" && fxEnabled()) ov.append(confetti(verdict === "encore" ? 28 : 14));
    ov.append(h("p", { class: "rs-sub" }, `${order.title} — ${STOP_TEXT[report.metrics.result]}`));

    const table = h("table", { class: "rs-table" });
    table.append(h("caption", { class: "visually-hidden" }, "3指標"));
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
      // メダルはドット絵＋文字「金/銀/銅」を併記（色だけで区別しない / kyoya P2）。なしは文字のまま。
      const medalCell = h("td", { "data-medal": r.medal });
      if (r.medal === "none") {
        medalCell.textContent = MEDAL_TEXT.none;
      } else {
        medalCell.append(
          iconCanvas(`medal-${r.medal}` as SpriteName, "ae-medal"),
          h("span", { class: "rs-medal-label" }, MEDAL_TEXT[r.medal]),
        );
      }
      tr.append(medalCell);
      body.append(tr);
    }
    table.append(body);
    ov.append(table);

    // 最初にずれた位置（spec-e §2 / #96）。表の外に1行。ずれなし（null）のときは出さない。
    const fm = report.metrics.firstMismatch;
    if (fm !== null) {
      const note = h(
        "p",
        { class: "rs-fm", "data-first-mismatch": String(fm) },
        "最初にずれたのは ",
      );
      note.append(h("strong", {}, `${fm}音目`));
      ov.append(note);
    }

    const msg = verdictMessage(order, verdict);
    if (msg) ov.append(h("p", { class: "rs-msg" }, msg));

    const back = h(
      "button",
      { type: "button", class: "ae-btn ae-btn-secondary rs-back" },
      "工房にもどる",
    );
    back.addEventListener("click", () => {
      setQaBusy("transition", true); // 工房の create で外す。start は次の step まで遅れるので先に立てる
      this.scene.start("workshop", { placements, orderId: order.id });
    });
    const actions = h("div", { class: "rs-actions" });
    actions.append(back);
    ov.append(actions);

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
      // クリアした時点で次の注文を解放する（「工房にもどる」を選んでも解放は残す）
      if (nextOrder && !unlocked.includes(nextOrder.id)) {
        unlockStore.save([...unlocked, nextOrder.id]);
      }
      if (nextOrder) {
        const nextBtn = h("button", {
          type: "button",
          class: "ae-btn ae-btn-primary rs-next",
        });
        nextBtn.textContent = "次の注文へ";
        nextBtn.addEventListener("click", () => {
          setQaBusy("transition", true);
          // 前の注文の配置は盤・入口が違うので持ち込まない
          this.scene.start("workshop", { orderId: nextOrder.id });
        });
        actions.append(nextBtn);
      }
    }

    const chartBox = data.throughput ? appendChart(ov) : null;

    (document.getElementById("game") ?? document.body).append(ov);
    back.focus();

    // autoSize は大きさの決まった要素が要るので、DOM に入れてから描く
    if (chartBox && data.throughput) {
      const dispose = mountThroughputChart(chartBox, data.throughput, report.metrics.total);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
    }

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
    this.playFx(report, verdict);
    // 不合格は runError の音（0.23秒）が先に鳴るので、結果の音はその後にずらす
    if (report.passed) playSfx(sfxForReport(report));
    else this.time.delayedCall(260, () => playSfx(sfxForReport(report)));
    document.body.dataset.scene = "result";
    setQaBusy("transition", false);
  }
}
