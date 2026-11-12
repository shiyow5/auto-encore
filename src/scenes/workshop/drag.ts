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

export type DragMode = "place" | "erase";

/** 1回のドラッグ。start で始め、move のたびにまだ触れていないマスだけを返す。 */
export class DragStroke {
  readonly mode: DragMode;
  private readonly visited = new Set<string>();
  private last: Point;
  private moved = false;

  constructor(mode: DragMode, start: Point) {
    this.mode = mode;
    this.last = start;
  }

  /** 最初の1マス以外にポインタが移ったか（クリックとドラッグの見分け用）。 */
  get dragged(): boolean {
    return this.moved;
  }

  /**
   * ポインタが pos のマスに来た。新しく触れたマスを順に返す（無ければ空）。
   * 最初のマスはクリック側で処理されるので、移動した最初の move で一緒に返す。
   */
  move(pos: Point): Point[] {
    if (pos.x === this.last.x && pos.y === this.last.y) return [];
    this.moved = true;
    const fresh: Point[] = [];
    for (const c of cellsBetween(this.last, pos)) {
      const k = `${c.x},${c.y}`;
      if (this.visited.has(k)) continue;
      this.visited.add(k);
      fresh.push(c);
    }
    this.last = pos;
    return fresh;
  }
}
