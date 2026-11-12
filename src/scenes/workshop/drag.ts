import type { Point } from "../../core/grid";

/**
 * 工房のドラッグ（押したままなぞる）で通ったマスを集める純粋ロジック（#120）。
 * - 1回のドラッグで同じマスは1度しか返さない（二重配置しない）
 * - 速く動かして間のマスを飛ばしても、直線上のマスを補って返す
 * DOM・Phaser に依存しない。
 */

/** a から b まで（両端を含む）の直線上のマスを順に返す。斜めは Bresenham。 */
export function cellsBetween(a: Point, b: Point): Point[] {
  const out: Point[] = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    out.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

/**
 * PointerEvent.button（0=左,1=中,2=右）で始めたストロークのボタンが、buttons（ビットマスク: 左1・右2・中4）でまだ押されているか。
 */
export function strokeButtonHeld(buttons: number, button: number): boolean {
  const bit = button === 0 ? 1 : button === 2 ? 2 : button === 1 ? 4 : 0;
  return (buttons & bit) !== 0;
}

export type DragMode = "place" | "erase";

/** 1回のドラッグ。start で始め、move のたびにまだ触れていないマスだけを返す。 */
export class DragStroke {
  readonly mode: DragMode;
  private readonly visited = new Set<string>();
  private last: Point | null;
  private moved = false;

  constructor(mode: DragMode, start: Point) {
    this.mode = mode;
    this.last = start;
  }

  /** 最初の1マス以外にポインタが移ったか（クリックとドラッグの見分け用）。 */
  get dragged(): boolean {
    return this.moved;
  }

  /** ポインタが盤外に出た。次の move は直線補間せず、入り直したマスから始める。 */
  leave(): void {
    this.last = null;
  }

  /**
   * ポインタが pos のマスに来た。新しく触れたマスを順に返す（無ければ空）。
   * 最初のマスはクリック側で処理されるので、移動した最初の move で一緒に返す。
   */
  move(pos: Point): Point[] {
    if (this.last && pos.x === this.last.x && pos.y === this.last.y) return [];
    this.moved = true;
    const fresh: Point[] = [];
    // 盤外に出ていた（last が無い）ときは補間せず、入り直したマスから始める
    for (const c of this.last ? cellsBetween(this.last, pos) : [pos]) {
      const k = `${c.x},${c.y}`;
      if (this.visited.has(k)) continue;
      this.visited.add(k);
      fresh.push(c);
    }
    this.last = pos;
    return fresh;
  }
}

/** ドラッグ中の「置く」SE を鳴らす最短間隔（ms）。 */
export const DRAG_SE_MIN_INTERVAL_MS = 80;

/**
 * ドラッグ中の SE の間引き（#191）。前回の発音から minMs 未満なら鳴らさない（配置自体は行う）。
 * 最初の move は1マス目と2マス目を同時に返すので、2発目がここで落ちて1発になる。
 */
export class SeThrottle {
  private lastAt: number | null = null;

  constructor(private readonly minMs: number = DRAG_SE_MIN_INTERVAL_MS) {}

  /** now（ms）に鳴らしてよいか。鳴らしてよければ発音時刻として記録する。 */
  allow(now: number): boolean {
    if (this.lastAt !== null && now - this.lastAt < this.minMs) return false;
    this.lastAt = now;
    return true;
  }
}
