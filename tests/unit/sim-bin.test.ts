import { describe, expect, it } from "vitest";
import { noteToString } from "../../src/core/sim/load";
import { buildWorld, run } from "../../src/core/sim/sim";
import type { Placement } from "../../src/core/sim/types";
import type { Dir } from "../../src/core/grid";
import { machines, miniOrder } from "./mini-order";

/**
 * 回収箱（bin, Issue #41・spec-e v0.2 Q6）: コスト0・個数無制限。後ろから受けた音符をその tick で消す。
 */
const at = (machine: Placement["machine"], x: number, y: number, dir: Dir): Placement => ({
  machine,
  pos: { x, y },
  dir,
  ...(machine === "sorter" ? { config: { pitch: 0 as const } } : {}),
});

describe("回収箱（bin）", () => {
  it("仕分け機の外れ（ミ）を回収箱で捨て、ドだけ出口へ → completed・正確さ 100%", () => {
    // 盤 5×2: 入口A(0,0)東 → ベルト(1,0) → 仕分け機ド(2,0)東 → ベルト(3,0) → 出口(4,0)東
    //          仕分け機の右（南）= (2,1) に回収箱（南向き＝後ろが北で (2,0) から受ける）
    const order = miniOrder({
      width: 5,
      height: 2,
      inputs: [
        { id: "A", pos: [0, 0], dir: "E", notes: ["do:short", "mi:short", "do:short", "mi:short"] },
      ],
      outputs: [{ id: "OUT", pos: [4, 0], dir: "E", expect: ["do:short", "do:short"] }],
      allowed: ["belt", "sorter", "bin"],
    });
    const placements = [
      at("belt", 1, 0, "E"),
      at("sorter", 2, 0, "E"),
      at("belt", 3, 0, "E"),
      at("bin", 2, 1, "S"),
    ];
    const out = run(buildWorld(order, placements, machines), { recordFrames: true });
    expect(out.result).toMatchObject({
      result: "completed",
      matched: 2,
      total: 2,
      firstMismatch: null,
    });
    expect(out.final.outputs[0]!.received.map(noteToString)).toEqual(["do:short", "do:short"]);
    // 回収箱のマス（key = 1*5+2）には一度も音符が載らない
    expect(out.frames.every((s) => s.cells.every((c) => c.key !== 7))).toBe(true);
  });

  it("コストは 0（何台置いても合計に足されない）", () => {
    const order = miniOrder({
      width: 5,
      height: 2,
      inputs: [{ id: "A", pos: [0, 0], dir: "E", notes: ["do:short"] }],
      outputs: [{ id: "OUT", pos: [4, 0], dir: "E", expect: ["do:short"] }],
      allowed: ["belt", "bin"],
    });
    const placements = [
      at("belt", 1, 0, "E"),
      at("belt", 2, 0, "E"),
      at("belt", 3, 0, "E"),
      at("bin", 1, 1, "E"),
      at("bin", 2, 1, "E"),
      at("bin", 3, 1, "E"),
    ];
    expect(run(buildWorld(order, placements, machines)).result).toMatchObject({
      result: "completed",
      cost: 3,
    });
  });

  it("詰まらない: 入口の直後に置くと全部消え、出口に届かないので stuck（正確さ 0）", () => {
    const notes = Array<string>(20).fill("do:short");
    const order = miniOrder({
      width: 4,
      height: 1,
      inputs: [{ id: "A", pos: [0, 0], dir: "E", notes }],
      outputs: [{ id: "OUT", pos: [3, 0], dir: "E", expect: ["do:short"] }],
      allowed: ["belt", "bin"],
    });
    const out = run(buildWorld(order, [at("bin", 1, 0, "E")], machines), { recordFrames: true });
    // 入口は interval 1 で毎 tick 出せる（回収箱が詰まらない）
    expect(out.frames.slice(0, 21).map((s) => s.inputs[0]!.next)).toEqual(
      Array.from({ length: 21 }, (_, t) => t),
    );
    expect(out.final.cells).toEqual([]);
    expect(out.result).toMatchObject({
      result: "stuck",
      ticks: null,
      matched: 0,
      total: 1,
      firstMismatch: 1,
    });
  });

  it("後ろからしか受けない: 横から押し込むとベルトの上で待つ（stuck）", () => {
    // 入口A(0,0)東 → ベルト(1,0)東 → 回収箱(2,0)北向き（後ろ＝南。西＝左からは受けない）
    const order = miniOrder({
      width: 4,
      height: 1,
      inputs: [{ id: "A", pos: [0, 0], dir: "E", notes: ["do:short"] }],
      outputs: [{ id: "OUT", pos: [3, 0], dir: "E", expect: ["do:short"] }],
      allowed: ["belt", "bin"],
    });
    const out = run(buildWorld(order, [at("belt", 1, 0, "E"), at("bin", 2, 0, "N")], machines));
    expect(out.result.result).toBe("stuck");
    expect(out.final.cells.map((c) => c.key)).toEqual([1]);
  });
});
