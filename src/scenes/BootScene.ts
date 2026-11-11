import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { createSceneFx } from "../fx/scene-fx";
import { Rng } from "../core/rng";
import { flags, fxEnabled } from "../ui/flags";
import { setQaBusy } from "../ui/qa";

export const TITLE = "Auto Encore ― 夜更けのオルゴール工房";

/** フォント読み込みを待つ（失敗時は monospace にフォールバックして先に進む）。 */
async function waitForFont(): Promise<void> {
  if (!document.fonts) return; // polyfill なし環境はスキップ
  try {
    await Promise.race([
      document.fonts.load('12px "DotGothic16"'),
      // 5秒でタイムアウトしたら待たずに進む（e2e をブロックしない）
      new Promise<void>((_res) => setTimeout(_res, 5000)),
    ]);
  } catch {
    // 読み込めなくても先に進む（Phaser は fallback で monospace を使う）
  }
}

/** 起動ロゴ。演出ありならグリッチを 0.6 秒見せてから工房へ、?fx=0 ならすぐ工房へ。 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  async create(): Promise<void> {
    document.body.dataset.scene = "boot";
    setQaBusy("transition", true); // 工房の create で外す
    this.game.events.emit("ready");

    // フォント読み込みを待つ（5秒でタイムアウトしたらフォールバック）
    await waitForFont();

    if (!fxEnabled()) {
      this.scene.start("title");
      return;
    }
    const rng = new Rng(flags().seed ?? "boot");
    createSceneFx(this, "fx-boot").emit("boot", rng.int(1, 9999));
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, TITLE, {
        fontFamily: '"DotGothic16", monospace',
        fontSize: "12px",
        color: "#e6e6e6",
      })
      .setOrigin(0.5);
    this.time.delayedCall(600, () => this.scene.start("title"));
  }
}
