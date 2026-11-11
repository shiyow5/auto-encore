import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMachines, parseOrder, parseSolution, totalCost } from "../../src/core/sim/load";
import type { Scoring, SimResult, Solution } from "../../src/core/sim/types";
import {
  accuracyMedal,
  accuracyPercent,
  judge,
  lowerIsBetterMedal,
  measure,
  score,
  toExpected,
} from "../../src/core/score";

const DATA = join(__dirname, "../../src/data");
const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(DATA, rel), "utf8"));

const machines = parseMachines(readJson("machines.json"));
const order01 = parseOrder(readJson("orders/order-01.json"), "orders/order-01.json");
const frugal = parseSolution(
  readJson("solutions/order-01-frugal.json"),
  "solutions/order-01-frugal.json",
  order01,
  machines,
);

/**
 * order-01 模範解の値（spec-e-mvp.md v0.3 §5 注文1、T2 #18 の expected）。
 * #18 マージ後は frugal.expected が入るので、下の「expected と一致」がそちらで比べる。
 * TODO(#18 マージ後): simulate() の結果で置き換え、この固定値を外す。
 */
const ORDER01_FRUGAL_EXPECTED = {
  result: "completed",
  accuracy: 100,
  ticks: 18,
  cost: 10,
} as const;

/** order-01 模範解を回したときの SimResult（T2 の simulate() の代わり）。 */
const frugalSim: SimResult = {
  result: "completed",
  ticks: 18,
  matched: 8,
  total: 8,
  cost: totalCost(frugal.placements, order01, machines),
  firstMismatch: null,
  finalHash: "fdb36a20d11f225b",
};

const th = (gold: number, silver: number, bronze: number) => ({ gold, silver, bronze });
const scoring: Scoring = {
  accuracy: th(100, 90, 80),
  ticks: th(10, 20, 30),
  cost: th(5, 10, 15),
  passRule: "all-bronze-or-better",
  encoreRule: "two-or-more-gold",
};
const sim = (over: Partial<SimResult>): SimResult => ({ ...frugalSim, ...over });

describe("order-01 模範解（frugal）", () => {
  it("コストは配置から出した totalCost と同じ（ベルト10本＝10G）", () => {
    expect(frugalSim.cost).toBe(10);
  });

  it("3指標が模範解の expected と一致する", () => {
    const want = frugal.expected ?? ORDER01_FRUGAL_EXPECTED;
    const got = toExpected(measure(frugalSim, order01, frugal), frugalSim.finalHash);
    expect({ ...got, finalHash: undefined }).toEqual({ ...want, finalHash: undefined });
    expect(got).toMatchObject(ORDER01_FRUGAL_EXPECTED);
  });

  it("注文の scoring で判定すると3指標すべて金・合格・Encore", () => {
    const r = score(frugalSim, order01, frugal);
    expect(r.medals).toEqual({ accuracy: "gold", ticks: "gold", cost: "gold" });
    expect(r.passed).toBe(true);
    expect(r.encore).toBe(true);
  });
});

describe("firstMismatch", () => {
  it("ずれなし（null）なら measure でも null", () => {
    const m = measure(frugalSim, order01, frugal);
    expect(m.firstMismatch).toBeNull();
  });

  it("ずれた場合は数値（1始まり）", () => {
    const m = measure(
      sim({ result: "stuck", ticks: null, matched: 3, total: 8, firstMismatch: 5 }),
      order01,
      frugal,
    );
    expect(m.firstMismatch).toBe(5);
  });
});

describe("measure", () => {
  it("止まったら速度なし（ticks null）で、正確さは途中までの値", () => {
    const m = measure(sim({ result: "stuck", ticks: null, matched: 3 }), order01, frugal);
    expect(m).toMatchObject({ result: "stuck", ticks: null, accuracy: 37, matched: 3, total: 8 });
  });

  it("別の注文の解は受けない", () => {
    const other: Solution = { ...frugal, orderId: "order-02" };
    expect(() => measure(frugalSim, order01, other)).toThrow("order-02 の解");
  });

  it("result と ticks の食い違い・matched > total は受けない", () => {
    expect(() => measure(sim({ ticks: null }), order01, frugal)).toThrow("ticks=null");
    expect(() => measure(sim({ result: "loop" }), order01, frugal)).toThrow("result=loop");
    expect(() => measure(sim({ matched: 9 }), order01, frugal)).toThrow("matched=9");
  });
});

describe("正確さ", () => {
  it("表示用 % は切り捨て、total 0 は 0", () => {
    expect(accuracyPercent(2, 3)).toBe(66);
    expect(accuracyPercent(8, 8)).toBe(100);
    expect(accuracyPercent(0, 0)).toBe(0);
  });

  it("判定は整数で matched*100 >= 閾値*total（境界ちょうどは届く）", () => {
    // 9/10 = 90% ちょうど → 銀。17/19 = 89.47% は銀に届かない → 銅
    expect(accuracyMedal(9, 10, scoring.accuracy)).toBe("silver");
    expect(accuracyMedal(17, 19, scoring.accuracy)).toBe("bronze");
    expect(accuracyMedal(10, 10, scoring.accuracy)).toBe("gold");
    expect(accuracyMedal(7, 10, scoring.accuracy)).toBe("none");
    expect(accuracyMedal(0, 0, scoring.accuracy)).toBe("none");
  });
});

describe("速度・コスト（小さいほど良い）", () => {
  it("境界ちょうどはそのメダル、超えたら次", () => {
    expect(lowerIsBetterMedal(10, scoring.ticks)).toBe("gold");
    expect(lowerIsBetterMedal(11, scoring.ticks)).toBe("silver");
    expect(lowerIsBetterMedal(20, scoring.ticks)).toBe("silver");
    expect(lowerIsBetterMedal(30, scoring.ticks)).toBe("bronze");
    expect(lowerIsBetterMedal(31, scoring.ticks)).toBe("none");
  });

  it("速度なし（null）は none", () => {
    expect(lowerIsBetterMedal(null, scoring.ticks)).toBe("none");
  });
});

describe("judge（閾値は引数で受けるだけ）", () => {
  const m = (over: Partial<SimResult>) => measure(sim(over), order01, frugal);

  it("金2つ＋銅1つ → 合格・Encore", () => {
    const r = judge(m({ ticks: 10, cost: 15 }), scoring);
    expect(r.medals).toEqual({ accuracy: "gold", ticks: "gold", cost: "bronze" });
    expect([r.passed, r.encore]).toEqual([true, true]);
  });

  it("金1つ → 合格だが Encore ではない", () => {
    const r = judge(m({ ticks: 20, cost: 10 }), scoring);
    expect(r.medals).toEqual({ accuracy: "gold", ticks: "silver", cost: "silver" });
    expect([r.passed, r.encore]).toEqual([true, false]);
  });

  it("1つでも none なら不合格（金が2つあっても Encore にならない）", () => {
    const r = judge(m({ ticks: 10, cost: 16 }), scoring);
    expect(r.medals.cost).toBe("none");
    expect([r.passed, r.encore]).toEqual([false, false]);
  });

  it("詰まって止まったら速度なし＝不合格", () => {
    const r = judge(m({ result: "stuck", ticks: null }), scoring);
    expect(r.medals.ticks).toBe("none");
    expect([r.passed, r.encore]).toEqual([false, false]);
  });

  it("失敗: 正確さ 0/8・未完走ならコストが閾値内でも none", () => {
    const r = judge(m({ result: "stuck", ticks: null, matched: 0, cost: 0 }), scoring);
    expect(r.medals).toEqual({ accuracy: "none", ticks: "none", cost: "none" });
    expect([r.passed, r.encore]).toEqual([false, false]);
  });

  it("失敗: 正確さ none でも完走していればコストは none", () => {
    const r = judge(m({ matched: 0, cost: 3 }), scoring);
    expect(r.medals.accuracy).toBe("none");
    expect(r.medals.cost).toBe("none");
    expect([r.passed, r.encore]).toEqual([false, false]);
  });

  it("失敗: 正確さ十分でも完走しなければコストは none", () => {
    const r = judge(m({ result: "stuck", ticks: null, cost: 3 }), scoring);
    expect(r.medals.cost).toBe("none");
  });

  it.each([
    [5, "gold", true, true],
    [10, "silver", true, true],
    [15, "bronze", true, true],
    [16, "none", false, false],
  ] as const)(
    "成功: cost=%i → %s（従来通り, passed=%s encore=%s）",
    (cost, medal, passed, encore) => {
      const r = judge(m({ ticks: 10, cost }), scoring);
      expect(r.medals.cost).toBe(medal);
      expect([r.passed, r.encore]).toEqual([passed, encore]);
    },
  );

  it("同じ結果でも閾値を変えればメダルが変わる（値を持っていない）", () => {
    const strict: Scoring = { ...scoring, cost: th(9, 9, 9) };
    expect(judge(m({}), scoring).medals.cost).toBe("silver");
    expect(judge(m({}), strict).medals.cost).toBe("none");
  });
});

describe("firstMismatch", () => {
  it("null のときは表示値も null", () => {
    const m = measure(frugalSim, order01, frugal);
    expect(m.firstMismatch).toBeNull();
  });

  it("ずれた位置が 1 始まりの番号で入る", () => {
    // matched=7, total=8, firstMismatch=5 のケース（8中5番目にずれる）
    const m = measure(
      sim({ result: "completed", matched: 7, total: 8, firstMismatch: 5 }),
      order01,
      frugal,
    );
    expect(m.firstMismatch).toBe(5);
  });

  it("judge の metrics.firstMismatch は伝搬する", () => {
    const simRes: SimResult = {
      result: "completed",
      ticks: 18,
      matched: 7,
      total: 8,
      cost: frugalSim.cost,
      firstMismatch: 3,
      finalHash: "abc",
    };
    const r = score(simRes, order01, frugal);
    expect(r.metrics.firstMismatch).toBe(3);
  });
});
