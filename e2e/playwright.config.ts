import { defineConfig, devices } from "@playwright/test";

// The E2E server's port, written once and handed to start-server.ts. Not
// 3000, so a running `pnpm start`, with the development database, is never
// tested by mistake (ADR 0026, decision 2).
const port = 3100;
const baseURL = `http://127.0.0.1:${String(port)}`;
const ci = Boolean(process.env.CI);

// The E2E suite against the production build (ADR 0007, decisions 5, 11
// and 15; ADR 0013, decision 2; the details in ADR 0026).
export default defineConfig({
  testDir: "tests",
  // Each test starts in a fresh browser context, a fresh guest, so the tests
  // run in parallel (ADR 0007, decision 15).
  fullyParallel: true,
  // A forgotten test.only would pass CI while running one test.
  forbidOnly: ci,
  // In CI, one retry tells a flaky test from a broken one, and a test that
  // passes only on its retry still fails the run (ADR 0026, decision 4).
  retries: ci ? 1 : 0,
  failOnFlakyTests: ci,
  // The HTML report holds the trace and screenshot of every failed test; it
  // is what CI uploads. github puts failures on the PR as annotations.
  reporter: ci
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Resets szop_e2e, then runs the API, which serves the built SPA.
    command: "node start-server.ts",
    url: `${baseURL}/api/health`,
    env: { E2E_PORT: String(port) },
    // A fresh server every run: whatever already answers on the port is
    // refused, never tested.
    reuseExistingServer: false,
    // The API logs at warn, so only what matters shows.
    stdout: "pipe",
    // SIGTERM, not SIGKILL, so the API shuts down as it does on ECS.
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
  },
});
