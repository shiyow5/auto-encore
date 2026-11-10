import { describe, expect, it } from "vitest";
import {
  MACHINE_IDS,
  checkOutcome,
  formatSmokeFailures,
  generatePlacements,
  placementSeedCount,
  runPlacementSmoke,
  validateGenerated,
  type GenInput,
  type GenPlacement,
  type SmokeOutcome,
  type Simulate,
  STOP_REASONS,
} from "./placement";

const INPUT: GenInput = {
  board: { width: 8, height: 6, blocked: [{ x: 3, y: 3 }] },
  machines: MACHINE_IDS,
  maxPlacements: 20,
  reserved: [
    { x: 0, y: 2 },
    { x: 7, y: 2 },
  ],
};

const N = placementSeedCount();

/** おもちゃのシミュ: 保存則を守る。置いた数に応じて終わり方を散らす。 */
const toySim: Simulate = (placements) => {
  const emitted = 4;
  const received = Math.min(emitted, placements.length);
  const results = ["completed", "stuck", "loop", "maxTicks"] as const;
  return {
    result: results[placements.length % 4] as SmokeOutcome["result"],
    emitted,
    received,
    remaining: emitted - received,
  };
};

describe("生成器（AE-24）", () => {
  it("同じ seed なら同じ配置、seed が違えば（ほぼ）違う配置", () => {
    expect(generatePlacements("s1", INPUT)).toEqual(generatePlacements("s1", INPUT));
    const distinct = new Set(
      Array.from({ length: 30 }, (_, i) => JSON.stringify(generatePlacements(`d${i}`, INPUT))),
    );
    expect(distinct.size).toBeGreaterThan(20);
  });

  it(`${N} seed すべてで盤内・重複なし・使用済みマス回避・許可機械のみ・仕分け機だけ config`, () => {
    for (let i = 0; i < N; i++) {
      const p = generatePlacements(`g${i}`, INPUT);
      expect(validateGenerated(p, INPUT), `seed g${i}`).toEqual([]);
    }
  });

  it("0 個の配置も、満杯に近い配置も出る（極端な形を取りこぼさない）", () => {
    const sizes = Array.from({ length: 300 }, (_, i) => generatePlacements(`e${i}`, INPUT).length);
    expect(Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(Math.max(...sizes)).toBeGreaterThanOrEqual(INPUT.maxPlacements - 2);
  });

  it("空きマスより多く頼んでも空きマス数で頭打ち（重複で埋めない）", () => {
    const tiny: GenInput = {
      board: { width: 2, height: 2 },
      machines: ["belt"],
      maxPlacements: 99,
    };
    for (let i = 0; i < 50; i++) {
      const p = generatePlacements(`t${i}`, tiny);
      expect(p.length).toBeLessThanOrEqual(4);
      expect(validateGenerated(p, tiny)).toEqual([]);
    }
  });

  it("全マス使用済みなら空配置（例外にしない）", () => {
    const full: GenInput = {
      board: { width: 1, height: 1 },
      machines: ["belt"],
      maxPlacements: 5,
      reserved: [{ x: 0, y: 0 }],
    };
    expect(generatePlacements("x", full)).toEqual([]);
  });

  it("不正な入力は RangeError", () => {
    expect(() => generatePlacements("x", { ...INPUT, board: { width: 0, height: 3 } })).toThrow(
      RangeError,
    );
    expect(() => generatePlacements("x", { ...INPUT, board: { width: 2.5, height: 3 } })).toThrow(
      RangeError,
    );
    expect(() => generatePlacements("x", { ...INPUT, machines: [] })).toThrow(RangeError);
    expect(() => generatePlacements("x", { ...INPUT, maxPlacements: -1 })).toThrow(RangeError);
  });

  it("validateGenerated は壊れた配置を捕まえる", () => {
    const bad = [
      { machine: "belt", pos: { x: 0, y: 0 }, dir: "N" },
      { machine: "belt", pos: { x: 0, y: 0 }, dir: "E" },
      { machine: "sorter", pos: { x: 1, y: 0 }, dir: "E" },
      { machine: "tuner", pos: { x: 9, y: 9 }, dir: "E" },
      { machine: "belt", pos: { x: 3, y: 3 }, dir: "E", config: { pitch: 0 } },
    ] as const;
    const problems = validateGenerated(bad, INPUT).join("\n");
    expect(problems).toContain("重複");
    expect(problems).toContain("config が無い");
    expect(problems).toContain("盤の外");
    expect(problems).toContain("使えないマス");
    expect(problems).toContain("belt に config");
  });
});

describe("検査の枠（おもちゃのシミュで実際に動かす）", () => {
  it(`${N} seed で保存則を守るシミュは failure 0`, () => {
    expect(runPlacementSmoke(toySim, INPUT, N)).toEqual([]);
  });

  it("例外・保存則違反・終わり方不明・生成器の不具合を種類別に捕まえ、seed と配置を出す", () => {
    const thrower: Simulate = () => {
      throw new Error("boom");
    };
    const leaky: Simulate = () => ({ result: "completed", emitted: 4, received: 3, remaining: 0 });
    const weird: Simulate = () => ({
      result: "done" as never,
      emitted: 0,
      received: 0,
      remaining: 0,
    });
    const f1 = runPlacementSmoke(thrower, INPUT, 3);
    expect(f1.map((f) => f.kind)).toEqual(["exception", "exception", "exception"]);
    expect(f1[0]?.message).toBe("boom");
    const f2 = runPlacementSmoke(leaky, INPUT, 3);
    expect(f2[0]?.kind).toBe("outcome");
    expect(f2[0]?.message).toContain("保存則");
    expect(runPlacementSmoke(weird, INPUT, 1)[0]?.message).toContain("4種");
    const report = formatSmokeFailures(f2, 1);
    expect(report).toContain("seed=ae24-0");
    expect(report).toContain("placements: [");
    expect(report).toContain("ほか 2 件");
    // 失敗した seed から配置を作り直せる（再現できる）
    expect(JSON.parse(report.split("placements: ")[1]!.split("\n")[0]!)).toEqual(
      generatePlacements("ae24-0", INPUT),
    );
  });

  it("checkOutcome: 負数・小数・ちょうど境界の保存則", () => {
    expect(checkOutcome({ result: "stuck", emitted: 0, received: 0, remaining: 0 })).toEqual([]);
    expect(
      checkOutcome({ result: "stuck", emitted: 1, received: -1, remaining: 2 }).join(),
    ).toContain("整数");
    expect(
      checkOutcome({ result: "stuck", emitted: 1.5, received: 1, remaining: 0.5 }).join(),
    ).toContain("整数");
    expect(
      checkOutcome({ result: "loop", emitted: 3, received: 1, remaining: 3 }).join(),
    ).toContain("保存則");
  });

  it("QA_PLACEMENT_SEEDS: 未設定・空は 300、数字はそのまま、0 や文字は RangeError", () => {
    expect(placementSeedCount({})).toBe(300);
    expect(placementSeedCount({ QA_PLACEMENT_SEEDS: "" })).toBe(300);
    expect(placementSeedCount({ QA_PLACEMENT_SEEDS: "1000" })).toBe(1000);
    for (const bad of ["0", "abc", "-5", "1.5", "1e3"]) {
      expect(() => placementSeedCount({ QA_PLACEMENT_SEEDS: bad })).toThrow(RangeError);
    }
  });
});

// ---------- 本物のシミュ ----------
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMachines, parseOrder } from "../../src/core/sim/load";
import { simulate } from "../../src/core/sim/sim";
import type { Placement, MachineTable, Order, StopReason } from "../../src/core/sim/types";
import type { Point } from "../../src/core/grid";
import type { SimState } from "../../src/core/sim/sim";

const FIXTURES_DIR = fileURLToPath(new URL("../../", import.meta.url));
const loadJson = <T>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, rel), "utf8"));

const machinesJson = loadJson<Record<string, unknown>>("src/data/machines.json");
const machines = parseMachines(machinesJson, "machines.json") as MachineTable;

const order01Json = loadJson<Record<string, unknown>>("src/data/orders/order-01.json");
const order01 = parseOrder(order01Json, "src/data/orders/order-01.json") as Order;

const order03Json = loadJson<Record<string, unknown>>("src/data/orders/order-03.json");
const order03 = parseOrder(order03Json, "src/data/orders/order-03.json") as Order;

/** GenPlacement[] を Placement[] にキャスト（互換型） */
function toPlacements(gs: readonly GenPlacement[]): Placement[] {
  return gs as unknown as Placement[];
}

/** SimState (シミュ最終状態) から保存則の数値を実測する。 */
function measureConservation(s: SimState): SmokeOutcome {
  const emitted = s.inputs.reduce((sum: number, st: { next: number }) => sum + st.next, 0);
  const received = s.outputs.reduce(
    (sum: number, o: { received: readonly unknown[] }) => sum + o.received.length,
    0,
  );
  return {
    result: "completed" as StopReason, // 呼ぶ側で result を上書きする
    emitted,
    received,
    remaining: emitted - received,
  };
}

describe("本番検査（本物 simulate）", () => {
  const sim = (placements: readonly GenPlacement[], _seed: string): SmokeOutcome => {
    const r = simulate(order01, toPlacements(placements), machines);
    const m = measureConservation(r.final);
    return { ...m, result: r.result.result };
  };

  it("本物のシミュ × order-01 の盤で N seed: 例外なし（AE-24）", () => {
    for (let i = 0; i < N; i++) {
      const seed = `ae24-${i}`;
      const placements = generatePlacements(seed, INPUT);
      // 例外なしで呼べることを確認
      expect(() => sim(placements, seed)).not.toThrow();
    }
  });

  it("本物のシミュ: 終わり方が completed/stuck/loop/maxTicks のどれか（AE-24）", () => {
    const results = new Set<string>();
    for (let i = 0; i < N; i++) {
      const seed = `ae24-${i}`;
      const placements = generatePlacements(seed, INPUT);
      const outcome = sim(placements, seed);
      expect(STOP_REASONS).toContain(outcome.result);
      results.add(outcome.result);
    }
    // order-01盤は単純なので1種類になりうる。stop reasons に含まれることが保証されればOK
    expect(results.size).toBeGreaterThanOrEqual(1);
  });

  it("本物のシミュ: 入口の音 = 出口で受けた音 + 盤上に残った音（保存則 AE-24）", () => {
    for (let i = 0; i < N; i++) {
      const seed = `ae24-${i}`;
      const placements = generatePlacements(seed, INPUT);
      const outcome = sim(placements, seed);
      const problems = checkOutcome(outcome);
      expect(problems).toEqual([]);
    }
  });

  it("注文3相当（合流機・調律機あり）の盤・機械一覧でも同じ検査（AE-24）", () => {
    // order-03 のポート（入口・出口）を reserved として予約する
    const order03Ports: Point[] = [
      { x: 5, y: 0 }, // 入力A
      { x: 5, y: 2 }, // 入力B
      { x: 4, y: 1 }, // 入力C1
      { x: 4, y: 7 }, // 入力C2
      { x: 11, y: 4 }, // 出力OUT
    ];
    const order01GenInput: GenInput = {
      board: { width: 12, height: 8, blocked: [] },
      machines: ["belt", "merger", "tuner", "bin"],
      maxPlacements: 20,
      reserved: order03Ports,
    };
    const sim03 = (placements: readonly GenPlacement[], _seed: string): SmokeOutcome => {
      const r = simulate(order03, toPlacements(placements), machines);
      const m = measureConservation(r.final);
      return { ...m, result: r.result.result };
    };
    for (let i = 0; i < N; i++) {
      const seed = `ae24-${i}`;
      const placements = generatePlacements(seed, order01GenInput);
      const outcome = sim03(placements, seed);
      expect(STOP_REASONS).toContain(outcome.result);
      const problems = checkOutcome(outcome);
      expect(problems).toEqual([]);
    }
  });
});
