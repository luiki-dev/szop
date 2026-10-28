import { apiErrorSchema, catalogSchema } from "@szop/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";

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
});
