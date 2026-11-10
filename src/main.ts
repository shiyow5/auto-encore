import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { OrderSelectScene } from "./scenes/OrderSelectScene";
import { ResultScene } from "./scenes/ResultScene";
import { WorkshopScene } from "./scenes/WorkshopScene";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";
import { installQa } from "./ui/qa";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  backgroundColor: "#1e1722",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, OrderSelectScene, WorkshopScene, ResultScene],
});

// E2E テストとデバッグ用。ゲームロジックはここから触らない。
declare global {
  interface Window {
    __game?: Phaser.Game;
  }
}
window.__game = game;
installQa();
