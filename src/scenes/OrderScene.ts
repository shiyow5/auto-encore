/**
 * 注文選択画面（ダミー、Issue #47 で本実装）。
 *
 * #47 実装前: 「はじめる」→ ここ → 工房 という流れを確保するため
 * ダミー scene を配置する。#47 PR がマージされたら本実装に置き換える。
 */
import Phaser from "phaser";
import { fxEnabled } from "../ui/flags";
import { setQaBusy } from "../ui/qa";
import "../ui/workshop.css";

export class OrderScene extends Phaser.Scene {
  private overlay?: HTMLElement;

  constructor() {
    super("orders");
  }

  create(): void {
    document.getElementById("os-overlay")?.remove();
    const ov = document.createElement("div");
    ov.id = "os-overlay";
    ov.setAttribute("data-scene", "orders");
    ov.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #0b0d12; color: #e6e6e6; font-family: monospace;
      z-index: 90;
    `;

    // ダミー: 注文1を自動選択して工房へ
    const label = document.createElement("p");
    label.style.cssText = "font-size: 14px; margin: 0 0 16px 0; color: #f2b45a;";
    label.textContent = "注文1: 開店前の試し弾き";
    ov.append(label);

    // 工房へ進むボタン（#47実装後はここが注文選択UIになる）
    const goBtn = document.createElement("button");
    goBtn.className = "ws-btn";
    goBtn.style.cssText = "font-size: 16px; padding: 12px 40px;";
    goBtn.textContent = "工房へ";
    goBtn.addEventListener("click", () => {
      this.scene.start("workshop");
    });
    ov.append(goBtn);

    (document.getElementById("game") ?? document.body).append(ov);
    this.overlay = ov;

    setQaBusy("transition", false);
    document.body.dataset.scene = "orders";

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
