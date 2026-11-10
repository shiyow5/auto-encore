import { test, expect } from "@playwright/test";

/** AE#124: 工房で「実行」ボタンの下に白い長方形が出る問題の検証。
 * 1280×720 / 844×390 / 1920×1080 の全解像度で、
 * 工房オーバーレイ内の DOM 要素の背景が白色 (#fff 系) になっていないことを確認する。 */
test("AE#124: workshop overlay has no white-background elements", async ({ page }) => {
  // Navigate to workshop
  await page.goto("/");
  await page.waitForTimeout(3000);

  // Title -> Order select -> Workshop
  await page.getByLabel("はじめる").click();
  await page.waitForTimeout(500);

  const orderBtn = page.locator('[data-order-id="order-01"] button');
  await orderBtn.click();
  await page.waitForTimeout(1500);

  // Verify overlay exists
  const overlay = page.locator("#ws-overlay");
  await expect(overlay).toBeVisible();

  // Check all elements in overlay for white background
  const whiteElements = await page.evaluate(() => {
    const overlay = document.getElementById("ws-overlay");
    if (!overlay) return [];
    const elements = overlay.querySelectorAll("*");
    const whiteElements: {tag: string; bg: string; text: string}[] = [];
    elements.forEach((el) => {
      const cs = window.getComputedStyle(el);
      const bg = cs.backgroundColor;
      // Check for white or near-white backgrounds (rgba/rgb with all channels > 240)
      if (
        bg === "rgb(255, 255, 255)" ||
        bg === "rgba(255, 255, 255, 1)" ||
        (bg.startsWith("rgb(") || bg.startsWith("rgba("))
      ) {
        const nums = bg.match(/\d+/g);
        if (nums && nums.length >= 3) {
          const [r, g, b] = nums.map(Number);
          if (r > 240 && g > 240 && b > 240) {
            whiteElements.push({
              tag: el.tagName.toLowerCase(),
              bg,
              text: el.textContent?.trim().substring(0, 50) || "",
            });
          }
        }
      }
    });
    return whiteElements;
  });

  expect(whiteElements).toEqual([]);

  // Verify specific panel backgrounds
  const wsOrder = page.locator(".ws-order");
  const orderBg = await wsOrder.evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );
  expect(orderBg).not.toBe("rgb(255, 255, 255)");

  // Verify overlay itself is not white
  const overlayBg = await overlay.evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );
  // Overlay is transparent (rgba(0,0,0,0)) which is correct — canvas shows through
  expect(overlayBg).not.toBe("rgb(255, 255, 255)");
});

// Run the same check at different resolutions
test("AE#124: workshop no white rect at 1280×720", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(3000);
  await page.getByLabel("はじめる").click();
  await page.waitForTimeout(500);
  await page.locator('[data-order-id="order-01"] button').click();
  await page.waitForTimeout(1500);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(500);

  const whiteElements = await page.evaluate(() => {
    const overlay = document.getElementById("ws-overlay");
    if (!overlay) return [];
    const elements = overlay.querySelectorAll("*");
    const result: string[] = [];
    elements.forEach((el) => {
      const cs = window.getComputedStyle(el);
      const bg = cs.backgroundColor;
      const nums = bg.match(/\d+/g);
      if (nums && nums.length >= 3) {
        const [r, g, b] = nums.map(Number);
        if (r > 240 && g > 240 && b > 240) {
          result.push(`${el.tagName.toLowerCase()} bg=${bg} text="${el.textContent?.trim().substring(0, 30)}"`);
        }
      }
    });
    return result;
  });
  expect(whiteElements).toEqual([]);
  await page.screenshot({ path: "test-results/ws-1280-720-ae124.png" });
});

test("AE#124: workshop no white rect at 844×390", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(3000);
  await page.getByLabel("はじめる").click();
  await page.waitForTimeout(500);
  await page.locator('[data-order-id="order-01"] button').click();
  await page.waitForTimeout(1500);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(500);

  const whiteElements = await page.evaluate(() => {
    const overlay = document.getElementById("ws-overlay");
    if (!overlay) return [];
    const elements = overlay.querySelectorAll("*");
    const result: string[] = [];
    elements.forEach((el) => {
      const cs = window.getComputedStyle(el);
      const bg = cs.backgroundColor;
      const nums = bg.match(/\d+/g);
      if (nums && nums.length >= 3) {
        const [r, g, b] = nums.map(Number);
        if (r > 240 && g > 240 && b > 240) {
          result.push(`${el.tagName.toLowerCase()} bg=${bg} text="${el.textContent?.trim().substring(0, 30)}"`);
        }
      }
    });
    return result;
  });
  expect(whiteElements).toEqual([]);
  await page.screenshot({ path: "test-results/ws-844-390-ae124.png" });
});

test("AE#124: workshop no white rect at 1920×1080", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(3000);
  await page.getByLabel("はじめる").click();
  await page.waitForTimeout(500);
  await page.locator('[data-order-id="order-01"] button').click();
  await page.waitForTimeout(1500);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);

  const whiteElements = await page.evaluate(() => {
    const overlay = document.getElementById("ws-overlay");
    if (!overlay) return [];
    const elements = overlay.querySelectorAll("*");
    const result: string[] = [];
    elements.forEach((el) => {
      const cs = window.getComputedStyle(el);
      const bg = cs.backgroundColor;
      const nums = bg.match(/\d+/g);
      if (nums && nums.length >= 3) {
        const [r, g, b] = nums.map(Number);
        if (r > 240 && g > 240 && b > 240) {
          result.push(`${el.tagName.toLowerCase()} bg=${bg} text="${el.textContent?.trim().substring(0, 30)}"`);
        }
      }
    });
    return result;
  });
  expect(whiteElements).toEqual([]);
  await page.screenshot({ path: "test-results/ws-1920-1080-ae124.png" });
});
