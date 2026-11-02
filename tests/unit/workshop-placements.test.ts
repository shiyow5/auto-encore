import { describe, expect, it } from "vitest";
import { loadGameData } from "../../src/data";
import {
  place,
  placementAt,
  removeAt,
  rotateAt,
  rulesFor,
  totalCost,
  whyNot,
} from "../../src/scenes/workshop/placements";
import type { Placement } from "../../src/core/sim/types";

const data = loadGameData();
const order = data.orders.find((o) => o.id === "order-01");
if (!order) throw new Error("order-01 が無い");
const rules = rulesFor(order);

function placeOk(
  list: readonly Placement[],
  x: number,
  y: number,
  dir: "N" | "E" | "S" | "W" = "E",
) {
  const r = place(list, rules, "belt", { x, y }, dir);
  if (!r.ok) throw new Error(r.error);
  return r.placements;
}

describe("工房の配置（order-01）", () => {
  it("盤は 12×8、入口 [0,3]E と出口 [11,3]E が予約されている", () => {
    expect([rules.width, rules.height]).toEqual([12, 8]);
    expect(rules.reserved).toEqual([
      { pos: { x: 0, y: 3 }, kind: "input", id: "A", dir: "E" },
      { pos: { x: 11, y: 3 }, kind: "output", id: "OUT", dir: "E" },
    ]);
  });

  it("空きマスに置ける。元の配列は変えない", () => {
    const empty: Placement[] = [];
    const next = placeOk(empty, 1, 3);
    expect(empty).toEqual([]);
    expect(next).toEqual([{ machine: "belt", pos: { x: 1, y: 3 }, dir: "E" }]);
  });

  it("同じマスに置き直すと1台のまま向きが変わる", () => {
    const next = placeOk(placeOk([], 1, 3, "E"), 1, 3, "S");
    expect(next).toHaveLength(1);
    expect(placementAt(next, { x: 1, y: 3 })?.dir).toBe("S");
  });

  it("入口・出口・盤の外・使えない機械には置けない", () => {
    expect(whyNot(rules, "belt", { x: 0, y: 3 })).toBe("入口のマスには置けない");
    expect(whyNot(rules, "belt", { x: 11, y: 3 })).toBe("出口のマスには置けない");
    expect(whyNot(rules, "belt", { x: 12, y: 0 })).toBe("盤の外には置けない");
    expect(whyNot(rules, "belt", { x: 0, y: -1 })).toBe("盤の外には置けない");
    expect(whyNot(rules, "sorter", { x: 2, y: 2 })).toBe("この注文では使えない機械");
    expect(place([], rules, "belt", { x: 0, y: 3 }, "E").ok).toBe(false);
  });

  it("R で時計回り（E→S→W→N→E）。空きマスは何もしない", () => {
    let list = placeOk([], 2, 3, "E");
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      list = rotateAt(list, { x: 2, y: 3 });
      seen.push(placementAt(list, { x: 2, y: 3 })?.dir ?? "");
    }
    expect(seen).toEqual(["S", "W", "N", "E"]);
    expect(rotateAt(list, { x: 5, y: 5 })).toBe(list);
  });

  it("消す。空きマスは何もしない", () => {
    const list = placeOk(placeOk([], 1, 3), 2, 3);
    expect(removeAt(list, { x: 1, y: 3 })).toEqual([
      { machine: "belt", pos: { x: 2, y: 3 }, dir: "E" },
    ]);
    expect(removeAt(list, { x: 7, y: 7 })).toBe(list);
  });

  it("ベルト10本で 1→10 をつなぐと 10G（machines.json の belt=1G）", () => {
    let list: readonly Placement[] = [];
    for (let x = 1; x <= 10; x++) list = placeOk(list, x, 3);
    expect(list).toHaveLength(10);
    expect(totalCost(list, data.machines, order)).toBe(10);
  });
});
