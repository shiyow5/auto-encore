import { describe, expect, it } from "vitest";
import { DragStroke, cellsBetween, strokeButtonHeld } from "../../src/scenes/workshop/drag";
import { loadGameData } from "../../src/data";
import { place, removeAt, rulesFor } from "../../src/scenes/workshop/placements";
import type { Placement } from "../../src/core/sim/types";

const order = loadGameData().orders.find((o) => o.id === "order-01");
if (!order) throw new Error("order-01 が無い");
const rules = rulesFor(order);

const key = (c: { x: number; y: number }): string => `${c.x},${c.y}`;

describe("cellsBetween（直線上のマス）", () => {
  it("同じマスなら1マス", () => {
    expect(cellsBetween({ x: 2, y: 3 }, { x: 2, y: 3 })).toEqual([{ x: 2, y: 3 }]);
  });
  it("横に速く動かしても間のマスを飛ばさない（両端を含む）", () => {
    expect(cellsBetween({ x: 1, y: 3 }, { x: 5, y: 3 }).map(key)).toEqual([
      "1,3",
      "2,3",
      "3,3",
      "4,3",
      "5,3",
    ]);
  });
  it("逆向き・斜めでも端から端まで連続する", () => {
    const path = cellsBetween({ x: 4, y: 0 }, { x: 0, y: 2 });
    expect(path[0]).toEqual({ x: 4, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 0, y: 2 });
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i]!.x - path[i - 1]!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(path[i]!.y - path[i - 1]!.y)).toBeLessThanOrEqual(1);
    }
  });
});

describe("DragStroke（1回のドラッグ）", () => {
  it("動かさない（クリック）なら何も返さない＝クリック1回の挙動は変わらない", () => {
    const s = new DragStroke("place", { x: 1, y: 3 });
    expect(s.move({ x: 1, y: 3 })).toEqual([]);
    expect(s.dragged).toBe(false);
  });

  it("最初に動いたとき、開始マスも一緒に返す", () => {
    const s = new DragStroke("place", { x: 1, y: 3 });
    expect(s.move({ x: 2, y: 3 }).map(key)).toEqual(["1,3", "2,3"]);
    expect(s.dragged).toBe(true);
  });

  it("行って戻っても同じマスを二度返さない", () => {
    const s = new DragStroke("place", { x: 1, y: 3 });
    const got = [
      ...s.move({ x: 4, y: 3 }),
      ...s.move({ x: 2, y: 3 }),
      ...s.move({ x: 6, y: 3 }),
    ].map(key);
    expect(got).toEqual(["1,3", "2,3", "3,3", "4,3", "5,3", "6,3"]);
    expect(new Set(got).size).toBe(got.length);
  });

  it("ベルト10個を左から右へなぞると10個置ける・二重配置なし", () => {
    let list: readonly Placement[] = [];
    const s = new DragStroke("place", { x: 1, y: 3 });
    for (const x of [3, 2, 6, 10]) {
      for (const c of s.move({ x, y: 3 })) {
        const res = place(list, rules, "belt", c, "E");
        if (res.ok) list = res.placements;
      }
    }
    expect(list.map((p) => key(p.pos))).toEqual([
      "1,3",
      "2,3",
      "3,3",
      "4,3",
      "5,3",
      "6,3",
      "7,3",
      "8,3",
      "9,3",
      "10,3",
    ]);
  });

  it("右ドラッグ（erase）で通ったマスを連続削除できる", () => {
    let list: readonly Placement[] = [];
    for (let x = 1; x <= 5; x++) {
      const res = place(list, rules, "belt", { x, y: 3 }, "E");
      if (res.ok) list = res.placements;
    }
    const s = new DragStroke("erase", { x: 2, y: 3 });
    expect(s.mode).toBe("erase");
    for (const c of s.move({ x: 4, y: 3 })) list = removeAt(list, c);
    expect(list.map((p) => key(p.pos))).toEqual(["1,3", "5,3"]);
  });

  it("盤外に出て別の場所から入り直しても、通っていないマスを補間しない", () => {
    // 1列目の上端 (0,0) から外に出て、10列目 (9,0) から戻る → 間の上の行は埋めない
    const s = new DragStroke("place", { x: 0, y: 0 });
    s.leave();
    const fresh = s.move({ x: 9, y: 0 });
    expect(fresh.map(key)).toEqual(["9,0"]);
    // 入り直したマスから先は通常どおり補間する
    expect(s.move({ x: 9, y: 2 }).map(key)).toEqual(["9,1", "9,2"]);
  });

  it("盤外に出ても、戻ったマスが訪問済みなら二重に返さない", () => {
    const s = new DragStroke("place", { x: 1, y: 1 });
    s.move({ x: 2, y: 1 });
    s.leave();
    expect(s.move({ x: 2, y: 1 })).toEqual([]);
  });

  it("始めたボタンが離れていたら strokeButtonHeld は false（盤外で離した取りこぼし）", () => {
    expect(strokeButtonHeld(1, 0)).toBe(true);
    expect(strokeButtonHeld(0, 0)).toBe(false);
    expect(strokeButtonHeld(2, 2)).toBe(true);
    expect(strokeButtonHeld(1, 2)).toBe(false);
    expect(strokeButtonHeld(0, 2)).toBe(false);
  });
});

describe("SeThrottle（ドラッグ中の置く SE の間引き #191）", () => {
  it("最初の move の2マス（同時刻）は1発だけ鳴る", async () => {
    const { SeThrottle } = await import("../../src/scenes/workshop/drag");
    const t = new SeThrottle();
    expect([t.allow(1000), t.allow(1000)]).toEqual([true, false]);
  });
  it("50ms 間隔の move を流しても、発音の間隔はすべて 80ms 以上", async () => {
    const { SeThrottle, DRAG_SE_MIN_INTERVAL_MS } = await import("../../src/scenes/workshop/drag");
    const t = new SeThrottle();
    const played: number[] = [];
    for (let i = 0; i < 10; i++) if (t.allow(1000 + i * 50)) played.push(1000 + i * 50);
    expect(played).toEqual([1000, 1100, 1200, 1300, 1400]);
    for (let i = 1; i < played.length; i++)
      expect(played[i]! - played[i - 1]!).toBeGreaterThanOrEqual(DRAG_SE_MIN_INTERVAL_MS);
  });
  it("ちょうど 80ms 空けば鳴る・79ms は鳴らない", async () => {
    const { SeThrottle } = await import("../../src/scenes/workshop/drag");
    const t = new SeThrottle();
    t.allow(0);
    expect(t.allow(79)).toBe(false);
    expect(t.allow(80)).toBe(true);
  });
});
