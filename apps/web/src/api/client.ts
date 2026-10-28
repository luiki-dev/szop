import {
  apiErrorSchema,
  catalogSchema,
  healthSchema,
  type Catalog,
  type Health,
} from "@szop/shared";

// The only code that calls fetch; components never do. A 200 and a 503 both
// carry a health body: the 503 says the database is down, which is an answer,
// not a failure of the request. Anything else, or a body that does not match
// the schema, is an error.
export async function getHealth(): Promise<Health> {
  const response = await fetch("/api/health");
  if (response.status !== 200 && response.status !== 503) {
    throw new Error(`GET /api/health answered ${String(response.status)}`);
  }
  return healthSchema.parse(await response.json());
}

// An error body carries a message worth showing; anything else only the
// status. A 200 whose body is not a catalog (the SPA and the API from
// different deploys) is an error too, not a crash further on.
export async function getCatalog(): Promise<Catalog> {
  const response = await fetch("/api/catalog");
  const body: unknown = await response.json().catch(() => null);
  if (response.status !== 200) {
    const error = apiErrorSchema.safeParse(body);
    throw new Error(
      error.success
        ? error.data.error.message
        : `GET /api/catalog answered ${String(response.status)}`,
    );
  }
  const catalog = catalogSchema.safeParse(body);
  if (!catalog.success) {
    throw new Error("The catalog came in a shape this page does not know");
  }
  return catalog.data;
}
