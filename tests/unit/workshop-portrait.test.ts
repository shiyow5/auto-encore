import { describe, expect, it } from "vitest";
import { isPortraitLayout, portraitMetrics } from "../../src/scenes/workshop/portrait";

describe("縦持ちレイアウト（Issue #95）", () => {
  it("390×844 は縦持ち、PC・横持ち・広い縦長は対象外", () => {
    expect(isPortraitLayout(390, 844)).toBe(true);
    expect(isPortraitLayout(844, 390)).toBe(false);
    expect(isPortraitLayout(1280, 720)).toBe(false);
    expect(isPortraitLayout(700, 1000)).toBe(false);
  });

  it("390px・12列で 1マス30px・盤面幅360px・左右15px・上 y=56", () => {
    expect(portraitMetrics(390, 12)).toEqual({ cell: 30, gridX: 15, gridY: 56 });
  });

  it("幅が狭くても盤面が画面幅に収まる", () => {
    const m = portraitMetrics(360, 12);
    expect(m.cell * 12 + m.gridX * 2).toBeLessThanOrEqual(360);
  });

  it("390×844・12×8 は高さを渡しても 30px のまま", () => {
    expect(portraitMetrics(390, 12, 844, 8)).toEqual({ cell: 30, gridX: 15, gridY: 56 });
  });

  it("600×650・12×8 は高さ側で縮み、注文票が 96px 以上残る", () => {
    const m = portraitMetrics(600, 12, 650, 8);
    expect(m.cell).toBeLessThan(47);
    // 注文票の高さ = 画面高 - 盤面の下端 - (操作列〜注文票の上端 136-… の固定分)。CSS: top=盤面下+136, bottom=108
    const orderHeight = 650 - (m.gridY + m.cell * 8 + 136) - (52 + 56);
    expect(orderHeight).toBeGreaterThanOrEqual(96);
  });
});
