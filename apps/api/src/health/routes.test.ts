import { healthSchema } from "@szop/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.ts";
import { createDatabase } from "../db/database.ts";
import { testConfig } from "../test/config.ts";
import { testDatabaseSettings, useTestDatabase } from "../test/database.ts";
import { captureLog, type LogLine } from "../test/log.ts";

const commit = "0123456789abcdef0123456789abcdef01234567";
const config = testConfig({ commit });

describe("GET /api/health", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("answers 200 with the commit and the schema version when the database is up", async () => {
    app = buildApp({ config, db: database.db });

    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.json()).toEqual({
      status: "ok",
      commit,
      database: { status: "up", schemaVersion: "0000_init" },
    });

    // The schema accepts the real body and drops nothing from it: a field
    // the API adds without the schema would fail here.
    const body: unknown = response.json();
    expect(healthSchema.parse(body)).toEqual(body);
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
        commit,
        database: { status: "down" },
      });

      const body: unknown = response.json();
      expect(healthSchema.parse(body)).toEqual(body);
    } finally {
      await unreachable.$client.end();
    }
  });
});

describe("GET /api/live", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("answers 200 while the database is up", async () => {
    app = buildApp({ config, db: database.db });

    const response = await app.inject({ method: "GET", url: "/api/live" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("answers 200 while the database cannot be reached", async () => {
    const unreachable = createDatabase(
      testDatabaseSettings("szop_test_missing"),
    );
    app = buildApp({ config, db: unreachable });

    try {
      const live = await app.inject({ method: "GET", url: "/api/live" });
      const health = await app.inject({ method: "GET", url: "/api/health" });

      expect(live.statusCode).toBe(200);
      expect(live.json()).toEqual({ status: "ok" });
      expect(health.statusCode).toBe(503);
    } finally {
      await unreachable.$client.end();
    }
  });

  // The load balancer reuses a connection for up to 60 seconds; a shorter
  // timeout would let the API close it just as a request arrives (a 502).
  it("keeps idle connections longer than the load balancer's 60 seconds", () => {
    app = buildApp({ config, db: database.db });

    expect(app.server.keepAliveTimeout).toBeGreaterThan(60_000);
  });
});

describe("the log", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  const requestLines = (lines: LogLine[]): LogLine[] =>
    lines.filter(
      ({ msg }) => msg === "incoming request" || msg === "request completed",
    );

  it.each(["/api/health", "/api/health?probe=1", "/api/live"])(
    "has no request lines for a healthy GET %s",
    async (url) => {
      const log = captureLog();
      app = buildApp({
        config: testConfig({ logLevel: "info" }),
        db: database.db,
        logStream: log.stream,
      });

      const response = await app.inject({ method: "GET", url });

      expect(response.statusCode).toBe(200);
      expect(requestLines(log.lines())).toEqual([]);
    },
  );

  it("still warns when the database cannot be reached, without request lines", async () => {
    const unreachable = createDatabase(
      testDatabaseSettings("szop_test_missing"),
    );
    const log = captureLog();
    app = buildApp({
      config: testConfig({ logLevel: "info" }),
      db: unreachable,
      logStream: log.stream,
    });

    try {
      const response = await app.inject({ method: "GET", url: "/api/health" });

      expect(response.statusCode).toBe(503);
      expect(log.lines()).toContainEqual(
        expect.objectContaining({ msg: "database check failed" }),
      );
      expect(requestLines(log.lines())).toEqual([]);
    } finally {
      await unreachable.$client.end();
    }
  });

  // Fastify 5 deprecates the top-level disableRequestLogging option and
  // warns on every buildApp; Fastify 6 removes it.
  it("builds without a deprecation warning", () => {
    const emitWarning = vi.spyOn(process, "emitWarning");
    try {
      app = buildApp({ config: testConfig(), db: database.db });

      expect(emitWarning).not.toHaveBeenCalled();
    } finally {
      emitWarning.mockRestore();
    }
  });

  it.each(["/api/healthz", "/api/health/x", "/api/live/x", "/api/livez"])(
    "keeps the request lines for GET %s",
    async (url) => {
      const log = captureLog();
      app = buildApp({
        config: testConfig({ logLevel: "info" }),
        db: database.db,
        logStream: log.stream,
      });

      await app.inject({ method: "GET", url });

      expect(log.lines()).toContainEqual(
        expect.objectContaining({ msg: "incoming request" }),
      );
    },
  );
});
