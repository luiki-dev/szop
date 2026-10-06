import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { Config } from "../config.ts";
import { createDatabase } from "../db/database.ts";
import { testDatabaseSettings, useTestDatabase } from "../test/database.ts";

const config: Config = {
  host: "127.0.0.1",
  port: 3000,
  logLevel: "silent",
  // Not used: each test passes its own database to buildApp.
  database: { host: "", port: 1, name: "", user: "", password: "" },
};

describe("GET /api/health", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("answers 200 with the schema version when the database is up", async () => {
    app = buildApp({ config, db: database.db });

    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.json()).toEqual({
      status: "ok",
      database: { status: "up", schemaVersion: "0000_init" },
    });
  });

  it("answers 503 when the database cannot be reached", async () => {
    // A database that does not exist fails at once; a stopped server can
    // take the pool's whole connection timeout to fail.
    const unreachable = createDatabase(
      testDatabaseSettings("szop_test_missing"),
    );
    app = buildApp({ config, db: unreachable });

    try {
      const response = await app.inject({ method: "GET", url: "/api/health" });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({
        status: "error",
        database: { status: "down" },
      });
    } finally {
      await unreachable.$client.end();
    }
  });
});
