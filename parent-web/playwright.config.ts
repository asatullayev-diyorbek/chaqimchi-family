import { defineConfig, devices } from "@playwright/test";

// The suite mocks every /api/ call (see e2e/fixtures.ts), so it needs no
// backend and creates no real accounts — it exercises the frontend only.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3111",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next dev -p 3111",
    url: "http://localhost:3111/login",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
