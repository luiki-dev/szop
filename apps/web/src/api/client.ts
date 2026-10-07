import { healthSchema, type Health } from "@szop/shared";

// The only code that calls fetch; components never do.
export async function getHealth(): Promise<Health> {
  const response = await fetch("/api/health");
  return healthSchema.parse(await response.json());
}
