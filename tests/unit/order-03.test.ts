/* eslint-disable @typescript-eslint/no-explicit-any -- テストで JSON を読むため */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMachines, parseOrder, parseSolution } from "../../src/core/sim/load";
import { accuracyPercent, simulate } from "../../src/core/sim/sim";

// 合流機（#32）・調律機（#34）は main に入った。
const READY = true;
const suite = READY ? describe : describe.skip;

const SRC = join(__dirname, "../../src/data");
const FIX = join(__dirname, "../fixtures");
const readJson = (p: string): any => JSON.parse(readFileSync(p, "utf8"));
const machines = parseMachines(readJson(join(SRC, "machines.json")));
const order = parseOrder(readJson(join(SRC, "orders/order-03.json")), "orders/order-03.json");
const load = (path: string, ref: string) => parseSolution(readJson(path), ref, order, machines);

suite("注文3（入口 A・B・C1・C2）の参照解（Issue #4）", () => {
  for (const ref of order.referenceSolutions) {
    it(`${ref}: 正確さ100%・maxTicks 内で完了し、expected と完全一致する`, () => {
      const sol = load(join(SRC, ref), ref);
      const { result } = simulate(order, sol.placements, machines);
      expect(result.result).toBe("completed");
      expect(accuracyPercent(result)).toBe(100);
      expect(result.ticks).toBeLessThanOrEqual(order.limits.maxTicks);
      expect({
        result: result.result,
        accuracy: accuracyPercent(result),
        ticks: result.ticks,
        cost: result.cost,
        finalHash: result.finalHash,
      }).toEqual(sol.expected);
    });
  }

  it("倹約型は調律機1台・速度型は2台", () => {
    const count = (ref: string) =>
      load(join(SRC, ref), ref).placements.filter((p) => p.machine === "tuner").length;
    expect(count("solutions/order-03-frugal.json")).toBe(1);
    expect(count("solutions/order-03-speed.json")).toBe(2);
  });

  it("手抜き型（調律機なし）は不合格（正確さ 50% < 銅 80%）", () => {
    const p = join(FIX, "solutions-fail/order-03-no-tuner.json");
    const sol = load(p, "order-03-no-tuner.json");
    const { result } = simulate(order, sol.placements, machines);
    expect(accuracyPercent(result)).toBe(50);
    expect(accuracyPercent(result)).toBeLessThan(order.scoring.accuracy.bronze);
  });

  it("3指標すべて金の参照解はない（spec §4 / Q12）", () => {
    for (const ref of order.referenceSolutions) {
      const { result } = simulate(order, load(join(SRC, ref), ref).placements, machines);
      const golds = [
        accuracyPercent(result) >= order.scoring.accuracy.gold,
        result.ticks !== null && result.ticks <= order.scoring.ticks.gold,
        result.cost <= order.scoring.cost.gold,
      ].filter(Boolean).length;
      expect(golds).toBeLessThan(3);
    }
  });
});
