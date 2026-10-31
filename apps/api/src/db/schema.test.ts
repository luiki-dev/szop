import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { useTestDatabase } from "../test/database.ts";

describe("the schema", () => {
  const database = useTestDatabase();

  async function rows(query: ReturnType<typeof sql>) {
    return (await database.db.execute(query)).rows;
  }

  it("gives every table created_at and updated_at as timestamptz NOT NULL", async () => {
    const tables = await rows(
      sql`SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public'`,
    );
    expect(tables.map((r) => r.t).sort()).toEqual([
      "accounts",
      "lists",
      "sessions",
      "users",
      "verifications",
      "workspaces",
    ]);
    const columns = await rows(sql`
      SELECT table_name AS t, column_name AS c, data_type AS d, is_nullable AS n
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name IN ('created_at', 'updated_at')`);
    expect(columns).toHaveLength(tables.length * 2);
    for (const column of columns) {
      expect(column).toMatchObject({
        d: "timestamp with time zone",
        n: "NO",
      });
    }
  });

  it("makes lists_pkey cover (workspace_id, id) in that order", async () => {
    const result = await rows(sql`
      SELECT a.attname AS c
      FROM pg_constraint k
      CROSS JOIN LATERAL unnest(k.conkey) WITH ORDINALITY AS u(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.attnum
      WHERE k.conname = 'lists_pkey'
      ORDER BY u.ord`);
    expect(result.map((r) => r.c)).toEqual(["workspace_id", "id"]);
  });

  it("allows one workspace per user", async () => {
    const result = await rows(sql`
      SELECT contype AS t FROM pg_constraint
      WHERE conname = 'workspaces_user_id_key'`);
    expect(result).toEqual([{ t: "u" }]);
  });

  it("deletes a user's workspace and lists with the user", async () => {
    const { db } = database;
    await db.execute(sql`
      INSERT INTO users (id, name, email) VALUES
        ('01900000-0000-7000-8000-000000000001', 'Guest', 'g@example.com')`);
    await db.execute(sql`
      INSERT INTO workspaces (id, user_id) VALUES
        ('01900000-0000-7000-8000-000000000002',
         '01900000-0000-7000-8000-000000000001')`);
    await db.execute(sql`
      INSERT INTO lists (workspace_id, id, name) VALUES
        ('01900000-0000-7000-8000-000000000002',
         '01900000-0000-7000-8000-000000000003', 'Groceries')`);

    await db.execute(sql`DELETE FROM users`);

    expect(await rows(sql`SELECT 1 FROM workspaces`)).toEqual([]);
    expect(await rows(sql`SELECT 1 FROM lists`)).toEqual([]);
  });

  it("defaults workspaces.id and users.id to uuidv7()", async () => {
    const result = await rows(sql`
      SELECT table_name AS t, column_default AS d
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'id'
        AND table_name IN ('users', 'workspaces')
      ORDER BY table_name`);
    expect(result).toEqual([
      { t: "users", d: "uuidv7()" },
      { t: "workspaces", d: "uuidv7()" },
    ]);
  });
});
