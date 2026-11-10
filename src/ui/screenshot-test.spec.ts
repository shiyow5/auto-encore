import { test, expect } from "@playwright/test";

test("workshop screenshot at 1280x720", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(5000); // Wait for game to boot
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(2000); // Wait for resize

  // Navigate: title -> select order -> workshop
  // Click "start" or the order selection
  const btns = page.locator("button");
  const count = await btns.count();
  console.log("Buttons found:", count);

  // Take screenshot of current state
  await page.screenshot({ path: "/tmp/ws-1280-720.png", fullPage: false });
  console.log("Screenshot saved: ws-1280-720.png");

  // If workshop overlay exists, check it
  const overlay = page.locator("#ws-overlay");
  const overlayVisible = await overlay.isVisible().catch(() => false);
  console.log("Overlay visible:", overlayVisible);

  if (overlayVisible) {
    // Check for white background elements
    const wsOrder = page.locator(".ws-order");
    const bg = await wsOrder.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return cs.backgroundColor;
    });
    console.log("ws-order background:", bg);
    expect(bg).not.toBe("rgb(255, 255, 255)");

    // Check the whole overlay
    const overlayBg = await overlay.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        width: cs.width,
        height: cs.height,
      };
    });
    console.log("Overlay info:", JSON.stringify(overlayBg, null, 2));
    expect(overlayBg.backgroundColor).not.toBe("rgb(255, 255, 255)");
  }

  // Take screenshot at 844x390
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/ws-844-390.png", fullPage: false });
  console.log("Screenshot saved: ws-844-390.png");

  // Take screenshot at 1920x1080
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/ws-1920-1080.png", fullPage: false });
  console.log("Screenshot saved: ws-1920-1080.png");
});
