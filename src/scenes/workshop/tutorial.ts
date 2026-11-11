/**
 * 注文1 のインタラクティブ・チュートリアル (Issue #50)。
 *
 * 「置く → R で回す → 実行」を1手ずつ案内する。進行は純関数 reduce() で持ち、
 * 進む方向にしか動かない（削除や音高変更で戻さない）。表示は WorkshopScene の DOM オーバーレイ。
 */
import { MemoryStorage, SaveStore } from "../../core/save";

export type TutorialStep = "place" | "rotate" | "run" | "done";
export type TutorialEvent = "placed" | "rotated" | "ran" | "skip";

/** チュートリアルを出す注文。 */
export const TUTORIAL_ORDER_ID = "order-01";
/** 完了・スキップの保存キー。 */
export const TUTORIAL_STORE_KEY = "ae-tutorial-done";

/** 手順ごとの案内文。#38 シナリオの口調に合わせた叩き台。 */
export const TUTORIAL_TEXT: Record<Exclude<TutorialStep, "done">, string> = {
  place: "手順1/3: 棚のベルトを、盤面のマスに1台置いてみましょう。",
  rotate: "手順2/3: 置いたベルトにカーソルを合わせて R で向きを回します。",
  run: "手順3/3: 「実行」で音を流してみましょう。失敗しても置き直せます。",
};

/** タッチ端末（ホバー無し）向けの手順2。R もカーソルも無いので、タップで回す。 */
export const TUTORIAL_ROTATE_TOUCH = "手順2/3: 置いたベルトをタップして向きを回します。";

/** 手順の案内文。touch 端末では手順2だけ文言を差し替える。 */
export function tutorialText(step: Exclude<TutorialStep, "done">, touch: boolean): string {
  return step === "rotate" && touch ? TUTORIAL_ROTATE_TOUCH : TUTORIAL_TEXT[step];
}

/** 機械がまだ無いときに手順2へ添える一言。 */
export const TUTORIAL_NEED_MACHINE = "（まず1台置いてください）";

export function reduce(step: TutorialStep, event: TutorialEvent): TutorialStep {
  if (step === "done") return "done";
  if (event === "skip") return "done";
  if (step === "place" && event === "placed") return "rotate";
  if (step === "rotate" && event === "rotated") return "run";
  if (step === "run" && event === "ran") return "done";
  return step;
}

/** 注文と保存状態から初期手順を決める。出さないときは done。 */
export function initialStep(orderId: string, alreadyDone: boolean): TutorialStep {
  if (orderId !== TUTORIAL_ORDER_ID || alreadyDone) return "done";
  return "place";
}

function getStore(): SaveStore<boolean> {
  let storage: Storage;
  try {
    storage =
      typeof localStorage !== "undefined"
        ? localStorage
        : (new MemoryStorage() as unknown as Storage);
  } catch {
    storage = new MemoryStorage() as unknown as Storage;
  }
  return new SaveStore<boolean>(storage, TUTORIAL_STORE_KEY, 1);
}

export function isTutorialDone(): boolean {
  try {
    return getStore().load().ok;
  } catch {
    return false;
  }
}

export function markTutorialDone(): void {
  try {
    getStore().save(true);
  } catch {
    // 保存できない環境では次回また出るだけ
  }
}
