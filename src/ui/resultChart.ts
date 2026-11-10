/**
 * 結果画面のグラフ（品質uplift §1.5）。TradingView Lightweight Charts で
 * 「出口に届いた音符の累計」を tick ごとに線で描き、注文の音符数を目標線にする。
 *
 * - ライセンスは Apache-2.0。帰属表示（チャート上の TradingView ロゴ＝attributionLogo と
 *   フッターの「Powered by TradingView Lightweight Charts」）を消さないこと。
 *   ライセンス文と NOTICE は public/licenses/lightweight-charts/ に同梱している。
 * - 横軸は tick（数値）なので、時刻ではなく数値を横軸にとる createOptionsChart を使う。
 * - 色は workshop.css の --ae-* と同じ値。
 */
import { LineSeries, LineStyle, createOptionsChart } from "lightweight-charts";
import type { ThroughputPoint } from "../scenes/workshop/execute";

const COLOR = {
  text: "#c4b4c9", // --ae-text-weak
  grid: "#3a2d42", // --ae-surface-up
  line: "#f2b45a", // --ae-amber
  target: "#f3e9dc", // --ae-text
} as const;

/**
 * 縦軸の範囲。price line（目標線）は autoscale の対象外なので、目標が必ず入るようにする。
 * 累計が全部 0 で目標が 8 のようなときも、0〜目標が見える。
 */
export function targetAutoscale(
  target: number,
  base: () => { priceRange: { minValue: number; maxValue: number } | null } | null,
): { priceRange: { minValue: number; maxValue: number } } {
  const r = base()?.priceRange;
  return { priceRange: { minValue: 0, maxValue: Math.max(target, r?.maxValue ?? 0) } };
}

export const TRADINGVIEW_URL = "https://www.tradingview.com/";
export const ATTRIBUTION_TEXT = "Powered by TradingView Lightweight Charts";

/**
 * container にグラフを描く。返り値の関数でグラフを片付ける（シーン終了時に呼ぶ）。
 *
 * @param container グラフを入れる要素。大きさは CSS で決める（autoSize）。
 * @param points tick ごとの累計（throughputSeries の結果）。
 * @param target 目標（注文の音符数の合計）。目標線として描く。
 */
export function mountThroughputChart(
  container: HTMLElement,
  points: readonly ThroughputPoint[],
  target: number,
): () => void {
  const chart = createOptionsChart(container, {
    autoSize: true,
    layout: {
      background: { color: "transparent" },
      textColor: COLOR.text,
      fontFamily: getComputedStyle(container).fontFamily,
      attributionLogo: true,
    },
    grid: { vertLines: { color: COLOR.grid }, horzLines: { color: COLOR.grid } },
    // 下側をあけて、左下の TradingView ロゴと線が重ならないようにする
    rightPriceScale: { borderColor: COLOR.grid, scaleMargins: { top: 0.15, bottom: 0.3 } },
    timeScale: { borderColor: COLOR.grid },
    handleScroll: false,
    handleScale: false,
  });
  const series = chart.addSeries(LineSeries, {
    color: COLOR.line,
    lineWidth: 2,
    autoscaleInfoProvider: (base: () => never) => targetAutoscale(target, base),
    // 個数なので整数。ロゴ用にあけた下の余白に出る負の目盛りは表示しない
    priceFormat: {
      type: "custom",
      minMove: 1,
      formatter: (v: number) => (v < 0 ? "" : String(Math.round(v))),
    },
  });
  series.setData(points.map((p) => ({ time: p.tick, value: p.value })));
  series.createPriceLine({
    price: target,
    color: COLOR.target,
    lineStyle: LineStyle.Dashed,
    lineWidth: 1,
    axisLabelVisible: true,
    title: "目標",
  });
  chart.timeScale().fitContent();
  return () => chart.remove();
}
