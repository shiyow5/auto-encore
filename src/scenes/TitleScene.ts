/**
 * タイトル画面（Issue #48）。
 *
 * - タイトル・はじめる・遊び方ボタン
 * - 「はじめる」→ "orders" 画面へ遷移（#47 で実装される注文選択画面）
 * - #47 未マージの間は scene.start("orders") だけ書いておく
 */
import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { TITLE } from "./BootScene";
import { fxEnabled } from "../ui/flags";
import { setQaBusy } from "../ui/qa";
import "../ui/workshop.css";

/** 工房画面の操作説明1行。 */
const OPERATIONS_TEXT =
  "置く=クリック / 向き=R / 仕分け機の音高=P か Shift+クリック / 消す=右クリック";

/** タイトル画面でクリックでAudioContextをresumeする。 */
import { ensureAudioContext } from "../audio";

export class TitleScene extends Phaser.Scene {
  private overlay?: HTMLElement;

  constructor() {
    super("title");
  }

  create(): void {
    document.getElementById("ts-overlay")?.remove();
    const ov = document.createElement("div");
    ov.id = "ts-overlay";
    ov.setAttribute("data-scene", "title");
    ov.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #0b0d12; color: #e6e6e6; font-family: monospace;
      z-index: 100;
    `;

    // タイトル
    const titleEl = document.createElement("h1");
    titleEl.style.cssText = `
      font-size: 20px; margin: 0 0 8px 0; text-align: center; line-height: 1.4;
      color: #f2b45a;
    `;
    titleEl.textContent = TITLE.replace(" ― ", "\n");
    ov.append(titleEl);

    // サブタイトル
    const sub = document.createElement("p");
    sub.style.cssText = "font-size: 11px; color: #a09bb0; margin: 0 0 20px 0;";
    sub.textContent = "夜ふけのオルゴール工房";
    ov.append(sub);

    // はじめるボタン
    const startBtn = document.createElement("button");
    startBtn.className = "ws-btn";
    startBtn.style.cssText = "font-size: 16px; padding: 12px 40px; margin-bottom: 12px;";
    startBtn.textContent = "はじめる";
    startBtn.addEventListener("click", async () => {
      await ensureAudioContext();
      this.scene.start("orders");
    });
    ov.append(startBtn);

    // 遊び方ボタン
    const guideBtn = document.createElement("button");
    guideBtn.className = "ws-btn";
    guideBtn.style.cssText = "font-size: 13px; padding: 8px 30px; margin-bottom: 20px;";
    guideBtn.textContent = "遊び方";
    guideBtn.addEventListener("click", () => {
      // 簡易: 遊び方はチュートリアル文を工房で表示するので、工房へ進む
      // 実際にはモーダル表示などを後で実装
      this.scene.start("orders");
    });
    ov.append(guideBtn);

    // 工房へ（e2eテスト・?fx=0用）
    const workshopBtn = document.createElement("button");
    workshopBtn.className = "ws-btn";
    workshopBtn.style.cssText = "font-size: 13px; padding: 8px 30px; margin-bottom: 20px;";
    workshopBtn.textContent = "工房へ";
    workshopBtn.addEventListener("click", async () => {
      await ensureAudioContext();
      this.scene.start("orders");
    });
    ov.append(workshopBtn);

    // 操作説明
    const op = document.createElement("p");
    op.style.cssText = "font-size: 10px; color: #807a8c; margin: 0; text-align: center;";
    op.textContent = OPERATIONS_TEXT;
    ov.append(op);

    (document.getElementById("game") ?? document.body).append(ov);
    this.overlay = ov;

    setQaBusy("transition", false);
    document.body.dataset.scene = "title";

    if (fxEnabled()) {
      setQaBusy("fade", true);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () =>
        setQaBusy("fade", false),
      );
      this.cameras.main.fadeIn(200, 30, 23, 34);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => ov.remove());
  }
}
