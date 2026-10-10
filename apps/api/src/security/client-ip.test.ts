import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { captureLog } from "../test/log.ts";

// The client wrote the first entry; the load balancer appended the second,
// the address it saw (ADR 0012, decision 13; ADR 0025, decision 7).
const forged = { "x-forwarded-for": "6.6.6.6, 203.0.113.7" };

describe("the client address", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  // The remoteAddress the log recorded for one request.
  async function loggedAddress(
    trustedProxies: string[],
    remoteAddress: string,
    headers: Record<string, string>,
  ): Promise<unknown> {
    const log = captureLog();
    app = buildApp({
      config: testConfig({ logLevel: "info", trustedProxies }),
      db: database.db,
      logStream: log.stream,
    });
    await app.inject({
      method: "GET",
      url: "/api/health",
      remoteAddress,
      headers,
    });
    const incoming = log
      .lines()
      .find((line) => line.msg === "incoming request");
    return (incoming?.req as { remoteAddress?: unknown } | undefined)
      ?.remoteAddress;
  }

  it.each([
    ["through the load balancer", "10.0.1.5", "203.0.113.7"],
    [
      "through the load balancer, seen as IPv6",
      "::ffff:10.0.1.5",
      "203.0.113.7",
    ],
    ["from a client connecting directly", "198.51.100.9", "198.51.100.9"],
  ])(
    "trusting 10.0.0.0/16, logs a request %s (from %s) as %s",
    async (_, from, expected) => {
      expect(await loggedAddress(["10.0.0.0/16"], from, forged)).toBe(expected);
    },
  );

  it("trusting no proxy, ignores the header", async () => {
    expect(await loggedAddress([], "10.0.1.5", forged)).toBe("10.0.1.5");
  });

  it("logs the load balancer itself when it sends no header", async () => {
    expect(await loggedAddress(["10.0.0.0/16"], "10.0.1.5", {})).toBe(
      "10.0.1.5",
    );
  });
});
