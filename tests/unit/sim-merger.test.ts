import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { noteToString, parseMachines, parseOrder } from "../../src/core/sim/load";
import { buildWorld, run, type SimState } from "../../src/core/sim/sim";
import type { Order, Placement } from "../../src/core/sim/types";
import type { Dir } from "../../src/core/grid";

/**
 * 合流機の交互ルール（Issue #3、spec-e-mvp.md v0.3 §2）。
 *
 * 盤（7×5）。合流機 M は (3,2) 東向き: 左=北、右=南、前=東。
 *
 *   y=0  . . . L' . . .     L' = 左の入口を1マス遠くに置くときの位置（南向き）
 *   y=1  . . . L  . . .     L  = 左の入口（南向き）。L' のときはここに南向きベルト
 *   y=2  . . . M  B O .     B = 東向きベルト、O = 出口（東向き）
 *   y=3  . . . R  . . .     R  = 右の入口（北向き）。R' のときはここに北向きベルト
 *   y=4  . . . R' . . .     R' = 右の入口を1マス遠くに置くときの位置
 *
 * 左はド、右はミを出す。出口に届いた並びと、tick ごとの合流機の上の音で固定する。
 */

const machines = parseMachines(
  JSON.parse(readFileSync(join(__dirname, "../../src/data/machines.json"), "utf8")),
);

const M = { x: 3, y: 2 };
const W = 7;
const keyOf = (p: { x: number; y: number }): number => p.y * W + p.x;

interface Side {
  /** 入口から合流機までの距離（1=隣、2=間にベルト1本）。 */
  readonly dist: 1 | 2;
  readonly count: number;
  readonly interval?: number;
}

function board(left: Side, right: Side): { order: Order; placements: Placement[] } {
  const lPos = [3, 2 - left.dist];
  const rPos = [3, 2 + right.dist];
  const total = left.count + right.count;
  const json = {
    schemaVersion: 1,
    id: "order-93",
    title: "合流機テスト",
    client: { id: "test", name: "テスト" },
    texts: { intro: "-", tutorial: "-", result: { encore: "-", pass: "-", fail: "-" } },
    board: { width: W, height: 5, blocked: [] },
    inputs: [
      {
        id: "L",
        pos: lPos,
        dir: "S",
        emit: { interval: left.interval ?? 1, notes: Array(left.count).fill("do:short") },
      },
      {
        id: "R",
        pos: rPos,
        dir: "N",
        emit: { interval: right.interval ?? 1, notes: Array(right.count).fill("mi:short") },
      },
    ],
    // 期待列は並びの確認には使わない（届いた並びを直接見る）。数だけ合わせる。
    outputs: [{ id: "OUT", pos: [5, 2], dir: "E", expect: Array(total).fill("do:short") }],
    allowedMachines: ["belt", "merger"],
    limits: { maxTicks: 80 },
    scoring: {
      accuracy: { gold: 100, silver: 90, bronze: 80, unit: "percent" },
      ticks: { gold: 18, silver: 24, bronze: 36 },
      cost: { gold: 10, silver: 12, bronze: 16 },
      passRule: "all-bronze-or-better",
      encoreRule: "two-or-more-gold",
    },
    unlocks: [],
    referenceSolutions: [],
  };
  const order = parseOrder(json, "order-93.json");
  const belt = (x: number, y: number, dir: Dir): Placement => ({
    machine: "belt",
    pos: { x, y },
    dir,
  });
  const placements: Placement[] = [{ machine: "merger", pos: M, dir: "E" }, belt(4, 2, "E")];
  if (left.dist === 2) placements.push(belt(3, 1, "S"));
  if (right.dist === 2) placements.push(belt(3, 3, "N"));
  return { order, placements };
}

function play(left: Side, right: Side) {
  const { order, placements } = board(left, right);
  const out = run(buildWorld(order, placements, machines), { recordFrames: true });
  const received = out.final.outputs[0]!.received.map((n) => noteToString(n).split(":")[0]);
  /** tick ごとの合流機の上の音（空なら "."）。frames[0] は初期状態なので外す。 */
  const onMerger = out.frames.slice(1).map((s: SimState) => {
    const c = s.cells.find((x) => x.key === keyOf(M));
    return c ? noteToString(c.note).split(":")[0] : ".";
  });
  return { ...out, received, onMerger };
}

describe("合流機の交互ルール（Issue #3）", () => {
  it("1. 同じ tick に左右から来た → 初回は左、次の同時は右、と交互", () => {
    const r = play({ dist: 1, count: 3 }, { dist: 1, count: 3 });
    expect(r.result).toMatchObject({ result: "completed", ticks: 8 });
    expect(r.onMerger).toEqual(["do", "mi", "do", "mi", "do", "mi", ".", "."]);
    expect(r.received).toEqual(["do", "mi", "do", "mi", "do", "mi"]);
  });

  it("2. 片方だけ来た → その tick で通す（相手を待たない）", () => {
    // 右が隣、左は1マス遠い: tick 1 は右だけが合流機に着く → 左を待たずに通す
    const r = play({ dist: 2, count: 2 }, { dist: 1, count: 2 });
    expect(r.onMerger[0]).toBe("mi");
    // 右が2連続で着く間隔（interval 3）なら、同時にならず全部来た順に通る
    const solo = play({ dist: 1, count: 2, interval: 3 }, { dist: 2, count: 2, interval: 3 });
    expect(solo.onMerger.slice(0, 6)).toEqual(["do", "mi", ".", "do", "mi", "."]);
    expect(solo.received).toEqual(["do", "mi", "do", "mi"]);
    expect(solo.result.result).toBe("completed");
  });

  it("3. 片側が尽きた → 残りはそのまま毎 tick 流れ、止まらない", () => {
    const r = play({ dist: 1, count: 2 }, { dist: 1, count: 5 });
    expect(r.received).toEqual(["do", "mi", "do", "mi", "mi", "mi", "mi"]);
    // 左が尽きた後（tick 4〜）も右は毎 tick 合流機を通る
    expect(r.onMerger).toEqual(["do", "mi", "do", "mi", "mi", "mi", "mi", ".", "."]);
    expect(r.result).toMatchObject({ result: "completed", ticks: 9 });
  });

  it("4. 「前回」は同時のときだけでなく、直前に通した側で決まる", () => {
    // 左が隣、右は1マス遠い: tick 1 は左だけが通る（同時ではない）。
    // tick 2 は左右が同時 → 前回=左なので右を通す（同時だけを数えるなら初回扱いで左になる）
    const r = play({ dist: 1, count: 3 }, { dist: 2, count: 3 });
    expect(r.onMerger.slice(0, 2)).toEqual(["do", "mi"]);
    expect(r.received).toEqual(["do", "mi", "do", "mi", "do", "mi"]);
    // 鏡写し: 右が先に1つ通ったあとの同時は左
    const m = play({ dist: 2, count: 3 }, { dist: 1, count: 3 });
    expect(m.received).toEqual(["mi", "do", "mi", "do", "mi", "do"]);
  });

  it("前回の側は状態に残り、合流機の無い盤では状態に mergers を持たない", () => {
    const r = play({ dist: 1, count: 1 }, { dist: 1, count: 1 });
    expect(r.frames[1]!.mergers).toEqual([{ key: keyOf(M), last: "left" }]);
    expect(r.frames[2]!.mergers).toEqual([{ key: keyOf(M), last: "right" }]);
    expect(r.frames[0]!.mergers).toEqual([]);
  });

  it("出口が詰まって合流機が動けない tick は、どちらも通さず優先側も変えない", () => {
    // 合流機の前のベルトを外す: 合流機は前（東）の (4,2) が空マスで出られない
    const { order, placements } = board({ dist: 1, count: 2 }, { dist: 1, count: 2 });
    const stuck = placements.filter((p) => !(p.pos.x === 4 && p.pos.y === 2));
    const out = run(buildWorld(order, stuck, machines), { recordFrames: true });
    expect(out.result.result).toBe("stuck");
    expect(out.final.mergers).toEqual([{ key: keyOf(M), last: "left" }]);
    expect(out.final.cells.find((c) => c.key === keyOf(M))?.note.pitch).toBe(0);
  });
});
