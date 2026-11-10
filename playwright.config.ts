import { defineConfig, devices } from "@playwright/test";

const url = `http://localhost:${process.env.PW_PORT ?? 4173}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: url, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview",
    url,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
