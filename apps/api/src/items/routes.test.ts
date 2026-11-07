import { randomUUID } from "node:crypto";
import { listItemSchema } from "@szop/shared";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { sameOrigin, signIn } from "../test/auth.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { twoWorkspaces, type Guest } from "../test/workspaces.ts";

const [dairy] = testCatalog.categories;
const [litre] = testCatalog.units;
const notFound = { error: { code: "not_found", message: "Not found" } };

describe("the items routes", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;
  let one: Guest;
  let two: Guest;

  beforeEach(async () => {
    app = buildApp({
      config: testConfig(),
      db: database.db,
      catalog: testCatalog,
    });
    [one, two] = await twoWorkspaces(app, database.db, testCatalog);
  });

  afterEach(async () => {
    await app.close();
  });

  const makeList = async (guest: Guest) => {
    const id = randomUUID();
    const response = await guest.inject({
      method: "POST",
      url: "/api/lists",
      payload: { id, name: "L" },
    });
    expect(response.statusCode).toBe(201);
    return id;
  };
  const create = (guest: Guest, listId: string, payload: object) =>
    guest.inject({
      method: "POST",
      url: `/api/lists/${listId}/items`,
      payload,
    });
  const update = (guest: Guest, listId: string, id: string, payload: object) =>
    guest.inject({
      method: "PATCH",
      url: `/api/lists/${listId}/items/${id}`,
      payload,
    });
  // No body, so no JSON content type (Fastify refuses an empty JSON body).
  const noBody = {
    "sec-fetch-site": sameOrigin["sec-fetch-site"],
    origin: sameOrigin.origin,
  };
  const remove = (guest: Guest, listId: string, id: string) =>
    app.inject({
      method: "DELETE",
      url: `/api/lists/${listId}/items/${id}`,
      headers: { ...noBody, cookie: guest.cookie },
    });
  const read = async (guest: Guest, listId: string) =>
    (await guest.inject({ method: "GET", url: `/api/lists/${listId}` })).json<{
      sortByCategory: boolean;
      name: string;
      items: unknown[];
    }>();
  const count = async () =>
    Number(
      (
        await database.db.execute<{ n: string }>(
          sql`SELECT count(*) AS n FROM list_items`,
        )
      ).rows[0]?.n,
    );

  it("NET-1.6: creating twice with the same ID makes one item", async () => {
    const listId = await makeList(one);
    const id = randomUUID();
    const first = await create(one, listId, { id, name: "Milk" });
    expect(first.statusCode).toBe(201);
    const again = await create(one, listId, { id, name: "Other" });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first.json());
    expect(await count()).toBe(1);
  });

  it("ITM-2.3: an item made from a name has no category, quantity, unit, price or note", async () => {
    const listId = await makeList(one);
    const id = randomUUID();
    const response = await create(one, listId, { id, name: " Milk " });
    expect(listItemSchema.parse(response.json())).toEqual({
      id,
      name: "Milk",
      quantity: null,
      unitId: null,
      price: null,
      categoryId: null,
      note: null,
      checkedAt: null,
    });
  });

  it("ITM-6.1: updates each field, and several at once", async () => {
    const listId = await makeList(one);
    const id = randomUUID();
    await create(one, listId, { id, name: "Milk" });
    const changes = [
      { name: "Oat milk" },
      { quantity: 2500 },
      { unitId: litre?.id },
      { price: 199 },
      { categoryId: dairy?.id },
      { note: "organic" },
    ];
    for (const change of changes) {
      const response = await update(one, listId, id, change);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject(change);
    }
    const all = {
      name: "Milk",
      quantity: 1000,
      unitId: null,
      price: null,
      categoryId: null,
      note: null,
    };
    const response = await update(one, listId, id, all);
    expect(response.json()).toEqual({ id, checkedAt: null, ...all });
  });

  it("ITM-6.2: editing an item changes only that item", async () => {
    const listId = await makeList(one);
    const [x = "", y = ""] = [randomUUID(), randomUUID()].sort();
    await create(one, listId, { id: x, name: "X" });
    const other = await create(one, listId, { id: y, name: "Y", price: 5 });
    await update(one, listId, x, { name: "X2", price: 1 });
    const { items } = await read(one, listId);
    expect(items).toEqual([
      expect.objectContaining({ id: x, name: "X2", price: 1 }),
      other.json(),
    ]);
  });

  it("ITM-7.2 and ITM-7.4: checking twice stays checked and stores the later time; false clears it", async () => {
    const listId = await makeList(one);
    const id = randomUUID();
    await create(one, listId, { id, name: "Milk" });
    const first = await update(one, listId, id, { checked: true });
    const firstAt = listItemSchema.parse(first.json()).checkedAt;
    expect(firstAt).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await update(one, listId, id, { checked: true });
    const secondAt = listItemSchema.parse(second.json()).checkedAt;
    expect(Date.parse(secondAt ?? "")).toBeGreaterThan(
      Date.parse(firstAt ?? ""),
    );
    const cleared = await update(one, listId, id, { checked: false });
    expect(cleared.json()).toMatchObject({ checkedAt: null });
  });

  it("APP-3.1: Undo's create brings back every field, checkedAt included", async () => {
    const listId = await makeList(one);
    const item = {
      id: randomUUID(),
      name: "Milk",
      quantity: 2000,
      unitId: litre?.id,
      price: 150,
      categoryId: dairy?.id,
      note: "semi-skimmed",
      checkedAt: "2026-11-06T10:00:00.000Z",
    };
    expect((await create(one, listId, item)).statusCode).toBe(201);
    expect((await remove(one, listId, item.id)).statusCode).toBe(204);
    const back = await create(one, listId, item);
    expect(back.statusCode).toBe(201);
    expect(back.json()).toEqual(item);
  });

  it("ORD-5.1: the list's sort setting is saved", async () => {
    const listId = await makeList(one);
    expect((await read(one, listId)).sortByCategory).toBe(true);
    const response = await one.inject({
      method: "PATCH",
      url: `/api/lists/${listId}`,
      payload: { sortByCategory: false },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ sortByCategory: false, name: "L" });
    expect(await read(one, listId)).toMatchObject({
      sortByCategory: false,
      name: "L",
      items: [],
    });
    const both = await one.inject({
      method: "PATCH",
      url: `/api/lists/${listId}`,
      payload: { name: "New", sortByCategory: true },
    });
    expect(both.json()).toMatchObject({ sortByCategory: true, name: "New" });
    const empty = await one.inject({
      method: "PATCH",
      url: `/api/lists/${listId}`,
      payload: {},
    });
    expect(empty.statusCode).toBe(400);
  });

  it("NFR-4.10: another workspace's list, category, unit or item, and another list's item, are one 404", async () => {
    const mine = await makeList(one);
    const theirs = await makeList(two);
    const otherList = await makeList(one);
    const id = randomUUID();
    await create(one, mine, { id, name: "Mine" });
    const theirItem = randomUUID();
    await create(two, theirs, { id: theirItem, name: "Theirs" });

    // A catalog ID that exists only in the other workspace.
    const foreignCategory = randomUUID();
    const foreignUnit = randomUUID();
    await database.db.execute(sql`
      INSERT INTO categories (workspace_id, id, name, position)
      VALUES (${two.context.workspaceId}, ${foreignCategory}, 'C', 0)`);
    await database.db.execute(sql`
      INSERT INTO units (workspace_id, id, name)
      VALUES (${two.context.workspaceId}, ${foreignUnit}, 'u')`);

    const responses = [
      await create(one, theirs, { id: randomUUID(), name: "X" }),
      await create(one, mine, {
        id: randomUUID(),
        name: "X",
        categoryId: foreignCategory,
      }),
      await create(one, mine, {
        id: randomUUID(),
        name: "X",
        unitId: foreignUnit,
      }),
      await update(one, mine, id, { categoryId: foreignCategory }),
      await update(one, mine, id, { unitId: foreignUnit }),
      await update(one, theirs, theirItem, { name: "Hijack" }),
      await update(one, theirs, theirItem, { checked: true }),
      await remove(one, theirs, theirItem),
      await update(one, otherList, id, { name: "Wrong list" }),
      await remove(one, otherList, id),
      await update(one, mine, randomUUID(), { name: "X" }),
      await update(one, mine, "not-a-uuid", { name: "X" }),
      await create(one, "not-a-uuid", { id: randomUUID(), name: "X" }),
    ];
    for (const response of responses) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(notFound);
    }
    expect(await read(two, theirs)).toMatchObject({
      items: [{ id: theirItem, name: "Theirs", checkedAt: null }],
    });
    expect(await read(one, mine)).toMatchObject({
      items: [{ id, name: "Mine", categoryId: null, unitId: null }],
    });
  });

  it("LIM-2.1: the API refuses a name over 100 and a note over 500", async () => {
    const listId = await makeList(one);
    const id = randomUUID();
    await create(one, listId, { id, name: "Milk" });
    const bad = [
      await create(one, listId, { id: randomUUID(), name: "a".repeat(101) }),
      await create(one, listId, {
        id: randomUUID(),
        name: "a",
        note: "n".repeat(501),
      }),
      await update(one, listId, id, { name: "a".repeat(101) }),
      await update(one, listId, id, { note: "n".repeat(501) }),
    ];
    for (const response of bad) {
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: "invalid_input" },
      });
    }
    const ok = await update(one, listId, id, { note: "n".repeat(500) });
    expect(ok.statusCode).toBe(200);
  });

  it("ACC-1.5: a guest's item with a default category and unit is saved", async () => {
    const cookie = await signIn(app);
    const listId = randomUUID();
    const headers = { ...sameOrigin, cookie };
    const made = await app.inject({
      method: "POST",
      url: "/api/lists",
      headers,
      payload: { id: listId, name: "First" },
    });
    expect(made.statusCode).toBe(201);
    const response = await app.inject({
      method: "POST",
      url: `/api/lists/${listId}/items`,
      headers,
      payload: {
        id: randomUUID(),
        name: "Milk",
        categoryId: dairy?.id,
        unitId: litre?.id,
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      categoryId: dairy?.id,
      unitId: litre?.id,
    });
  });

  it("GET returns the list's items in the order added; deleting an item removes it", async () => {
    const listId = await makeList(one);
    const ids = [randomUUID(), randomUUID()].sort();
    for (const id of [...ids].reverse())
      await create(one, listId, { id, name: "N" });
    const { items } = await read(one, listId);
    expect(items.map((i) => (i as { id: string }).id)).toEqual(ids);
    const deleted = await remove(one, listId, ids[0] ?? "");
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe("");
    expect((await read(one, listId)).items).toHaveLength(1);
  });

  it("every item write is 401 without a session", async () => {
    const listId = randomUUID();
    const id = randomUUID();
    const send = (method: "POST" | "PATCH" | "DELETE", url: string) =>
      method === "DELETE"
        ? app.inject({ method, url, headers: noBody })
        : app.inject({
            method,
            url,
            headers: sameOrigin,
            payload: { id, name: "X" },
          });
    const responses = [
      await send("POST", `/api/lists/${listId}/items`),
      await send("PATCH", `/api/lists/${listId}/items/${id}`),
      await send("DELETE", `/api/lists/${listId}/items/${id}`),
    ];
    for (const response of responses) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: { code: "unauthorized", message: "Sign-in required" },
      });
    }
  });
});
