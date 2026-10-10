import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.ts";
import type { Database } from "./db/database.ts";
import { readJournal } from "./db/schema-version.ts";
import { healthRoutes } from "./health/routes.ts";
import { crossSite } from "./security/cross-site.ts";
import { headers } from "./security/headers.ts";
import { jsonOnly } from "./security/json-only.ts";
import { requestSerializer } from "./security/log.ts";
import { webRoutes } from "./web/routes.ts";

// Where the log goes: anything that takes one line at a time.
export interface LogStream {
  write(line: string): void;
}

// Everything the app needs from outside. Production and tests both call
// buildApp, passing real or fake dependencies (ADR 0007, decision 14).
export interface AppDeps {
  config: Config;
  db: Database;
  // Stdout when left out. Tests pass a stream they read back (ADR 0025,
  // decision 9).
  logStream?: LogStream;
}

export function buildApp({ config, db, logStream }: AppDeps): FastifyInstance {
  const app = Fastify({
    // By address, never a hop count or true (ADR 0025, decision 7).
    trustProxy: config.trustedProxies,
    logger: {
      level: config.logLevel,
      stream: logStream,
      serializers: { req: requestSerializer },
    },
  });

  // The web baseline, before any route, so every response and request goes
  // through it (ADR 0012, decisions 7 and 8).
  app.register(headers);
  app.register(crossSite);
  app.register(jsonOnly);

  // Each feature's routes are a plugin; later ones get their services as
  // plugin options.
  app.register(healthRoutes, { prefix: "/api", db, journal: readJournal() });

  // The built SPA, and index.html for the app's own paths. Registered last:
  // its not-found handler answers every path no route above claims.
  app.register(webRoutes, { root: config.webRoot });

  return app;
}
