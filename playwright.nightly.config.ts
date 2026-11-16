import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// nightly 専用。必須 CI（npm run test:e2e = playwright.config.ts, testDir: e2e）には含まれない。
export default defineConfig({ ...base, testDir: "e2e-nightly", retries: 0 });
