import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 音量パネルの閉じ方（#135）。node 環境なので最小の DOM もどきで確かめる。
class FakeNode {
  children: FakeNode[] = [];
  parent: FakeNode | null = null;
  hidden = false;
  id = "";
  className = "";
  title = "";
  textContent = "";
  value = "";
  min = "";
  max = "";
  step = "";
  type = "";
  attrs = new Map<string, string>();
  listeners = new Map<string, ((e: unknown) => void)[]>();
  constructor(public tag: string) {}
  append(...n: FakeNode[]) {
    for (const c of n) {
      c.parent = this;
      this.children.push(c);
    }
  }
  replaceChildren(...n: FakeNode[]) {
    this.children = [];
    this.append(...n);
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  addEventListener(t: string, f: (e: unknown) => void) {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), f]);
  }
  contains(n: FakeNode | null): boolean {
    for (let c = n; c; c = c.parent) if (c === this) return true;
    return false;
  }
  focus() {
    doc.active = this;
  }
  fire(t: string, e: object = {}) {
    for (const f of this.listeners.get(t) ?? []) f({ target: this, ...e });
  }
}
const doc = {
  body: new FakeNode("body"),
  active: null as FakeNode | null,
  game: new FakeNode("div"),
  byId(id: string): FakeNode | null {
    const walk = (n: FakeNode): FakeNode | null =>
      n.id === id ? n : (n.children.map(walk).find(Boolean) ?? null);
    return walk(this.game);
  },
  listeners: new Map<string, ((e: unknown) => void)[]>(),
  addEventListener(t: string, f: (e: unknown) => void) {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), f]);
  },
  dispatch(t: string, target: FakeNode, e: object = {}) {
    for (const f of this.listeners.get(t) ?? []) f({ target, ...e });
  },
};

vi.mock("../../src/fx/audio", () => ({ isAudioEnabled: () => true }));
vi.mock("../../src/art/sprites", () => ({ iconCanvas: () => new FakeNode("canvas") }));
vi.mock("../../src/audio/player", () => ({
  audioAvailable: () => true,
  onSoundToggle: () => {},
  playSfx: () => {},
  setVolume: () => {},
  toggleSound: () => true,
}));
vi.mock("../../src/audio/volume", () => ({
  VOLUME_STEP: 10,
  getVolumePercent: () => 100,
  isSilentByVolume: () => false,
  onVolumeChange: () => {},
}));

async function setup() {
  vi.resetModules();
  doc.game = new FakeNode("div");
  doc.game.id = "game";
  doc.listeners.clear();
  doc.active = doc.body;
  vi.stubGlobal("Node", FakeNode);
  vi.stubGlobal("document", {
    createElement: (t: string) => new FakeNode(t),
    getElementById: (id: string) => (id === "game" ? doc.game : doc.byId(id)),
    addEventListener: doc.addEventListener.bind(doc),
  });
  const { installAudioToggle } = await import("../../src/ui/audio-toggle");
  installAudioToggle();
  const btn = doc.byId("volume-toggle")!;
  const panel = doc.byId("volume-panel")!;
  return { btn, panel, slider: doc.byId("volume-bgm")! };
}

describe("音量パネルの閉じ方", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("開いた状態で document に Escape → 閉じ、フォーカスが音量ボタンに戻る", async () => {
    const { btn, panel } = await setup();
    btn.fire("click");
    expect(panel.hidden).toBe(false);
    doc.dispatch("keydown", doc.body, { key: "Escape" });
    expect(panel.hidden).toBe(true);
    expect(btn.attrs.get("aria-expanded")).toBe("false");
    expect(doc.active).toBe(btn);
  });

  it("閉じているときの Escape は何もしない（フォーカスも動かさない）", async () => {
    const { btn, panel } = await setup();
    doc.dispatch("keydown", doc.body, { key: "Escape" });
    expect(panel.hidden).toBe(true);
    expect(doc.active).not.toBe(btn);
  });

  it("パネル外の要素で pointerdown → 閉じる", async () => {
    const { btn, panel } = await setup();
    btn.fire("click");
    doc.dispatch("pointerdown", doc.body);
    expect(panel.hidden).toBe(true);
    expect(btn.attrs.get("aria-expanded")).toBe("false");
  });

  it("パネル内（スライダー）の pointerdown → 開いたまま", async () => {
    const { btn, panel, slider } = await setup();
    btn.fire("click");
    doc.dispatch("pointerdown", slider);
    expect(panel.hidden).toBe(false);
  });

  it("音量ボタンで開→再クリックで閉（pointerdown→click の流れでもトグルが保たれる）", async () => {
    const { btn, panel } = await setup();
    doc.dispatch("pointerdown", btn);
    btn.fire("click");
    expect(panel.hidden).toBe(false);
    doc.dispatch("pointerdown", btn);
    btn.fire("click");
    expect(panel.hidden).toBe(true);
    expect(btn.attrs.get("aria-expanded")).toBe("false");
  });
});
