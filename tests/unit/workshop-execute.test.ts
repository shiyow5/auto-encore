import { describe, expect, it } from "vitest";
import { loadGameData } from "../../src/data";
import type { Placement } from "../../src/core/sim/types";
import {
  execute,
  metricRows,
  toSolution,
  verdictMessage,
  verdictOf,
} from "../../src/scenes/workshop/execute";

const data = loadGameData();
const order = data.orders.find((o) => o.id === "order-01");
if (!order) throw new Error("order-01 が無い");
const frugal = data.solutions["solutions/order-01-frugal.json"];
if (!frugal) throw new Error("order-01-frugal が無い");

const belt = (x: number, y: number, dir: Placement["dir"] = "E"): Placement => ({
  machine: "belt",
  pos: { x, y },
  dir,
});

describe("工房の実行（order-01）", () => {
  it("模範解（ベルト10本）: 完成・ゴールデンと同じ3指標・アンコール", () => {
    const ex = execute(order, data.machines, frugal.placements);
    const m = ex.report.metrics;
    expect(m.result).toBe("completed");
    expect({ accuracy: m.accuracy, ticks: m.ticks, cost: m.cost }).toEqual({
      accuracy: frugal.expected?.accuracy,
      ticks: frugal.expected?.ticks,
      cost: frugal.expected?.cost,
    });
    expect(ex.finalHash).toBe(frugal.expected?.finalHash);
    expect(verdictOf(ex.report)).toBe("encore");
    expect(verdictMessage(order, "encore")).toBe("いいね。これなら朝から流せるよ。");
  });

  it("frames は tick 0〜完成 tick まで全部ある（音符の再描画用）", () => {
    const ex = execute(order, data.machines, frugal.placements);
    expect(ex.frames).toHaveLength((ex.report.metrics.ticks ?? 0) + 1);
    expect(ex.frames[0]?.tick).toBe(0);
    expect(ex.frames.at(-1)?.tick).toBe(ex.report.metrics.ticks);
    // 途中の tick ではベルト上に音符がいる
    expect(ex.frames.some((f) => f.cells.length > 0)).toBe(true);
  });

  it("表の行: 正確さ・速度・コストの順に数値とメダル", () => {
    const rows = metricRows(execute(order, data.machines, frugal.placements).report);
    expect(rows.map((r) => [r.label, r.value, r.medal])).toEqual([
      ["正確さ", "100%（8/8）", "gold"],
      ["速度", "18 tick", "gold"],
      ["コスト", "10G", "gold"],
    ]);
  });

  it("途中が切れていると詰まる: 速度は記録なし・不合格", () => {
    const placements = frugal.placements.filter((p) => p.pos.x !== 6);
    const ex = execute(order, data.machines, placements);
    expect(ex.report.metrics.result).not.toBe("completed");
    expect(ex.report.metrics.ticks).toBeNull();
    expect(verdictOf(ex.report)).toBe("fail");
    const rows = metricRows(ex.report);
    expect(rows[0]?.value).toBe("0%（0/8）");
    expect(rows[1]).toMatchObject({ value: "記録なし", medal: "none" });
    expect(rows[2]?.value).toBe("9G");
  });

  it("何も置かずに実行しても落ちない（0台・0G）", () => {
    const ex = execute(order, data.machines, []);
    expect(ex.report.metrics.cost).toBe(0);
    expect(ex.report.passed).toBe(false);
  });

  it("置けない配置（入口のマス）は DataError", () => {
    expect(() => execute(order, data.machines, [belt(0, 3)])).toThrow(/入口/);
  });

  it("toSolution は注文 ID を持った Solution", () => {
    expect(toSolution(order, [belt(1, 3)])).toEqual({
      schemaVersion: 1,
      orderId: "order-01",
      name: "player",
      placements: [belt(1, 3)],
    });
  });
});
