import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { captureLog } from "../test/log.ts";
import { redactUrl } from "./log.ts";

describe("redactUrl", () => {
  it.each([
    ["/api/health", "/api/health"],
    ["/reset-password?token=abc", "/reset-password?token=[redacted]"],
    [
      "/verify?token=abc&next=/lists",
      "/verify?token=[redacted]&next=[redacted]",
    ],
    ["/a?tag=x&tag=y", "/a?tag=[redacted]&tag=[redacted]"],
    ["/a?a=", "/a?a=[redacted]"],
    ["/a?abc123", "/a?[redacted]"],
    ["/a?q=%2Fsecret%20x", "/a?q=[redacted]"],
    ["/a?x=1=2", "/a?x=[redacted]"],
    ["/a?a=1&&b=2", "/a?a=[redacted]&&b=[redacted]"],
    ["/a?", "/a?"],
  ])("logs %j as %j", (url, expected) => {
    expect(redactUrl(url)).toBe(expected);
  });
});

describe("the request log", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("logs a page's URL with its token hidden", async () => {
    const log = captureLog();
    app = buildApp({
      config: testConfig({ logLevel: "info" }),
      db: database.db,
      logStream: log.stream,
    });

    await app.inject({ method: "GET", url: "/reset-password?token=s3cret" });

    const incoming = log
      .lines()
      .find((line) => line.msg === "incoming request");
    expect(incoming?.req).toMatchObject({
      method: "GET",
      url: "/reset-password?token=[redacted]",
    });
    expect(JSON.stringify(log.lines())).not.toContain("s3cret");
  });

  it("keeps the token out of the error line", async () => {
    const log = captureLog();
    app = buildApp({
      config: testConfig({ logLevel: "info" }),
      db: database.db,
      logStream: log.stream,
    });
    // A route that fails: Fastify's error line carries the request too.
    app.get("/api/test-fails", () => {
      throw new Error("kaput");
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/test-fails?token=s3cret",
    });

    expect(response.statusCode).toBe(500);
    expect(log.lines().some((line) => line.msg === "kaput")).toBe(true);
    expect(JSON.stringify(log.lines())).not.toContain("s3cret");
  });
});
