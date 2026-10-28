import { catalogSchema, type Catalog } from "@szop/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export interface CatalogRoutesOptions {
  catalog: Catalog;
}

// GET /api/catalog: the seed catalog, read-only (PH-15a spec). The response
// schema serializes the body, so a catalog that breaks the contract fails
// here with a generic 500 and never reaches the page.
export function catalogRoutes(
  app: FastifyInstance,
  { catalog }: CatalogRoutesOptions,
): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      "/catalog",
      { schema: { response: { 200: catalogSchema } } },
      () => catalog,
    );
}
