import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server.ts";

// A request nobody wrote a handler for must fail the test, not reach a real
// network. MSW 3's "error" strategy rejects the request but does not fail the
// test, and a rejected fetch looks like the "Can't reach the API" state that
// several tests expect. So the callback records the request and rejects it
// (a callback that returned would let it through to the network), and
// afterEach fails the test that made it.
const unhandled: string[] = [];

beforeAll(() => {
  server.listen({
    onUnhandledFrame({ frame }) {
      const { request } = frame.data as { request: Request };
      const description = `${request.method} ${request.url}`;
      unhandled.push(description);
      throw new Error(`No request handler for ${description}`);
    },
  });
});

// The check is registered first so it runs last: Vitest runs afterEach hooks
// in reverse order, and cleanup must not hide the failure.
afterEach(() => {
  const requests = unhandled.splice(0);
  if (requests.length > 0) {
    throw new Error(`Requests without a handler: ${requests.join(", ")}`);
  }
});

// Without Vitest globals, Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
