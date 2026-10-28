import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import type { FastifyInstance } from "fastify";
import { apiErrorSchema } from "@szop/shared";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { useWebRoot, webRootFiles } from "../test/web-root.ts";

const immutable = "public, max-age=31536000, immutable";

describe("serving the SPA", () => {
  const database = useTestDatabase();
  const webRoot = useWebRoot();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  function start(root = webRoot.path): FastifyInstance {
    app = buildApp({
      catalog: testCatalog,
      config: testConfig({ webRoot: root }),
      db: database.db,
    });
    return app;
  }

  it("NFR-3.2: sends index.html as Brotli to a browser, never cached", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/",
      headers: { "accept-encoding": "gzip, deflate, br, zstd" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-encoding"]).toBe("br");
    expect(response.headers["content-type"]).toMatch(/^text\/html/);
    expect(response.headers["cache-control"]).toBe("no-cache");
    expect(response.headers.vary).toMatch(/accept-encoding/i);
    expect(brotliDecompressSync(response.rawPayload).toString()).toBe(
      webRootFiles["index.html"],
    );
  });

  it("NFR-3.2: sends a fingerprinted asset as gzip, cached for a year", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/assets/index-abc123.js",
      headers: { "accept-encoding": "gzip" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(response.headers["content-type"]).toMatch(/javascript/);
    expect(response.headers["cache-control"]).toBe(immutable);
    expect(gunzipSync(response.rawPayload).toString()).toBe(
      webRootFiles["assets/index-abc123.js"],
    );
  });

  it("sends the plain file to a client that accepts no encoding", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/assets/index-abc123.js",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers["cache-control"]).toBe(immutable);
    expect(response.body).toBe(webRootFiles["assets/index-abc123.js"]);
  });

  it("answers a client-side route with index.html, never cached", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/some/route",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^text\/html/);
    expect(response.headers["cache-control"]).toBe("no-cache");
    expect(response.body).toBe(webRootFiles["index.html"]);
  });

  it("answers HEAD on a client-side route like GET, without a body", async () => {
    const response = await start().inject({
      method: "HEAD",
      url: "/some/route",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^text\/html/);
    expect(response.body).toBe("");
  });

  it("treats a dot in a folder name as a page, not a file", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/v1.2/route",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(webRootFiles["index.html"]);
  });

  it("serves only the files found at startup", async () => {
    start();
    const late = join(webRoot.path, "late.txt");
    try {
      await app.ready();
      await writeFile(late, "added after startup");

      const response = await app.inject({ method: "GET", url: "/late.txt" });

      expect(response.statusCode).toBe(404);
    } finally {
      await rm(late, { force: true });
    }
  });

  it("ignores the query string when it decides", async () => {
    start();

    const page = await app.inject({
      method: "GET",
      url: "/some/route?tab=a.b",
    });
    expect(page.statusCode).toBe(200);
    expect(page.body).toBe(webRootFiles["index.html"]);

    const file = await app.inject({
      method: "GET",
      url: "/assets/missing.js?v=1",
    });
    expect(file.statusCode).toBe(404);
  });

  // Same-origin, so POST passes the cross-site check and reaches routing.
  it.each([
    ["GET", "/api/nope"],
    ["GET", "/api"],
    ["GET", "/assets/missing.js"],
    ["GET", "/favicon.ico"],
    ["POST", "/some/route"],
  ] as const)("answers %s %s with the JSON 404", async (method, url) => {
    const response = await start().inject({
      method,
      url,
      headers: { "sec-fetch-site": "same-origin" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: {
        code: "not_found",
        message: `Route ${method}:${url} not found`,
      },
    });
  });

  it("still routes /api/health to its handler", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("keeps the API working when WEB_ROOT does not exist", async () => {
    start("/nonexistent/szop-web-root");

    const health = await app.inject({ method: "GET", url: "/api/health" });
    expect(health.statusCode).toBe(200);

    const page = await app.inject({ method: "GET", url: "/" });
    expect(page.statusCode).toBe(404);
    // Fastify's basic plain-text 404: sendFile calls reply.callNotFound()
    // inside our not-found handler, so no page and no JSON error is sent.
    expect(page.headers["content-type"]).toMatch(/^text\/plain/);
    expect(page.body).toBe("404 Not Found");
  });
});
