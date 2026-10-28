import { apiErrorSchema } from "@szop/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildApp } from "./app.ts";
import { testCatalog } from "./test/catalog.ts";
import { testConfig } from "./test/config.ts";
import { useTestDatabase } from "./test/database.ts";
import { captureLog } from "./test/log.ts";

describe("the error shape", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  function start(): ReturnType<typeof captureLog> {
    const log = captureLog();
    app = buildApp({
      catalog: testCatalog,
      config: testConfig({ logLevel: "info" }),
      db: database.db,
      logStream: log.stream,
    });
    app.get("/api/test-boom", () => {
      throw new Error("secret detail");
    });
    app.get("/api/test-unavailable", () => {
      throw Object.assign(new Error("secret outage detail"), {
        statusCode: 503,
      });
    });
    app.get("/api/test-conflict", () => {
      throw Object.assign(new Error("Name taken"), { statusCode: 409 });
    });
    app.get(
      "/api/test-query",
      { schema: { querystring: z.object({ n: z.coerce.number().int() }) } },
      () => ({ ok: true }),
    );
    return log;
  }

  it("NFR-4.11: answers an unexpected error with a generic 500 and logs the details", async () => {
    const log = start();

    const response = await app.inject({ method: "GET", url: "/api/test-boom" });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: { code: "internal_error", message: "Internal server error" },
    });
    expect(response.body).not.toContain("secret detail");
    const logged = log.lines().find((line) => line.level === 50);
    expect(logged).toMatchObject({ err: { message: "secret detail" } });
  });

  it("NFR-4.11: answers an error with a 5xx status other than 500 as the same generic 500", async () => {
    const log = start();

    const response = await app.inject({
      method: "GET",
      url: "/api/test-unavailable",
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: { code: "internal_error", message: "Internal server error" },
    });
    expect(response.body).not.toContain("secret outage detail");
    const logged = log.lines().find((line) => line.level === 50);
    expect(logged).toMatchObject({ err: { message: "secret outage detail" } });
  });

  it("keeps the status and message of a client error, with a code from the status", async () => {
    start();

    const response = await app.inject({
      method: "GET",
      url: "/api/test-conflict",
    });

    expect(response.statusCode).toBe(409);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: { code: "conflict", message: "Name taken" },
    });
  });

  it("answers a query that fails its schema with 400 invalid_input", async () => {
    start();

    const response = await app.inject({
      method: "GET",
      url: "/api/test-query?n=x",
    });

    expect(response.statusCode).toBe(400);
    expect(apiErrorSchema.parse(response.json()).error.code).toBe(
      "invalid_input",
    );
  });

  it.each(["/api/nope", "/missing.js"])(
    "answers GET %s with 404",
    async (url) => {
      start();

      const response = await app.inject({ method: "GET", url });

      expect(response.statusCode).toBe(404);
      expect(apiErrorSchema.parse(response.json()).error.code).toBe(
        "not_found",
      );
    },
  );
});
