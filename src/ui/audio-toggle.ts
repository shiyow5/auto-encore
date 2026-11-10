/**
 * 画面右上の「音を切る / 音を出す」ボタン。#game の直下に置く（画面が変わっても残す）。
 * 工房には棚に同じ役目のボタンがあるので、工房では CSS で隠す（workshop.css）。
 * ?fx=0 では音を鳴らさないので出さない。
 */
import { isAudioEnabled } from "../fx/audio";
import { audioAvailable, onSoundToggle, playSfx, toggleSound } from "../audio/player";

function label(enabled: boolean): string {
  return enabled ? "音を切る" : "音を出す";
}

export function installAudioToggle(): void {
  if (!audioAvailable() || document.getElementById("audio-toggle")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.id = "audio-toggle";
  b.className = "audio-toggle";
  const render = (enabled: boolean) => {
    b.textContent = enabled ? "♪" : "♪✕";
    b.setAttribute("aria-label", label(enabled));
    b.setAttribute("aria-pressed", enabled ? "false" : "true");
    b.title = label(enabled);
  };
  render(isAudioEnabled());
  onSoundToggle(render);
  b.addEventListener("click", () => {
    if (toggleSound()) playSfx("click");
  });
  document.getElementById("game")?.append(b);
}
