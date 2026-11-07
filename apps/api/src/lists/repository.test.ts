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
  updateList,
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

  it("LST-1.2: updateList writes only when a field it was given changes", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000001" };
    await database.db.execute(
      sql`INSERT INTO users (id, name, email, email_verified) VALUES (${user.id}, 'g', 'g@x.test', false)`,
    );
    const context = await ownWorkspace(database.db, user, testCatalog);
    const id = "00000000-0000-4000-8000-000000000002";
    await insertList(database.db, context, { id, name: "A" });
    const updatedAt = async () =>
      (
        await database.db.execute<{ u: string }>(
          sql`SELECT extract(epoch FROM updated_at)::text AS u FROM lists`,
        )
      ).rows[0]?.u;
    const start = await updatedAt();

    // The same values change nothing, whichever field is given.
    await updateList(database.db, context, id, { name: "A" });
    await updateList(database.db, context, id, { sortByCategory: true });
    expect(await updatedAt()).toBe(start);

    // A new value in one field writes, though the other is not given.
    const sorted = await updateList(database.db, context, id, {
      sortByCategory: false,
    });
    expect(sorted?.sortByCategory).toBe(false);
    const afterSort = await updatedAt();
    expect(Number(afterSort)).toBeGreaterThan(Number(start));
    await updateList(database.db, context, id, { name: "B" });
    expect(Number(await updatedAt())).toBeGreaterThan(Number(afterSort));
  });
});
