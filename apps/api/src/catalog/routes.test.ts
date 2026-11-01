import { apiErrorSchema, catalogSchema, type Catalog } from "@szop/shared";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { sameOrigin, signIn } from "../test/auth.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { twoWorkspaces } from "../test/workspaces.ts";

describe("GET /api/catalog", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  function start(catalog = testCatalog): FastifyInstance {
    app = buildApp({ config: testConfig(), db: database.db, catalog });
    return app;
  }

  it("PRD-2.1, ACC-1.2: answers GET /api/catalog with the catalog", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/api/catalog",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    // The schema accepts the real body and drops nothing from it.
    const body: unknown = response.json();
    expect(catalogSchema.parse(body)).toEqual(body);
    expect(body).toEqual(testCatalog);
  });

  it("ACC-1.3: sets no cookie", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/api/catalog",
    });

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it.each(["POST", "PUT", "DELETE"] as const)(
    "ACC-1.2: is read-only, %s answers 404",
    async (method) => {
      const response = await start().inject({
        method,
        url: "/api/catalog",
        headers: { "sec-fetch-site": "same-origin" },
      });

      expect(response.statusCode).toBe(404);
      expect(apiErrorSchema.parse(response.json()).error.code).toBe(
        "not_found",
      );
    },
  );

  it("answers a catalog that breaks the schema with a generic 500", async () => {
    const longName = "x".repeat(101);
    const response = await start({
      ...testCatalog,
      units: [{ id: "l", name: longName }],
    }).inject({ method: "GET", url: "/api/catalog" });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: { code: "internal_error", message: "Internal server error" },
    });
    expect(response.body).not.toContain(longName);
  });

  const get = (cookie?: string) =>
    app.inject({
      method: "GET",
      url: "/api/catalog",
      headers: cookie ? { cookie } : {},
    });

  it("ACC-1.3: a session without a workspace gets the seed and no cookie", async () => {
    start();
    const response = await get(await signIn(app));

    expect(response.json()).toEqual(testCatalog);
    expect(response.headers["set-cookie"]).toBeUndefined();
    const rows = await database.db.execute(
      sql`SELECT count(*)::int AS n FROM workspaces`,
    );
    expect(rows.rows[0]).toEqual({ n: 0 });
  });

  it("gives the seed to a cookie whose session row was deleted", async () => {
    start();
    const cookie = await signIn(app);
    await database.db.execute(sql`DELETE FROM sessions`);

    const response = await get(cookie);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(testCatalog);
  });

  it("serves each workspace its own copy", async () => {
    start();
    const [a, b] = await twoWorkspaces(app, database.db, testCatalog);
    await database.db.execute(
      sql`UPDATE products SET name = 'Renamed' WHERE workspace_id = ${a.context.workspaceId}`,
    );

    const names = async (cookie: string) =>
      (await get(cookie)).json<Catalog>().products.map((p) => p.name);
    expect(await names(a.cookie)).toContain("Renamed");
    expect(await names(b.cookie)).not.toContain("Renamed");
  });

  it("serves an empty catalog to a workspace whose rows are gone", async () => {
    start();
    const [a] = await twoWorkspaces(app, database.db, testCatalog);
    await database.db.execute(
      sql`DELETE FROM products WHERE workspace_id = ${a.context.workspaceId}`,
    );
    await database.db.execute(
      sql`DELETE FROM categories WHERE workspace_id = ${a.context.workspaceId}`,
    );
    await database.db.execute(
      sql`DELETE FROM units WHERE workspace_id = ${a.context.workspaceId}`,
    );

    expect((await get(a.cookie)).json()).toEqual({
      units: [],
      categories: [],
      products: [],
    });
  });

  it("ACC-1.9: a workspace keeps the catalog it was created with after the seed changes", async () => {
    const seedB: Catalog = {
      ...testCatalog,
      products: [
        // A renamed seed entry gets a new ID under UUIDv5.
        ...testCatalog.products.map((p, i) =>
          i === 0 ? { ...p, id: randomUUID(), name: "Renamed" } : p,
        ),
        { id: randomUUID(), name: "Extra", categoryId: null, unitId: null },
      ],
    };
    const appA = buildApp({
      config: testConfig(),
      db: database.db,
      catalog: testCatalog,
    });
    const appB = buildApp({
      config: testConfig(),
      db: database.db,
      catalog: seedB,
    });
    app = appB;
    try {
      const makeList = async (target: FastifyInstance) => {
        const cookie = await signIn(target);
        const created = await target.inject({
          method: "POST",
          url: "/api/lists",
          headers: { ...sameOrigin, cookie },
          payload: { id: randomUUID(), name: "Groceries" },
        });
        expect(created.statusCode).toBe(201);
        return cookie;
      };
      const one = await makeList(appA);
      const two = await makeList(appB);

      const byId = (c: Catalog) => ({
        units: [...c.units].sort((x, y) => x.id.localeCompare(y.id)),
        categories: [...c.categories].sort((x, y) => x.id.localeCompare(y.id)),
        products: [...c.products].sort((x, y) => x.id.localeCompare(y.id)),
      });
      expect((await get(one)).json()).toEqual(byId(testCatalog));
      expect(byId((await get(two)).json<Catalog>())).toEqual(byId(seedB));
      expect(byId(testCatalog)).not.toEqual(byId(seedB));
    } finally {
      await appA.close();
    }
  });
});
