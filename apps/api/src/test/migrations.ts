import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase, type Database } from "../db/database.ts";
import { migrationsFolder } from "../db/migrate.ts";
import { readJournal } from "../db/schema-version.ts";
import { resetDatabase } from "./reset-database.ts";
import { testDatabaseSettings } from "./database.ts";

// An open, empty-then-migrated database `name` with the journal's migrations
// applied up to and including the tag `upTo`, so a test can insert rows that
// exist before a later migration, then call `runMigrations(db)` (the same as
// production) to apply the rest. Drizzle's migrator reads a whole folder, so
// the wanted entries and their SQL files are copied to a temporary one. The
// caller closes the database with `db.$client.end()`.
export async function migratedDatabase(
  name: string,
  upTo: string,
): Promise<Database> {
  const journal = readJournal();
  const last = journal.entries.findIndex(({ tag }) => tag === upTo);
  if (last === -1) throw new Error(`No migration is tagged ${upTo}`);
  const entries = journal.entries.slice(0, last + 1);

  const folder = mkdtempSync(join(tmpdir(), "szop-migrations-"));
  try {
    mkdirSync(join(folder, "meta"));
    writeFileSync(
      join(folder, "meta", "_journal.json"),
      JSON.stringify({ ...journal, entries }),
    );
    for (const { tag } of entries) {
      cpSync(join(migrationsFolder, `${tag}.sql`), join(folder, `${tag}.sql`));
    }
    await resetDatabase(name);
    const db = createDatabase(testDatabaseSettings(name));
    try {
      await migrate(db, { migrationsFolder: folder });
    } catch (error) {
      await db.$client.end();
      throw error;
    }
    return db;
  } finally {
    rmSync(folder, { recursive: true });
  }
}
