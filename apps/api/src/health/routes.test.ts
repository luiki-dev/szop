import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { Config } from "../config.ts";

const config: Config = { host: "127.0.0.1", port: 3000, logLevel: "silent" };

describe("GET /api/health", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp({ config });
  });

  afterEach(async () => {
    await app.close();
  });

  it("answers 200 with status ok", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
