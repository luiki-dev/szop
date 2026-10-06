import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { Database } from "./database.ts";
import { migrationsFolder } from "./migrate.ts";

// The part of drizzle-kit's meta/_journal.json used here: each migration's
// timestamp and name, such as 0000_init.
export interface Journal {
  entries: { when: number; tag: string }[];
}

export function readJournal(): Journal {
  const path = join(migrationsFolder, "meta", "_journal.json");
  return JSON.parse(readFileSync(path, "utf8")) as Journal;
}

// Drizzle records each applied migration with the journal's `when` as
// `created_at`, a bigint that node-postgres returns as a string.
export function schemaVersionFor(
  journal: Journal,
  createdAt: number | string | undefined,
): string {
  const entry = journal.entries.find(({ when }) => when === Number(createdAt));
  // A migration this code does not know (an older image on a newer
  // database), or none recorded at all.
  return entry?.tag ?? "unknown";
}

// The latest applied migration's name. Throws when the database cannot be
// reached, which the health check reports as down.
export async function currentSchemaVersion(
  db: Database,
  journal: Journal,
): Promise<string> {
  const result = await db.execute<{ created_at: string }>(
    sql`SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1`,
  );
  return schemaVersionFor(journal, result.rows[0]?.created_at);
}
