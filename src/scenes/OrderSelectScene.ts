/**
 * 注文選択画面 (Issue #47)。
 *
 * - 注文一覧 (タイトル・メダル) を表示
 * - 解放状態は core/save.ts の SaveStore で管理
 * - 「はじめる」(TitleScene) → ここ → WorkshopScene
 * - ResultScene から「次の注文へ」でここへ戻ってくる
 */
import Phaser from "phaser";
import type { Order } from "../core/sim/types";
import { loadGameData } from "../data";
import { SaveStore, MemoryStorage } from "../core/save";
import "../ui/workshop.css";
import { setQaBusy } from "../ui/qa";

/** 解放状態の保存キー。 */
const UNLOCK_STORE_KEY = "ae-order-unlocked";

/** 解放済み注文IDの配列を保存・読み込みする Store。 */
function getUnlockStore(): SaveStore<string[]> {
  // テスト環境 (SSR) では MemoryStorage を使う
  // localStorage へのアクセス自体が拒否される環境でも落ちないよう try で包む
  let storage: Storage;
  try {
    storage =
      typeof localStorage !== "undefined"
        ? localStorage
        : (new MemoryStorage() as unknown as Storage);
  } catch {
    storage = new MemoryStorage() as unknown as Storage;
  }
  return new SaveStore<string[]>(storage, UNLOCK_STORE_KEY, 1);
}

/** 最初の注文 (order-01) は常に解放済み。 */
const DEFAULT_UNLOCKED: string[] = ["order-01"];

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

export class OrderSelectScene extends Phaser.Scene {
  private overlay!: HTMLDivElement;

  constructor() {
    super("orders");
  }

  create(): void {
    document.getElementById("order-select-overlay")?.remove();
    // Phaser は scene の shutdown() を自動で呼ばないので、イベントで明示的に登録する
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());

    const data = loadGameData();
    const store = getUnlockStore();

    // 解放済み注文を読み込み (デフォルトは order-01)
    const loadResult = store.load();
    const unlocked: string[] =
      loadResult.ok && loadResult.data.length > 0 ? loadResult.data : [...DEFAULT_UNLOCKED];

    // overlay 作成
    const ov = h("div", {
      id: "order-select-overlay",
      "data-scene": "order-select",
    });
    ov.style.cssText = `
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(15, 12, 20, 0.95); color: var(--ae-text); font-family: var(--ae-font);
    `;

    // タイトル
    ov.append(h("h1", { style: "font-size: 14px; margin: 0 0 4px;" }, "Auto Encore"));
    ov.append(
      h(
        "p",
        { style: "font-size: 12px; color: var(--ae-text-weak); margin: 0 0 20px;" },
        "夜更けのオルゴール工房",
      ),
    );
    ov.append(h("h2", { style: "font-size: 12px; margin: 0 0 12px;" }, "注文を選ぶ"));

    // 注文一覧
    const list = h("div", { style: "width: 100%; max-width: 300px;" });
    data.orders.forEach((order, index) => {
      const isUnlocked = unlocked.includes(order.id);
      const item = h("div", {
        "data-order-id": order.id,
        style: `
          border: 1px solid ${isUnlocked ? "#5c4a66" : "#3a2f40"};
          border-radius: 4px; margin: 6px 0; padding: 8px 12px;
          background: ${isUnlocked ? "#2a2530" : "#1a1520"};
          opacity: ${isUnlocked ? 1 : 0.5};
        `,
      });

      if (isUnlocked) {
        const btn = h("button", {
          type: "button",
          class: "ws-btn",
          "data-order-id": order.id,
          style:
            "width: 100%; text-align: left; display: flex; justify-content: space-between; align-items: center;",
        });
        btn.append(h("span", {}, order.title));
        // メダルはまだ保存していないので欄ごと出さない (保存・表示は次版。Issue #70)
        btn.addEventListener("click", () => {
          this.selectOrder(order.id, data.orders);
        });
        item.append(btn);
      } else {
        const prev = data.orders[index - 1];
        const hint = prev ? `（${prev.title} をクリアで解放）` : "";
        item.append(h("span", {}, `🔒 ${order.title}${hint}`));
      }
      list.append(item);
    });
    ov.append(list);

    // タイトルへ戻る (TitleScene へ)
    const back = h("button", {
      type: "button",
      class: "ws-btn",
      style: "margin-top: 16px;",
    });
    back.textContent = "タイトルへ戻る";
    back.addEventListener("click", () => {
      this.scene.start("title");
    });
    ov.append(back);

    ov.append(
      h(
        "p",
        {
          style: "font-size: 12px; color: var(--ae-text-weak); margin-top: 12px;",
        },
        "クリアすると次の注文が解放されます",
      ),
    );

    const gameEl = document.getElementById("game") ?? document.body;
    gameEl.append(ov);
    this.overlay = ov;

    // クリックで閉じる (注文以外)
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!ov.contains(pointer.event.target as Node)) {
        this.scene.start("title");
      }
    });

    document.body.dataset.scene = "order-select";
  }

  shutdown(): void {
    this.overlay?.remove();
  }

  /** 注文IDで WorkshopScene を起動。解放済みなら unlock を保存。 */
  private selectOrder(orderId: string, orders: readonly Order[]): void {
    const store = getUnlockStore();
    const loadResult = store.load();
    const unlocked: string[] = loadResult.ok ? [...loadResult.data] : [...DEFAULT_UNLOCKED];
    if (!unlocked.includes(orderId)) {
      unlocked.push(orderId);
      store.save(unlocked);
    }
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    setQaBusy("transition", true);
    this.scene.start("workshop", { orderId });
  }
}
