import { defineConfig } from "vitest/config";

// One project per package, plus the push hook's tests (ADR 0007, decision 8).
export default defineConfig({
  test: {
    projects: [
      "apps/api/vitest.config.ts",
      {
        test: {
          name: "hooks",
          environment: "node",
          include: [".claude/hooks/**/*.test.ts"],
        },
      },
    ],
    // Measured, never gated (ADR 0007, decision 19). include lists files no
    // test loads too, such as server.ts, so they show up at 0%.
    coverage: {
      provider: "v8",
      include: [
        "apps/*/src/**/*.{ts,tsx}",
        "packages/*/src/**/*.ts",
        ".claude/hooks/**/*.ts",
      ],
      // Test infrastructure, not app code; global-setup.ts would show 0%,
      // since it runs outside the test workers.
      exclude: ["apps/*/src/test/**"],
      reporter: ["text", "html", "json-summary"],
    },
  },
});
