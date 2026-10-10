import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";

// Every request here is same-origin, so it passes the cross-site check and
// only the body rule is under test (ADR 0025, decision 3).
const sameOrigin = { "sec-fetch-site": "same-origin" };

describe("JSON-only bodies", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  // No route takes a body yet, so the test adds one.
  function start(): FastifyInstance {
    app = buildApp({ config: testConfig(), db: database.db });
    app.route({
      method: ["POST", "DELETE"],
      url: "/api/test-body",
      handler: () => ({ ok: true }),
    });
    return app;
  }

  // The three content types an HTML form can send: the "simple requests" a
  // browser sends to another site without asking first.
  it.each([
    ["text/plain", "x"],
    ["application/x-www-form-urlencoded", "a=1"],
    ["multipart/form-data; boundary=x", "--x--"],
  ])("refuses a %s body with 415", async (type, payload) => {
    const response = await start().inject({
      method: "POST",
      url: "/api/test-body",
      headers: { ...sameOrigin, "content-type": type },
      payload,
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({
      statusCode: 415,
      error: "Unsupported Media Type",
    });
  });

  it.each(["application/json", "application/json; charset=utf-8"])(
    "accepts a %s body",
    async (type) => {
      const response = await start().inject({
        method: "POST",
        url: "/api/test-body",
        headers: { ...sameOrigin, "content-type": type },
        payload: '{"name":"Milk"}',
      });

      expect(response.statusCode).toBe(200);
    },
  );

  it("refuses a body without a Content-Type with 415", async () => {
    const response = await start().inject({
      method: "POST",
      url: "/api/test-body",
      headers: sameOrigin,
      payload: '{"name":"Milk"}',
    });

    expect(response.statusCode).toBe(415);
  });

  it("passes a same-origin DELETE without a body: the JSON rule is about bodies", async () => {
    const response = await start().inject({
      method: "DELETE",
      url: "/api/test-body",
      headers: sameOrigin,
    });

    expect(response.statusCode).toBe(200);
  });
});
