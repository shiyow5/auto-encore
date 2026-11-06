import { describe, expect, it } from "vitest";
import { buildWorld, run } from "../../src/core/sim/sim";
import type { Placement } from "../../src/core/sim/types";
import type { Dir } from "../../src/core/grid";
import { machines, miniOrder } from "./mini-order";

/**
 * 停止判定（spec-e-mvp.md v0.3 Q8: 詰まり・ループ・上限で止まったら速度なし＝不合格）。
 *
 * 盤 6×4。合流機4台で輪を作る（どれも右の辺で前の合流機から受ける）:
 *   (1,1)東 → (2,1)南 → (2,2)西 → (1,2)北 → (1,1)
 * 入口A は (1,0) 南向きで、(1,1) の左（北）に入れる。出口は輪とつながらない (5,3)。
 */
const merger = (x: number, y: number, dir: Dir): Placement => ({
  machine: "merger",
  pos: { x, y },
  dir,
});
const ring = [merger(1, 1, "E"), merger(2, 1, "S"), merger(2, 2, "W"), merger(1, 2, "N")];

function ringOrder(notes: number, maxTicks = 80) {
  return miniOrder({
    width: 6,
    height: 4,
    inputs: [{ id: "A", pos: [1, 0], dir: "S", notes: Array(notes).fill("do:short") }],
    outputs: [{ id: "OUT", pos: [5, 3], dir: "E", expect: ["do:short"] }],
    allowed: ["belt", "merger"],
    maxTicks,
  });
}

describe("停止判定", () => {
  it("音符が輪を回り続ける → loop（入口が出し終えたあと、同じ形が戻った tick で止める）", () => {
    const out = run(buildWorld(ringOrder(2), ring, machines), { recordFrames: true });
    expect(out.result).toMatchObject({ result: "loop", ticks: null, matched: 0, total: 1 });
    // 入口は2音とも出している（loop は「進みが止まってから」の繰り返しだけを見る）
    expect(out.final.inputs[0]!.next).toBe(2);
    expect(out.final.cells).toHaveLength(2);
    // 2音目が出たのは tick 2。合流機の「前回の側」も状態に入るので、それが落ち着いてから
    // 同じ形に戻った tick で止まる（ここでは tick 9）
    expect(out.frames.findIndex((s) => s.inputs[0]!.next === 2)).toBe(2);
    expect(out.final.tick).toBe(9);
    expect(out.final.tick).toBeLessThan(80);
  });

  it("輪が満杯（4音）で全員が同時に回っても loop", () => {
    const out = run(buildWorld(ringOrder(4), ring, machines));
    expect(out.result.result).toBe("loop");
    expect(out.final.cells).toHaveLength(4);
  });

  it("入口が出し続けている間は進んでいるので loop にしない。上限 tick に先に届けば maxTicks", () => {
    // 輪に入れない入口: 輪が満杯になると入口が待つ → 以後は進まずループ。
    // maxTicks を輪が埋まる前（3）にすると maxTicks で止まる
    const out = run(buildWorld(ringOrder(4, 3), ring, machines));
    expect(out.result).toMatchObject({ result: "maxTicks", ticks: null });
    expect(out.final.tick).toBe(3);
  });

  it("停止判定に関わらず結果は決定的（同じ入力から同じ finalHash）", () => {
    const a = run(buildWorld(ringOrder(2), ring, machines)).result.finalHash;
    const b = run(buildWorld(ringOrder(2), ring, machines)).result.finalHash;
    expect(a).toBe(b);
  });
});
