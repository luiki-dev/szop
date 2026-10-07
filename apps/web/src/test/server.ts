import type { Health } from "@szop/shared";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const healthyBody = {
  status: "ok",
  database: { status: "up", schemaVersion: "0000_init" },
} satisfies Health;

// The handlers every test starts with; a test overrides one with server.use().
export const server = setupServer(
  http.get("/api/health", () => HttpResponse.json(healthyBody)),
);
