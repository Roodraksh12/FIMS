import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5177",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5177 --strictPort",
    url: "http://127.0.0.1:5177/api/health",
    reuseExistingServer: false,
    env: { FIMS_DB: ":memory:", FIMS_API_PORT: "4177" },
  },
  reporter: "list",
});
