/**
 * 工房の配置（placements[]）を変える純粋関数。画面（WorkshopScene）はここ経由でしか配置を変えない。
 *
 * - 形は core の Solution.placements と同じ `Placement[]`。そのまま Solution に入れて step() に渡せる
 * - 1マスに置けるのは1台まで。入口・出口・blocked のマスと盤の外には置けない
 * - 配列は毎回新しく作る（元の配列は変えない）。並びは「置いた順」
 */
import { rotateCW } from "../../core/grid";
import type { Dir, Point } from "../../core/grid";
import type { MachineId, MachineTable, Order, Placement } from "../../core/sim/types";

export interface Reserved {
  readonly pos: Point;
  readonly kind: "input" | "output" | "blocked";
  readonly id?: string;
  readonly dir?: Dir;
}

export interface WorkshopRules {
  readonly width: number;
  readonly height: number;
  readonly reserved: readonly Reserved[];
  readonly allowed: readonly MachineId[];
}

export function rulesFor(order: Order): WorkshopRules {
  return {
    width: order.board.width,
    height: order.board.height,
    reserved: [
      ...order.inputs.map((i) => ({ pos: i.pos, kind: "input" as const, id: i.id, dir: i.dir })),
      ...order.outputs.map((o) => ({ pos: o.pos, kind: "output" as const, id: o.id, dir: o.dir })),
      ...order.board.blocked.map((p) => ({ pos: p, kind: "blocked" as const })),
    ],
    allowed: order.allowedMachines,
  };
}

export function samePos(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function reservedAt(rules: WorkshopRules, pos: Point): Reserved | undefined {
  return rules.reserved.find((r) => samePos(r.pos, pos));
}

export function placementAt(list: readonly Placement[], pos: Point): Placement | undefined {
  return list.find((p) => samePos(p.pos, pos));
}

/** 置けないときは理由（画面にそのまま出す文）、置けるなら null。 */
export function whyNot(rules: WorkshopRules, machine: MachineId, pos: Point): string | null {
  if (pos.x < 0 || pos.y < 0 || pos.x >= rules.width || pos.y >= rules.height) {
    return "盤の外には置けない";
  }
  if (!rules.allowed.includes(machine)) return "この注文では使えない機械";
  const r = reservedAt(rules, pos);
  if (r?.kind === "input") return "入口のマスには置けない";
  if (r?.kind === "output") return "出口のマスには置けない";
  if (r?.kind === "blocked") return "ふさがっているマス";
  return null;
}

export type Change =
  | { readonly ok: true; readonly placements: readonly Placement[] }
  | { readonly ok: false; readonly error: string };

/** 置く。同じマスにもう置いてあれば置き換える（向きの付け直しにも使える）。 */
export function place(
  list: readonly Placement[],
  rules: WorkshopRules,
  machine: MachineId,
  pos: Point,
  dir: Dir,
): Change {
  const err = whyNot(rules, machine, pos);
  if (err) return { ok: false, error: err };
  const next: Placement = { machine, pos: { x: pos.x, y: pos.y }, dir };
  const rest = list.filter((p) => !samePos(p.pos, pos));
  return { ok: true, placements: [...rest, next] };
}

/** そのマスの機械を時計回りに90°回す。何も無ければ同じ配列を返す。 */
export function rotateAt(list: readonly Placement[], pos: Point): readonly Placement[] {
  if (!placementAt(list, pos)) return list;
  return list.map((p) => (samePos(p.pos, pos) ? { ...p, dir: rotateCW(p.dir) } : p));
}

/** そのマスの機械を消す。何も無ければ同じ配列を返す。 */
export function removeAt(list: readonly Placement[], pos: Point): readonly Placement[] {
  if (!placementAt(list, pos)) return list;
  return list.filter((p) => !samePos(p.pos, pos));
}

/** 総コスト（G）。注文の machineCost があればそれ、無ければ machines.json の cost。 */
export function totalCost(
  list: readonly Placement[],
  machines: MachineTable,
  order: Pick<Order, "machineCost">,
): number {
  let sum = 0;
  for (const p of list) sum += order.machineCost[p.machine] ?? machines[p.machine].cost;
  return sum;
}
