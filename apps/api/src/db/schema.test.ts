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
      "categories",
      "lists",
      "products",
      "sessions",
      "units",
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

  it("gives every workspace-owned table a NOT NULL workspace_id that references workspaces and starts its key", async () => {
    const owned = await rows(sql`
      SELECT c.table_name AS t, c.is_nullable AS n
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.column_name = 'workspace_id'`);
    expect(owned.length).toBeGreaterThan(0);
    for (const { t, n } of owned as { t: string; n: string }[]) {
      expect(n, t + ".workspace_id").toBe("NO");
      const fk = await rows(sql`
        SELECT 1 FROM pg_constraint k
        WHERE k.contype = 'f' AND k.conrelid = ${`public.${t}`}::regclass
          AND k.confrelid = 'public.workspaces'::regclass
          AND (SELECT a.attname FROM pg_attribute a
               WHERE a.attrelid = k.conrelid AND a.attnum = k.conkey[1]) = 'workspace_id'
          AND array_length(k.conkey, 1) = 1`);
      expect(fk, t + " fk to workspaces").toHaveLength(1);
      const keys = await rows(sql`
        SELECT (SELECT string_agg(a.attname, ',' ORDER BY u.ord)
                FROM unnest(k.conkey) WITH ORDINALITY AS u(attnum, ord)
                JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.attnum
               ) AS cols
        FROM pg_constraint k
        WHERE k.contype IN ('p', 'u') AND k.conrelid = ${`public.${t}`}::regclass`);
      expect(
        keys.some((r) => r.cols === "workspace_id,id"),
        t + " key (workspace_id, id)",
      ).toBe(true);
    }
    const others = await rows(sql`
      SELECT tablename AS t FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT IN (
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'workspace_id')
      ORDER BY 1`);
    expect(others.map((r) => r.t)).toEqual([
      "accounts",
      "sessions",
      "users",
      "verifications",
      "workspaces",
    ]);
  });

  it("keeps every reference to a workspace-owned table inside the workspace", async () => {
    const result = await rows(sql`
      SELECT k.conname AS name
      FROM pg_constraint k
      WHERE k.contype = 'f'
        AND EXISTS (SELECT 1 FROM pg_attribute t
                    WHERE t.attrelid = k.confrelid AND t.attname = 'workspace_id')
        AND NOT EXISTS (
          SELECT 1 FROM generate_series(1, array_length(k.conkey, 1)) AS i
          WHERE k.conkey[i] = (SELECT a.attnum FROM pg_attribute a
                WHERE a.attrelid = k.conrelid AND a.attname = 'workspace_id')
            AND k.confkey[i] = (SELECT a.attnum FROM pg_attribute a
                WHERE a.attrelid = k.confrelid AND a.attname = 'workspace_id'))`);
    expect(result).toEqual([]);
  });

  describe("the catalog tables", () => {
    const user = (n: number) =>
      "01900000-0000-7000-8000-00000000010" + String(n);
    const ws = (n: number) => "01900000-0000-7000-8000-00000000020" + String(n);
    const row = (n: number) =>
      "01900000-0000-7000-8000-00000000030" + String(n);

    async function twoWorkspaces() {
      const { db } = database;
      for (const n of [1, 2] as const) {
        await db.execute(sql`
          INSERT INTO users (id, name, email)
          VALUES (${user(n)}, 'U', ${"u" + String(n) + "@example.com"})`);
        await db.execute(sql`
          INSERT INTO workspaces (id, user_id) VALUES (${ws(n)}, ${user(n)})`);
      }
    }

    async function code(query: ReturnType<typeof sql>) {
      try {
        await database.db.execute(query);
      } catch (error) {
        const cause = (error as { cause?: { code?: string } }).cause;
        return cause?.code ?? (error as { code?: string }).code;
      }
      return undefined;
    }

    it("refuses a reference to a row of another workspace", async () => {
      const { db } = database;
      await twoWorkspaces();
      await db.execute(sql`
        INSERT INTO categories (workspace_id, id, position, name) VALUES (${ws(2)}, ${row(1)}, 0, 'B')`);
      await db.execute(sql`
        INSERT INTO units (workspace_id, id, name) VALUES (${ws(2)}, ${row(2)}, 'kg')`);
      expect(
        await code(sql`INSERT INTO products (workspace_id, id, name, category_id)
          VALUES (${ws(1)}, ${row(3)}, 'P', ${row(1)})`),
      ).toBe("23503");
      expect(
        await code(sql`INSERT INTO products (workspace_id, id, name, unit_id)
          VALUES (${ws(1)}, ${row(3)}, 'P', ${row(2)})`),
      ).toBe("23503");
      expect(
        await code(sql`INSERT INTO categories (workspace_id, id, parent_id, position, name)
          VALUES (${ws(1)}, ${row(4)}, ${row(1)}, 0, 'C')`),
      ).toBe("23503");
    });

    it("cascades and nulls on delete as intended", async () => {
      const { db } = database;
      await twoWorkspaces();
      await db.execute(sql`
        INSERT INTO categories (workspace_id, id, parent_id, position, name) VALUES
          (${ws(1)}, ${row(1)}, NULL, 0, 'Parent'),
          (${ws(1)}, ${row(2)}, ${row(1)}, 0, 'Child')`);
      await db.execute(sql`
        INSERT INTO units (workspace_id, id, name) VALUES (${ws(1)}, ${row(3)}, 'kg')`);
      await db.execute(sql`
        INSERT INTO products (workspace_id, id, name, category_id, unit_id)
        VALUES (${ws(1)}, ${row(4)}, 'P', ${row(1)}, ${row(3)})`);

      await db.execute(sql`DELETE FROM categories WHERE id = ${row(1)}`);
      expect(await rows(sql`SELECT 1 FROM categories`)).toEqual([]);
      expect(
        await rows(
          sql`SELECT workspace_id AS w, category_id AS c FROM products`,
        ),
      ).toEqual([{ w: ws(1), c: null }]);

      await db.execute(sql`DELETE FROM units`);
      expect(await rows(sql`SELECT unit_id AS u FROM products`)).toEqual([
        { u: null },
      ]);

      await db.execute(sql`
        INSERT INTO units (workspace_id, id, name) VALUES (${ws(1)}, ${row(5)}, 'l')`);
      await db.execute(sql`DELETE FROM workspaces`);
      for (const t of ["units", "categories", "products"]) {
        expect(await rows(sql`SELECT 1 FROM ${sql.identifier(t)}`)).toEqual([]);
      }
    });

    it("refuses an empty or long name and a negative position", async () => {
      await twoWorkspaces();
      for (const name of ["", "x".repeat(101)]) {
        expect(
          await code(sql`INSERT INTO units (workspace_id, id, name)
            VALUES (${ws(1)}, ${row(1)}, ${name})`),
        ).toBe("23514");
        expect(
          await code(sql`INSERT INTO categories (workspace_id, id, position, name)
            VALUES (${ws(1)}, ${row(1)}, 0, ${name})`),
        ).toBe("23514");
        expect(
          await code(sql`INSERT INTO products (workspace_id, id, name)
            VALUES (${ws(1)}, ${row(1)}, ${name})`),
        ).toBe("23514");
      }
      expect(
        await code(sql`INSERT INTO categories (workspace_id, id, position, name)
          VALUES (${ws(1)}, ${row(1)}, -1, 'C')`),
      ).toBe("23514");
    });
  });
});
