/**
 * SE / BGM を鳴らす（ZzFX・ZzFXM）。
 *
 * - zzfx は読み込んだ時点で AudioContext を作るので、最初のユーザー操作のあとに動的 import する
 *   （自動再生の制限に引っかからない・Node のテストからは読まれない）。
 * - `?fx=0` では音も鳴らさない（演出を切るフラグ。e2e 用）。
 * - 音のオン/オフは src/fx/audio.ts と同じ設定（localStorage `ae-audio-enabled`）。切り替えは
 *   toggleSound() に集め、BGM の停止・再開と画面のボタン表示の更新もここで行う。
 * - どこで失敗しても例外にしない（音が出ないだけ）。
 */
import { isAudioEnabled, toggleAudio } from "../fx/audio";
import { flags } from "../ui/flags";
import { BGM_BPM, BGM_INSTRUMENTS, BGM_PATTERNS, BGM_SEQUENCE, SFX, type SfxName } from "./sounds";
import { renderSong } from "./zzfxm";

type Engine = typeof import("zzfx");

/** BGM は SE より小さく。 */
const BGM_VOLUME = 0.5;
/** 実行中（音符が鳴る間）は BGM をさらに絞る。 */
const BGM_DUCKED = 0.15;

let engine: Engine | null = null;
let loading: Promise<Engine | null> | null = null;
let bgm: AudioBufferSourceNode | null = null;
let bgmSamples: [number[], number[]] | null = null;
let bgmWanted = false;
let ducked = false;
const listeners = new Set<(enabled: boolean) => void>();

/** 音を出してよい環境か（?fx=0 ではない）。 */
export function audioAvailable(): boolean {
  return flags().fx;
}

function canPlay(): boolean {
  return audioAvailable() && isAudioEnabled();
}

function load(): Promise<Engine | null> {
  loading ??= import("zzfx")
    .then((m) => {
      engine = m;
      if (m.ZZFX.audioContext.state === "suspended") void m.ZZFX.audioContext.resume();
      return m;
    })
    .catch(() => null);
  return loading;
}

/** 効果音を鳴らす。 */
export function playSfx(name: SfxName): void {
  if (!canPlay()) return;
  const params = SFX[name];
  const play = (e: Engine | null) => {
    // 読み込み待ちの間に音を切られたら鳴らさない
    if (!canPlay()) return;
    try {
      e?.zzfx(...params);
    } catch {
      // 音が出ないだけ
    }
  };
  if (engine) play(engine);
  else void load().then(play);
}

function bgmGain(): number {
  return ducked ? BGM_DUCKED : BGM_VOLUME;
}

function startBgmNow(e: Engine): void {
  if (bgm || !bgmWanted || !canPlay()) return;
  try {
    bgmSamples ??= renderSong(
      BGM_INSTRUMENTS,
      BGM_PATTERNS,
      BGM_SEQUENCE,
      BGM_BPM,
      e.ZZFX.sampleRate,
      e.ZZFX.buildSamples.bind(e.ZZFX),
    );
    bgm = e.ZZFX.playSamples(bgmSamples, bgmGain(), 1, 0, true);
  } catch {
    bgm = null;
  }
}

/** BGM をループ再生する（再生中なら何もしない）。 */
export function startBgm(): void {
  bgmWanted = true;
  if (!canPlay()) return;
  void load().then((e) => {
    // 曲の生成は少し重いので、押した操作の反応を先に返す
    if (e) setTimeout(() => startBgmNow(e), 0);
  });
}

function stopBgmNow(): void {
  try {
    bgm?.stop();
  } catch {
    // すでに止まっている
  }
  bgm = null;
}

/** 実行中は BGM を絞る（音符を聞き取れるように）。 */
export function duckBgm(on: boolean): void {
  ducked = on;
  const gain = (bgm as (AudioBufferSourceNode & { gainNode?: GainNode }) | null)?.gainNode;
  if (gain && engine) gain.gain.value = engine.ZZFX.volume * bgmGain();
}

/** 音のオン/オフを切り替える。戻り値は切り替え後に音が出るか。 */
export function toggleSound(): boolean {
  const enabled = toggleAudio();
  if (!enabled) stopBgmNow();
  else if (bgmWanted) startBgm();
  for (const l of listeners) l(enabled);
  return enabled;
}

/** 音のオン/オフが変わったときに呼ばれる。戻り値で解除。 */
export function onSoundToggle(l: (enabled: boolean) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * 最初のクリック・キー入力で BGM を始める（ブラウザはユーザー操作前の再生を許さない）。
 * main.ts から1回だけ呼ぶ。
 */
export function startBgmOnFirstInput(): void {
  if (!audioAvailable()) return;
  const once = () => {
    document.removeEventListener("pointerdown", once, true);
    document.removeEventListener("keydown", once, true);
    startBgm();
  };
  document.addEventListener("pointerdown", once, true);
  document.addEventListener("keydown", once, true);
}

/**
 * ボタンのクリック音を1か所でつける（画面ごとにボタンの作り方が違うため、document で受ける）。
 * 工房のマスは「置いた・消した」などの SE を鳴らすので除く。
 */
export function installClickSfx(): void {
  if (!audioAvailable()) return;
  document.addEventListener(
    "click",
    (e) => {
      const b = (e.target as Element | null)?.closest?.("button");
      if (!b || b.disabled || b.closest(".ws-grid") || b.id === "audio-toggle") return;
      playSfx("click");
    },
    true,
  );
}
