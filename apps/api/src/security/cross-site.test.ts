import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";

const safe = ["GET", "HEAD", "OPTIONS"] as const;
const unsafe = ["POST", "PUT", "PATCH", "DELETE"] as const;

const refused = {
  statusCode: 403,
  error: "Forbidden",
  message: "Cross-site request refused",
};

describe("the cross-site check", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  // No route changes data yet, so the test adds one, answering every method
  // (Fastify answers HEAD for every GET route).
  function start(config = testConfig()): FastifyInstance {
    app = buildApp({ config, db: database.db });
    app.route({
      method: ["GET", "OPTIONS", ...unsafe],
      url: "/api/test-unsafe",
      handler: () => ({ ok: true }),
    });
    return app;
  }

  async function send(
    method: (typeof safe)[number] | (typeof unsafe)[number],
    headers: Record<string, string>,
  ): Promise<{ statusCode: number; body: unknown }> {
    const response = await start().inject({
      method,
      url: "/api/test-unsafe",
      headers,
    });
    // HEAD answers without a body.
    const body: unknown = method === "HEAD" ? undefined : response.json();
    return { statusCode: response.statusCode, body };
  }

  describe.each(unsafe)("%s", (method) => {
    it("passes with Sec-Fetch-Site: same-origin", async () => {
      const response = await send(method, { "sec-fetch-site": "same-origin" });
      expect(response.statusCode).toBe(200);
    });

    // same-site is a sibling subdomain: another site to Szop, and SameSite=Lax
    // alone would not stop it.
    it.each(["same-site", "cross-site", "none"])(
      "refuses Sec-Fetch-Site: %s",
      async (site) => {
        const response = await send(method, { "sec-fetch-site": site });
        expect(response).toEqual({ statusCode: 403, body: refused });
      },
    );

    it("passes without Sec-Fetch-Site when Origin matches Host", async () => {
      const response = await send(method, {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      });
      expect(response.statusCode).toBe(200);
    });

    it.each([
      ["another host", "https://evil.example"],
      ["the same host name on another port", "http://localhost:5173"],
      ["an opaque origin", "null"],
    ])("refuses an Origin from %s", async (_, origin) => {
      const response = await send(method, { host: "localhost:3000", origin });
      expect(response).toEqual({ statusCode: 403, body: refused });
    });

    it("refuses a request with neither header", async () => {
      const response = await send(method, {});
      expect(response).toEqual({ statusCode: 403, body: refused });
    });

    it("Sec-Fetch-Site wins over a matching Origin", async () => {
      const response = await send(method, {
        "sec-fetch-site": "cross-site",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      });
      expect(response).toEqual({ statusCode: 403, body: refused });
    });
  });

  it.each(safe)(
    "does not check %s, which never changes anything",
    async (method) => {
      const response = await send(method, { "sec-fetch-site": "cross-site" });
      expect(response.statusCode).toBe(200);
    },
  );

  it("compares the raw Host, not request.host", async () => {
    // Behind a trusted proxy request.host reads X-Forwarded-Host, which the
    // client controls.
    const response = await start(
      testConfig({ trustedProxies: ["10.0.0.0/16"] }),
    ).inject({
      method: "POST",
      url: "/api/test-unsafe",
      remoteAddress: "10.0.1.5",
      headers: {
        host: "evil.example",
        "x-forwarded-host": "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(refused);
  });
});
