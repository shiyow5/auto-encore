import { describe, expect, it } from "vitest";
import { changedCells, popHistory, pushHistory, UNDO_LIMIT } from "../../src/core/undo";

describe("undo history (#139)", () => {
  it("積んだ順の逆で戻せる", () => {
    let s: readonly (readonly number[])[] = [];
    s = pushHistory(s, [1]);
    s = pushHistory(s, [1, 2]);
    const a = popHistory(s);
    expect(a.prev).toEqual([1, 2]);
    const b = popHistory(a.stack);
    expect(b.prev).toEqual([1]);
    expect(b.stack).toEqual([]);
  });

  it("元のスタックを書き換えない", () => {
    const s: readonly (readonly number[])[] = [[1]];
    pushHistory(s, [2]);
    popHistory(s);
    expect(s).toEqual([[1]]);
  });

  it("上限は既定で 50 件。超えたら古い順に捨てる", () => {
    expect(UNDO_LIMIT).toBe(50);
    let s: readonly (readonly number[])[] = [];
    for (let i = 0; i < 60; i++) s = pushHistory(s, [i]);
    expect(s.length).toBe(50);
    expect(s[0]).toEqual([10]);
    expect(s[49]).toEqual([59]);
  });

  it("limit を指定できる", () => {
    let s: readonly (readonly number[])[] = [];
    for (let i = 0; i < 5; i++) s = pushHistory(s, [i], 3);
    expect(s).toEqual([[2], [3], [4]]);
  });

  it("空で pop しても壊れない", () => {
    const r = popHistory<number>([]);
    expect(r.prev).toBeNull();
    expect(r.stack).toEqual([]);
  });
});

describe("changedCells (#139)", () => {
  const belt = (x: number, y: number, dir: "E" | "N" = "E") => ({
    machine: "belt" as const,
    pos: { x, y },
    dir,
  });
  it("増えた・消えた・向きが変わったマスだけ返す", () => {
    const before = [belt(1, 1), belt(2, 1)];
    const after = [belt(1, 1, "N"), belt(3, 1)];
    const got = changedCells(before, after).map((p) => `${p.x},${p.y}`);
    expect(got.sort()).toEqual(["1,1", "2,1", "3,1"]);
  });
  it("同じ配置なら空", () => {
    expect(changedCells([belt(1, 1)], [belt(1, 1)])).toEqual([]);
  });
});
