import { defineProject } from "vitest/config";

// The api project of the root vitest.config.ts.
export default defineProject({
  test: {
    name: "api",
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Creates the test databases once per run (src/test/global-setup.ts).
    globalSetup: ["src/test/global-setup.ts"],
  },
});
