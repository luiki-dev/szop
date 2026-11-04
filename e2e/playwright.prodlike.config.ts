import { defineConfig, devices } from "@playwright/test";

// The checks against the prodlike profile over HTTPS. Run only by
// scripts/check-prodlike.sh, which starts the environment; never by
// pnpm test:e2e or CI (ADR 0064, decision 2).
export default defineConfig({
  testDir: "prodlike",
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "https://localhost:8443",
    // The script's throwaway certificate authority is not installed.
    ignoreHTTPSErrors: true,
  },
  projects: [{ name: "prodlike", use: { ...devices["Desktop Chrome"] } }],
});
