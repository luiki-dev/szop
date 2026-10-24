import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

// The web project of the root vitest.config.ts. jsdom is a simulated browser
// in Node (ADR 0007, decision 9).
export default defineProject({
  plugins: [react()],
  // The same "@/" alias as vite.config.ts, which Vitest does not load.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
