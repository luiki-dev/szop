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
  },
});
