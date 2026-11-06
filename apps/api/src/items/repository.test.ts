import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ownWorkspace } from "../access/workspace.ts";
import { testCatalog } from "../test/catalog.ts";
import { useTestDatabase } from "../test/database.ts";
import { insertList } from "../lists/repository.ts";
import {
  insertItem,
  isForeignKeyViolation,
  listItemsOf,
  updateItem,
} from "./repository.ts";

describe("isForeignKeyViolation", () => {
  it("NFR-4.10: sees code 23503 on the error or on its cause, nothing else", () => {
    expect(isForeignKeyViolation({ code: "23503" })).toBe(true);
    expect(
      isForeignKeyViolation(new Error("x", { cause: { code: "23503" } })),
    ).toBe(true);
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
    expect(isForeignKeyViolation(new Error("x"))).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
  });
});

describe("the items repository", () => {
  const database = useTestDatabase();

  async function setup() {
    const user = { id: "00000000-0000-4000-8000-000000000001" };
    await database.db.execute(
      sql`INSERT INTO users (id, name, email, email_verified) VALUES (${user.id}, 'g', 'g@x.test', false)`,
    );
    const context = await ownWorkspace(database.db, user, testCatalog);
    const listId = "00000000-0000-4000-8000-000000000002";
    await insertList(database.db, context, { id: listId, name: "A" });
    return { context, listId };
  }
  const itemId = "00000000-0000-4000-8000-000000000003";
  const checkedAt = "2026-01-02T03:04:05.000Z";
  // A value the database refuses with an error that is not a reference's.
  const tooBig = 3_000_000_000;

  it("NFR-4.10: an error that is not a refused reference is thrown, not turned into null", async () => {
    const { context, listId } = await setup();

    await expect(
      insertItem(database.db, context, listId, {
        id: itemId,
        name: "A",
        quantity: tooBig,
      }),
    ).rejects.toThrow();
    await insertItem(database.db, context, listId, { id: itemId, name: "A" });
    await expect(
      updateItem(database.db, context, listId, itemId, { quantity: tooBig }),
    ).rejects.toThrow();
  });

  it("ITM-7.4: an update without `checked` leaves the check as it is", async () => {
    const { context, listId } = await setup();
    await insertItem(database.db, context, listId, {
      id: itemId,
      name: "A",
      checkedAt,
    });

    await updateItem(database.db, context, listId, itemId, { name: "B" });

    const [item] = await listItemsOf(database.db, context, listId);
    expect(item).toMatchObject({ name: "B", checkedAt });
  });
});
