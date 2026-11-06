import { describe, expect, it } from "vitest";
import { noteToString } from "../../src/core/sim/load";
import { buildWorld, run, tuneUp, type SimState } from "../../src/core/sim/sim";
import type { Placement } from "../../src/core/sim/types";
import type { Dir } from "../../src/core/grid";
import { machines, miniOrder } from "./mini-order";

/**
 * 調律機（spec-e-mvp.md v0.3 §2、machines.json processTicks 2）。
 *
 * 盤 6×1: 入口A(0,0)東 → ベルト(1,0) → 調律機(2,0) → ベルト(3,0) → ベルト(4,0) → 出口(5,0)東
 * （QA フィクスチャ tests/fixtures/boards/ae10-tuner-backpressure.json と同じ形）
 */
const at = (machine: Placement["machine"], x: number, dir: Dir = "E"): Placement => ({
  machine,
  pos: { x, y: 0 },
  dir,
});

function line(notes: string[], expect: string[], middle: Placement[]) {
  const order = miniOrder({
    width: 6,
    height: 1,
    inputs: [{ id: "A", pos: [0, 0], dir: "E", notes }],
    outputs: [{ id: "OUT", pos: [5, 0], dir: "E", expect }],
    allowed: ["belt", "tuner"],
  });
  const out = run(buildWorld(order, middle, machines), { recordFrames: true });
  /** tick ごとの盤（x=1..4）。音符は音高名、調律機の処理中は後ろに "*"、空は "." */
  const rows = out.frames.slice(1).map((s: SimState) =>
    [1, 2, 3, 4]
      .map((x) => {
        const c = s.cells.find((k) => k.key === x);
        if (!c) return ".";
        return noteToString(c.note).split(":")[0] + (c.wait ? "*" : "");
      })
      .join(" "),
  );
  const got = out.final.outputs[0]!.received.map((n) => noteToString(n).split(":")[0]);
  return { ...out, rows, got };
}

const standard = [at("belt", 1), at("tuner", 2), at("belt", 3), at("belt", 4)];

describe("調律機（processTicks 2）", () => {
  it("音高を1段上げる: ド→ミ→ソ→ド", () => {
    expect([0, 1, 2].map((p) => tuneUp(p as 0 | 1 | 2))).toEqual([1, 2, 0]);
  });

  it("入った tick の2つ後に出る・処理中は次を受けず後ろと入口が待つ（ゴールデン）", () => {
    const r = line(Array(3).fill("do:short"), Array(3).fill("mi:short"), standard);
    expect(r.rows).toEqual([
      "do . . .", // t1
      "do do* . .", // t2: 1音目が調律機へ（処理中）、2音目がベルトへ
      "do do . .", // t3: 1音目は処理中、2音目と入口は待つ
      "do do* mi .", // t4: 1音目がミで出る。同じ tick に2音目が入り、3音目が入口から出る
      "do do . mi", // t5
      ". do* mi .", // t6: 1音目が出口へ。2音目がミで出て、3音目が入る
      ". do . mi", // t7
      ". . mi .", // t8
      ". . . mi", // t9
      ". . . .", // t10: 3音目が出口へ → completed
    ]);
    expect(r.got).toEqual(["mi", "mi", "mi"]);
    expect(r.result).toMatchObject({
      result: "completed",
      ticks: 10,
      matched: 3,
      total: 3,
      cost: 11,
    });
  });

  it("入口は詰まりの分だけ遅れて出す（interval 1 でも 1,2,4 tick 目）", () => {
    const r = line(Array(3).fill("do:short"), Array(3).fill("mi:short"), standard);
    const nextByTick = r.frames.map((s) => s.inputs[0]!.next);
    expect(nextByTick.slice(0, 5)).toEqual([0, 1, 2, 2, 3]);
  });

  it("ソはドに戻る。2台続けるとド→ソ", () => {
    expect(line(["so:short"], ["do:short"], standard).got).toEqual(["do"]);
    const two = line(
      ["do:short"],
      ["so:short"],
      [at("belt", 1), at("tuner", 2), at("tuner", 3), at("belt", 4)],
    );
    expect(two.got).toEqual(["so"]);
    // 2台目にも2 tick いる: t1 ベルト, t2-3 調律機1, t4-5 調律機2, t6 ベルト, t7 出口
    expect(two.result).toMatchObject({ result: "completed", ticks: 7 });
  });

  it("出口側が詰まったら処理が終わっても出ず、後ろも待って stuck", () => {
    // 調律機の前（3,0）にベルトが無い
    const r = line(Array(2).fill("do:short"), Array(2).fill("mi:short"), [
      at("belt", 1),
      at("tuner", 2),
    ]);
    expect(r.result.result).toBe("stuck");
    expect(r.result.ticks).toBeNull();
    expect(r.final.cells.map((c) => [c.key, noteToString(c.note), c.wait])).toEqual([
      [1, "do:short", undefined],
      [2, "do:short", undefined],
    ]);
  });

  it("調律機の無い盤では状態に wait を持たない（既存ゴールデンのハッシュを変えない）", () => {
    const r = line(
      ["do:short"],
      ["do:short"],
      [1, 2, 3, 4].map((x) => at("belt", x)),
    );
    expect(r.frames.every((s) => s.cells.every((c) => !("wait" in c)))).toBe(true);
  });
});
