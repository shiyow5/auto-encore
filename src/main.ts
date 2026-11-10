import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { OrderSelectScene } from "./scenes/OrderSelectScene";
import { ResultScene } from "./scenes/ResultScene";
import { WorkshopScene } from "./scenes/WorkshopScene";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";
import { installQa } from "./ui/qa";
import { installClickSfx, startBgmOnFirstInput } from "./audio/player";
import { installAudioToggle } from "./ui/audio-toggle";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  backgroundColor: "#0b0d12",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, OrderSelectScene, WorkshopScene, ResultScene],
});

// E2E テスト用フック。DEV またはテスト用ビルド(--mode e2e)のときだけ公開する。
// 本番ビルドでは条件が false に畳まれ、__qa / __game ごとバンドルから消える(#36)。
if (import.meta.env.DEV || import.meta.env.MODE === "e2e") {
  window.__game = game;
  installQa();
}

declare global {
  interface Window {
    __game?: Phaser.Game;
  }
}

// 音（ZzFX / ZzFXM）。ボタンのクリック音・最初の操作から流す BGM・音のオン/オフ。
installClickSfx();
startBgmOnFirstInput();
installAudioToggle();
