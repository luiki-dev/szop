import type { FastifyInstance } from "fastify";
import type { Database } from "../db/database.ts";
import { currentSchemaVersion, type Journal } from "../db/schema-version.ts";

export interface HealthRoutesOptions {
  db: Database;
  journal: Journal;
  commit: string;
  instance: string;
}

// GET /api/health: the readiness check (ADR 0008, decision 15). One query
// proves the database reachable and gives the schema version; the body also
// names the commit the API was built from and the instance that answered,
// up or down.
export function healthRoutes(
  app: FastifyInstance,
  { db, journal, commit, instance }: HealthRoutesOptions,
): void {
  // GET /api/live: the load balancer's check. It touches only the process, so
  // a database outage does not make the load balancer replace the task
  // (ADR 0036, decision 4).
  app.get("/live", () => ({ status: "ok" }));

  app.get("/health", async (request, reply) => {
    // Helmet sends same-origin on every response, which makes the browser
    // fail a no-cors request from the landing page on dzwoniec.com as if
    // nothing had answered. same-site lets the page receive the (opaque)
    // answer, and only pages of this site, never another site's; every other
    // route keeps same-origin (ADR 0046). The 503 below counts as an answer.
    void reply.header("Cross-Origin-Resource-Policy", "same-site");

    try {
      const schemaVersion = await currentSchemaVersion(db, journal);
      return {
        status: "ok",
        commit,
        instance,
        database: { status: "up", schemaVersion },
      };
    } catch (error) {
      // The details go to the log only: the route is public.
      request.log.warn(error, "database check failed");
      return reply.code(503).send({
        status: "error",
        commit,
        instance,
        database: { status: "down" },
      });
    }
  });
}
