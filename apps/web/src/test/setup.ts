import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server.ts";

// A request nobody wrote a handler for fails the test instead of reaching a
// real network.
beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});

// Without Vitest globals, Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
