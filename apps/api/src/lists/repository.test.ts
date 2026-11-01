import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ownWorkspace } from "../access/workspace.ts";
import { testCatalog } from "../test/catalog.ts";
import { useTestDatabase } from "../test/database.ts";
import { insertList, listLists } from "./repository.ts";

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
});
