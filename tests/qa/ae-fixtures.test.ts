/**
 * QA フィクスチャ（Issue #6・#8）の形の検査と、シミュ／Schema が入ったら有効にするテストの置き場。
 *
 * - 今すぐ動くもの: フィクスチャ自体が壊れていないか（盤内・重なり無し・コストの足し算・manifest と実ファイルの対応）。
 *   シミュ本体（src/core/sim/）に依存しないので、main のままで CI が回る。
 * - シミュ・Schema が要るもの: it.todo。#16/#18（シミュ核）と #5（Schema）が main に入ったら外す。
 * - 値の意味と「仮の値」の一覧は tests/fixtures/README.md。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FIX = fileURLToPath(new URL("../fixtures", import.meta.url));
const readJson = (rel: string): unknown => JSON.parse(fs.readFileSync(path.join(FIX, rel), "utf8"));

type Pos = [number, number];
interface RawPlacement {
  machine: string;
  pos: Pos;
  dir: string;
  config?: { pitch: string };
}
interface RawExpected {
  result: "completed" | "stuck" | "loop" | "maxTicks";
  accuracy: number;
  ticks: number | null;
  cost: number;
}
interface RawSolution {
  schemaVersion: 1;
  orderId: string;
  name: string;
  placements: RawPlacement[];
  expected?: RawExpected;
}
interface RawPort {
  id: string;
  pos: Pos;
  dir: string;
}
interface RawOrder {
  id: string;
  board: { width: number; height: number; blocked: Pos[] };
  inputs: (RawPort & { emit: { interval: number; notes: string[] } })[];
  outputs: (RawPort & { expect: string[] })[];
  allowedMachines: string[];
}
interface BoardFixture {
  meta: { ae: string[]; purpose: string; checks: string[]; pending?: string };
  order: RawOrder;
  solution: RawSolution;
  expected: RawExpected | null;
}

/** spec-e-mvp v0.3 §2 の機械コスト（src/data/machines.json と同じ値。ずれたらここで気づく）。 */
const SPEC_COST: Record<string, number> = { belt: 1, merger: 4, sorter: 6, tuner: 8 };
const DIRS = ["N", "E", "S", "W"];

/** spec-e-mvp v0.3 §5・§10-3 の注文1・2 の盤（src/data/orders/ に入る前の、QA 側の写し）。 */
const SPEC_ORDERS: Record<string, { width: number; height: number; reserved: Pos[] }> = {
  "order-01": {
    width: 12,
    height: 8,
    reserved: [
      [0, 3],
      [11, 3],
    ],
  },
  "order-02": {
    width: 12,
    height: 8,
    reserved: [
      [0, 2],
      [11, 2],
      [6, 7],
    ],
  },
};

const key = (p: Pos): string => `${p[0]},${p[1]}`;
const costOf = (s: RawSolution): number =>
  s.placements.reduce((sum, p) => sum + (SPEC_COST[p.machine] ?? Number.NaN), 0);

/** フィクスチャの配置が「置ける形」になっているか。問題があれば文で返す（空なら OK）。 */
function placementProblems(
  s: RawSolution,
  board: { width: number; height: number },
  reserved: Pos[],
): string[] {
  const out: string[] = [];
  const seen = new Set(reserved.map(key));
  s.placements.forEach((p, i) => {
    const [x, y] = p.pos;
    if (x < 0 || y < 0 || x >= board.width || y >= board.height)
      out.push(`[${i}] 盤外 ${key(p.pos)}`);
    if (seen.has(key(p.pos))) out.push(`[${i}] 重なり ${key(p.pos)}`);
    seen.add(key(p.pos));
    if (!DIRS.includes(p.dir)) out.push(`[${i}] dir ${p.dir}`);
    if (!(p.machine in SPEC_COST)) out.push(`[${i}] 機械 ${p.machine}`);
    if ((p.machine === "sorter") !== (p.config !== undefined)) out.push(`[${i}] config`);
  });
  return out;
}

// ---------------------------------------------------------------- #6 模範解・壊れた配置

interface SolutionCase {
  file: string;
  ae: string[];
  pass: boolean;
  provisional?: Record<string, string>;
}
const solutionManifest = readJson("solutions/manifest.json") as { cases: SolutionCase[] };

describe("注文1・2 の模範解フィクスチャ（#6: AE-18・AE-19・AE-31）", () => {
  it("manifest と solutions/*.json が1対1", () => {
    const files = fs
      .readdirSync(path.join(FIX, "solutions"))
      .filter((f) => f.endsWith(".json") && f !== "manifest.json")
      .sort();
    expect(solutionManifest.cases.map((c) => c.file).sort()).toEqual(files);
  });

  for (const c of solutionManifest.cases) {
    const s = readJson(`solutions/${c.file}`) as RawSolution;
    describe(c.file, () => {
      it("ファイル名・orderId・name がそろっている", () => {
        expect(c.file).toBe(`${s.orderId}-${s.name}.json`);
        expect(Object.keys(SPEC_ORDERS)).toContain(s.orderId);
      });
      it("盤内・重なり無し・入口出口に置いていない", () => {
        const spec = SPEC_ORDERS[s.orderId]!;
        expect(placementProblems(s, spec, spec.reserved)).toEqual([]);
      });
      it("expected.cost が機械コストの足し算と一致（AE-22 の意味チェックの先取り）", () => {
        expect(s.expected?.cost).toBe(costOf(s));
      });
      it("completed のときだけ ticks が整数・pass は complete かつ 100%", () => {
        const e = s.expected!;
        expect(e.ticks === null).toBe(e.result !== "completed");
        expect(c.pass).toBe(e.result === "completed" && e.accuracy === 100);
      });
    });
  }

  it("注文1 模範解は [1,3]〜[10,3] の東向きベルト10本＝10G", () => {
    const s = readJson("solutions/order-01-frugal.json") as RawSolution;
    expect(s.placements.map((p) => `${p.machine}@${key(p.pos)}${p.dir}`)).toEqual(
      Array.from({ length: 10 }, (_, i) => `belt@${i + 1},3E`),
    );
    expect(costOf(s)).toBe(10);
  });

  it("注文2 模範解は 仕分け機 [6,2] 東向き「ド」＋ベルト13本＝19G", () => {
    const s = readJson("solutions/order-02-frugal.json") as RawSolution;
    const sorters = s.placements.filter((p) => p.machine === "sorter");
    expect(sorters).toEqual([
      { machine: "sorter", pos: [6, 2], dir: "E", config: { pitch: "do" } },
    ]);
    expect(s.placements.filter((p) => p.machine === "belt")).toHaveLength(13);
    expect(costOf(s)).toBe(19);
  });

  // シミュ核（#16・#18）が main に入ったら外す。値は manifest の provisional を見て直す。
  it.todo("注文1 の5件を simulate して expected（result・accuracy・ticks・cost）と一致");
  it.todo("注文1 壊れた配置3件: 例外なし・t5 で stuck・入口から出た4＝盤上4・入口残り4（AE-31②③）");
  it.todo(
    "注文1 余計なベルト: frugal と同じ結果・コストだけ 11G でコストのメダルが1段下がる（AE-31④）",
  );
  it.todo(
    "注文2 の3件を simulate して expected と一致（仕分け機の実装と src/data/orders/order-02.json の後）",
  );
});

// ---------------------------------------------------------------- #6 Schema の正例・誤例

interface SchemaCase {
  file: string;
  reason: string;
  order?: string;
  undecided?: string;
}
const schemaManifest = readJson("schema/manifest.json") as {
  orders: { valid: string[]; invalid: SchemaCase[] };
  solutions: { valid: { file: string; order: string }[]; invalid: SchemaCase[] };
  notes: { valid: string[]; invalid: string[]; undecided: Record<string, string> };
};

describe("#5 Schema に通す例・弾く例（#6: AE-22・AE-23）", () => {
  it("manifest に書いた例がすべて実在し、誤例はファイル名が重ならない", () => {
    const all = [
      ...schemaManifest.orders.valid.map((f) => `orders/${f}`),
      ...schemaManifest.orders.invalid.map((c) => `orders/${c.file}`),
      ...schemaManifest.solutions.valid.map((c) => `solutions/${c.file}`),
      ...schemaManifest.solutions.invalid.map((c) => `solutions/${c.file}`),
    ];
    expect(new Set(all).size).toBe(all.length);
    for (const rel of all) expect(fs.existsSync(path.join(FIX, "schema", rel)), rel).toBe(true);
  });

  it("誤例はどれも理由が書いてある", () => {
    for (const c of [...schemaManifest.orders.invalid, ...schemaManifest.solutions.invalid]) {
      expect(c.reason, c.file).not.toBe("");
    }
  });

  it("音符の正例・誤例・未決が重ならない", () => {
    const { valid, invalid, undecided } = schemaManifest.notes;
    const all = [...valid, ...invalid, ...Object.keys(undecided)];
    expect(new Set(all).size).toBe(all.length);
    expect(invalid).toEqual(expect.arrayContaining(["fa:short", "do:", "DO:short"]));
  });

  // #5 の Schema（と読み込み時検証 parseOrder / parseSolution）が決まり次第外す。undecided の例は判定しない。
  it.todo("orders/valid は Schema・parseOrder を通る");
  it.todo("orders/invalid（undecided 以外）は Schema か parseOrder のどちらかで弾かれる");
  it.todo(
    "solutions/invalid（undecided 以外）は parseSolution か expected の意味チェックで弾かれる",
  );
  it.todo("notes.valid は parseNote を通り、notes.invalid はすべて弾かれる");
});

// ---------------------------------------------------------------- #8 盤面フィクスチャ

const boardFiles = fs
  .readdirSync(path.join(FIX, "boards"))
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("盤面フィクスチャ（#8: AE-09・AE-10・AE-11）", () => {
  it("AE-09・AE-10・AE-11 がそれぞれ1つ以上ある", () => {
    const ae = boardFiles.flatMap((f) => (readJson(`boards/${f}`) as BoardFixture).meta.ae);
    expect(ae).toEqual(expect.arrayContaining(["AE-09", "AE-10", "AE-11"]));
  });

  for (const f of boardFiles) {
    const b = readJson(`boards/${f}`) as BoardFixture;
    describe(f, () => {
      it("入口・出口・塞がりマスが盤内で重ならない", () => {
        const ports = [...b.order.inputs, ...b.order.outputs].map((p) => p.pos);
        const all = [...ports, ...b.order.board.blocked];
        expect(new Set(all.map(key)).size).toBe(all.length);
        for (const [x, y] of all) {
          expect(x >= 0 && y >= 0 && x < b.order.board.width && y < b.order.board.height).toBe(
            true,
          );
        }
      });
      it("配置が置ける形で、allowedMachines だけを使う", () => {
        const reserved = [
          ...b.order.inputs.map((p) => p.pos),
          ...b.order.outputs.map((p) => p.pos),
          ...b.order.board.blocked,
        ];
        expect(placementProblems(b.solution, b.order.board, reserved)).toEqual([]);
        for (const p of b.solution.placements) expect(b.order.allowedMachines).toContain(p.machine);
        expect(b.solution.orderId).toBe(b.order.id);
      });
      it("expected は合意待ち（pending）なら null、そうでなければコストが足し算と一致", () => {
        if (b.meta.pending !== undefined) expect(b.expected).toBeNull();
        else expect(b.expected?.cost).toBe(costOf(b.solution));
      });
    });
  }

  it("AE-11: +1 個の盤面は、ちょうどの盤面と入口の音の数だけが1つ違う", () => {
    const exact = readJson("boards/ae11-output-exact.json") as BoardFixture;
    const plus = readJson("boards/ae11-output-plus-one.json") as BoardFixture;
    const out = exact.order.outputs[0]!.expect.length;
    expect(exact.order.inputs[0]!.emit.notes).toHaveLength(out);
    expect(plus.order.inputs[0]!.emit.notes).toHaveLength(out + 1);
    expect(plus.solution.placements).toEqual(exact.solution.placements);
  });

  // シミュ核が main に入ったら外す。保存則は毎 tick: 入口から出た数 = 出口が受けた数 + 盤上 + 機械が持つ数。
  it.todo("全盤面: 例外なく止まる（noThrow）・毎 tick 保存則（conservation）");
  it.todo(
    "AE-09: 盤外・塞がりマスを向いたベルトで stuck（E-U3 が 11/04 に決まったら expected を入れる）",
  );
  it.todo(
    "AE-10: 調律機の手前が詰まると、入口が出す tick が interval どおりより後ろへずれる（inputDelayed）",
  );
  it.todo("AE-10: 仕分け機の右が行き止まり → so が仕分け機で待ち、後ろも入口も待って stuck");
  it.todo(
    "AE-11: 出口が受けた数は毎 tick expect の個数以下（outputNeverOverExpect）、+1 でも ticks はちょうどと同じ",
  );
  it.todo("AE-11: 出口1が先に満杯 → 入口Aが待ち、出口2が埋まって completed。出口1は2個のまま");
});
