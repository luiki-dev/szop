import { randomUUID } from "node:crypto";
import { listsResponseSchema, listSchema } from "@szop/shared";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { sameOrigin, signIn } from "../test/auth.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";

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

  it("LST-1.2: PATCH with a blank name is 400 invalid_input", async () => {
    const id = randomUUID();
    await post(a, { id, name: "Old" });

    const response = await patch(a, id, "   ");

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "invalid_input" } });
  });
});
