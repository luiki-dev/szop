import { defineProject } from "vitest/config";

// The api project of the root vitest.config.ts.
export default defineProject({
  test: {
    name: "api",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
