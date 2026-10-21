import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Database } from "./database.ts";

// apps/api/drizzle/, wherever the process was started from.
export const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

// Applies the pending migrations in one transaction. Drizzle takes no lock,
// so server.ts runs it inside withMigrationLock, one task at a time
// (ADR 0036, decision 2).
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder });
}
