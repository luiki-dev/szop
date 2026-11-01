import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { workspaces } from "../db/schema.ts";
import { testCatalog } from "../test/catalog.ts";
import { useTestDatabase } from "../test/database.ts";
import { insertCatalog } from "./repository.ts";

const userId = "00000000-0000-4000-8000-000000000001";

describe("insertCatalog", () => {
  const database = useTestDatabase();

  async function newWorkspace() {
    await database.db.execute(
      sql`INSERT INTO users (id, name, email, email_verified) VALUES (${userId}, 'g', 'g@x.test', false)`,
    );
    const [row] = await database.db
      .insert(workspaces)
      .values({ userId })
      .returning({ id: workspaces.id });
    return {
      user: { id: userId },
      workspaceId: row?.id ?? "",
      role: "owner" as const,
    };
  }
  const count = async (table: string) =>
    Number(
      (
        await database.db.execute<{ n: string }>(
          sql.raw(`SELECT count(*) AS n FROM ${table}`),
        )
      ).rows[0]?.n,
    );

  it("ACC-1.4: writes every unit, category and product into the workspace", async () => {
    await insertCatalog(database.db, await newWorkspace(), testCatalog);
    expect(await count("units")).toBe(testCatalog.units.length);
    expect(await count("categories")).toBe(testCatalog.categories.length);
    expect(await count("products")).toBe(testCatalog.products.length);
  });

  it("writes nothing for an empty catalog", async () => {
    await insertCatalog(database.db, await newWorkspace(), {
      units: [],
      categories: [],
      products: [],
    });
    expect(await count("units")).toBe(0);
    expect(await count("categories")).toBe(0);
    expect(await count("products")).toBe(0);
  });
});
