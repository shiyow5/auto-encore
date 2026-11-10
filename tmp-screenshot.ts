import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:4175', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(2000);
    const screenshotPath = path.join(__dirname, 'tmp-screenshots', 'ae-title.png');
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved: ${screenshotPath}`);
  } catch (e) {
    console.error(`Error: ${e}`);
  }

  await browser.close();
}

main();
