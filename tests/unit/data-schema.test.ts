/**
 * #5: 同梱データ（src/data/orders/*.json・src/data/solutions/*.json）を JSON Schema と load.ts の両方で全件検証する。
 * あわせて Schema の列挙・上限が load.ts / types.ts と食い違っていないか、参照パスが実在するかを見る。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DIRS } from "../../src/core/grid";
import { accuracyMedal, lowerIsBetterMedal, type Medal } from "../../src/core/score";
import { MAX_TICKS_CAP, parseMachines } from "../../src/core/sim/load";
import {
  LENGTH_NAMES,
  MACHINE_IDS,
  PITCH_NAMES,
  type MedalThresholds,
} from "../../src/core/sim/types";
import { loadGameData } from "../../src/data";
import {
  formatErrors,
  orderSchema,
  solutionSchema,
  validateOrderSchema,
  validateSolutionSchema,
} from "../helpers/schema";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DATA = path.join(ROOT, "src/data");
const PUBLIC = path.join(ROOT, "public");
const readJson = (abs: string): unknown => JSON.parse(fs.readFileSync(abs, "utf8"));
const listJson = (dir: string): string[] =>
  fs
    .readdirSync(path.join(DATA, dir))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => `${dir}/${f}`);

const orderFiles = listJson("orders");
const solutionFiles = listJson("solutions");
const data = loadGameData();

describe("同梱データを Schema で全件検証", () => {
  it("注文と参照解が1件以上ある", () => {
    expect(orderFiles.length).toBeGreaterThan(0);
    expect(solutionFiles.length).toBeGreaterThan(0);
  });

  it.each(orderFiles)("%s は order.schema.json を通る", (rel) => {
    const json = readJson(path.join(DATA, rel));
    expect(validateOrderSchema(json), formatErrors(validateOrderSchema.errors)).toBe(true);
  });

  it.each(solutionFiles)("%s は solution.schema.json を通る", (rel) => {
    const json = readJson(path.join(DATA, rel));
    expect(validateSolutionSchema(json), formatErrors(validateSolutionSchema.errors)).toBe(true);
  });

  it("loadGameData（parseOrder / parseSolution）が全件通る", () => {
    expect(data.orders.map((o) => `orders/${o.id}.json`)).toEqual(orderFiles);
  });
});

describe("参照パスが実在する", () => {
  it("注文のファイル名と id が一致", () => {
    for (const o of data.orders) expect(orderFiles).toContain(`orders/${o.id}.json`);
  });

  it("referenceSolutions はすべて実在し、solutions/ に注文から参照されない孤児が無い", () => {
    const refs = data.orders.flatMap((o) => o.referenceSolutions);
    for (const r of refs) expect(fs.existsSync(path.join(DATA, r)), r).toBe(true);
    expect([...refs].sort()).toEqual(solutionFiles);
  });

  it("参照解の orderId・ファイル名が参照元の注文と一致", () => {
    for (const o of data.orders) {
      for (const r of o.referenceSolutions) {
        const s = data.solutions[r]!;
        expect(s.orderId, r).toBe(o.id);
        expect(r, r).toBe(`solutions/${o.id}-${s.name}.json`);
      }
    }
  });

  it("unlocks は実在する注文", () => {
    const ids = new Set(data.orders.map((o) => o.id));
    for (const o of data.orders)
      for (const u of o.unlocks) expect(ids.has(u), `${o.id} → ${u}`).toBe(true);
  });

  it("client.portrait（立ち絵、public/ からの相対）があれば実在する", () => {
    for (const rel of orderFiles) {
      const json = readJson(path.join(DATA, rel)) as { client?: { portrait?: string } };
      const p = json.client?.portrait;
      if (p !== undefined) expect(fs.existsSync(path.join(PUBLIC, p)), `${rel}: ${p}`).toBe(true);
    }
  });
});

describe("Schema と load.ts / types.ts の定義が食い違わない", () => {
  const defs = orderSchema.$defs;
  const placement = solutionSchema.properties.placements.items;
  const machines = parseMachines(readJson(path.join(DATA, "machines.json")));

  it("機械・向き・音高の列挙", () => {
    expect(defs.machineId.enum).toEqual([...MACHINE_IDS]);
    expect(placement.properties.machine.enum).toEqual([...MACHINE_IDS]);
    expect(defs.dir.enum).toEqual([...DIRS]);
    expect(placement.properties.dir.enum).toEqual([...DIRS]);
    expect(placement.properties.config.properties.pitch.enum).toEqual([...PITCH_NAMES]);
    expect(defs.note.enum).toEqual(
      LENGTH_NAMES.flatMap((l) => PITCH_NAMES.map((p) => `${p}:${l}`)),
    );
  });

  it("maxTicks の上限", () => {
    expect(orderSchema.properties.limits.properties.maxTicks.maximum).toBe(MAX_TICKS_CAP);
    expect(solutionSchema.properties.expected.properties.ticks.maximum).toBe(MAX_TICKS_CAP);
  });

  it("config を持つ機械（Schema では if/then の sorter）が machines.json と一致", () => {
    const withConfig = MACHINE_IDS.filter((id) => machines[id].config !== undefined);
    expect(withConfig).toEqual([placement.if.properties.machine.const]);
  });
});

describe("メダル境界（閾値ちょうど／±1、全注文の実際の閾値で）", () => {
  const tiers = ["gold", "silver", "bronze"] as const;

  for (const o of data.orders) {
    describe(o.id, () => {
      it("正確さ: 一致数×100 >= 閾値×総数（ちょうどは届く、-1 は届かない）", () => {
        const th: MedalThresholds = o.scoring.accuracy;
        for (const tier of tiers) {
          const t = th[tier];
          // 総数 100 なら一致数 = %。ちょうど・+1 はそのメダル以上、-1 はそのメダル未満。
          expect(rank(accuracyMedal(t, 100, th)), `${tier} ちょうど`).toBeGreaterThanOrEqual(
            rank(tier),
          );
          if (t < 100)
            expect(rank(accuracyMedal(t + 1, 100, th))).toBeGreaterThanOrEqual(rank(tier));
          if (t > 0) expect(rank(accuracyMedal(t - 1, 100, th))).toBeLessThan(rank(tier));
        }
      });

      for (const key of ["ticks", "cost"] as const) {
        it(`${key}: 値 <= 閾値（ちょうどは届く、+1 は届かない）`, () => {
          const th = o.scoring[key];
          for (const tier of tiers) {
            const t = th[tier];
            expect(rank(lowerIsBetterMedal(t, th))).toBeGreaterThanOrEqual(rank(tier));
            if (t > 0)
              expect(rank(lowerIsBetterMedal(t - 1, th))).toBeGreaterThanOrEqual(rank(tier));
            expect(rank(lowerIsBetterMedal(t + 1, th))).toBeLessThan(rank(tier));
          }
        });
      }
    });
  }
});

function rank(m: Medal): number {
  return ["none", "bronze", "silver", "gold"].indexOf(m);
}
