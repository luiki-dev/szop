import { healthSchema } from "@szop/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.ts";
import { createDatabase } from "../db/database.ts";
import { instanceId } from "../instance.ts";
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
      instance: instanceId,
      database: { status: "up", schemaVersion: "0000_init" },
    });

    // The schema accepts the real body and drops nothing from it: a field
    // the API adds without the schema would fail here.
    const body: unknown = response.json();
    expect(healthSchema.parse(body)).toEqual(body);
  });

  it("names this process with 8 hexadecimal characters, the same on every answer", async () => {
    app = buildApp({ config, db: database.db });

    const first = await app.inject({ method: "GET", url: "/api/health" });
    const second = await app.inject({ method: "GET", url: "/api/health" });

    const instance: unknown = first.json<{ instance: unknown }>().instance;
    expect(instance).toMatch(/^[0-9a-f]{8}$/);
    expect(second.json<{ instance: unknown }>().instance).toBe(instance);
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
        instance: instanceId,
        database: { status: "down" },
      });

      const body: unknown = response.json();
      expect(healthSchema.parse(body)).toEqual(body);
    } finally {
      await unreachable.$client.end();
    }
  });
});

// The landing page on dzwoniec.com asks /api/health from the browser with a
// no-cors request (ADR 0044, decision 5). The browser hands the page the
// answer only if the response's Cross-Origin-Resource-Policy allows it, and
// helmet's default, same-origin, makes the request fail as if nothing had
// answered (ADR 0046).
describe("GET /api/health from pages of the same site", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("lets pages of the same site receive the answer", async () => {
    app = buildApp({ config, db: database.db });

    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.headers["cross-origin-resource-policy"]).toBe("same-site");
  });

  it("allows it when the database is down too, which still counts as an answer", async () => {
    const unreachable = createDatabase(
      testDatabaseSettings("szop_test_missing"),
    );
    app = buildApp({ config, db: unreachable });

    try {
      const response = await app.inject({ method: "GET", url: "/api/health" });

      expect(response.statusCode).toBe(503);
      expect(response.headers["cross-origin-resource-policy"]).toBe(
        "same-site",
      );
    } finally {
      await unreachable.$client.end();
    }
  });

  it.each(["/api/live", "/api/nothing-here"])(
    "keeps every other response same-origin: %s",
    async (url) => {
      app = buildApp({ config, db: database.db });

      const response = await app.inject({ method: "GET", url });

      expect(response.headers["cross-origin-resource-policy"]).toBe(
        "same-origin",
      );
    },
  );
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
