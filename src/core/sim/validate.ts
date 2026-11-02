/**
 * JSON 読み込み用の小さな検証ヘルパー（依存を増やさず手書き）。
 * エラー文は「どのファイルの、どの項目が、なぜ駄目か」を必ず含める。
 */

export class DataError extends Error {
  constructor(
    readonly file: string,
    readonly path: string,
    reason: string,
  ) {
    super(`${file}: ${path || "(root)"}: ${reason}`);
    this.name = "DataError";
  }
}

/** 検証中の位置（ファイル名と JSON パス）。子の位置は at() で作る。 */
export class Ctx {
  constructor(
    readonly file: string,
    readonly path: string = "",
  ) {}

  at(key: string | number): Ctx {
    const next =
      typeof key === "number" ? `${this.path}[${key}]` : this.path ? `${this.path}.${key}` : key;
    return new Ctx(this.file, next);
  }

  fail(reason: string): never {
    throw new DataError(this.file, this.path, reason);
  }
}

function describe(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

export function expectObject(v: unknown, c: Ctx): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    c.fail(`object が必要（実際: ${describe(v)}）`);
  }
  return v as Record<string, unknown>;
}

/** 知らないキーがあれば失敗（打ち間違いを読み込み時に見つけるため）。 */
export function expectKeys(
  o: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  c: Ctx,
): void {
  for (const k of required) {
    if (!(k in o)) c.at(k).fail("必須の項目がない");
  }
  const known = new Set([...required, ...optional]);
  for (const k of Object.keys(o).sort()) {
    if (!known.has(k)) c.at(k).fail("知らない項目");
  }
}

export function expectArray(v: unknown, c: Ctx): unknown[] {
  if (!Array.isArray(v)) c.fail(`array が必要（実際: ${describe(v)}）`);
  return v;
}

export function expectString(v: unknown, c: Ctx): string {
  if (typeof v !== "string" || v.length === 0) c.fail("空でない string が必要");
  return v;
}

export function expectInt(v: unknown, c: Ctx, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isInteger(v)) c.fail(`整数が必要（実際: ${String(v)}）`);
  if (v < min || v > max) c.fail(`${min}〜${max} の範囲外（実際: ${v}）`);
  return v;
}

export function expectEnum<T extends string>(v: unknown, allowed: readonly T[], c: Ctx): T {
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    c.fail(`${allowed.join(" / ")} のどれか（実際: ${JSON.stringify(v)}）`);
  }
  return v as T;
}

export function expectLiteral<T extends string | number>(v: unknown, lit: T, c: Ctx): T {
  if (v !== lit) c.fail(`${JSON.stringify(lit)} が必要（実際: ${JSON.stringify(v)}）`);
  return lit;
}
