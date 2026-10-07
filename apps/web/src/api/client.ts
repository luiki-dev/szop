import { healthSchema, type Health } from "@szop/shared";

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
