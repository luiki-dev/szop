import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { readJournal } from "../db/schema-version.ts";
import { truncateAllTables, useTestDatabase } from "./database.ts";

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
