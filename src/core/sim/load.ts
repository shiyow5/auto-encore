/**
 * machines.json / orders/*.json / solutions/*.json の読み込みと検証。
 * 引数は JSON.parse 済みの unknown。検証に通ったものだけを types.ts の形で返す。
 */
import { DIRS, type Dir, type Point } from "../grid";
import {
  LENGTH_NAMES,
  MACHINE_IDS,
  PITCH_NAMES,
  SIDES,
  type Board,
  type ExpectedResult,
  type InputDef,
  type MachineDef,
  type MachineId,
  type MachineTable,
  type MedalThresholds,
  type Note,
  type NoteLength,
  type Order,
  type OutputDef,
  type Pitch,
  type Placement,
  type Scoring,
  type Side,
  type Solution,
  type StopReason,
} from "./types";
import {
  Ctx,
  expectArray,
  expectEnum,
  expectInt,
  expectKeys,
  expectLiteral,
  expectObject,
  expectString,
} from "./validate";

/** core が受け付ける tick の上限（review-e-tech (c)）。 */
export const MAX_TICKS_CAP = 2000;
const MAX_INT = 1_000_000;

// ---------- 小さな部品 ----------

export function parsePitch(v: unknown, c: Ctx): Pitch {
  return PITCH_NAMES.indexOf(expectEnum(v, PITCH_NAMES, c)) as Pitch;
}

/** "do:short" → { pitch: 0, length: 0 } */
export function parseNote(v: unknown, c: Ctx): Note {
  const s = expectString(v, c);
  const [p, l, ...rest] = s.split(":");
  if (rest.length > 0 || p === undefined || l === undefined) {
    c.fail(`音符は "音高:長さ" の形（例 "do:short"、実際: ${JSON.stringify(s)}）`);
  }
  const pitch = PITCH_NAMES.indexOf(expectEnum(p, PITCH_NAMES, c)) as Pitch;
  const length = LENGTH_NAMES.indexOf(expectEnum(l, LENGTH_NAMES, c)) as NoteLength;
  return { pitch, length };
}

export function noteToString(n: Note): string {
  return `${PITCH_NAMES[n.pitch]}:${LENGTH_NAMES[n.length]}`;
}

function parsePos(v: unknown, c: Ctx): Point {
  const a = expectArray(v, c);
  if (a.length !== 2) c.fail("座標は [x, y] の2要素");
  return { x: expectInt(a[0], c.at(0), 0, MAX_INT), y: expectInt(a[1], c.at(1), 0, MAX_INT) };
}

function parseDir(v: unknown, c: Ctx): Dir {
  return expectEnum(v, DIRS, c);
}

function parseSides(v: unknown, c: Ctx): Side[] {
  const a = expectArray(v, c).map((s, i) => expectEnum(s, SIDES, c.at(i)));
  if (new Set(a).size !== a.length) c.fail("同じ辺が重複している");
  return a;
}

function parseCostMap(v: unknown, c: Ctx): Partial<Record<MachineId, number>> {
  const o = expectObject(v, c);
  const out: Partial<Record<MachineId, number>> = {};
  for (const k of Object.keys(o).sort()) {
    const id = expectEnum(k, MACHINE_IDS, c.at(k));
    out[id] = expectInt(o[k], c.at(k), 0, MAX_INT);
  }
  return out;
}

function samePos(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function inBoard(p: Point, b: Board): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < b.width && p.y < b.height;
}

// ---------- machines.json ----------

export function parseMachines(json: unknown, file = "machines.json"): MachineTable {
  const root = new Ctx(file);
  const o = expectObject(json, root);
  expectKeys(o, ["schemaVersion", "machines"], [], root);
  expectLiteral(o.schemaVersion, 1, root.at("schemaVersion"));
  const list = expectArray(o.machines, root.at("machines"));
  const table: Partial<Record<MachineId, MachineDef>> = {};
  list.forEach((raw, i) => {
    const c = root.at("machines").at(i);
    const m = expectObject(raw, c);
    expectKeys(m, ["id", "cost", "accepts", "emits", "processTicks"], ["arbitration", "config"], c);
    const id = expectEnum(m.id, MACHINE_IDS, c.at("id"));
    if (table[id]) c.at("id").fail(`機械 "${id}" が重複している`);
    const def: MachineDef = {
      id,
      cost: expectInt(m.cost, c.at("cost"), 0, MAX_INT),
      accepts: parseSides(m.accepts, c.at("accepts")),
      emits: parseSides(m.emits, c.at("emits")),
      processTicks: expectInt(m.processTicks, c.at("processTicks"), 0, 100),
      ...(m.arbitration !== undefined
        ? { arbitration: expectEnum(m.arbitration, ["alternate"] as const, c.at("arbitration")) }
        : {}),
      ...(m.config !== undefined ? { config: parseMachineConfig(m.config, c.at("config")) } : {}),
    };
    if (def.accepts.length === 0) c.at("accepts").fail("受け口が1つもない");
    if (def.emits.length === 0) c.at("emits").fail("出口が1つもない");
    table[id] = def;
  });
  for (const id of MACHINE_IDS) {
    if (!table[id]) root.at("machines").fail(`機械 "${id}" の定義がない`);
  }
  return table as MachineTable;
}

function parseMachineConfig(v: unknown, c: Ctx): { pitch: Pitch[] } {
  const o = expectObject(v, c);
  expectKeys(o, ["pitch"], [], c);
  const pitches = expectArray(o.pitch, c.at("pitch")).map((p, i) =>
    parsePitch(p, c.at("pitch").at(i)),
  );
  if (pitches.length === 0) c.at("pitch").fail("候補が1つもない");
  return { pitch: pitches };
}

// ---------- orders/*.json ----------

const ORDER_REQUIRED = [
  "schemaVersion",
  "id",
  "title",
  "board",
  "inputs",
  "outputs",
  "allowedMachines",
  "limits",
  "scoring",
  "unlocks",
  "referenceSolutions",
] as const;
const ORDER_OPTIONAL = ["client", "texts", "voice", "machineCost"] as const;

export function parseOrder(json: unknown, file: string): Order {
  const root = new Ctx(file);
  const o = expectObject(json, root);
  expectKeys(o, ORDER_REQUIRED, ORDER_OPTIONAL, root);
  expectLiteral(o.schemaVersion, 1, root.at("schemaVersion"));
  const id = expectString(o.id, root.at("id"));
  if (!/^order-\d{2}$/.test(id)) root.at("id").fail(`"order-NN" の形（実際: ${id}）`);

  const board = parseBoard(o.board, root.at("board"));
  const inputs = expectArray(o.inputs, root.at("inputs")).map((v, i) =>
    parseInput(v, root.at("inputs").at(i)),
  );
  const outputs = expectArray(o.outputs, root.at("outputs")).map((v, i) =>
    parseOutput(v, root.at("outputs").at(i)),
  );
  if (inputs.length === 0) root.at("inputs").fail("入口が1つもない");
  if (outputs.length === 0) root.at("outputs").fail("出口が1つもない");

  // 入口・出口・塞がりマスは盤内で、互いに重ならない。ID も重ならない。
  const ports: { pos: Point; c: Ctx; id: string }[] = [
    ...inputs.map((p, i) => ({ pos: p.pos, c: root.at("inputs").at(i), id: p.id })),
    ...outputs.map((p, i) => ({ pos: p.pos, c: root.at("outputs").at(i), id: p.id })),
  ];
  const seenIds = new Set<string>();
  ports.forEach((p, i) => {
    if (!inBoard(p.pos, board)) p.c.at("pos").fail("盤の外");
    if (seenIds.has(p.id)) p.c.at("id").fail(`入口・出口の ID "${p.id}" が重複している`);
    seenIds.add(p.id);
    for (let j = 0; j < i; j++) {
      if (samePos(p.pos, ports[j]!.pos)) p.c.at("pos").fail(`"${ports[j]!.id}" と同じマス`);
    }
    if (board.blocked.some((b) => samePos(b, p.pos))) p.c.at("pos").fail("塞がりマスと同じ");
  });

  const allowed = expectArray(o.allowedMachines, root.at("allowedMachines")).map((v, i) =>
    expectEnum(v, MACHINE_IDS, root.at("allowedMachines").at(i)),
  );
  if (allowed.length === 0) root.at("allowedMachines").fail("置ける機械が1つもない");
  if (new Set(allowed).size !== allowed.length) root.at("allowedMachines").fail("重複している");

  const machineCost =
    o.machineCost === undefined ? {} : parseCostMap(o.machineCost, root.at("machineCost"));
  for (const k of Object.keys(machineCost) as MachineId[]) {
    if (!allowed.includes(k)) root.at("machineCost").at(k).fail("allowedMachines に無い機械");
  }

  const lc = root.at("limits");
  const limits = expectObject(o.limits, lc);
  expectKeys(limits, ["maxTicks"], ["machines"], lc);
  const maxTicks = expectInt(limits.maxTicks, lc.at("maxTicks"), 1, MAX_TICKS_CAP);
  const machineLimits =
    limits.machines === undefined ? {} : parseCostMap(limits.machines, lc.at("machines"));

  const strList = (v: unknown, c: Ctx): string[] =>
    expectArray(v, c).map((s, i) => expectString(s, c.at(i)));
  const referenceSolutions = strList(o.referenceSolutions, root.at("referenceSolutions"));
  referenceSolutions.forEach((p, i) => {
    if (!p.startsWith(`solutions/${id}-`) || !p.endsWith(".json")) {
      root.at("referenceSolutions").at(i).fail(`"solutions/${id}-<name>.json" の形（実際: ${p}）`);
    }
  });

  return {
    schemaVersion: 1,
    id,
    title: expectString(o.title, root.at("title")),
    board,
    inputs,
    outputs,
    allowedMachines: allowed,
    machineCost,
    limits: { maxTicks, machines: machineLimits },
    scoring: parseScoring(o.scoring, root.at("scoring")),
    unlocks: strList(o.unlocks, root.at("unlocks")),
    referenceSolutions,
    texts: o.texts === undefined ? {} : expectObject(o.texts, root.at("texts")),
  };
}

function parseBoard(v: unknown, c: Ctx): Board {
  const o = expectObject(v, c);
  expectKeys(o, ["width", "height"], ["blocked"], c);
  const board: Board = {
    width: expectInt(o.width, c.at("width"), 1, 64),
    height: expectInt(o.height, c.at("height"), 1, 64),
    blocked:
      o.blocked === undefined
        ? []
        : expectArray(o.blocked, c.at("blocked")).map((p, i) => parsePos(p, c.at("blocked").at(i))),
  };
  board.blocked.forEach((p, i) => {
    if (!inBoard(p, board)) c.at("blocked").at(i).fail("盤の外");
  });
  return board;
}

function parseInput(v: unknown, c: Ctx): InputDef {
  const o = expectObject(v, c);
  expectKeys(o, ["id", "pos", "dir", "emit"], [], c);
  const ec = c.at("emit");
  const emit = expectObject(o.emit, ec);
  expectKeys(emit, ["interval", "notes"], [], ec);
  const notes = expectArray(emit.notes, ec.at("notes")).map((n, i) =>
    parseNote(n, ec.at("notes").at(i)),
  );
  if (notes.length === 0) ec.at("notes").fail("音符が1つもない");
  return {
    id: expectString(o.id, c.at("id")),
    pos: parsePos(o.pos, c.at("pos")),
    dir: parseDir(o.dir, c.at("dir")),
    interval: expectInt(emit.interval, ec.at("interval"), 1, 100),
    notes,
  };
}

function parseOutput(v: unknown, c: Ctx): OutputDef {
  const o = expectObject(v, c);
  expectKeys(o, ["id", "pos", "dir", "expect"], [], c);
  const expect = expectArray(o.expect, c.at("expect")).map((n, i) =>
    parseNote(n, c.at("expect").at(i)),
  );
  if (expect.length === 0) c.at("expect").fail("期待する音符が1つもない");
  return {
    id: expectString(o.id, c.at("id")),
    pos: parsePos(o.pos, c.at("pos")),
    dir: parseDir(o.dir, c.at("dir")),
    expect,
  };
}

function parseMedals(v: unknown, c: Ctx, higherIsBetter: boolean, max: number): MedalThresholds {
  const o = expectObject(v, c);
  expectKeys(o, ["gold", "silver", "bronze"], ["unit"], c);
  if (o.unit !== undefined) expectLiteral(o.unit, "percent", c.at("unit"));
  const m = {
    gold: expectInt(o.gold, c.at("gold"), 0, max),
    silver: expectInt(o.silver, c.at("silver"), 0, max),
    bronze: expectInt(o.bronze, c.at("bronze"), 0, max),
  };
  const ok = higherIsBetter
    ? m.gold >= m.silver && m.silver >= m.bronze
    : m.gold <= m.silver && m.silver <= m.bronze;
  if (!ok)
    c.fail(higherIsBetter ? "gold >= silver >= bronze が必要" : "gold <= silver <= bronze が必要");
  return m;
}

function parseScoring(v: unknown, c: Ctx): Scoring {
  const o = expectObject(v, c);
  expectKeys(o, ["accuracy", "ticks", "cost", "passRule", "encoreRule"], [], c);
  return {
    accuracy: parseMedals(o.accuracy, c.at("accuracy"), true, 100),
    ticks: parseMedals(o.ticks, c.at("ticks"), false, MAX_TICKS_CAP),
    cost: parseMedals(o.cost, c.at("cost"), false, MAX_INT),
    passRule: expectEnum(o.passRule, ["all-bronze-or-better"] as const, c.at("passRule")),
    encoreRule: expectEnum(o.encoreRule, ["two-or-more-gold"] as const, c.at("encoreRule")),
  };
}

// ---------- solutions/*.json ----------

const STOP_REASONS: readonly StopReason[] = ["completed", "stuck", "loop", "maxTicks"];

/**
 * 解答（模範解・プレイヤーの配置・セーブ）を読み込み、注文に対して置けるかを検証する。
 * 盤外・入口/出口/塞がりマスへの配置・重なり・許可されない機械・設定の過不足・個数上限を弾く。
 */
export function parseSolution(
  json: unknown,
  file: string,
  order: Order,
  machines: MachineTable,
): Solution {
  const root = new Ctx(file);
  const o = expectObject(json, root);
  expectKeys(o, ["schemaVersion", "orderId", "name", "placements"], ["expected"], root);
  expectLiteral(o.schemaVersion, 1, root.at("schemaVersion"));
  const orderId = expectString(o.orderId, root.at("orderId"));
  if (orderId !== order.id)
    root.at("orderId").fail(`注文 "${order.id}" の解ではない（実際: ${orderId}）`);

  const pc = root.at("placements");
  const placements = expectArray(o.placements, pc).map((v, i) =>
    parsePlacement(v, pc.at(i), machines),
  );
  validatePlacements(placements, order, pc);

  return {
    schemaVersion: 1,
    orderId,
    name: expectString(o.name, root.at("name")),
    placements,
    ...(o.expected !== undefined
      ? { expected: parseExpected(o.expected, root.at("expected")) }
      : {}),
  };
}

function parsePlacement(v: unknown, c: Ctx, machines: MachineTable): Placement {
  const o = expectObject(v, c);
  expectKeys(o, ["machine", "pos", "dir"], ["config"], c);
  const machine = expectEnum(o.machine, MACHINE_IDS, c.at("machine"));
  const def = machines[machine];
  const base = { machine, pos: parsePos(o.pos, c.at("pos")), dir: parseDir(o.dir, c.at("dir")) };
  if (def.config) {
    if (o.config === undefined) c.at("config").fail(`"${machine}" には config.pitch が必要`);
    const cc = c.at("config");
    const cfg = expectObject(o.config, cc);
    expectKeys(cfg, ["pitch"], [], cc);
    const pitch = parsePitch(cfg.pitch, cc.at("pitch"));
    if (!def.config.pitch.includes(pitch)) cc.at("pitch").fail("この機械で選べない音高");
    return { ...base, config: { pitch } };
  }
  if (o.config !== undefined) c.at("config").fail(`"${machine}" は config を持たない`);
  return base;
}

/** 配置の並びが注文に置けるか。画面側（工房）でも同じ関数で判定する。 */
export function validatePlacements(
  placements: readonly Placement[],
  order: Order,
  c: Ctx = new Ctx("placements"),
): void {
  const { board } = order;
  const reserved: Point[] = [
    ...board.blocked,
    ...order.inputs.map((p) => p.pos),
    ...order.outputs.map((p) => p.pos),
  ];
  const counts: Partial<Record<MachineId, number>> = {};
  placements.forEach((p, i) => {
    const pc = c.at(i);
    if (!order.allowedMachines.includes(p.machine)) {
      pc.at("machine").fail(`この注文では "${p.machine}" を置けない`);
    }
    if (!inBoard(p.pos, board)) pc.at("pos").fail("盤の外");
    if (reserved.some((r) => samePos(r, p.pos)))
      pc.at("pos").fail("入口・出口・塞がりマスには置けない");
    for (let j = 0; j < i; j++) {
      if (samePos(placements[j]!.pos, p.pos)) pc.at("pos").fail(`placements[${j}] と同じマス`);
    }
    const n = (counts[p.machine] ?? 0) + 1;
    counts[p.machine] = n;
    const limit = order.limits.machines[p.machine];
    if (limit !== undefined && n > limit)
      pc.at("machine").fail(`"${p.machine}" は ${limit} 個まで`);
  });
}

function parseExpected(v: unknown, c: Ctx): ExpectedResult {
  const o = expectObject(v, c);
  expectKeys(o, ["result", "accuracy", "ticks", "cost"], ["finalHash"], c);
  const result = expectEnum(o.result, STOP_REASONS, c.at("result"));
  const ticks = o.ticks === null ? null : expectInt(o.ticks, c.at("ticks"), 1, MAX_TICKS_CAP);
  if ((result === "completed") !== (ticks !== null)) {
    c.at("ticks").fail("completed のときだけ整数、それ以外は null");
  }
  return {
    result,
    accuracy: expectInt(o.accuracy, c.at("accuracy"), 0, 100),
    ticks,
    cost: expectInt(o.cost, c.at("cost"), 0, MAX_INT),
    ...(o.finalHash !== undefined
      ? { finalHash: expectString(o.finalHash, c.at("finalHash")) }
      : {}),
  };
}

// ---------- コスト ----------

/** 配置の総コスト。注文の machineCost があればそちらを優先する。 */
export function totalCost(
  placements: readonly Placement[],
  order: Order,
  machines: MachineTable,
): number {
  let sum = 0;
  for (const p of placements) sum += order.machineCost[p.machine] ?? machines[p.machine].cost;
  return sum;
}
