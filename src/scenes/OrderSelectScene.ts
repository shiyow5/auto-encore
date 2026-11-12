/**
 * 注文選択画面 (Issue #47)。
 *
 * - 注文一覧 (タイトル・メダル) を表示
 * - 解放状態は core/save.ts の SaveStore で管理
 * - 「はじめる」(TitleScene) → ここ → WorkshopScene
 * - ResultScene から「次の注文へ」でここへ戻ってくる
 */
import { createSceneFx } from "../fx/scene-fx";
import { iconCanvas } from "../art/sprites";
import Phaser from "phaser";
import type { Order } from "../core/sim/types";
import { loadGameData } from "../data";
import { SaveStore, MemoryStorage } from "../core/save";
import "../ui/workshop.css";
import { playSfx } from "../audio/player";
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

    // 背景はタイトルと同じ星の演出・同じ地色にそろえる
    createSceneFx(this, "fx-orders").emit("ambient");

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
    ov.className = "os-overlay";

    // 見出しは「注文を選ぶ」だけ（作品名はタイトル画面で見せたので繰り返さない）
    ov.append(h("h2", { class: "os-heading" }, "注文を選ぶ"));

    // 注文一覧
    const list = h("div", { class: "os-list" });
    data.orders.forEach((order, index) => {
      const isUnlocked = unlocked.includes(order.id);
      const item = h("div", {
        "data-order-id": order.id,
        class: isUnlocked ? "os-row" : "os-row os-row-locked",
      });

      if (isUnlocked) {
        const btn = h("button", {
          type: "button",
          class: "os-row-btn",
          "data-order-id": order.id,
        });
        btn.append(h("span", {}, order.title));
        // メダルはまだ保存していないので欄ごと出さない (保存・表示は次版。Issue #70)
        btn.addEventListener("click", () => {
          this.selectOrder(order.id, data.orders);
        });
        item.append(btn);
      } else {
        const prev = data.orders[index - 1];
        const locked = h("span", { class: "os-lock-title" }, `ロック中: ${order.title}`);
        locked.prepend(iconCanvas("lock"));
        item.append(locked);
        if (prev) {
          // 解放条件は行を分け、各行 nowrap（語の途中で折り返さない）
          const cond = h("span", { class: "os-lock-cond" });
          cond.append(h("span", {}, "解放条件:"), h("span", {}, `${prev.title} をクリア`));
          item.append(cond);
        }
      }
      list.append(item);
    });
    ov.append(list);

    // タイトルへ戻る (TitleScene へ)
    const back = h("button", {
      type: "button",
      class: "ae-btn ae-btn-secondary os-back",
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
          class: "os-note",
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
    // 結果画面の「注文選択」から来た場合の遷移フラグを外す（waitForIdle が止まらないように）
    setQaBusy("transition", false);
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

    playSfx("confirm");
    setQaBusy("transition", true);
    this.scene.start("workshop", { orderId });
  }
}
