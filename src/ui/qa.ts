/**
 * テスト用フック `window.__qa`（Issue #13）。E2E と手動デバッグ用。ゲームの動きはここから変えない。
 *
 * - 公開するのは `import.meta.env.DEV`（npm run dev）か `?qa=1` のときだけ。本番ビルドの普通のURLには出ない
 * - 画面（シーン）は create で qaAttach()、別の画面へ移る直前・SHUTDOWN で qaDetach() する
 * - stateHash() は core の src/core/sim/hash.ts の stateHash をそのまま使う（Vitest のゴールデン finalHash と比べられる）
 * - waitForIdle() は「画面が決まっていて、再生・演出（フェード）が止まっている」状態が2フレーム続いたら resolve
 */
import { stateHash } from "../core/sim/hash";

/** 画面ごとの窓口。今いる画面が1つだけ登録される。 */
export interface QaScene {
  /** 今の画面名（body[data-scene] と同じ）。 */
  readonly name: string;
  /** 再生中・演出中なら true。 */
  busy(): boolean;
  /** 今画面に出ているシミュ状態（hash.ts の stateHash に渡すもの）。無い画面は undefined を返す。 */
  simState(): unknown;
  /** 模範解などの解 JSON を盤に流し込む（工房だけ）。 */
  loadSolution?(json: unknown): void;
}

export interface QaHooks {
  /** 今画面に出ているシミュ状態の stateHash（hash.ts と同じ関数）。結果画面なら最終状態＝finalHash。 */
  stateHash(): string;
  /** 再生・演出・画面遷移が止まるまで待つ。 */
  waitForIdle(timeoutMs?: number): Promise<void>;
  /** 解 JSON（src/data/solutions/*.json の形）を工房に置く。 */
  loadSolution(json: unknown): void;
  /** 今の画面名（切り替え中は null）。 */
  scene(): string | null;
}

declare global {
  interface Window {
    __qa?: QaHooks;
  }
}

let current: QaScene | null = null;

export function qaAttach(scene: QaScene): void {
  current = scene;
}

/** 画面を離れる。scene.start() の直前に呼ぶ（遷移の途中で waitForIdle が先に解けないように）。引数なしなら無条件に外す。 */
export function qaDetach(scene?: QaScene): void {
  if (!scene || current === scene) current = null;
}

/** `?qa=1` か開発サーバーのときだけ公開する。 */
export function qaEnabled(search: string, dev: boolean): boolean {
  return dev || new URLSearchParams(search).get("qa") === "1";
}

function need(): QaScene {
  if (!current) throw new Error("__qa: 画面の切り替え中（waitForIdle() のあとで呼ぶ）");
  return current;
}

export const DEFAULT_IDLE_TIMEOUT_MS = 15_000;

export function createQaHooks(): QaHooks {
  return {
    stateHash(): string {
      const s = need();
      const state = s.simState();
      if (state === undefined)
        throw new Error(`__qa.stateHash: 画面 "${s.name}" にシミュ状態が無い`);
      return stateHash(state);
    },
    waitForIdle(timeoutMs = DEFAULT_IDLE_TIMEOUT_MS): Promise<void> {
      return new Promise((resolve, reject) => {
        const start = performance.now();
        let idleFrames = 0;
        const tick = (): void => {
          const idle = current !== null && !current.busy();
          idleFrames = idle ? idleFrames + 1 : 0;
          if (idleFrames >= 2) {
            resolve();
            return;
          }
          if (performance.now() - start > timeoutMs) {
            reject(new Error(`__qa.waitForIdle: ${timeoutMs}ms 待っても止まらない`));
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
    loadSolution(json: unknown): void {
      const s = need();
      if (!s.loadSolution) throw new Error(`__qa.loadSolution: 画面 "${s.name}" では使えない`);
      s.loadSolution(json);
    },
    scene(): string | null {
      return current?.name ?? null;
    },
  };
}

export function installQa(): void {
  if (!qaEnabled(location.search, import.meta.env.DEV)) return;
  window.__qa = createQaHooks();
}
