/**
 * AE#98: 注文選択の文字は 16px 以上・ロックは opacity を使わず #9A88A8・解放条件は2行で語が割れない。
 */
import { expect, test } from "@playwright/test";

for (const vp of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`AE#98 注文選択の文字・ロック表示 (${vp.width}×${vp.height})`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto("/?fx=0");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15_000 });
    await page.getByRole("button", { name: "はじめる" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select");
    const info = await page.evaluate(() => {
      const ov = document.getElementById("order-select-overlay");
      if (!ov) throw new Error("overlay なし");
      const sizes = [...ov.querySelectorAll("h1,h2,p,span,button")]
        .filter((e) => e.textContent?.trim() && e.children.length === 0)
        .map((e) => parseFloat(getComputedStyle(e).fontSize));
      const lock = ov.querySelector<HTMLElement>(".os-row-locked");
      if (!lock) throw new Error("ロック行なし");
      const cs = getComputedStyle(lock);
      const spans = [...lock.querySelectorAll<HTMLElement>(".os-lock-title, .os-lock-cond > span")];
      return {
        minFont: Math.min(...sizes),
        opacity: cs.opacity,
        color: cs.color,
        lockHeight: lock.getBoundingClientRect().height,
        clipped: spans.some((s) => s.scrollWidth > s.parentElement!.clientWidth + 1),
        oneLine: spans.every(
          (s) => s.getBoundingClientRect().height < parseFloat(getComputedStyle(s).fontSize) * 2,
        ),
      };
    });
    // クリックを受けるのは行内の button。行いっぱい（44px 以上）であること
    const btn = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>("#order-select-overlay .os-row-btn");
      const r = b!.closest<HTMLElement>(".os-row")!.getBoundingClientRect();
      const br = b!.getBoundingClientRect();
      return { w: br.width, h: br.height, rowW: r.width, rowH: r.height };
    });
    expect(btn.h).toBeGreaterThanOrEqual(44);
    expect(btn.w).toBeGreaterThanOrEqual(btn.rowW - 6);
    expect(info.minFont).toBeGreaterThanOrEqual(16);
    expect(info.opacity).toBe("1");
    expect(info.color).toBe("rgb(154, 136, 168)"); // #9A88A8
    expect(info.lockHeight).toBeGreaterThanOrEqual(56);
    expect(info.clipped).toBe(false);
    expect(info.oneLine).toBe(true);
  });
}
