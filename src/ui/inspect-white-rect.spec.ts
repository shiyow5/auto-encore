import { test, expect } from "@playwright/test";

test("inspect white rectangle in workshop", async ({ page }) => {
  // ?fx=0 で演出スキップ。タイトル→注文選択→工房へ進む
  await page.goto("http://localhost:4175/?fx=0");
  // タイトル画面
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15000 });
  // はじめる
  await page.getByRole("button", { name: "はじめる" }).click();
  // 注文選択画面
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", { timeout: 10000 });
  // order-01 を選ぶ
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  // 工房画面
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop", { timeout: 10000 });
  await page.waitForTimeout(500); // layout のため

  // Get canvas info
  const canvasEl = page.locator("canvas");
  const canvasRect = await canvasEl.boundingBox();
  console.log("canvas bounding box:", JSON.stringify(canvasRect));

  // Get all elements with white background in the workshop area
  const whiteElements = await page.evaluate(() => {
    const overlay = document.getElementById("ws-overlay");
    if (!overlay) return [];
    const all = overlay.querySelectorAll("*");
    const result: any[] = [];
    all.forEach((el) => {
      const computed = window.getComputedStyle(el);
      if (computed.backgroundColor === "rgba(255, 255, 255, 1)" || 
          computed.backgroundColor === "rgb(255, 255, 255)" ||
          computed.backgroundColor === "white") {
        result.push({
          tag: el.tagName,
          class: el.className,
          id: el.id,
          bg: computed.backgroundColor,
          bgRaw: computed.background,
          bgImage: computed.backgroundImage,
          width: el.offsetWidth,
          height: el.offsetHeight,
          text: el.textContent?.substring(0, 80),
        });
      }
    });
    return result;
  });
  console.log("White bg elements:", JSON.stringify(whiteElements, null, 2));

  // Check all sections
  const sectionDetails = await page.evaluate(() => {
    const sections = document.querySelectorAll("section");
    const result: any[] = [];
    sections.forEach((el) => {
      const computed = window.getComputedStyle(el);
      result.push({
        tag: el.tagName,
        class: el.className,
        bg: computed.backgroundColor,
        background: computed.background,
        backgroundImage: computed.backgroundImage,
        width: el.offsetWidth,
        height: el.offsetHeight,
        childCount: el.children.length,
      });
    });
    return result;
  });
  console.log("section details:", JSON.stringify(sectionDetails, null, 2));

  // Check #game and body
  const bodyInfo = await page.evaluate(() => {
    return {
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
      bodyBgRaw: window.getComputedStyle(document.body).background,
      gameBg: window.getComputedStyle(document.getElementById("game")!).backgroundColor,
      gameBgRaw: window.getComputedStyle(document.getElementById("game")!).background,
      canvasBg: window.getComputedStyle(document.querySelector("canvas")!).backgroundColor,
      overlayBg: window.getComputedStyle(document.getElementById("ws-overlay")!).backgroundColor,
      overlayBgRaw: window.getComputedStyle(document.getElementById("ws-overlay")!).background,
    };
  });
  console.log("backgrounds:", JSON.stringify(bodyInfo, null, 2));

  // Screenshot at 1280x720
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/white-rect-1280.png", fullPage: false });

  // Screenshot at 844x390
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/white-rect-844.png", fullPage: false });

  // Screenshot at 1920x1080
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/white-rect-1920.png", fullPage: false });
});
