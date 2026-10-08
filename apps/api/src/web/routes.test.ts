import { brotliDecompressSync, gunzipSync } from "node:zlib";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { Config } from "../config.ts";
import { useTestDatabase } from "../test/database.ts";
import { useWebRoot, webRootFiles } from "../test/web-root.ts";

function configFor(webRoot: string): Config {
  return {
    host: "127.0.0.1",
    port: 3000,
    logLevel: "silent",
    // Not used: each test passes its own database to buildApp.
    database: { host: "", port: 1, name: "", user: "", password: "" },
    webRoot,
  };
}

const immutable = "public, max-age=31536000, immutable";

describe("serving the SPA", () => {
  const database = useTestDatabase();
  const webRoot = useWebRoot();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  function start(root = webRoot.path): FastifyInstance {
    app = buildApp({ config: configFor(root), db: database.db });
    return app;
  }

  it("sends index.html as Brotli to a browser, never cached", async () => {
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

  it("sends a fingerprinted asset as gzip, cached for a year", async () => {
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

  it.each([
    ["GET", "/api/nope"],
    ["GET", "/api"],
    ["GET", "/assets/missing.js"],
    ["GET", "/favicon.ico"],
    ["POST", "/some/route"],
  ] as const)("answers %s %s with Fastify's JSON 404", async (method, url) => {
    const response = await start().inject({ method, url });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.json()).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${method}:${url} not found`,
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
  });
});
