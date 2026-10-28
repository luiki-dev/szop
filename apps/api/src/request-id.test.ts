import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { testCatalog } from "./test/catalog.ts";
import { testConfig } from "./test/config.ts";
import { useTestDatabase } from "./test/database.ts";
import { captureLog, type LogLine } from "./test/log.ts";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Two tasks behind the load balancer must not both log req-1, req-2… for
// different requests (ADR 0036, decision 10; PH-37 spec, decision 4).
describe("request IDs", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  const incomingIds = (lines: LogLine[]): unknown[] =>
    lines
      .filter(({ msg }) => msg === "incoming request")
      .map(({ reqId }) => reqId);

  it("gives each request a random UUID", async () => {
    const log = captureLog();
    app = buildApp({
      catalog: testCatalog,
      config: testConfig({ logLevel: "info" }),
      db: database.db,
      logStream: log.stream,
    });

    await app.inject({ method: "GET", url: "/" });
    await app.inject({ method: "GET", url: "/" });

    const ids = incomingIds(log.lines());
    expect(ids).toHaveLength(2);
    expect(ids[0]).toMatch(uuid);
    expect(ids[1]).toMatch(uuid);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("ignores an ID the client sends", async () => {
    const log = captureLog();
    app = buildApp({
      catalog: testCatalog,
      config: testConfig({ logLevel: "info" }),
      db: database.db,
      logStream: log.stream,
    });

    await app.inject({
      method: "GET",
      url: "/",
      headers: {
        "request-id": "chosen",
        "x-amzn-trace-id": "Root=1-67891233-abcdef012345678912345678",
      },
    });

    const [id] = incomingIds(log.lines());
    expect(id).toMatch(uuid);
    expect(String(id)).not.toContain("chosen");
    expect(String(id)).not.toContain("67891233");
  });
});
