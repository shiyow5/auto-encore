/**
 * タイトル画面 (Issue #48)。
 *
 * - タイトル表示、「はじめる」ボタン、「遊び方」ボタン
 * - 「はじめる」→ orders 画面へ遷移 (`this.scene.start("orders")`)
 * - 「遊び方」→ モーダルで操作説明を表示
 */
import Phaser from "phaser";

import { TITLE } from "./BootScene";
import "../ui/workshop.css";

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

  attach(parent: HTMLElement): void {
    document.getElementById("title-overlay")?.remove();
    const ov = h("div", { id: "title-overlay", "data-scene": "title" });
    ov.style.cssText = `
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(11, 13, 18, 0.95); color: #e6e6e6; font-family: monospace;
      z-index: 100;
    `;

    const title = h("h1", {}, TITLE);
    title.style.cssText = "font-size: 14px; margin: 0 0 8px;";
    ov.append(title);

    const subtitle = h("p", {}, "夜更けのオルゴール工房");
    subtitle.style.cssText = "font-size: 10px; color: #8a8090; margin: 0 0 24px;";
    ov.append(subtitle);

    const btnStart = h("button", {
      type: "button",
      class: "ws-btn",
      "aria-label": "はじめる",
    });
    btnStart.textContent = "はじめる";
    btnStart.style.cssText = `
      padding: 8px 24px; font-size: 12px; font-family: monospace;
      background: #3a2f40; color: #e6e6e6; border: 1px solid #5c4a66;
      cursor: pointer; margin: 4px;
    `;
    btnStart.addEventListener("click", () => {
      this.remove();
      // orders scene が未実装なので当面 workshop へ
      this.goToWorkshop();
    });
    ov.append(btnStart);

    const btnGuide = h("button", {
      type: "button",
      class: "ws-btn",
      "aria-label": "遊び方",
    });
    btnGuide.textContent = "遊び方";
    btnGuide.style.cssText = `
      padding: 8px 24px; font-size: 12px; font-family: monospace;
      background: #2a2530; color: #b0a0c0; border: 1px solid #3a2f40;
      cursor: pointer; margin: 4px;
    `;
    btnGuide.addEventListener("click", () => this.toggleGuide());
    ov.append(btnGuide);

    parent.append(ov);
    this.el = ov;
  }

  private goToWorkshop(): void {
    // orders が未実装なので当面 workshop へ
    const game = (window as unknown as { __game?: { scene: { start: (s: string) => void } } })
      .__game;
    if (game?.scene) {
      game.scene.start("workshop");
    }
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
      background: #1e1722; border: 1px solid #5c4a66;
      padding: 20px; max-width: 300px; color: #e6e6e6;
      font-size: 11px; line-height: 1.6;
    `;

    const title = h("h2", {}, "遊び方");
    title.style.cssText = "margin: 0 0 12px; font-size: 13px;";
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
      margin-top: 12px; padding: 4px 16px; font-size: 11px;
      background: #3a2f40; color: #e6e6e6; border: 1px solid #5c4a66;
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

    const gameEl = document.getElementById("game") ?? document.body;
    this.overlay.attach(gameEl);

    // クリックでタイトル画面を閉じて workshop へ
    this.input.on("pointerdown", () => {
      this.overlay.remove();
      // orders がまだないので workshop へフォールバック
      this.scene.start("workshop");
    });
  }

  shutdown(): void {
    this.overlay.remove();
  }
}
