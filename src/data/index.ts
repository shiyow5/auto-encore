/**
 * 同梱データ（machines / orders / solutions）を検証して読み込む。画面側はここから取る。
 * 検証に失敗したら起動時に DataError を投げる（壊れたデータで遊ばせない）。
 */
import { parseMachines, parseOrder, parseSolution } from "../core/sim/load";
import type { MachineTable, Order, Solution } from "../core/sim/types";
import machinesJson from "./machines.json";

const orderFiles = import.meta.glob<unknown>("./orders/*.json", { eager: true, import: "default" });
const solutionFiles = import.meta.glob<unknown>("./solutions/*.json", {
  eager: true,
  import: "default",
});

export interface GameData {
  readonly machines: MachineTable;
  /** id 昇順。 */
  readonly orders: readonly Order[];
  /** キーは "solutions/order-01-frugal.json" の形（注文 JSON の referenceSolutions と同じ）。 */
  readonly solutions: Readonly<Record<string, Solution>>;
}

export function loadGameData(): GameData {
  const machines = parseMachines(machinesJson, "machines.json");
  const orders = Object.keys(orderFiles)
    .sort()
    .map((path) => parseOrder(orderFiles[path], path.slice(2)));
  const solutions: Record<string, Solution> = {};
  for (const order of orders) {
    for (const ref of order.referenceSolutions) {
      const json = solutionFiles[`./${ref}`];
      if (json === undefined) {
        throw new Error(`orders/${order.id}.json: referenceSolutions: ${ref} が無い`);
      }
      solutions[ref] = parseSolution(json, ref, order, machines);
    }
  }
  return { machines, orders, solutions };
}
