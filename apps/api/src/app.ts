import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.ts";
import { healthRoutes } from "./health/routes.ts";

// Everything the app needs from outside. Production and tests both call
// buildApp, passing real or fake dependencies (ADR 0007, decision 14).
export interface AppDeps {
  config: Config;
}

export function buildApp({ config }: AppDeps): FastifyInstance {
  const app = Fastify({ logger: { level: config.logLevel } });

  // Each feature's routes are a plugin; later ones get their services as
  // plugin options.
  app.register(healthRoutes, { prefix: "/api" });

  return app;
}
