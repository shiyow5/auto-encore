/** テスト用の小さな注文を組み立てる（盤・入口・出口だけ指定し、残りは既定値）。 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMachines, parseOrder } from "../../src/core/sim/load";
import type { MachineId, Order } from "../../src/core/sim/types";

export const machines = parseMachines(
  JSON.parse(readFileSync(join(__dirname, "../../src/data/machines.json"), "utf8")),
);

export interface MiniPort {
  readonly id: string;
  readonly pos: [number, number];
  readonly dir: "N" | "E" | "S" | "W";
}

export function miniOrder(o: {
  width: number;
  height: number;
  inputs: (MiniPort & { notes: string[]; interval?: number })[];
  outputs: (MiniPort & { expect: string[] })[];
  allowed: MachineId[];
  maxTicks?: number;
}): Order {
  return parseOrder(
    {
      schemaVersion: 1,
      id: "order-92",
      title: "テスト盤",
      client: { id: "test", name: "テスト" },
      texts: { intro: "-", tutorial: "-", result: { encore: "-", pass: "-", fail: "-" } },
      board: { width: o.width, height: o.height, blocked: [] },
      inputs: o.inputs.map((i) => ({
        id: i.id,
        pos: i.pos,
        dir: i.dir,
        emit: { interval: i.interval ?? 1, notes: i.notes },
      })),
      outputs: o.outputs.map((x) => ({ id: x.id, pos: x.pos, dir: x.dir, expect: x.expect })),
      allowedMachines: o.allowed,
      limits: { maxTicks: o.maxTicks ?? 80 },
      scoring: {
        accuracy: { gold: 100, silver: 90, bronze: 80, unit: "percent" },
        ticks: { gold: 18, silver: 24, bronze: 36 },
        cost: { gold: 10, silver: 12, bronze: 16 },
        passRule: "all-bronze-or-better",
        encoreRule: "two-or-more-gold",
      },
      unlocks: [],
      referenceSolutions: [],
    },
    "order-92.json",
  );
}
