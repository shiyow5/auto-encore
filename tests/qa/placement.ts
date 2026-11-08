/**
 * ランダム配置スモークの足場（AE-24）。
 *
 * 盤サイズと機械の一覧から seed で配置を作り、シミュレータに食わせて
 * 「例外なし・4種のどれかで終わる・保存則が崩れない」を検査する。
 * シミュレータ本体（src/core/sim）が main に入るまでは、型を自前の最小形で持ち
 * （sim の型には依存しない）、検査の枠そのものはおもちゃのシミュで動かす。
 * 本物につなぐときは `simulate` を差し替えるだけ。
 */
import { DIRS, type Dir, type Point } from "../../src/core/grid";
import { Rng } from "../../src/core/rng";

export type MachineId = "belt" | "merger" | "sorter" | "tuner" | "bin";
export const MACHINE_IDS: readonly MachineId[] = ["belt", "merger", "sorter", "tuner", "bin"];

export interface PlacementBoard {
  readonly width: number;
  readonly height: number;
  readonly blocked?: readonly Point[];
}

export interface GenPlacement {
  readonly machine: MachineId;
  readonly pos: Point;
  readonly dir: Dir;
  /** 仕分け機だけ。0=ド 1=ミ 2=ソ。 */
  readonly config?: { readonly pitch: 0 | 1 | 2 };
}

export interface GenInput {
  readonly board: PlacementBoard;
  /** 置いてよい機械（重複なし）。 */
  readonly machines: readonly MachineId[];
  /** 置く個数の上限。実際は 0〜max のどれか（0 個＝何も置かない配置も出る）。 */
  readonly maxPlacements: number;
  /** 入口・出口などで使用済みのマス（置かない）。 */
  readonly reserved?: readonly Point[];
}

/** GenPlacement[] を src/core/sim/types.Placement[] に変換する。 */
export function toPlacement(
  p: GenPlacement,
): import("../../src/core/sim/types").Placement {
  return {
    machine: p.machine,
    pos: p.pos,
    dir: p.dir,
    config: p.config
      ? { pitch: p.config.pitch as import("../../src/core/sim/types").Pitch }
      : undefined,
  };
}

export function toPlacements(
  arr: readonly GenPlacement[],
): import("../../src/core/sim/types").Placement[] {
  return arr.map(toPlacement);
}

const key = (p: Point): string => `${p.x},${p.y}`;

/** seed から配置を作る。同じ (seed, input) なら必ず同じ配置。マスの重複・盤外・使用済みマスは出さない。 */
export function generatePlacements(seed: string, input: GenInput): GenPlacement[] {
  const { board, machines, maxPlacements } = input;
  if (!Number.isInteger(board.width) || !Number.isInteger(board.height)) {
    throw new RangeError(`invalid board: ${board.width}x${board.height}`);
  }
  if (board.width <= 0 || board.height <= 0) {
    throw new RangeError(`invalid board: ${board.width}x${board.height}`);
  }
  if (machines.length === 0) throw new RangeError("machines must not be empty");
  if (!Number.isInteger(maxPlacements) || maxPlacements < 0) {
    throw new RangeError(`invalid maxPlacements: ${maxPlacements}`);
  }
  const rng = new Rng(`placement:${seed}`);
  const taken = new Set<string>([...(board.blocked ?? []), ...(input.reserved ?? [])].map(key));
  const free: Point[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) if (!taken.has(`${x},${y}`)) free.push({ x, y });
  }
  const count = Math.min(rng.int(0, maxPlacements), free.length);
  return rng
    .shuffle(free)
    .slice(0, count)
    .map((pos): GenPlacement => {
      const machine = rng.pick(machines);
      const dir = rng.pick(DIRS);
      if (machine === "sorter") {
        return { machine, pos, dir, config: { pitch: rng.pick([0, 1, 2] as const) } };
      }
      return { machine, pos, dir };
    });
}

/** 生成器自身の約束（生成結果が壊れていたら、以降の検査が意味を失うので先に見る）。 */
export function validateGenerated(placements: readonly GenPlacement[], input: GenInput): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const blocked = new Set([...(input.board.blocked ?? []), ...(input.reserved ?? [])].map(key));
  for (const [i, p] of placements.entries()) {
    const at = `placements[${i}] (${p.pos.x},${p.pos.y})`;
    if (p.pos.x < 0 || p.pos.y < 0 || p.pos.x >= input.board.width || p.pos.y >= input.board.height)
      problems.push(`${at}: 盤の外`);
    if (blocked.has(key(p.pos))) problems.push(`${at}: 使えないマス`);
    if (seen.has(key(p.pos))) problems.push(`${at}: マスが重複`);
    seen.add(key(p.pos));
    if (!input.machines.includes(p.machine))
      problems.push(`${at}: 許可されていない機械 ${p.machine}`);
    if (p.machine === "sorter" && p.config === undefined)
      problems.push(`${at}: 仕分け機に config が無い`);
    if (p.machine !== "sorter" && p.config !== undefined)
      problems.push(`${at}: ${p.machine} に config`);
  }
  return problems;
}

// ---- シミュ結果の検査 --------------------------------------------------------

export type StopReason = "completed" | "stuck" | "loop" | "maxTicks";
export const STOP_REASONS: readonly StopReason[] = ["completed", "stuck", "loop", "maxTicks"];

/** 保存則の検査に必要な最小の数字。本物のシミュが出す形に合わせて後で写す。 */
export interface SmokeOutcome {
  readonly result: StopReason;
  /** 入口が出した音の総数。 */
  readonly emitted: number;
  /** 出口が受けた音の総数。 */
  readonly received: number;
  /** 終了時に盤上（機械の中・詰まった入口）に残っている音の数。 */
  readonly remaining: number;
}

export type Simulate = (placements: readonly GenPlacement[], seed: string) => SmokeOutcome;

/** 結果が約束を破っていたら理由の文字列を返す。 */
export function checkOutcome(o: SmokeOutcome): string[] {
  const problems: string[] = [];
  if (!STOP_REASONS.includes(o.result))
    problems.push(`終わり方が4種のどれでもない: ${String(o.result)}`);
  for (const k of ["emitted", "received", "remaining"] as const) {
    if (!Number.isInteger(o[k]) || o[k] < 0) problems.push(`${k} が 0 以上の整数でない: ${o[k]}`);
  }
  if (o.emitted !== o.received + o.remaining) {
    problems.push(
      `保存則が崩れた: emitted(${o.emitted}) != received(${o.received}) + remaining(${o.remaining})`,
    );
  }
  return problems;
}

export interface SmokeFailure {
  readonly kind: "exception" | "generator" | "outcome";
  readonly seed: string;
  readonly message: string;
  readonly placements: readonly GenPlacement[];
}

export const DEFAULT_PLACEMENT_SEEDS = 300;

/**
 * 本数は環境変数 QA_PLACEMENT_SEEDS（PR 既定 300、nightly 1000: qa-plan-v3 §5-3）。
 * 空・未設定は既定値。数字でない・0以下は設定ミスなので例外（0本で緑にしない）。
 */
export function placementSeedCount(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.QA_PLACEMENT_SEEDS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_PLACEMENT_SEEDS;
  const t = raw.trim();
  const n = Number(t);
  if (!/^\d+$/.test(t) || !Number.isSafeInteger(n) || n <= 0) {
    throw new RangeError(`QA_PLACEMENT_SEEDS must be a positive integer: "${raw}"`);
  }
  return n;
}

export function runPlacementSmoke(
  simulate: Simulate,
  input: GenInput,
  count: number,
  seedPrefix = "ae24",
): SmokeFailure[] {
  const failures: SmokeFailure[] = [];
  for (let i = 0; i < count; i++) {
    const seed = `${seedPrefix}-${i}`;
    const placements = generatePlacements(seed, input);
    const gen = validateGenerated(placements, input);
    if (gen.length > 0) {
      failures.push({ kind: "generator", seed, message: gen.join(" / "), placements });
      continue;
    }
    try {
      const problems = checkOutcome(simulate(placements, seed));
      if (problems.length > 0) {
        failures.push({ kind: "outcome", seed, message: problems.join(" / "), placements });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      failures.push({ kind: "exception", seed, message, placements });
    }
  }
  return failures;
}

/** 失敗の報告。seed と配置 JSON をそのまま不具合票に貼れる形で出す。 */
export function formatSmokeFailures(failures: readonly SmokeFailure[], limit = 5): string {
  const shown = failures
    .slice(0, limit)
    .map(
      (f) =>
        `[${f.kind}] seed=${f.seed}: ${f.message}\nplacements: ${JSON.stringify(f.placements)}`,
    );
  const rest = failures.length > limit ? `\n…ほか ${failures.length - limit} 件` : "";
  return `placement smoke failures: ${failures.length}\n${shown.join("\n")}${rest}`;
}
