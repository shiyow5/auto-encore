import { test, expect } from "@playwright/test";

test("check canvas vs overlay alignment", async ({ page }) => {
  await page.goto("http://localhost:4175/?fx=0");
  await expect(page.locator("body")).toHaveAttribute("data-scene", "title", { timeout: 15000 });
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "order-select", { timeout: 10000 });
  await page.getByRole("button", { name: "開店前の試し弾き" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-scene", "workshop", { timeout: 10000 });
  await page.waitForTimeout(500);

  // Check alignment at multiple viewport sizes
  const sizes = [
    { w: 1280, h: 720 },
    { w: 844, h: 390 },
    { w: 1920, h: 1080 },
    { w: 800, h: 600 },
    { w: 1024, h: 768 },
  ];

  for (const size of sizes) {
    await page.setViewportSize({ width: size.w, height: size.h });
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const game = document.getElementById("game") as HTMLElement;
      const overlay = document.getElementById("ws-overlay") as HTMLElement;
      if (!canvas || !game || !overlay) return null;

      const canvasRect = canvas.getBoundingClientRect();
      const gameRect = game.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();

      return {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        game: {
          w: gameRect.width, h: gameRect.height,
          x: gameRect.x.toFixed(1), y: gameRect.y.toFixed(1)
        },
        canvas: {
          w: canvasRect.width, h: canvasRect.height,
          x: canvasRect.x.toFixed(1), y: canvasRect.y.toFixed(1)
        },
        overlay: {
          w: overlayRect.width, h: overlayRect.height,
          x: overlayRect.x.toFixed(1), y: overlayRect.y.toFixed(1)
        },
        // Check if overlay extends beyond canvas
        overlayExceedsCanvasTop: overlayRect.top < canvasRect.top,
        overlayExceedsCanvasBottom: overlayRect.bottom > canvasRect.bottom,
        overlayExceedsCanvasLeft: overlayRect.left < canvasRect.left,
        overlayExceedsCanvasRight: overlayRect.right > canvasRect.right,
        // Background behind overlay
        bgColorAtCanvasEdge: {
          // Check the body color at specific points
          top: getComputedStyle(document.body).backgroundColor,
        }
      };
    });

    console.log(`\n=== Viewport ${size.w}x${size.h} ===`);
    console.log(JSON.stringify(info, null, 2));

    // Also check if there's any area between canvas and viewport edge
    if (info) {
      const viewportW = size.w;
      const viewportH = size.h;
      const canvasLeft = parseFloat(info.canvas.x);
      const canvasRight = canvasLeft + parseFloat(info.canvas.w);
      const canvasTop = parseFloat(info.canvas.y);
      const canvasBottom = canvasTop + parseFloat(info.canvas.h);
      
      console.log(`Canvas edges: left=${canvasLeft.toFixed(1)}, right=${canvasRight.toFixed(1)}, top=${canvasTop.toFixed(1)}, bottom=${canvasBottom.toFixed(1)}`);
      console.log(`Viewport: 0 to ${viewportW}, 0 to ${viewportH}`);
      console.log(`Gap left: ${canvasLeft.toFixed(1)}, right: ${(viewportW - canvasRight).toFixed(1)}, top: ${canvasTop.toFixed(1)}, bottom: ${(viewportH - canvasBottom).toFixed(1)}`);
    }
  }
});
