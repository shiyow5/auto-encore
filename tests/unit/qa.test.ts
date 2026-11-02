import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stateHash } from "../../src/core/sim/hash";
import { createQaHooks, qaAttach, qaDetach, qaEnabled, type QaScene } from "../../src/ui/qa";

/** node 環境には requestAnimationFrame が無いので、手で1フレームずつ進める。 */
let frames: (() => void)[] = [];
function flush(n: number): void {
  for (let i = 0; i < n; i++) {
    const now = frames;
    frames = [];
    for (const f of now) f();
  }
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (f: () => void) => {
    frames.push(f);
    return frames.length;
  });
});

afterEach(() => {
  qaDetach();
  vi.unstubAllGlobals();
});

function fakeScene(over: Partial<QaScene> = {}): QaScene & { isBusy: boolean } {
  const s: QaScene & { isBusy: boolean } = {
    name: "workshop",
    isBusy: false,
    busy: (): boolean => s.isBusy,
    simState: (): unknown => ({ tick: 3, cells: [] }),
    ...over,
  };
  return s;
}

describe("__qa の公開条件", () => {
  it("DEV か ?qa=1 のときだけ", () => {
    expect(qaEnabled("", true)).toBe(true);
    expect(qaEnabled("?qa=1", false)).toBe(true);
    expect(qaEnabled("?fx=0&qa=1", false)).toBe(true);
    expect(qaEnabled("", false)).toBe(false);
    expect(qaEnabled("?qa=0", false)).toBe(false);
    expect(qaEnabled("?qa=true", false)).toBe(false);
  });
});

describe("__qa.stateHash()", () => {
  it("core の hash.ts の stateHash と同じ値（キーの並びに依らない）", () => {
    const qa = createQaHooks();
    qaAttach(fakeScene({ simState: () => ({ tick: 3, cells: [] }) }));
    expect(qa.stateHash()).toBe(stateHash({ cells: [], tick: 3 }));
    expect(qa.stateHash()).toMatch(/^[0-9a-f]{16}$/);
  });

  it("画面が無い・シミュ状態が無いときは理由つきで投げる", () => {
    const qa = createQaHooks();
    expect(() => qa.stateHash()).toThrow(/切り替え中/);
    qaAttach(fakeScene({ name: "boot", simState: () => undefined }));
    expect(() => qa.stateHash()).toThrow(/"boot" にシミュ状態が無い/);
  });
});

describe("__qa.waitForIdle()", () => {
  it("busy の間は待ち、止まって2フレーム続いたら resolve", async () => {
    const qa = createQaHooks();
    const s = fakeScene();
    s.isBusy = true;
    qaAttach(s);
    let done = false;
    const p = qa.waitForIdle().then(() => (done = true));
    flush(5);
    await Promise.resolve();
    expect(done).toBe(false);
    s.isBusy = false;
    flush(1);
    await Promise.resolve();
    expect(done).toBe(false);
    flush(1);
    await p;
    expect(done).toBe(true);
  });

  it("画面の切り替え中（未登録）は待つ", async () => {
    const qa = createQaHooks();
    let done = false;
    const p = qa.waitForIdle().then(() => (done = true));
    flush(5);
    await Promise.resolve();
    expect(done).toBe(false);
    qaAttach(fakeScene({ name: "result" }));
    flush(2);
    await p;
    expect(qa.scene()).toBe("result");
  });

  it("止まらなければ timeout で reject", async () => {
    const qa = createQaHooks();
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(0);
    const p = qa.waitForIdle(100);
    now.mockReturnValue(101);
    flush(1);
    await expect(p).rejects.toThrow(/100ms 待っても止まらない/);
    now.mockRestore();
  });
});

describe("__qa.loadSolution()", () => {
  it("工房に渡す。使えない画面では投げる", () => {
    const qa = createQaHooks();
    const got: unknown[] = [];
    qaAttach(fakeScene({ loadSolution: (j) => got.push(j) }));
    qa.loadSolution({ a: 1 });
    expect(got).toEqual([{ a: 1 }]);
    qaAttach(fakeScene({ name: "result" }));
    expect(() => qa.loadSolution({})).toThrow(/"result" では使えない/);
  });

  it("qaDetach(scene) は自分が今の画面のときだけ外す", () => {
    const qa = createQaHooks();
    const a = fakeScene({ name: "workshop" });
    const b = fakeScene({ name: "result" });
    qaAttach(b);
    qaDetach(a);
    expect(qa.scene()).toBe("result");
    qaDetach(b);
    expect(qa.scene()).toBeNull();
  });
});
