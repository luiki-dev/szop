import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { testDatabaseName } from "../test/database.ts";
import { migratedDatabase } from "../test/migrations.ts";
import { runMigrations } from "./migrate.ts";

describe("a migration applied to existing data", () => {
  it("OP-052: lists made before 0003 keep their rows and sort by category", async () => {
    // A name of its own: resetDatabase empties it, and the worker number
    // keeps parallel files apart (testing.md, "Writing a database test").
    const db = await migratedDatabase(
      testDatabaseName(`m${String(process.env.VITEST_POOL_ID)}`),
      "0002_tough_ultron",
    );
    try {
      await db.execute(sql`
        INSERT INTO users (id, name, email)
        VALUES ('01900000-0000-7000-8000-000000000001', 'Guest', 'g@example.com')`);
      await db.execute(sql`
        INSERT INTO workspaces (id, user_id)
        VALUES ('01900000-0000-7000-8000-000000000002',
                '01900000-0000-7000-8000-000000000001')`);
      await db.execute(sql`
        INSERT INTO lists (workspace_id, id, name) VALUES
          ('01900000-0000-7000-8000-000000000002', '01900000-0000-7000-8000-000000000003', 'Groceries'),
          ('01900000-0000-7000-8000-000000000002', '01900000-0000-7000-8000-000000000004', 'Hardware')`);

      await runMigrations(db);

      const result = await db.execute(
        sql`SELECT name, sort_by_category AS s FROM lists ORDER BY name`,
      );
      expect(result.rows).toEqual([
        { name: "Groceries", s: true },
        { name: "Hardware", s: true },
      ]);
    } finally {
      await db.$client.end();
    }
  });
});
