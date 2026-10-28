import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

// The web project of the root vitest.config.ts. jsdom is a simulated browser
// in Node (ADR 0007, decision 9).
export default defineProject({
  plugins: [react()],
  resolve: {
    alias: {
      // The same "@/" alias as vite.config.ts, which Vitest does not load.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The workspace package from this checkout's own files: through pnpm's
      // symlink it would resolve to the original repository, not Stryker's
      // sandbox copy, and mutants in packages/shared would never be seen.
      "@szop/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
