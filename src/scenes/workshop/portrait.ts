/** 縦持ち（スマホ幅）レイアウトの境界。幅がこれ以下で縦長なら縦持ち用の配置にする（Issue #95）。 */
export const PORTRAIT_MAX_WIDTH = 600;

export function isPortraitLayout(width: number, height: number): boolean {
  return width <= PORTRAIT_MAX_WIDTH && height > width;
}

/** 縦持ちの盤面の大きさ。1マスは (幅-30)/列数 を切り捨て（390px・12列で30px）、左右に余白を均等に置く。上は y=56。 */
export function portraitMetrics(
  viewportWidth: number,
  cols: number,
): { cell: number; gridX: number; gridY: number } {
  const cell = Math.max(1, Math.floor((viewportWidth - 30) / cols));
  return { cell, gridX: Math.floor((viewportWidth - cell * cols) / 2), gridY: 56 };
}
