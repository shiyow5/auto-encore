/**
 * 工房の配置（placements[]）を変える純粋関数。画面（WorkshopScene）はここ経由でしか配置を変えない。
 *
 * - 形は core の Solution.placements と同じ `Placement[]`。そのまま Solution に入れて step() に渡せる
 * - 1マスに置けるのは1台まで。入口・出口・blocked のマスと盤の外には置けない
 * - 配列は毎回新しく作る（元の配列は変えない）。並びは「置いた順」
 * - 仕分け機は config.pitch を持つ。候補は machines.json の sorter.config.pitch（ここでは決め打ちしない）
 */
import { rotateCW } from "../../core/grid";
import type { Dir, Point } from "../../core/grid";
import type { MachineId, MachineTable, Order, Pitch, Placement } from "../../core/sim/types";

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

/**
 * 注文から工房のルールを作る。allowed を渡すと「置ける機械」をそれに差し替える
 * （工房の棚は machines.json の全機械を出し、注文で使えるかは「実行」時の検証に任せるため）。
 */
export function rulesFor(order: Order, allowed?: readonly MachineId[]): WorkshopRules {
  return {
    width: order.board.width,
    height: order.board.height,
    reserved: [
      ...order.inputs.map((i) => ({ pos: i.pos, kind: "input" as const, id: i.id, dir: i.dir })),
      ...order.outputs.map((o) => ({ pos: o.pos, kind: "output" as const, id: o.id, dir: o.dir })),
      ...order.board.blocked.map((p) => ({ pos: p, kind: "blocked" as const })),
    ],
    allowed: allowed ?? order.allowedMachines,
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

/** その機械に設定できる音高の候補（machines.json の config.pitch）。設定の無い機械は空。 */
export function pitchChoices(machines: MachineTable, machine: MachineId): readonly Pitch[] {
  return machines[machine].config?.pitch ?? [];
}

/** 候補の中で pitch の次（最後なら最初へ戻る）。候補に無い pitch なら最初の候補。 */
export function nextPitch(choices: readonly Pitch[], pitch: Pitch): Pitch {
  const first = choices[0];
  if (first === undefined) throw new Error("音高の候補が1つもない");
  const i = choices.indexOf(pitch);
  return i < 0 ? first : (choices[(i + 1) % choices.length] ?? first);
}

/**
 * 置く。同じマスにもう置いてあれば置き換える（向きの付け直しにも使える）。
 * 音高の候補がある機械（仕分け機）は config.pitch を付ける。pitch を省くと候補の先頭。
 * pitch が候補に無いときは置かない。
 */
export function place(
  list: readonly Placement[],
  rules: WorkshopRules,
  machine: MachineId,
  pos: Point,
  dir: Dir,
  machines?: MachineTable,
  pitch?: Pitch,
): Change {
  const err = whyNot(rules, machine, pos);
  if (err) return { ok: false, error: err };
  const choices = machines ? pitchChoices(machines, machine) : [];
  if (machines && machines[machine].config && choices.length === 0) {
    return { ok: false, error: "音高の候補が無い" };
  }
  let config: Placement["config"];
  if (choices.length > 0) {
    const chosen = pitch ?? choices[0]!;
    if (!choices.includes(chosen)) return { ok: false, error: "その音高はこの機械に設定できない" };
    config = { pitch: chosen };
  }
  const next: Placement = config
    ? { machine, pos: { x: pos.x, y: pos.y }, dir, config }
    : { machine, pos: { x: pos.x, y: pos.y }, dir };
  const rest = list.filter((p) => !samePos(p.pos, pos));
  return { ok: true, placements: [...rest, next] };
}

/** そのマスの機械を時計回りに90°回す。何も無ければ同じ配列を返す。 */
export function rotateAt(list: readonly Placement[], pos: Point): readonly Placement[] {
  if (!placementAt(list, pos)) return list;
  return list.map((p) => (samePos(p.pos, pos) ? { ...p, dir: rotateCW(p.dir) } : p));
}

/**
 * そのマスの機械の音高を次の候補へ回す（仕分け機の音高切替）。
 * 機械が無い・音高の設定が無い機械なら同じ配列を返す。
 */
export function cyclePitchAt(
  list: readonly Placement[],
  machines: MachineTable,
  pos: Point,
): readonly Placement[] {
  const p = placementAt(list, pos);
  if (!p) return list;
  const choices = pitchChoices(machines, p.machine);
  if (choices.length === 0) return list;
  const pitch = nextPitch(choices, p.config?.pitch ?? choices[0]!);
  return list.map((q) => (q === p ? { ...q, config: { pitch } } : q));
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
