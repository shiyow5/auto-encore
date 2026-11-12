import type Phaser from "phaser";

/**
 * 工房の背景（#110 床・作業台 / #101 遠景タイル＋ビネット）。
 * 奥から: 床タイル(暗い市松＋目地) → 盤面の影 → 作業台(木目の天板＋金属の縁) → 四隅のビネット。
 * 盤面セル(#1E1722)と作業台の天板は 3:1 以上離す。文字領域(右パネル・下の帯)は暗いまま。
 * 色は DESIGN.md の「工房の背景」表と同じ値。Graphics 1枚に描く（再描画は viewport が変わったときだけ）。
 */
export const BG_COLOR = {
  floorA: 0x241b29,
  floorB: 0x2b2131,
  grout: 0x1a131f,
  benchTop: 0x8c6642,
  benchGrain: 0x7a5636,
  benchLight: 0xa57a4e,
  benchEdge: 0x4a3322,
  metal: 0x9a88a8,
  shadow: 0x0b0710,
  vignette: 0x0b0710,
} as const;

export const BENCH_MARGIN = 6; // 盤面の外側に出す天板の幅(px)
const TILE = 16;

export interface BoardRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function drawWorkshopBg(
  g: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  board: BoardRect,
): void {
  g.clear();
  // 1. 床タイル（遠景）。16px 市松＋目地。コントラストは低く保つ
  for (let ty = 0; ty * TILE < height; ty++) {
    for (let tx = 0; tx * TILE < width; tx++) {
      g.fillStyle((tx + ty) % 2 === 0 ? BG_COLOR.floorA : BG_COLOR.floorB, 1);
      g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  g.fillStyle(BG_COLOR.grout, 1);
  for (let x = 0; x < width; x += TILE) g.fillRect(x, 0, 1, height);
  for (let y = 0; y < height; y += TILE) g.fillRect(0, y, width, 1);

  // 2. 作業台の影（右下へ 3px・2段で柔らかく）
  const m = BENCH_MARGIN;
  const bx = board.x - m;
  const by = board.y - m;
  const bw = board.w + m * 2;
  const bh = board.h + m * 2;
  g.fillStyle(BG_COLOR.shadow, 0.25);
  g.fillRect(bx + 2, by + 4, bw + 4, bh + 4);
  g.fillStyle(BG_COLOR.shadow, 0.35);
  g.fillRect(bx + 1, by + 2, bw + 2, bh + 2);

  // 3. 作業台の天板（木目）。外縁は暗い木、上辺・左辺にハイライト、下辺に金属の縁
  g.fillStyle(BG_COLOR.benchEdge, 1);
  g.fillRect(bx, by, bw, bh);
  g.fillStyle(BG_COLOR.benchTop, 1);
  g.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
  g.fillStyle(BG_COLOR.benchGrain, 1);
  for (let y = by + 3; y < by + bh - 2; y += 4) {
    // 木目: 行ごとに少しずらした短い線
    const off = (y * 7) % 11;
    for (let x = bx + 2 + off; x < bx + bw - 6; x += 19) g.fillRect(x, y, 9, 1);
  }
  g.fillStyle(BG_COLOR.benchLight, 1);
  g.fillRect(bx + 1, by + 1, bw - 2, 1);
  g.fillRect(bx + 1, by + 1, 1, bh - 2);
  g.fillStyle(BG_COLOR.metal, 1);
  g.fillRect(bx + 1, by + bh - 2, bw - 2, 1);
  // 四隅のネジ（金属）
  g.fillStyle(BG_COLOR.metal, 1);
  for (const [sx, sy] of [
    [bx + 2, by + 2],
    [bx + bw - 4, by + 2],
    [bx + 2, by + bh - 4],
    [bx + bw - 4, by + bh - 4],
  ] as const) {
    g.fillRect(sx, sy, 2, 2);
  }

  // 4. ビネット（四隅を暗く。中心側ほど透明）。盤面・文字へは重ねない（depth 0 のため下に敷く）
  const steps = 5;
  const band = Math.round(Math.min(width, height) / 10);
  for (let i = 0; i < steps; i++) {
    g.fillStyle(BG_COLOR.vignette, 0.12);
    const d = (band * (steps - i)) / steps;
    g.fillRect(0, 0, width, d); // 上
    g.fillRect(0, height - d, width, d); // 下
    g.fillRect(0, 0, d, height); // 左
    g.fillRect(width - d, 0, d, height); // 右
  }
}
