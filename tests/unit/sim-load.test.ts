/* eslint-disable @typescript-eslint/no-explicit-any -- テストでわざと JSON を壊すため、壊す側だけ型を外す */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Ctx, DataError } from "../../src/core/sim/validate";
import {
  noteToString,
  parseMachines,
  parseNote,
  parseOrder,
  parseSolution,
  totalCost,
  validatePlacements,
} from "../../src/core/sim/load";
import { loadGameData } from "../../src/data";

const DATA = join(__dirname, "../../src/data");
const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(DATA, rel), "utf8"));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const machines = parseMachines(readJson("machines.json"));
const order01Json = readJson("orders/order-01.json") as Record<string, unknown>;
const order01 = parseOrder(order01Json, "orders/order-01.json");

function expectDataError(fn: () => unknown, message: string): void {
  expect(fn).toThrow(DataError);
  expect(fn).toThrow(message);
}

describe("音符の文字列", () => {
  it('"so:short" を整数に直し、元に戻せる', () => {
    const n = parseNote("so:short", new Ctx("t"));
    expect(n).toEqual({ pitch: 2, length: 0 });
    expect(noteToString(n)).toBe("so:short");
  });

  it("知らない音高・形はファイル名と位置つきで失敗", () => {
    expectDataError(() => parseNote("fa:short", new Ctx("x.json", "notes[3]")), "x.json: notes[3]");
    expectDataError(() => parseNote("do", new Ctx("x.json")), '"音高:長さ"');
    expectDataError(() => parseNote("do:short:1", new Ctx("x.json")), '"音高:長さ"');
  });
});

describe("machines.json", () => {
  it("最小版の4種が spec-e v0.3 §2 の値", () => {
    expect(Object.keys(machines).sort()).toEqual(["belt", "merger", "sorter", "tuner"]);
    expect(machines.belt).toMatchObject({
      cost: 1,
      accepts: ["back"],
      emits: ["front"],
      processTicks: 0,
    });
    expect(machines.merger).toMatchObject({
      cost: 4,
      accepts: ["left", "right"],
      arbitration: "alternate",
    });
    expect(machines.sorter).toMatchObject({
      cost: 6,
      emits: ["front", "right"],
      config: { pitch: [0, 1, 2] },
    });
    expect(machines.tuner).toMatchObject({ cost: 8, processTicks: 2 });
  });

  it("schemaVersion 違い・機械の不足・重複・知らない項目で失敗", () => {
    const base = readJson("machines.json") as { schemaVersion: number; machines: object[] };
    expectDataError(() => parseMachines({ ...base, schemaVersion: 2 }), "schemaVersion");
    expectDataError(
      () => parseMachines({ ...base, machines: base.machines.slice(0, 3) }),
      '"tuner" の定義がない',
    );
    expectDataError(
      () => parseMachines({ ...base, machines: [...base.machines, base.machines[0]] }),
      "machines[4].id",
    );
    const typo = clone(base);
    (typo.machines[0] as Record<string, unknown>).cots = 1;
    expectDataError(() => parseMachines(typo), "machines[0].cots: 知らない項目");
  });
});

describe("orders/*.json", () => {
  it("全注文が読み込める（id とファイル名が一致）", () => {
    const files = readdirSync(join(DATA, "orders")).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const o = parseOrder(readJson(`orders/${f}`), `orders/${f}`);
      expect(`${o.id}.json`).toBe(f);
    }
  });

  it("order-01 は spec-e v0.3 §5・§10 のベルト1本道", () => {
    expect(order01.board).toEqual({ width: 12, height: 8, blocked: [] });
    expect(order01.inputs).toHaveLength(1);
    expect(order01.inputs[0]).toMatchObject({
      id: "A",
      pos: { x: 0, y: 3 },
      dir: "E",
      interval: 1,
    });
    expect(order01.inputs[0]!.notes.map(noteToString)).toEqual(Array(8).fill("do:short"));
    expect(order01.outputs[0]).toMatchObject({ id: "OUT", pos: { x: 11, y: 3 }, dir: "E" });
    expect(order01.outputs[0]!.expect).toHaveLength(8);
    expect(order01.allowedMachines).toEqual(["belt"]);
    expect(order01.limits.maxTicks).toBe(80);
  });

  it.each([
    ["入口が盤外", (o: any) => (o.inputs[0].pos = [12, 3]), "inputs[0].pos: 盤の外"],
    [
      "入口と出口が同じマス",
      (o: any) => (o.outputs[0].pos = [0, 3]),
      'outputs[0].pos: "A" と同じマス',
    ],
    [
      "音符の打ち間違い",
      (o: any) => (o.inputs[0].emit.notes[5] = "do:shrot"),
      "inputs[0].emit.notes[5]",
    ],
    ["知らない機械", (o: any) => (o.allowedMachines = ["belt", "bin"]), "allowedMachines[1]"],
    ["閾値の向きが逆", (o: any) => (o.scoring.ticks.gold = 99), "scoring.ticks: gold <= silver"],
    ["maxTicks が上限超え", (o: any) => (o.limits.maxTicks = 2001), "limits.maxTicks"],
    ["passRule が不明", (o: any) => (o.scoring.passRule = "any"), "scoring.passRule"],
    ["id の形", (o: any) => (o.id = "order1"), 'id: "order-NN"'],
    [
      "参照解のパス",
      (o: any) => (o.referenceSolutions = ["order-01-frugal.json"]),
      "referenceSolutions[0]",
    ],
    ["必須項目なし", (o: any) => delete o.scoring, "scoring: 必須の項目がない"],
  ])("%s → エラー文に位置が入る", (_label, mutate, message) => {
    const o = clone(order01Json);
    mutate(o);
    expectDataError(
      () => parseOrder(o, "orders/order-01.json"),
      `orders/order-01.json: ${message}`,
    );
  });
});

describe("solutions/*.json", () => {
  const frugalJson = readJson("solutions/order-01-frugal.json") as { placements: any[] };

  it("order-01 の模範解はベルト10本・10G で置ける", () => {
    const s = parseSolution(frugalJson, "solutions/order-01-frugal.json", order01, machines);
    expect(s.placements).toHaveLength(10);
    expect(totalCost(s.placements, order01, machines)).toBe(10);
  });

  it.each([
    ["入口のマス", (s: any) => (s.placements[0].pos = [0, 3]), "placements[0].pos: 入口・出口"],
    [
      "重なり",
      (s: any) => (s.placements[1].pos = [1, 3]),
      "placements[1].pos: placements[0] と同じマス",
    ],
    [
      "許可されない機械",
      (s: any) => (s.placements[0].machine = "merger"),
      'placements[0].machine: この注文では "merger"',
    ],
    ["盤外", (s: any) => (s.placements[0].pos = [3, 8]), "placements[0].pos: 盤の外"],
    [
      "ベルトに config",
      (s: any) => (s.placements[0].config = { pitch: "do" }),
      "placements[0].config",
    ],
    ["注文違い", (s: any) => (s.orderId = "order-02"), "orderId"],
    [
      "expected.cost が配置のコストと違う（AE-22）",
      (s: any) => (s.expected.cost = 11),
      "expected.cost: 配置から計算したコストは 10",
    ],
  ])("%s → 失敗", (_label, mutate, message) => {
    const s = clone(frugalJson);
    mutate(s);
    expectDataError(() => parseSolution(s, "sol.json", order01, machines), `sol.json: ${message}`);
  });

  it("仕分け機は config.pitch が必須（設定の過不足を弾く）", () => {
    const o = clone(order01Json);
    o.allowedMachines = ["belt", "sorter"];
    const order = parseOrder(o, "o.json");
    const sorter = { machine: "sorter", pos: [5, 3], dir: "E" };
    const sol = (p: object) => ({
      schemaVersion: 1,
      orderId: "order-01",
      name: "t",
      placements: [p],
    });
    expectDataError(
      () => parseSolution(sol(sorter), "s.json", order, machines),
      "config.pitch が必要",
    );
    const ok = parseSolution(
      sol({ ...sorter, config: { pitch: "so" } }),
      "s.json",
      order,
      machines,
    );
    expect(ok.placements[0]!.config).toEqual({ pitch: 2 });
  });

  it("個数上限（limits.machines）を超えると失敗", () => {
    const o = clone(order01Json) as any;
    o.limits.machines = { belt: 9 };
    const order = parseOrder(o, "o.json");
    expectDataError(
      () => parseSolution(frugalJson, "s.json", order, machines),
      '"belt" は 9 個まで',
    );
  });

  it("validatePlacements を直接呼んでも負の座標は盤の外で失敗", () => {
    for (const pos of [
      { x: -1, y: 3 },
      { x: 3, y: -1 },
    ]) {
      expectDataError(
        () => validatePlacements([{ machine: "belt", pos, dir: "E" }], order01),
        "盤の外",
      );
    }
  });

  it("expected: completed 以外で ticks を持つと失敗", () => {
    const s = {
      ...clone(frugalJson),
      expected: { result: "stuck", accuracy: 0, ticks: 12, cost: 10 },
    };
    expectDataError(() => parseSolution(s, "s.json", order01, machines), "expected.ticks");
  });
});

describe("loadGameData（画面側の入口）", () => {
  it("同梱データを全部検証して返す", () => {
    const d = loadGameData();
    expect(d.orders.map((o) => o.id)).toContain("order-01");
    expect(Object.keys(d.solutions)).toContain("solutions/order-01-frugal.json");
  });
});
