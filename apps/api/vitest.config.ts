import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

// The api project of the root vitest.config.ts.
export default defineProject({
  // The workspace package from this checkout's own files: through pnpm's
  // symlink it would resolve to the original repository, not Stryker's
  // sandbox copy, and mutants in packages/shared would never be seen.
  resolve: {
    alias: {
      "@szop/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    name: "api",
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Creates the test databases once per run (src/test/global-setup.ts).
    globalSetup: ["src/test/global-setup.ts"],
  },
});
