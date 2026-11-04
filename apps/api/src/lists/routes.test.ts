import { randomUUID } from "node:crypto";
import { listsResponseSchema, listSchema } from "@szop/shared";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.ts";
import { loadSeed } from "../catalog/seed.ts";
import { sameOrigin, signIn } from "../test/auth.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { twoWorkspaces } from "../test/workspaces.ts";

describe("the lists routes", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;
  let a: string;
  let b: string;

  beforeEach(async () => {
    app = buildApp({
      config: testConfig(),
      db: database.db,
      catalog: testCatalog,
    });
    a = await signIn(app);
    b = await signIn(app);
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (cookie: string | undefined, payload: unknown) =>
    app.inject({
      method: "POST",
      url: "/api/lists",
      headers: { ...sameOrigin, ...(cookie ? { cookie } : {}) },
      payload: payload as object,
    });
  const patch = (cookie: string | undefined, id: string, name: string) =>
    app.inject({
      method: "PATCH",
      url: `/api/lists/${id}`,
      headers: { ...sameOrigin, ...(cookie ? { cookie } : {}) },
      payload: { name },
    });
  const get = (cookie: string | undefined, url: string) =>
    app.inject({
      method: "GET",
      url,
      headers: cookie ? { cookie } : {},
    });
  const count = async (table: string) =>
    Number(
      (
        await database.db.execute<{ n: string }>(
          sql.raw(`SELECT count(*) AS n FROM ${table}`),
        )
      ).rows[0]?.n,
    );

  it("LST-1.1: creates a list, repeats idempotently, keeps the first name, separates guests", async () => {
    const id = randomUUID();
    const first = await post(a, { id, name: "Weekly" });
    expect(first.statusCode).toBe(201);
    const list = listSchema.parse(first.json());
    expect(list).toMatchObject({ id, name: "Weekly" });

    const again = await post(a, { id, name: "Weekly" });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(list);

    const renamed = await post(a, { id, name: "Other" });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toEqual(list);

    const theirs = await post(b, { id, name: "Mine" });
    expect(theirs.statusCode).toBe(201);
    expect(theirs.json()).toMatchObject({ id, name: "Mine" });
    expect(await count("lists")).toBe(2);
  });

  it("ACC-1.1: the first POST makes one workspace, also for two at once", async () => {
    const [x, y] = await Promise.all([
      post(a, { id: randomUUID(), name: "One" }),
      post(a, { id: randomUUID(), name: "Two" }),
    ]);
    expect([x.statusCode, y.statusCode]).toEqual([201, 201]);
    expect(await count("workspaces")).toBe(1);
    expect(await count("lists")).toBe(2);
  });

  it("POST without a cookie is 401 unauthorized", async () => {
    const response = await post(undefined, { id: randomUUID(), name: "X" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "unauthorized" } });
    expect(response.json()).toMatchObject({
      error: { message: "Sign-in required" },
    });
  });

  it.each([
    ["a missing id", { name: "X" }],
    ["a bad id", { id: "x", name: "X" }],
    ["a blank name", { id: randomUUID(), name: "   " }],
    ["a 101-character name", { id: randomUUID(), name: "a".repeat(101) }],
  ])("POST with %s is 400 invalid_input", async (_label, payload) => {
    const response = await post(a, payload);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "invalid_input" } });
  });

  it("LST-1.1: stores a decomposed name composed", async () => {
    const response = await post(a, { id: randomUUID(), name: "ó" });
    expect(response.statusCode).toBe(201);
    expect(listSchema.parse(response.json()).name).toBe("ó");
  });

  it("LST-2.1: lists newest first; no cookie or no workspace gives none", async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, id] of ids.entries())
      await post(a, { id, name: `L${String(i)}` });

    const response = await get(a, "/api/lists");
    expect(
      listsResponseSchema.parse(response.json()).lists.map((l) => l.id),
    ).toEqual([...ids].reverse());

    const anonymous = await get(undefined, "/api/lists");
    expect(anonymous.json()).toEqual({ lists: [] });
    expect(anonymous.headers["set-cookie"]).toBeUndefined();

    expect((await get(b, "/api/lists")).json()).toEqual({ lists: [] });
  });

  it("NFR-4.10: a foreign, missing, malformed or sessionless list is one 404", async () => {
    const id = randomUUID();
    await post(a, { id, name: "Mine" });
    await post(b, { id: randomUUID(), name: "Theirs" });

    const missing = await get(b, `/api/lists/${randomUUID()}`);
    expect(missing.statusCode).toBe(404);
    const foreign = await get(b, `/api/lists/${id}`);
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json()).toEqual(missing.json());
    const foreignPatch = await patch(b, id, "Hijack");
    expect(foreignPatch.statusCode).toBe(404);
    expect(foreignPatch.json()).toEqual(missing.json());

    const notFound = { error: { code: "not_found", message: "Not found" } };
    expect(missing.json()).toEqual(notFound);
    const malformed = await get(b, "/api/lists/not-a-uuid");
    expect(malformed.statusCode).toBe(404);
    expect(malformed.json()).toEqual(notFound);
    const malformedPatch = await patch(b, "not-a-uuid", "X");
    expect(malformedPatch.statusCode).toBe(404);
    expect(malformedPatch.json()).toEqual(notFound);
    expect((await get(undefined, `/api/lists/${id}`)).statusCode).toBe(404);
    expect((await patch(undefined, id, "X")).statusCode).toBe(404);
    expect((await get(a, `/api/lists/${id}`)).json()).toMatchObject({
      name: "Mine",
    });
  });

  it("NFR-4.10: a guest made by twoWorkspaces cannot read the other's list", async () => {
    const [one, two] = await twoWorkspaces(app, database.db, testCatalog);
    const id = randomUUID();
    const created = await one.inject({
      method: "POST",
      url: "/api/lists",
      payload: { id, name: "Mine" },
    });
    expect(created.statusCode).toBe(201);
    expect(
      (await one.inject({ method: "GET", url: `/api/lists/${id}` })).statusCode,
    ).toBe(200);
    expect(
      (await two.inject({ method: "GET", url: `/api/lists/${id}` })).statusCode,
    ).toBe(404);
  });

  it("GET /api/lists/:id reads the lists table once", async () => {
    const id = randomUUID();
    await post(a, { id, name: "Mine" });
    const spy = vi.spyOn(database.db.$client, "query");
    try {
      expect((await get(a, `/api/lists/${id}`)).statusCode).toBe(200);
      const reads = spy.mock.calls.filter(([query]) =>
        /from "lists"/i.test(
          typeof query === "string"
            ? query
            : ((query as { text?: string }).text ?? ""),
        ),
      );
      expect(reads).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("LST-1.2: renames, and leaves updated_at alone for the same name", async () => {
    const id = randomUUID();
    await post(a, { id, name: "Old" });
    const updatedAt = async () =>
      Number(
        (
          await database.db.execute<{ u: string }>(
            sql`SELECT extract(epoch FROM updated_at)::text AS u FROM lists`,
          )
        ).rows[0]?.u,
      );
    const before = await updatedAt();

    const renamed = await patch(a, id, " New ");
    expect(renamed.statusCode).toBe(200);
    expect(listSchema.parse(renamed.json()).name).toBe("New");
    const after = await updatedAt();
    expect(after).toBeGreaterThan(before);

    const same = await patch(a, id, "New");
    expect(same.statusCode).toBe(200);
    expect(await updatedAt()).toBe(after);
  });

  it.each(["a\u0000b", "a\u202eb"])(
    "LST-1.1: a name with a control character (%j) is 400 on create and rename",
    async (name) => {
      const id = randomUUID();
      const created = await post(a, { id, name });
      expect(created.statusCode).toBe(400);
      expect(created.json()).toMatchObject({
        error: { code: "invalid_input" },
      });
      await post(a, { id, name: "Ok" });
      const renamed = await patch(a, id, name);
      expect(renamed.statusCode).toBe(400);
      expect(renamed.json()).toMatchObject({
        error: { code: "invalid_input" },
      });
    },
  );

  // No body, so no JSON content type (Fastify refuses an empty JSON body).
  const del = (cookie: string | undefined, id: string) =>
    app.inject({
      method: "DELETE",
      url: `/api/lists/${id}`,
      headers: {
        "sec-fetch-site": sameOrigin["sec-fetch-site"],
        origin: sameOrigin.origin,
        ...(cookie ? { cookie } : {}),
      },
    });
  const delMany = (cookie: string | undefined, payload: unknown) =>
    app.inject({
      method: "POST",
      url: "/api/lists/delete",
      headers: { ...sameOrigin, ...(cookie ? { cookie } : {}) },
      payload: payload as object,
    });

  it("LST-1.3: DELETE removes the list; a foreign, missing and non-UUID ID are one 404", async () => {
    const [one, two] = await twoWorkspaces(app, database.db, testCatalog);
    const mine = randomUUID();
    const theirs = randomUUID();
    await one.inject({
      method: "POST",
      url: "/api/lists",
      payload: { id: mine, name: "Mine" },
    });
    await two.inject({
      method: "POST",
      url: "/api/lists",
      payload: { id: theirs, name: "Theirs" },
    });

    const missing = await del(one.cookie, randomUUID());
    expect(missing.statusCode).toBe(404);
    const foreign = await del(one.cookie, theirs);
    const malformed = await del(one.cookie, "not-a-uuid");
    expect(foreign.statusCode).toBe(404);
    expect(malformed.statusCode).toBe(404);
    expect(foreign.body).toBe(missing.body);
    expect(malformed.body).toBe(missing.body);
    expect(
      (await two.inject({ method: "GET", url: `/api/lists/${theirs}` }))
        .statusCode,
    ).toBe(200);

    const deleted = await del(one.cookie, mine);
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe("");
    expect(
      (await one.inject({ method: "GET", url: `/api/lists/${mine}` }))
        .statusCode,
    ).toBe(404);
  });

  it("LST-1.8: POST /lists/delete deletes the caller's lists among ids, skips foreign ones", async () => {
    const [one, two] = await twoWorkspaces(app, database.db, testCatalog);
    const [x, y, z, theirs] = [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ];
    for (const id of [x, y, z])
      await one.inject({
        method: "POST",
        url: "/api/lists",
        payload: { id, name: "L" },
      });
    await two.inject({
      method: "POST",
      url: "/api/lists",
      payload: { id: theirs, name: "T" },
    });

    const response = await delMany(one.cookie, {
      ids: [x, y, theirs, randomUUID()],
    });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    const remaining = await one.inject({ method: "GET", url: "/api/lists" });
    expect(
      remaining.json<{ lists: { id: string }[] }>().lists.map((l) => l.id),
    ).toEqual([z]);
    expect(
      (await two.inject({ method: "GET", url: `/api/lists/${theirs}` }))
        .statusCode,
    ).toBe(200);
  });

  it.each([
    ["no ids", { ids: [] }],
    ["101 ids", { ids: Array.from({ length: 101 }, () => randomUUID()) }],
    ["a missing ids", {}],
    ["a non-UUID", { ids: ["x"] }],
  ])("LST-1.8: POST /lists/delete with %s is 400", async (_label, payload) => {
    const response = await delMany(a, payload);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "invalid_input" } });
  });

  it("LST-1.8: POST /lists/delete with a duplicated ID is 400 and deletes nothing", async () => {
    const id = randomUUID();
    await post(a, { id, name: "Keep" });
    expect((await delMany(a, { ids: [id, id] })).statusCode).toBe(400);
    expect((await get(a, `/api/lists/${id}`)).statusCode).toBe(200);
  });

  it("both delete routes are 401 without a session", async () => {
    const id = randomUUID();
    for (const response of [
      await del(undefined, id),
      await delMany(undefined, { ids: [id] }),
    ]) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: { code: "unauthorized", message: "Sign-in required" },
      });
    }
  });

  it("with no workspace, DELETE is 404, POST /lists/delete is 204, and neither makes a workspace", async () => {
    expect((await del(a, randomUUID())).statusCode).toBe(404);
    expect((await delMany(a, { ids: [randomUUID()] })).statusCode).toBe(204);
    expect(await count("workspaces")).toBe(0);
  });

  it("LST-1.2: PATCH with a blank name is 400 invalid_input", async () => {
    const id = randomUUID();
    await post(a, { id, name: "Old" });

    const response = await patch(a, id, "   ");

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "invalid_input" } });
  });

  const sortById = <T extends { id: string }>(rows: T[]) =>
    [...rows].sort((x, y) => x.id.localeCompare(y.id));
  const rowsOf = async (table: string) =>
    (await database.db.execute(sql.raw(`SELECT * FROM ${table}`))).rows;
  const catalogRows = async () => ({
    units: sortById(
      (await rowsOf("units")).map((r) => ({
        id: r.id as string,
        name: r.name as string,
      })),
    ),
    categories: sortById(
      (await rowsOf("categories")).map((r) => ({
        id: r.id as string,
        parentId: r.parent_id as string | null,
        position: r.position as number,
        name: r.name as string,
      })),
    ),
    products: sortById(
      (await rowsOf("products")).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        categoryId: r.category_id as string | null,
        unitId: r.unit_id as string | null,
      })),
    ),
  });

  it("ACC-1.4: the first POST copies the catalog into the new workspace", async () => {
    const response = await post(a, { id: randomUUID(), name: "Weekly" });
    expect(response.statusCode).toBe(201);
    expect(await count("lists")).toBe(1);
    expect(await catalogRows()).toEqual({
      units: sortById(testCatalog.units),
      categories: sortById(testCatalog.categories),
      products: sortById(testCatalog.products),
    });
  });

  it("UNT-1.1: the copy of the seed holds the default units", async () => {
    const seeded = buildApp({
      config: testConfig(),
      db: database.db,
      catalog: loadSeed(),
    });
    try {
      const cookie = await signIn(seeded);
      const response = await seeded.inject({
        method: "POST",
        url: "/api/lists",
        headers: { ...sameOrigin, cookie },
        payload: { id: randomUUID(), name: "Weekly" },
      });
      expect(response.statusCode).toBe(201);
    } finally {
      await seeded.close();
    }
    const names = (await catalogRows()).units.map((u) => u.name);
    expect(names).toEqual(
      expect.arrayContaining(["pcs", "kg", "g", "l", "ml", "pack"]),
    );
  });

  it("ACC-1.6: two concurrent first POSTs copy the catalog once", async () => {
    const [x, y] = await Promise.all([
      post(a, { id: randomUUID(), name: "One" }),
      post(a, { id: randomUUID(), name: "Two" }),
    ]);
    expect([x.statusCode, y.statusCode]).toEqual([201, 201]);
    expect(await count("workspaces")).toBe(1);
    expect(await count("lists")).toBe(2);
    expect(await count("units")).toBe(testCatalog.units.length);
    expect(await count("categories")).toBe(testCatalog.categories.length);
    expect(await count("products")).toBe(testCatalog.products.length);
  });

  it("a second POST copies nothing", async () => {
    await post(a, { id: randomUUID(), name: "One" });
    await post(a, { id: randomUUID(), name: "Two" });
    expect(await count("units")).toBe(testCatalog.units.length);
    expect(await count("categories")).toBe(testCatalog.categories.length);
    expect(await count("products")).toBe(testCatalog.products.length);
  });

  it("a failed copy is a 500 and leaves no workspace, list or catalog row", async () => {
    const broken = buildApp({
      config: testConfig(),
      db: database.db,
      catalog: {
        ...testCatalog,
        products: [
          {
            id: randomUUID(),
            name: "Orphan",
            categoryId: null,
            unitId: randomUUID(),
          },
        ],
      },
    });
    try {
      const cookie = await signIn(broken);
      const response = await broken.inject({
        method: "POST",
        url: "/api/lists",
        headers: { ...sameOrigin, cookie },
        payload: { id: randomUUID(), name: "Weekly" },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await broken.close();
    }
    for (const table of [
      "workspaces",
      "lists",
      "units",
      "categories",
      "products",
    ]) {
      expect(await count(table)).toBe(0);
    }
  });
});
