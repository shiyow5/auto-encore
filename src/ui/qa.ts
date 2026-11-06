/**
 * QA 用フック（Issue #13）。`window.__qa` に生やす。ゲームロジックはここから触らない。
 *
 * - `stateHash()` … いま画面が見せている SimState の stateHash（Vitest 側と同じ `core/sim/hash` の関数）。
 *   まだ一度も実行していなければ null
 * - `waitForIdle()` … 再生・画面遷移・フェードが止まったら resolve する Promise
 * - `scene()` … 今のシーン名（`<body data-scene>` と同じ値）
 *
 * 「忙しい」は名前付きのキーで数える。立てたシーンが必ず外すこと（SHUTDOWN でも外す）。
 */
import { stateHash as hashOf } from "../core/sim/hash";
import type { SimState } from "../core/sim/sim";

export interface QaHooks {
  stateHash(): string | null;
  waitForIdle(): Promise<void>;
  scene(): string | null;
}

declare global {
  interface Window {
    __qa?: QaHooks;
  }
}

let current: SimState | null = null;
const busy = new Set<string>();
let waiters: Array<() => void> = [];

/** いま見せている状態（再生中は tick ごとに差し替える）。 */
export function setQaState(s: SimState | null): void {
  current = s;
}

/** 忙しいキーを立てる／外す。空になったら waitForIdle を待っている人を起こす。 */
export function setQaBusy(key: string, on: boolean): void {
  if (on) busy.add(key);
  else busy.delete(key);
  if (busy.size === 0) {
    const ws = waiters;
    waiters = [];
    for (const w of ws) w();
  }
}

export function qaIdle(): boolean {
  return busy.size === 0;
}

export function installQa(): void {
  window.__qa = {
    stateHash: () => (current ? hashOf(current) : null),
    waitForIdle: () => (qaIdle() ? Promise.resolve() : new Promise<void>((r) => waiters.push(r))),
    scene: () => document.body.dataset.scene ?? null,
  };
}
