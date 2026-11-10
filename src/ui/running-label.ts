/** 実行中の表示文言（実行ボタンの位置に出す。Issue #121）。 */
export function runningLabel(tick: number): string {
  return `実行中…(tick ${tick})`;
}
