import type { Health } from "@szop/shared";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const healthyBody = {
  status: "ok",
  commit: "unknown",
  instance: "00000000",
  database: { status: "up", schemaVersion: "0000_init" },
} satisfies Health;

// The handlers every test starts with; a test overrides one with server.use().
export const server = setupServer(
  http.get("/api/health", () => HttpResponse.json(healthyBody)),
  // The home screen asks for the lists; a test that cares overrides this.
  http.get("/api/lists", () => HttpResponse.json({ lists: [] })),
);
