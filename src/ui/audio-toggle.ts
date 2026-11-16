/**
 * 画面右上の音まわりのボタン。#game の直下に置く（画面が変わっても残す）。
 * - 「♪」… 音を切る / 出す
 * - 「音量」… BGM と SE の音量スライダー（0〜100%、10%刻み。localStorage に保存）を開く
 * 工房には棚に ♪ と同じ役目のボタンがあるので、工房では ♪ だけ CSS で隠す（workshop.css）。
 * ?fx=0 では音を鳴らさないので出さない。
 */
import { isAudioEnabled } from "../fx/audio";
import { iconCanvas } from "../art/sprites";
import { audioAvailable, onSoundToggle, playSfx, setVolume, toggleSound } from "../audio/player";
import { VOLUME_STEP, getVolumePercent, isSilentByVolume, onVolumeChange } from "../audio/volume";
import type { VolumeKind } from "../audio/volume";

function label(enabled: boolean): string {
  return enabled ? "音を切る" : "音を出す";
}

const SLIDERS: { kind: VolumeKind; text: string }[] = [
  { kind: "bgm", text: "BGM" },
  { kind: "sfx", text: "効果音" },
];

function buildPanel(): HTMLElement {
  const panel = document.createElement("div");
  panel.id = "volume-panel";
  panel.className = "volume-panel";
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "音量");
  panel.hidden = true;
  for (const { kind, text } of SLIDERS) {
    const row = document.createElement("label");
    row.className = "volume-row";
    const name = document.createElement("span");
    name.textContent = text;
    const input = document.createElement("input");
    input.type = "range";
    input.id = `volume-${kind}`;
    input.min = "0";
    input.max = "100";
    input.step = String(VOLUME_STEP);
    const out = document.createElement("output");
    const show = () => {
      const v = getVolumePercent(kind);
      input.value = String(v);
      input.setAttribute("aria-valuetext", `${v}%`);
      out.textContent = `${v}%`;
    };
    show();
    onVolumeChange(show);
    input.addEventListener("input", () => setVolume(kind, Number(input.value)));
    // 離したときに SE の音量を確かめられるよう 1 回鳴らす
    input.addEventListener("change", () => {
      if (kind === "sfx") playSfx("click");
    });
    row.append(name, input, out);
    panel.append(row);
  }
  return panel;
}

export function installAudioToggle(): void {
  if (!audioAvailable() || document.getElementById("audio-toggle")) return;
  const game = document.getElementById("game");

  const b = document.createElement("button");
  b.type = "button";
  b.id = "audio-toggle";
  b.className = "audio-toggle";
  const render = () => {
    // ミュート中、または BGM も SE も 0% のときは「音が出ない」表示
    const on = isAudioEnabled() && !isSilentByVolume();
    b.replaceChildren(iconCanvas(on ? "note-on" : "note-off"));
    b.setAttribute("aria-label", label(on));
    b.setAttribute("aria-pressed", on ? "false" : "true");
    b.title = label(on);
  };
  render();
  onSoundToggle(render);
  onVolumeChange(render);
  b.addEventListener("click", () => {
    if (toggleSound()) playSfx("click");
  });

  const v = document.createElement("button");
  v.type = "button";
  v.id = "volume-toggle";
  v.className = "audio-toggle volume-toggle";
  v.replaceChildren(iconCanvas("speaker-on"));
  v.setAttribute("aria-label", "音量");
  v.setAttribute("aria-expanded", "false");
  v.setAttribute("aria-controls", "volume-panel");
  const panel = buildPanel();
  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    v.setAttribute("aria-expanded", String(open));
  };
  v.addEventListener("click", () => setOpen(panel.hidden));
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      v.focus();
    }
  });

  game?.append(b, v, panel);
}
