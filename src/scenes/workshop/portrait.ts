/** 縦持ち（スマホ幅）レイアウトの境界。幅がこれ以下で縦長なら縦持ち用の配置にする（Issue #95）。 */
export const PORTRAIT_MAX_WIDTH = 600;

export function isPortraitLayout(width: number, height: number): boolean {
  return width <= PORTRAIT_MAX_WIDTH && height > width;
}

/** 盤面の上端 y。 */
export const PORTRAIT_GRID_Y = 56;
/**
 * 盤面より下に必要な高さ（workshop.css の縦持ちの値と揃える）:
 * 盤面の外周 8px の枠を避ける上余白 12 + 操作列 44 + 棚 64 + 注文票との間 16（= 注文票の top 136）
 * + 注文票の最低高さ 96 + 下の固定帯（実行ボタン 52 + 余白 56）と safe-area 余裕 34。
 */
export const PORTRAIT_BELOW_GRID = 136 + 96 + 52 + 56 + 34;

/**
 * 縦持ちの盤面の大きさ。1マスは幅から (幅-30)/列数、高さから (高さ-56-盤面以外の高さ)/行数 の小さい方（切り捨て）。
 * 390×844・12×8 では幅側で 30px。背の低い画面（600×650 など）では高さ側で縮めて注文票を 96px 以上残す。
 * 左右の余白は均等。
 */
export function portraitMetrics(
  viewportWidth: number,
  cols: number,
  viewportHeight = Number.POSITIVE_INFINITY,
  rows = 1,
): { cell: number; gridX: number; gridY: number } {
  const byWidth = Math.floor((viewportWidth - 30) / cols);
  const byHeight = Math.floor((viewportHeight - PORTRAIT_GRID_Y - PORTRAIT_BELOW_GRID) / rows);
  const cell = Math.max(1, Math.min(byWidth, byHeight));
  return { cell, gridX: Math.floor((viewportWidth - cell * cols) / 2), gridY: PORTRAIT_GRID_Y };
}

/**
 * スマホ横（短い辺が 500px 以下・幅 600px 以上）の工房レイアウトか（Issue #165 / #161）。
 * 縦持ちと同じく canvas を画面の CSS ピクセルと同じ大きさにして、棚・注文票を px 指定で並べる。
 * 320×180 を拡大する従来の横レイアウトだと 844×390 で棚ボタンが 52×24px・価格が枠から出る・注文票が切れるため。
 */
export const COMPACT_MAX_HEIGHT = 500;
export const COMPACT_MIN_WIDTH = 600;

export function isCompactLandscape(width: number, height: number): boolean {
  return width > height && height <= COMPACT_MAX_HEIGHT && width >= COMPACT_MIN_WIDTH;
}

/** 左の棚の右端 = 8（余白）+ 216（棚の幅）。workshop.css の .ws-compact .ws-shelf と揃える。 */
export const COMPACT_SHELF_RIGHT = 224;
/** 右の注文票が占める幅 = 220（注文票）+ 8（余白）。 */
export const COMPACT_ORDER_W = 228;
/** 盤面の上端 y（上の説明文 1 行ぶんの帯 8〜52 の下）。 */
export const COMPACT_GRID_Y = 56;
/** 盤面の下に必要な高さ: 外周 8 + 状態表示 2 行 40 + 余白 12 + 下余白 8。 */
export const COMPACT_BELOW_GRID = 68;

/**
 * スマホ横の盤面。1マスは、棚と注文票の間に外周 8px×2 を引いた幅 / 列数 と、高さから (高さ-56-下の帯)/行数 の小さい方。
 * 盤面は棚と注文票の間で左右の余白を均等にする。
 */
export function compactMetrics(
  viewportWidth: number,
  viewportHeight: number,
  cols: number,
  rows: number,
): { cell: number; gridX: number; gridY: number } {
  const avail = viewportWidth - COMPACT_SHELF_RIGHT - COMPACT_ORDER_W;
  const byWidth = Math.floor((avail - 16) / cols);
  const byHeight = Math.floor((viewportHeight - COMPACT_GRID_Y - COMPACT_BELOW_GRID) / rows);
  const cell = Math.max(1, Math.min(byWidth, byHeight));
  return {
    cell,
    gridX: COMPACT_SHELF_RIGHT + Math.floor((avail - cell * cols) / 2),
    gridY: COMPACT_GRID_Y,
  };
}
