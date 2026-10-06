import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { loadConfig, type DatabaseSettings } from "../config.ts";
import { createDatabase, type Database } from "../db/database.ts";

const envFile = new URL("../../.env", import.meta.url);

// The server in apps/api/.env, the same one the API uses, with another
// database name: tests never touch the development database (ADR 0020,
// decision 10).
export function testDatabaseSettings(name: string): DatabaseSettings {
  let content: string;
  try {
    content = readFileSync(envFile, "utf8");
  } catch {
    throw new Error(
      "apps/api/.env is missing: copy apps/api/.env.example (see docs/development/setup.md)",
    );
  }
  return { ...loadConfig(parseEnv(content)).database, name };
}

// Empties every table of the app's schema in one round trip, reading the
// list each time so it never goes stale. Drizzle's own table lives in the
// drizzle schema and is left alone (ADR 0020; ADR 0007, decision 13).
export async function truncateAllTables(db: Database): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE tables text;
    BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
        INTO tables FROM pg_tables WHERE schemaname = 'public';
      IF tables IS NOT NULL THEN
        EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
      END IF;
    END $$
  `);
}

// Gives a test file this worker's database, emptied before each test.
// Call it at the top of the file; use `database.db` inside the tests.
export function useTestDatabase(): { readonly db: Database } {
  let db: Database | undefined;
  beforeAll(() => {
    // The copy global-setup.ts made for this worker, numbered from 1.
    const worker = process.env.VITEST_POOL_ID;
    if (!worker) throw new Error("useTestDatabase runs only under Vitest");
    db = createDatabase(testDatabaseSettings(`szop_test_${worker}`));
  });
  // Before, not after: a test starts clean even if the previous one crashed.
  beforeEach(async () => {
    await truncateAllTables(database.db);
  });
  afterAll(async () => {
    await db?.$client.end();
  });
  const database = {
    get db(): Database {
      if (!db) throw new Error("useTestDatabase: the database is not open yet");
      return db;
    },
  };
  return database;
}
