import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readJournal } from "../db/schema-version.ts";
import {
  testDatabaseName,
  truncateAllTables,
  useTestDatabase,
} from "./database.ts";

describe("truncateAllTables", () => {
  const database = useTestDatabase();

  it("empties the app's tables and leaves Drizzle's record alone", async () => {
    const { db } = database;
    // No table exists before PH-15, so the test brings its own.
    await db.execute(sql`CREATE TABLE probe (id serial PRIMARY KEY)`);
    try {
      await db.execute(sql`INSERT INTO probe DEFAULT VALUES`);

      await truncateAllTables(db);

      const probe = await db.execute(sql`SELECT count(*)::int AS n FROM probe`);
      expect(probe.rows).toEqual([{ n: 0 }]);
      const migrations = await db.execute(
        sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`,
      );
      expect(migrations.rows).toEqual([{ n: readJournal().entries.length }]);
    } finally {
      await db.execute(sql`DROP TABLE probe`);
    }
  });
});

describe("testDatabaseName", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the plain names outside Stryker", () => {
    vi.stubEnv("STRYKER_MUTATOR_WORKER", undefined);
    expect(testDatabaseName("1")).toBe("szop_test_1");
    expect(testDatabaseName("template")).toBe("szop_test_template");
  });

  it("prefixes the names with Stryker's process number", () => {
    vi.stubEnv("STRYKER_MUTATOR_WORKER", "2");
    expect(testDatabaseName("1")).toBe("szop_test_s2_1");
    expect(testDatabaseName("template")).toBe("szop_test_s2_template");
  });

  it("refuses a process number that is not digits", () => {
    vi.stubEnv("STRYKER_MUTATOR_WORKER", "1; DROP DATABASE szop");
    expect(() => testDatabaseName("1")).toThrow(/STRYKER_MUTATOR_WORKER/);
  });
});
