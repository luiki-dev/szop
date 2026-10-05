import type { FastifyInstance } from "fastify";

// GET /api/health. PH-04 adds the database check (ADR 0008, decision 15).
export function healthRoutes(app: FastifyInstance): void {
  app.get("/health", () => ({ status: "ok" }));
}
