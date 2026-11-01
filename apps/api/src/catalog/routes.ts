import { catalogSchema, type Catalog } from "@szop/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { findOwnWorkspace } from "../access/workspace.ts";
import type { Auth } from "../auth/auth.ts";
import { sessionHook } from "../auth/session.ts";
import type { Database } from "../db/database.ts";
import { readCatalog } from "./repository.ts";

export interface CatalogRoutesOptions {
  db: Database;
  auth: Auth;
  catalog: Catalog;
}

// GET /api/catalog: the visitor's own workspace catalog, or the seed when they
// have no workspace yet (PH-16b spec). Read-only; it creates nothing and sets
// no cookie of its own, but a refreshed session's Set-Cookie is passed on by
// `sessionHook`. The response schema serializes the body, so a catalog that
// breaks the contract fails here with a generic 500 and never reaches the page.
export function catalogRoutes(
  app: FastifyInstance,
  { db, auth, catalog }: CatalogRoutesOptions,
): void {
  // A stale cookie gives request.user = null, so it gets the seed, not a 401.
  app.addHook("preHandler", sessionHook(auth));
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      "/catalog",
      { schema: { response: { 200: catalogSchema } } },
      async (request) => {
        const context = await findOwnWorkspace(db, request.user);
        return context ? readCatalog(db, context) : catalog;
      },
    );
}
