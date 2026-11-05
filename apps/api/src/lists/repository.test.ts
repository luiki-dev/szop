import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ownWorkspace } from "../access/workspace.ts";
import { testCatalog } from "../test/catalog.ts";
import { useTestDatabase } from "../test/database.ts";
import {
  deleteList,
  deleteLists,
  insertList,
  listLists,
} from "./repository.ts";

describe("the lists repository", () => {
  const database = useTestDatabase();

  it("takes the workspace context, not a bare workspace ID", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000001" };
    await database.db.execute(
      sql`INSERT INTO users (id, name, email, email_verified) VALUES (${user.id}, 'g', 'g@x.test', false)`,
    );
    const context = await ownWorkspace(database.db, user, testCatalog);
    const id = "00000000-0000-4000-8000-000000000002";
    const { list } = await insertList(database.db, context, { id, name: "A" });

    expect(await listLists(database.db, context)).toEqual([list]);
    // Never called: only the type is checked.
    const typeOnly = () =>
      // @ts-expect-error a workspace ID alone is no longer accepted
      listLists(database.db, context.workspaceId);
    expect(typeOnly).toBeTypeOf("function");
  });

  it("LST-1.3: deleteList says whether it deleted a row", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000001" };
    await database.db.execute(
      sql`INSERT INTO users (id, name, email, email_verified) VALUES (${user.id}, 'g', 'g@x.test', false)`,
    );
    const context = await ownWorkspace(database.db, user, testCatalog);
    const id = "00000000-0000-4000-8000-000000000002";
    await insertList(database.db, context, { id, name: "A" });

    expect(await deleteList(database.db, context, id)).toBe(true);
    expect(await deleteList(database.db, context, id)).toBe(false);
  });

  it("LST-1.8: a failure after deleteLists in a transaction leaves every list", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000001" };
    await database.db.execute(
      sql`INSERT INTO users (id, name, email, email_verified) VALUES (${user.id}, 'g', 'g@x.test', false)`,
    );
    const context = await ownWorkspace(database.db, user, testCatalog);
    const ids = [
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    ];
    for (const id of ids)
      await insertList(database.db, context, { id, name: "A" });

    await expect(
      database.db.transaction(async (tx) => {
        await deleteLists(tx, context, ids);
        expect(await listLists(tx, context)).toEqual([]);
        throw new Error("forced");
      }),
    ).rejects.toThrow("forced");

    expect(await listLists(database.db, context)).toHaveLength(2);
  });
});
