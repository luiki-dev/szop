import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.ts";
import type { Database } from "./db/database.ts";
import { readJournal } from "./db/schema-version.ts";
import { healthRoutes } from "./health/routes.ts";
import { webRoutes } from "./web/routes.ts";

// Everything the app needs from outside. Production and tests both call
// buildApp, passing real or fake dependencies (ADR 0007, decision 14).
export interface AppDeps {
  config: Config;
  db: Database;
}

export function buildApp({ config, db }: AppDeps): FastifyInstance {
  const app = Fastify({ logger: { level: config.logLevel } });

  // Each feature's routes are a plugin; later ones get their services as
  // plugin options.
  app.register(healthRoutes, { prefix: "/api", db, journal: readJournal() });

  // The built SPA, and index.html for the app's own paths. Registered last:
  // its not-found handler answers every path no route above claims.
  app.register(webRoutes, { root: config.webRoot });

  return app;
}
