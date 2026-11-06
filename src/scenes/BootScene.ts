import Phaser from "phaser";
import * as glitch from "pixelfx/fx/scifi/glitch";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { PixelFxLayer } from "../fx/PixelFxLayer";
import { Rng } from "../core/rng";
import { flags, fxEnabled } from "../ui/flags";
import { setQaBusy } from "../ui/qa";

export const TITLE = "Auto Encore ― 夜更けのオルゴール工房";

/** 起動ロゴ。演出ありならグリッチ→タイトルへ、?fx=0 なら工房へ直接。 */
export class BootScene extends Phaser.Scene {
  private fx?: PixelFxLayer;

  constructor() {
    super("boot");
  }

  create(): void {
    document.body.dataset.scene = "boot";
    setQaBusy("transition", true); // タイトル/工房の create で外す
    this.game.events.emit("ready");
    if (!fxEnabled()) {
      // ?fx=0: E2Eテスト用。工房へ直接。
      this.scene.start("workshop");
      return;
    }
    const rng = new Rng(flags().seed ?? "boot");
    this.fx = new PixelFxLayer(this, "fx-boot", GAME_WIDTH, GAME_HEIGHT);
    this.fx.play(glitch, { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, seed: rng.int(1, 9999) });
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, TITLE, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#e6e6e6",
      })
      .setOrigin(0.5);
    this.time.delayedCall(600, () => this.scene.start("title"));
  }

  override update(_time: number, delta: number): void {
    this.fx?.update(delta / 1000);
  }
}
