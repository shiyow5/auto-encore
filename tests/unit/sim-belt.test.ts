/* eslint-disable @typescript-eslint/no-explicit-any -- テストで JSON を書き換えるため */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMachines, parseOrder, parseSolution } from "../../src/core/sim/load";
import { hash64, stableStringify } from "../../src/core/sim/hash";
import {
  absOf,
  accuracyPercent,
  buildWorld,
  initialState,
  run,
  sideOf,
  simulate,
  step,
} from "../../src/core/sim/sim";
import type { Placement } from "../../src/core/sim/types";
import type { Dir } from "../../src/core/grid";

const DATA = join(__dirname, "../../src/data");
const readJson = (rel: string): any => JSON.parse(readFileSync(join(DATA, rel), "utf8"));
const machines = parseMachines(readJson("machines.json"));
const order01Json = readJson("orders/order-01.json");
const order01 = parseOrder(order01Json, "orders/order-01.json");

const belt = (x: number, y: number, dir: Dir = "E"): Placement => ({
  machine: "belt",
  pos: { x, y },
  dir,
});
const line = (): Placement[] => Array.from({ length: 10 }, (_, i) => belt(i + 1, 3));

/** order-01 を書き換えた注文（盤の大きさ・入口などを変えて境界を試す）。 */
function orderWith(mutate: (o: any) => void) {
  const o = JSON.parse(JSON.stringify(order01Json));
  mutate(o);
  return parseOrder(o, "test.json");
}

describe("向きの変換", () => {
  it("東向きの左=北・右=南・後ろ=西（spec-e §2）", () => {
    expect(absOf("E", "left")).toBe("N");
    expect(absOf("E", "right")).toBe("S");
    expect(absOf("E", "back")).toBe("W");
    for (const d of ["N", "E", "S", "W"] as Dir[]) {
      for (const side of ["front", "back", "left", "right"] as const) {
        expect(sideOf(d, absOf(d, side))).toBe(side);
      }
    }
  });
});

describe("stableStringify / hash64", () => {
  it("キーの並びに依存しない", () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(
      stableStringify({ a: [1, { c: 3, d: 2 }], b: 1 }),
    );
    expect(hash64("x")).toMatch(/^[0-9a-f]{16}$/);
    expect(hash64("x")).not.toBe(hash64("y"));
  });
});

describe("ベルト・入口・出口", () => {
  it("tick 1 に入口が最初の1音を出し、満杯の列でも 1 tick 1 マスで進む", () => {
    const w = buildWorld(order01, line(), machines);
    let s = initialState(w);
    s = step(w, s);
    expect(s.tick).toBe(1);
    expect(s.cells.map((c) => c.key)).toEqual([3 * 12 + 1]);
    for (let t = 2; t <= 8; t++) s = step(w, s);
    // 8音が [1,3]〜[8,3] に隙間なく並ぶ。先頭が ID 0。
    expect(s.cells.map((c) => c.key % 12)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(s.cells.map((c) => c.note.id)).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);
    expect(s.inputs[0]).toEqual({ next: 8, wait: 0 });
  });

  it("order-01 の模範解: 18 tick で完成・正確さ100%・10G", () => {
    const { result } = simulate(order01, line(), machines);
    expect(result).toMatchObject({
      result: "completed",
      ticks: 18,
      matched: 8,
      total: 8,
      cost: 10,
    });
    expect(result.firstMismatch).toBeNull();
    expect(accuracyPercent(result)).toBe(100);
  });

  it("interval 2 なら1マスおきに出る", () => {
    const order = orderWith((o) => (o.inputs[0].emit.interval = 2));
    const { result } = simulate(order, line(), machines);
    // 最後の音は tick 15 に出て、10 tick 後に出口へ
    expect(result).toMatchObject({ result: "completed", ticks: 25 });
  });

  it("配置の並び順で結果が変わらない（決定性）", () => {
    const a = simulate(order01, line(), machines).result;
    const b = simulate(order01, line().reverse(), machines).result;
    expect(b).toEqual(a);
  });

  it("frames は初期状態＋各 tick（再生用）", () => {
    const { frames, result } = simulate(order01, line(), machines, { recordFrames: true });
    expect(frames).toHaveLength(19);
    expect(frames[0]!.tick).toBe(0);
    expect(frames[18]!.outputs[0]!.received).toHaveLength(8);
    expect(result.ticks).toBe(18);
  });

  it("出口は期待数に達したら受けない（後ろが詰まる）", () => {
    const order = orderWith((o) => {
      o.outputs[0].expect = ["do:short", "do:short", "do:short", "do:short"];
    });
    const w = buildWorld(order, line(), machines);
    const out = run(w);
    expect(out.result).toMatchObject({ result: "completed", ticks: 14, matched: 4, total: 4 });
    expect(out.final.outputs[0]!.received).toHaveLength(4);
  });
});

describe("停止判定", () => {
  it("向きを1本間違えると詰まる（stuck・速度なし）", () => {
    const placements = line();
    placements[4] = belt(5, 3, "W");
    const { result } = simulate(order01, placements, machines);
    expect(result.result).toBe("stuck");
    expect(result.ticks).toBeNull();
    expect(result.matched).toBe(0);
    expect(result.firstMismatch).toBe(1);
  });

  it("何も置かないと tick 1 で詰まる", () => {
    expect(simulate(order01, [], machines).result).toMatchObject({
      result: "stuck",
      ticks: null,
      cost: 0,
    });
  });

  it("ベルトが途中で切れていても詰まる", () => {
    const placements = line().filter((p) => p.pos.x !== 7);
    expect(simulate(order01, placements, machines).result.result).toBe("stuck");
  });

  it("maxTicks に届いたら止める", () => {
    const order = orderWith((o) => (o.limits.maxTicks = 5));
    expect(simulate(order, line(), machines).result).toMatchObject({
      result: "maxTicks",
      ticks: null,
    });
  });
  // ループ（loop）: v0.3 のベルトは後ろからしか受けず曲がれないので、ベルトだけでは輪が作れない。
  // 合流機が入る T5 で、合流機を曲がり角にした輪で固定する。
});

describe("模範解ゴールデン（solutions/*.json の expected と完全一致）", () => {
  const data = (() => {
    const order = order01;
    return order.referenceSolutions.map((ref) => ({
      ref,
      order,
      sol: parseSolution(readJson(ref), ref, order, machines),
    }));
  })();

  it.each(data)("$ref", ({ order, sol }) => {
    expect(sol.expected).toBeDefined();
    const { result } = simulate(order, sol.placements, machines);
    expect({
      result: result.result,
      accuracy: accuracyPercent(result),
      ticks: result.ticks,
      cost: result.cost,
      finalHash: result.finalHash,
    }).toEqual(sol.expected);
  });
});
