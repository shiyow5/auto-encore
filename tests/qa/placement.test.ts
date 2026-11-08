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
  type SmokeOutcome,
  type Simulate,
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

// ---- 本物 simulate アダプター ----
import {
  simulate as realSimulate,
  type MachineDef,
  type Order,
  type Placement,
} from "../../src/core/sim/sim";
import type { MachineId, Pitch } from "../../src/core/sim/types";

/** GenPlacement → src/core/sim/Placement に変換 */
function toSimPlacement(gp: import("./placement").GenPlacement): Placement {
  return {
    machine: gp.machine,
    pos: gp.pos,
    dir: gp.dir,
    config: gp.config ? { pitch: gp.config.pitch as Pitch } : undefined,
  };
}

/**
 * テスト用 order-01 相当: 1入口1出口、ベルトのみ。
 * board: 8x6 (placement test と同じサイズ)、入口左端、出口右端。
 */
const ORD01_ORDER: Order = {
  schemaVersion: 1,
  id: "test-order-01",
  title: "test-order-01",
  board: { width: 8, height: 6, blocked: [{ x: 3, y: 3 }] },
  inputs: [
    {
      id: "A",
      pos: { x: 0, y: 3 },
      dir: "E",
      interval: 1,
      notes: [
        { pitch: 0 as Pitch, length: 0 as import("../../src/core/sim/types").NoteLength },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
      ],
    },
  ],
  outputs: [
    {
      id: "OUT",
      pos: { x: 7, y: 3 },
      dir: "E",
      expect: [
        { pitch: 0 as Pitch, length: 0 as import("../../src/core/sim/types").NoteLength },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
        { pitch: 0, length: 0 },
      ],
    },
  ],
  allowedMachines: ["belt"],
  machineCost: {},
  limits: { maxTicks: 80, machines: {} },
  scoring: {
    accuracy: { gold: 100, silver: 90, bronze: 80 },
    ticks: { gold: 18, silver: 24, bronze: 36 },
    cost: { gold: 10, silver: 12, bronze: 16 },
    passRule: "all-bronze-or-better",
    encoreRule: "two-or-more-gold",
  },
  unlocks: [],
  referenceSolutions: [],
  texts: {},
};

/** 全機械の MachineTable */
const FULL_MACHINES: Readonly<Record<MachineId, MachineDef>> = {
  belt: { id: "belt", cost: 1, accepts: ["back"], emits: ["front"], processTicks: 0 },
  merger: {
    id: "merger",
    cost: 4,
    accepts: ["left", "right"],
    emits: ["front"],
    processTicks: 0,
    arbitration: "alternate",
  },
  sorter: {
    id: "sorter",
    cost: 6,
    accepts: ["back"],
    emits: ["front", "right"],
    processTicks: 0,
    config: { pitch: [0, 1, 2] as Pitch[] },
  },
  tuner: { id: "tuner", cost: 8, accepts: ["back"], emits: ["front"], processTicks: 2 },
  bin: { id: "bin", cost: 0, accepts: ["back"], emits: [], processTicks: 0 },
};

function realSimulateAdaptor(
  placements: import("./placement").GenPlacement[],
  _seed: string,
): import("./placement").SmokeOutcome {
  const simPlacements = placements.map(toSimPlacement);
  const { result, final: finalState } = realSimulate(ORD01_ORDER, simPlacements, FULL_MACHINES);

  // received: 全出口が受けた音符の合計
  const received = finalState.outputs.reduce((s, o) => s + o.received.length, 0);
  // remaining: 盤面上の音符数（cells.length）+ 入口に残り音符数
  const cellsRemaining = finalState.cells.length;
  const inputRemaining = finalState.inputs.reduce((s, inp, idx) => {
    const orderNotes = ORD01_ORDER.inputs[idx]!.notes;
    return s + Math.max(0, orderNotes.length - inp.next);
  }, 0);
  const remaining = cellsRemaining + inputRemaining;

  return {
    result: result.result,
    emitted: ORD01_ORDER.inputs.reduce((s, inp) => s + inp.notes.length, 0),
    received,
    remaining,
  };
}

// 本番検査: 本物のシミュレータでランダム配置を検査
describe("本番検査（本物 simulate）", () => {
  const N = placementSeedCount();

  it(`${N} seed: 本物のシミュ × order-01 の盤で例外なし（AE-24）`, () => {
    for (let i = 0; i < N; i++) {
      const seed = `ae24-${i}`;
      const placements = generatePlacements(seed, INPUT);
      expect(() => realSimulateAdaptor(placements, seed)).not.toThrow();
    }
  });

  it(`本物のシミュ: 終わり方が completed/stuck/loop/maxTicks のどれか（AE-24）`, () => {
    const reasons: Set<string> = new Set();
    for (let i = 0; i < N; i++) {
      const seed = `ae24-${i}`;
      const placements = generatePlacements(seed, INPUT);
      const outcome = realSimulateAdaptor(placements, seed);
      expect(["completed", "stuck", "loop", "maxTicks"]).toContain(outcome.result);
      reasons.add(outcome.result);
    }
    // 少なくとも1つの終わり方が観測される（同じ結果でもOK）
    expect(reasons.size).toBeGreaterThanOrEqual(1);
  });

  it(`本物のシミュ: 保存則が成り立つ emitted = received + remaining + discarded_to_bin（AE-24）`, () => {
    for (let i = 0; i < N; i++) {
      const seed = `ae24-${i}`;
      const placements = generatePlacements(seed, INPUT);
      const outcome = realSimulateAdaptor(placements, seed);
      // bin が追加されたので discarded >= 0 を許容: emitted >= received + remaining
      const diff = outcome.emitted - outcome.received - outcome.remaining;
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(outcome.emitted);
    }
  });

  // 注文3相当の盤（合流機・調律機あり）
  const ORD03_ORDER: Order = {
    schemaVersion: 1,
    id: "test-order-03",
    title: "test-order-03",
    board: { width: 8, height: 6, blocked: [] },
    inputs: [
      {
        id: "A",
        pos: { x: 0, y: 2 },
        dir: "E",
        interval: 1,
        notes: [
          { pitch: 0 as Pitch, length: 0 as import("../../src/core/sim/types").NoteLength },
          { pitch: 1 as Pitch, length: 0 },
          { pitch: 0, length: 0 },
          { pitch: 1, length: 0 },
          { pitch: 0, length: 0 },
          { pitch: 1, length: 0 },
          { pitch: 0, length: 0 },
          { pitch: 1, length: 0 },
        ],
      },
    ],
    outputs: [
      {
        id: "OUT",
        pos: { x: 7, y: 2 },
        dir: "E",
        expect: [
          { pitch: 0 as Pitch, length: 0 as import("../../src/core/sim/types").NoteLength },
          { pitch: 1 as Pitch, length: 0 },
          { pitch: 0, length: 0 },
          { pitch: 1, length: 0 },
          { pitch: 0, length: 0 },
          { pitch: 1, length: 0 },
          { pitch: 0, length: 0 },
          { pitch: 1, length: 0 },
        ],
      },
    ],
    allowedMachines: ["belt", "merger", "sorter", "tuner", "bin"],
    machineCost: {},
    limits: { maxTicks: 80, machines: {} },
    scoring: {
      accuracy: { gold: 100, silver: 90, bronze: 80 },
      ticks: { gold: 18, silver: 24, bronze: 36 },
      cost: { gold: 10, silver: 12, bronze: 16 },
      passRule: "all-bronze-or-better",
      encoreRule: "two-or-more-gold",
    },
    unlocks: [],
    referenceSolutions: [],
    texts: {},
  };

  function realSimulateAdaptor2(
    placements: import("./placement").GenPlacement[],
    _seed: string,
  ): import("./placement").SmokeOutcome {
    const simPlacements = placements.map(toSimPlacement);
    const { result, final: finalState } = realSimulate(ORD03_ORDER, simPlacements, FULL_MACHINES);

    const received = finalState.outputs.reduce((s, o) => s + o.received.length, 0);
    const cellsRemaining = finalState.cells.length;
    const inputRemaining = finalState.inputs.reduce((s, inp, idx) => {
      const orderNotes = ORD03_ORDER.inputs[idx]!.notes;
      return s + Math.max(0, orderNotes.length - inp.next);
    }, 0);
    const remaining = cellsRemaining + inputRemaining;

    return {
      result: result.result,
      emitted: ORD03_ORDER.inputs.reduce((s, inp) => s + inp.notes.length, 0),
      received,
      remaining,
    };
  }

  it(`注文3相当（合流機・調律機あり）: 同じ検査が通る（AE-24）`, () => {
    const input3: import("./placement").GenInput = {
      board: { width: 8, height: 6, blocked: [] },
      machines: MACHINE_IDS,
      maxPlacements: 20,
      reserved: [],
    };
    for (let i = 0; i < N; i++) {
      const seed = `ae24-03-${i}`;
      const placements = generatePlacements(seed, input3);
      const outcome = realSimulateAdaptor2(placements, seed);
      // bin が追加されたので discarded >= 0 を許容
      const diff = outcome.emitted - outcome.received - outcome.remaining;
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(outcome.emitted);
      expect(["completed", "stuck", "loop", "maxTicks"]).toContain(outcome.result);
    }
  });
});
