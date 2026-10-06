import type { FastifyInstance } from "fastify";
import type { Database } from "../db/database.ts";
import { currentSchemaVersion, type Journal } from "../db/schema-version.ts";

export interface HealthRoutesOptions {
  db: Database;
  journal: Journal;
}

// GET /api/health: the load balancer's check (ADR 0008, decision 15). One
// query proves the database reachable and gives the schema version.
export function healthRoutes(
  app: FastifyInstance,
  { db, journal }: HealthRoutesOptions,
): void {
  app.get("/health", async (request, reply) => {
    try {
      const schemaVersion = await currentSchemaVersion(db, journal);
      return { status: "ok", database: { status: "up", schemaVersion } };
    } catch (error) {
      // The details go to the log only: the route is public.
      request.log.warn(error, "database check failed");
      return reply
        .code(503)
        .send({ status: "error", database: { status: "down" } });
    }
  });
}
