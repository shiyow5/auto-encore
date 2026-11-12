/** 縦持ち（スマホ幅）レイアウトの境界。幅がこれ以下で縦長なら縦持ち用の配置にする（Issue #95）。 */
export const PORTRAIT_MAX_WIDTH = 600;

export function isPortraitLayout(width: number, height: number): boolean {
  return width <= PORTRAIT_MAX_WIDTH && height > width;
}

/** 盤面の上端 y。 */
export const PORTRAIT_GRID_Y = 64;
/**
 * 盤面より下に必要な高さ（workshop.css の縦持ちの値と揃える）:
 * 盤面の外周 8px の枠を避ける上余白 12 + 操作列 44 + 棚 64 + 注文票との間 16（= 注文票の top 136）
 * + 注文票の要約の高さ 96（.ws-order-body は 96px 固定。詳細は閉じた状態で、開くとページ側が伸びる） + 下の固定帯（実行ボタン 52 + 余白 56）と safe-area 余裕 34。
 */
export const PORTRAIT_BELOW_GRID = 136 + 96 + 52 + 56 + 34;

/**
 * 縦持ちの盤面の大きさ。1マスは幅から (幅-30)/列数、高さから (高さ-64-盤面以外の高さ)/行数 の小さい方（切り捨て）。
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
