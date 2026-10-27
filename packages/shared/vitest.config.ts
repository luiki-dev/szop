import { defineProject } from "vitest/config";

// The shared project of the root vitest.config.ts.
export default defineProject({
  test: {
    name: "shared",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
