/* eslint-disable @typescript-eslint/no-explicit-any -- テストで JSON を書き換えるため */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMachines, parseOrder, parseSolution } from "../../src/core/sim/load";
import { accuracyPercent, simulate } from "../../src/core/sim/sim";
import type { Placement } from "../../src/core/sim/types";

const DATA = join(__dirname, "../../src/data");
const readJson = (rel: string): any => JSON.parse(readFileSync(join(DATA, rel), "utf8"));
const machines = parseMachines(readJson("machines.json"));
const order02 = parseOrder(readJson("orders/order-02.json"), "orders/order-02.json");
const frugal = parseSolution(
  readJson("solutions/order-02-frugal.json"),
  "solutions/order-02-frugal.json",
  order02,
  machines,
).placements;

const SORTER_POS = { x: 6, y: 2 };
const isSorter = (p: Placement): boolean => p.pos.x === SORTER_POS.x && p.pos.y === SORTER_POS.y;

/** 模範解の仕分け機だけを差し替える。 */
function withSorter(f: (p: Placement) => Placement): Placement[] {
  return frugal.map((p) => (isSorter(p) ? f(p) : p));
}

describe("仕分け機（spec-e v0.3 §2・§5 注文2）", () => {
  it("order-02 の模範解: 設定「ド」で ド→前(低)・ソ→右(高)、18 tick・正確さ100%・19G", () => {
    const { result, final } = simulate(order02, frugal, machines);
    expect(result).toMatchObject({
      result: "completed",
      ticks: 18,
      matched: 8,
      total: 8,
      cost: 19,
    });
    const pitches = order02.outputs.map((o, i) => ({
      id: o.id,
      got: final.outputs[i]!.received.map((n) => n.pitch),
    }));
    expect(pitches).toEqual([
      { id: "HI", got: [2, 2, 2, 2] },
      { id: "LO", got: [0, 0, 0, 0] },
    ]);
  });

  it("設定を「ソ」にすると左右が逆になり、正確さ0%（失敗例）", () => {
    const placements = withSorter((p) => ({ ...p, config: { pitch: 2 } }));
    const { result, final } = simulate(order02, placements, machines);
    // ソ が前(低)へ、ド が右(高)へ。どちらの出口も4音ずつ受けるが全部ちがう音
    expect(result).toMatchObject({ result: "completed", matched: 0, total: 8 });
    expect(accuracyPercent(result)).toBe(0);
    expect(final.outputs.map((o) => o.received.map((n) => n.pitch))).toEqual([
      [0, 0, 0, 0],
      [2, 2, 2, 2],
    ]);
  });

  it("仕分け機なし（ベルトで代用）だと高に何も来ず、低が満杯で詰まる", () => {
    const placements = withSorter((p) => ({ machine: "belt", pos: p.pos, dir: p.dir }));
    const { result, final } = simulate(order02, placements, machines);
    expect(result.result).toBe("stuck");
    expect(result.ticks).toBeNull();
    const hi = order02.outputs.findIndex((o) => o.id === "HI");
    expect(final.outputs[hi]!.received).toEqual([]);
  });

  it("行き先が詰まっていると逃がさず待つ（右の列が無ければ ソ で止まる）", () => {
    // 南向きの列を外す: 最初の ソ（2音目）が仕分け機で右へ出られず、後ろも全部止まる
    const placements = frugal.filter((p) => !(p.pos.x === 6 && p.pos.y >= 3));
    const { result, final } = simulate(order02, placements, machines);
    expect(result.result).toBe("stuck");
    const lo = order02.outputs.findIndex((o) => o.id === "LO");
    // 先頭の ド だけが低へ届き、ソ は仕分け機の上に残る（前の空いたベルトへ逃げない）
    expect(final.outputs[lo]!.received.map((n) => n.pitch)).toEqual([0]);
    const sorterKey = SORTER_POS.y * order02.board.width + SORTER_POS.x;
    expect(final.cells.find((c) => c.key === sorterKey)?.note.pitch).toBe(2);
  });

  it("仕分け機は後ろからだけ受ける（横から入れない）", () => {
    // 入口の列を1段ずらして [6,1] の南向きベルトから仕分け機の左（東向きの左=北）へ入れようとする
    const order = parseOrder(
      {
        ...readJson("orders/order-02.json"),
        inputs: [{ ...readJson("orders/order-02.json").inputs[0], pos: [6, 0], dir: "S" }],
      },
      "x.json",
    );
    const placements: Placement[] = [
      { machine: "belt", pos: { x: 6, y: 1 }, dir: "S" },
      ...frugal.filter((p) => p.pos.x >= 6),
    ];
    const { result, final } = simulate(order, placements, machines);
    expect(result.result).toBe("stuck");
    expect(final.outputs.every((o) => o.received.length === 0)).toBe(true);
  });
});
