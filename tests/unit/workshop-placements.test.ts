import { describe, expect, it } from "vitest";
import { loadGameData } from "../../src/data";
import {
  cyclePitchAt,
  nextPitch,
  pitchChoices,
  place,
  placementAt,
  removeAt,
  rotateAt,
  rulesFor,
  totalCost,
  whyNot,
} from "../../src/scenes/workshop/placements";
import type { Placement } from "../../src/core/sim/types";
import { validatePlacements } from "../../src/core/sim/load";

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

describe("工房の配置: 棚の機械3種と仕分け機の音高（K5）", () => {
  const all = rulesFor(order, ["belt", "merger", "sorter", "tuner"]);
  const choices = pitchChoices(data.machines, "sorter");

  function put(
    list: readonly Placement[],
    machine: Placement["machine"],
    x: number,
    y: number,
    dir: "N" | "E" | "S" | "W" = "E",
    pitch?: 0 | 1 | 2,
  ) {
    const r = place(list, all, machine, { x, y }, dir, data.machines, pitch);
    if (!r.ok) throw new Error(r.error);
    return r.placements;
  }

  it("音高の候補は machines.json の sorter.config.pitch（ド・ミ・ソ）。他の機械は無し", () => {
    expect(choices).toEqual(data.machines.sorter.config?.pitch);
    expect(choices).toEqual([0, 1, 2]);
    expect(pitchChoices(data.machines, "belt")).toEqual([]);
    expect(pitchChoices(data.machines, "merger")).toEqual([]);
    expect(pitchChoices(data.machines, "tuner")).toEqual([]);
  });

  it("rulesFor に allowed を渡すと置ける機械が差し替わる（省くと注文どおり）", () => {
    expect(rulesFor(order).allowed).toEqual(["belt"]);
    expect(whyNot(all, "sorter", { x: 2, y: 2 })).toBeNull();
    expect(whyNot(all, "merger", { x: 2, y: 2 })).toBeNull();
    expect(whyNot(all, "tuner", { x: 2, y: 2 })).toBeNull();
    expect(whyNot(all, "tuner", { x: 0, y: 3 })).toBe("入口のマスには置けない");
  });

  it("仕分け機は config.pitch 付きで置かれる。省くと候補の先頭、指定すればその音高", () => {
    expect(put([], "sorter", 2, 3)).toEqual([
      { machine: "sorter", pos: { x: 2, y: 3 }, dir: "E", config: { pitch: choices[0] } },
    ]);
    expect(placementAt(put([], "sorter", 2, 3, "E", 2), { x: 2, y: 3 })?.config).toEqual({
      pitch: 2,
    });
  });

  it("合流機・調律機・ベルトには config を付けない（belt-with-config は Schema 誤例）", () => {
    let list = put([], "merger", 2, 3);
    list = put(list, "tuner", 3, 3);
    list = put(list, "belt", 4, 3);
    for (const p of list) expect(p).not.toHaveProperty("config");
  });

  it("候補に無い音高では置けない", () => {
    const fake = {
      ...data.machines,
      sorter: { ...data.machines.sorter, config: { pitch: [0, 2] as const } },
    };
    const r = place([], all, "sorter", { x: 2, y: 3 }, "E", fake, 1);
    expect(r).toEqual({ ok: false, error: "その音高はこの機械に設定できない" });
  });

  it("音高切替は候補を順に巡回（ド→ミ→ソ→ド）。元の配列は変えない", () => {
    const first = put([], "sorter", 2, 3);
    let list = first;
    const seen: number[] = [];
    for (let i = 0; i < choices.length; i++) {
      list = cyclePitchAt(list, data.machines, { x: 2, y: 3 });
      seen.push(placementAt(list, { x: 2, y: 3 })?.config?.pitch ?? -1);
    }
    expect(seen).toEqual([1, 2, 0]);
    expect(placementAt(first, { x: 2, y: 3 })?.config).toEqual({ pitch: 0 });
  });

  it("音高切替は machines.json の候補に従う（候補が2つなら2つで巡回）", () => {
    const fake = {
      ...data.machines,
      sorter: { ...data.machines.sorter, config: { pitch: [2, 0] as const } },
    };
    expect(nextPitch([2, 0], 2)).toBe(0);
    expect(nextPitch([2, 0], 0)).toBe(2);
    expect(nextPitch([2, 0], 1)).toBe(2);
    const r = place([], all, "sorter", { x: 2, y: 3 }, "E", fake);
    if (!r.ok) throw new Error(r.error);
    expect(r.placements[0]?.config).toEqual({ pitch: 2 });
    const once = cyclePitchAt(r.placements, fake, { x: 2, y: 3 });
    expect(once[0]?.config).toEqual({ pitch: 0 });
  });

  it("音高の無い機械・空きマスの音高切替は何もしない（同じ配列）", () => {
    const list = put(put([], "belt", 1, 3), "tuner", 2, 3);
    expect(cyclePitchAt(list, data.machines, { x: 1, y: 3 })).toBe(list);
    expect(cyclePitchAt(list, data.machines, { x: 2, y: 3 })).toBe(list);
    expect(cyclePitchAt(list, data.machines, { x: 7, y: 7 })).toBe(list);
  });

  it("回転・削除しても仕分け機の config.pitch は保たれる", () => {
    let list = put(put([], "belt", 1, 3), "sorter", 2, 3, "E", 1);
    list = rotateAt(list, { x: 2, y: 3 });
    expect(placementAt(list, { x: 2, y: 3 })).toEqual({
      machine: "sorter",
      pos: { x: 2, y: 3 },
      dir: "S",
      config: { pitch: 1 },
    });
    list = removeAt(list, { x: 1, y: 3 });
    expect(list).toEqual([
      { machine: "sorter", pos: { x: 2, y: 3 }, dir: "S", config: { pitch: 1 } },
    ]);
  });

  it("コストは machines.json（合流機4G・仕分け機6G・調律機8G）", () => {
    let list = put([], "merger", 1, 1);
    list = put(list, "sorter", 2, 1);
    list = put(list, "tuner", 3, 1);
    expect(totalCost(list, data.machines, order)).toBe(
      data.machines.merger.cost + data.machines.sorter.cost + data.machines.tuner.cost,
    );
    expect(totalCost(list, data.machines, order)).toBe(18);
  });
});

describe("工房の配置で order-02 の模範解（仕分け機入り）を組むと同じ形になる", () => {
  const order2 = data.orders.find((o) => o.id === "order-02");
  if (!order2) throw new Error("order-02 が無い");
  const ref = data.solutions["solutions/order-02-frugal.json"];
  if (!ref) throw new Error("order-02 の模範解が無い");

  it("place() を順に呼ぶと模範解の placements と一致し、validatePlacements を通る", () => {
    const rules2 = rulesFor(order2);
    let list: readonly Placement[] = [];
    for (const p of ref.placements) {
      const r = place(list, rules2, p.machine, p.pos, p.dir, data.machines, p.config?.pitch);
      if (!r.ok) throw new Error(r.error);
      list = r.placements;
    }
    expect(list).toEqual(ref.placements);
    expect(() => validatePlacements(list, order2)).not.toThrow();
  });
});

describe("工房の配置: 回収箱（bin, #41）", () => {
  const order03 = data.orders.find((o) => o.id === "order-03");
  if (!order03) throw new Error("order-03 が無い");
  const r3 = rulesFor(order03);

  it("棚に回収箱が出る（machines.json にあり、注文3では使える）", () => {
    expect(Object.keys(data.machines)).toContain("bin");
    expect(order03.allowedMachines).toContain("bin");
    expect(order03.outputs.map((o) => o.id)).not.toContain("bin");
    expect(r3.allowed).toContain("bin");
    expect(rulesFor(order).allowed).not.toContain("bin");
  });

  it("コスト0・音高設定なし・何台でも置ける", () => {
    expect(pitchChoices(data.machines, "bin")).toEqual([]);
    let list: readonly Placement[] = [];
    const free: { x: number; y: number }[] = [];
    for (let y = 0; y < r3.height && free.length < 12; y++)
      for (let x = 0; x < r3.width && free.length < 12; x++)
        if (whyNot(r3, "bin", { x, y }) === null) free.push({ x, y });
    for (const pos of free) {
      const r = place(list, r3, "bin", pos, "E", data.machines);
      if (!r.ok) throw new Error(r.error);
      list = r.placements;
    }
    expect(list).toHaveLength(12);
    expect(list.every((p) => p.config === undefined)).toBe(true);
    expect(totalCost(list, data.machines, order03)).toBe(0);
    expect(() => validatePlacements(list, order03)).not.toThrow();
  });
});
