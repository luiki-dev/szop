import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

// The web project of the root vitest.config.ts. jsdom is a simulated browser
// in Node (ADR 0007, decision 9).
export default defineProject({
  plugins: [react()],
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
