import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { useWebRoot } from "../test/web-root.ts";

// ADR 0012, decision 8; ADR 0025, decisions 4 and 5.
const csp =
  "default-src 'self';object-src 'none';base-uri 'none';form-action 'self';frame-ancestors 'none'";

describe("security headers", () => {
  const database = useTestDatabase();
  const webRoot = useWebRoot();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  const crossSite = { "sec-fetch-site": "cross-site" };

  it.each([
    ["a JSON response", "GET", "/api/health", 200, {}],
    ["the SPA's index.html", "GET", "/", 200, {}],
    ["a fingerprinted asset", "GET", "/assets/index-abc123.js", 200, {}],
    ["the JSON 404", "GET", "/api/nope", 404, {}],
    ["a refused cross-site request", "POST", "/api/health", 403, crossSite],
  ] as const)("are on %s", async (_, method, url, status, headers) => {
    app = buildApp({
      config: testConfig({ webRoot: webRoot.path }),
      db: database.db,
    });

    const response = await app.inject({ method, url, headers });

    expect(response.statusCode).toBe(status);
    expect(response.headers["content-security-policy"]).toBe(csp);
    expect(response.headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
