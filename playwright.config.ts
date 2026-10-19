import { defineConfig, devices } from "@playwright/test";

// Click-through tests against a production build. Uses the locally installed Chrome
// (channel "chrome"), so no Playwright browser download is needed.
const PORT = 3217;
// Set E2E_BASE_URL (e.g. https://autoplayed.vercel.app) to test a deployment instead of a local build
const REMOTE = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: REMOTE ?? `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: REMOTE
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
