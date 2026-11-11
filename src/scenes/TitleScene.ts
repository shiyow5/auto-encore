/**
 * タイトル画面 (Issue #48)。
 *
 * - タイトル表示、「はじめる」ボタン、「遊び方」ボタン
 * - 「はじめる」→ orders 画面へ遷移 (`this.scene.start("orders")`)
 * - 「遊び方」→ モーダルで操作説明を表示
 */
import { createSceneFx } from "../fx/scene-fx";
import Phaser from "phaser";

import { TITLE } from "./BootScene";
import "../ui/workshop.css";
import { playSfx } from "../audio/player";

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

/** タイトル画面のオーバーレイ。 */
class TitleOverlay {
  private el!: HTMLDivElement;
  private modal: HTMLDivElement | null = null;

  attach(parent: HTMLElement, onStart: () => void): void {
    document.getElementById("title-overlay")?.remove();
    const ov = h("div", { id: "title-overlay", "data-scene": "title" });
    ov.style.cssText = `
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(15, 12, 20, 0.95); color: var(--ae-text); font-family: var(--ae-font);
      z-index: 100;
    `;

    // 狭い画面では「夜更け」と「のオルゴール工房」の間で折れないよう、後半を nowrap にまとめる
    const title = h("h1", {});
    const [titleHead, titleTail] = TITLE.split(" ― ");
    title.append(`${titleHead} ― `);
    const titleNoWrap = h("span", {}, titleTail);
    titleNoWrap.style.whiteSpace = "nowrap";
    title.append(titleNoWrap);
    title.style.cssText =
      "font-size: 32px; line-height: 32px; color: #f2b45a; margin: 0 0 24px; text-align: center; padding: 0 16px;";
    ov.append(title);

    const btnStart = h("button", {
      type: "button",
      class: "ws-btn",
      "aria-label": "はじめる",
    });
    btnStart.textContent = "はじめる";
    btnStart.style.cssText = `
      min-height: 44px; padding: 8px 24px; font-size: 16px; font-family: var(--ae-font);
      background: var(--ae-surface-up); color: var(--ae-text); border: 1px solid #5c4a66;
      cursor: pointer; margin: 4px;
    `;
    btnStart.addEventListener("click", () => {
      playSfx("start");
      this.remove();
      onStart();
    });
    ov.append(btnStart);

    const btnGuide = h("button", {
      type: "button",
      class: "ws-btn",
      "aria-label": "遊び方",
    });
    btnGuide.textContent = "遊び方";
    btnGuide.style.cssText = `
      min-height: 44px; padding: 8px 24px; font-size: 16px; font-family: var(--ae-font);
      background: var(--ae-surface); color: var(--ae-text-weak); border: 1px solid #3a2f40;
      cursor: pointer; margin: 4px;
    `;
    btnGuide.addEventListener("click", () => this.toggleGuide());
    ov.append(btnGuide);

    parent.append(ov);
    this.el = ov;
  }

  private toggleGuide(): void {
    if (this.modal) {
      this.el.removeChild(this.modal);
      this.modal = null;
      return;
    }
    const guide = h("div", {
      class: "ws-guide-modal",
      "aria-label": "遊び方",
    });
    guide.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: var(--ae-bg); border: 1px solid #5c4a66;
      padding: 20px; max-width: 420px; color: var(--ae-text);
      font-size: 16px; line-height: 24px;
    `;

    const title = h("h2", {}, "遊び方");
    title.style.cssText = "margin: 0 0 12px; font-size: 24px; line-height: 32px;";
    guide.append(title);

    const ops = [
      "置く = クリック",
      "向き = R キー",
      "仕分け機の音高 = P キー",
      "仕分け機の音高(マウス) = Shift+クリック",
      "消す = 右クリック",
    ];
    const ul = h("ul", {}, "");
    for (const op of ops) {
      ul.append(h("li", {}, op));
    }
    guide.append(ul);

    const close = h("button", { type: "button", class: "ws-btn" });
    close.textContent = "閉じる";
    close.style.cssText = `
      margin-top: 12px; min-height: 44px; padding: 4px 16px; font-size: 16px;
      background: var(--ae-surface-up); color: var(--ae-text); border: 1px solid #5c4a66;
      cursor: pointer;
    `;
    close.addEventListener("click", () => {
      this.el.removeChild(guide);
      this.modal = null;
    });
    guide.append(close);

    this.el.append(guide);
    this.modal = guide;
  }

  remove(): void {
    this.el.remove();
  }
}

export class TitleScene extends Phaser.Scene {
  private overlay = new TitleOverlay();

  constructor() {
    super("title");
  }

  create(): void {
    document.body.dataset.scene = "title";
    createSceneFx(this, "fx-title").emit("ambient");

    const gameEl = document.getElementById("game") ?? document.body;
    this.overlay.attach(gameEl, () => this.scene.start("orders"));

    // クリックでタイトル画面を閉じて orders へ
    this.input.on("pointerdown", () => {
      this.overlay.remove();
      this.scene.start("orders");
    });
  }

  shutdown(): void {
    this.overlay.remove();
  }
}
