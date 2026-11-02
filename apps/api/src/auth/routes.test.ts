import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { createAuth } from "./auth.ts";
import { sameOrigin, signIn } from "../test/auth.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import type { Config } from "../config.ts";

describe("/api/auth", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  function start(overrides: Partial<Config> = {}): FastifyInstance {
    app = buildApp({
      config: testConfig(overrides),
      db: database.db,
      catalog: testCatalog,
    });
    return app;
  }

  function signInRequest(headers: Record<string, string> = sameOrigin) {
    return start().inject({
      method: "POST",
      url: "/api/auth/sign-in/anonymous",
      headers,
      payload: {},
    });
  }

  it("signs in anonymously: a cookie, an anonymous user, no workspace", async () => {
    const response = await signInRequest();

    expect(response.statusCode).toBe(200);
    expect(response.cookies).toHaveLength(1);
    const users = await database.db.execute<{
      id: string;
      is_anonymous: boolean;
    }>(sql`SELECT id, is_anonymous FROM users`);
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0]?.is_anonymous).toBe(true);
    expect(users.rows[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const workspaces = await database.db.execute(sql`SELECT 1 FROM workspaces`);
    expect(workspaces.rows).toHaveLength(0);
  });

  it("answers 403 to a sign-in without Sec-Fetch-Site and Origin", async () => {
    const response = await signInRequest({
      "content-type": "application/json",
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: { code: "forbidden_cross_site" },
    });
  });

  it("answers 415 to a sign-in that is not JSON", async () => {
    const response = await signInRequest({
      ...sameOrigin,
      "content-type": "text/plain",
    });
    expect(response.statusCode).toBe(415);
  });

  it("NFR-4.9: on an https origin the cookie is __Host-, HttpOnly, Secure, SameSite=Lax, Path=/, without Domain", async () => {
    app = buildApp({
      config: testConfig({ appOrigin: "https://szop.test" }),
      db: database.db,
      catalog: testCatalog,
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/anonymous",
      headers: { ...sameOrigin, origin: "https://szop.test" },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const header = [response.headers["set-cookie"]].flat().join("\n");
    expect(header).toMatch(/^__Host-better-auth\.session_token=/);
    expect(header).toMatch(/; HttpOnly/i);
    expect(header).toMatch(/; Secure/i);
    expect(header).toMatch(/; SameSite=Lax/i);
    expect(header).toMatch(/; Path=\//i);
    expect(header).not.toMatch(/; Domain=/i);
  });

  it("NFR-4.9: on an http origin the cookie has no prefix and no Secure", async () => {
    const response = await signInRequest();
    const header = [response.headers["set-cookie"]].flat().join("\n");
    expect(header).toMatch(/^better-auth\.session_token=/);
    expect(header).toMatch(/; HttpOnly/i);
    expect(header).not.toMatch(/; Secure/i);
    expect(header).toMatch(/; SameSite=Lax/i);
  });

  it("hands the API's trusted proxies to Better Auth's rate limiter", () => {
    const config = testConfig({ trustedProxies: ["10.0.0.0/16"] });
    app = buildApp({ config, db: database.db, catalog: testCatalog });
    const auth = createAuth({
      db: database.db,
      secret: config.betterAuthSecret,
      origin: config.appOrigin,
      trustedProxies: config.trustedProxies,
    });
    expect(auth.options.advanced.ipAddress.trustedProxies).toEqual([
      "10.0.0.0/16",
    ]);
  });

  it("passes the JSON body, the status and the headers of Better Auth through", async () => {
    app = start();
    const cookie = await signIn(app);

    const session = await app.inject({
      method: "GET",
      url: "/api/auth/get-session",
      headers: { cookie },
    });
    expect(session.statusCode).toBe(200);
    expect(session.headers["content-type"]).toMatch(/application\/json/);
    expect(session.json()).toMatchObject({ user: { isAnonymous: true } });

    const out = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { ...sameOrigin, cookie },
      payload: {},
    });
    expect(out.statusCode).toBe(200);
  });

  it("NFR-4.12: any other path or method under /api/auth answers 404 in the error format", async () => {
    app = start();
    const cookie = await signIn(app);
    const rename = await app.inject({
      method: "POST",
      url: "/api/auth/update-user",
      headers: { ...sameOrigin, cookie },
      payload: { name: "Zed" },
    });
    expect(rename.statusCode).toBe(404);
    expect(rename.json()).toMatchObject({ error: { code: "not_found" } });
    const users = await database.db.execute<{ name: string }>(
      sql`SELECT name FROM users`,
    );
    expect(users.rows[0]?.name).not.toBe("Zed");

    // A query string on an allowed path still answers (not a 404).
    const withQuery = await app.inject({
      method: "GET",
      url: "/api/auth/get-session?disableCookieCache=true",
      headers: { cookie },
    });
    expect(withQuery.statusCode).toBe(200);

    for (const [method, url] of [
      ["GET", "/api/auth/no-such-endpoint"],
      ["GET", "/api/auth/sign-in/anonymous"],
      ["POST", "/api/auth/get-session"],
      ["GET", "/api/auth/list-sessions"],
      ["GET", "/api/auth/get-session/"],
      ["GET", "/api/auth//get-session"],
      ["HEAD", "/api/auth/list-sessions?x=get-session"],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: { ...sameOrigin, cookie },
        payload: method === "POST" ? {} : undefined,
      });
      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }
  });

  it("NFR-4.13: a body larger than 16 KiB answers 413, on an auth route and on another", async () => {
    app = start();
    const cookie = await signIn(app);
    const payload = { name: "x".repeat(16 * 1024) };
    for (const url of ["/api/auth/sign-in/anonymous", "/api/lists"]) {
      const response = await app.inject({
        method: "POST",
        url,
        headers: { ...sameOrigin, cookie },
        payload,
      });
      expect(response.statusCode, url).toBe(413);
    }
  });

  it("limits anonymous sign-ins to 30 an hour per address", async () => {
    // Its own address: Better Auth keeps the counters in memory shared by the
    // whole test file.
    app = start();
    const headers = { ...sameOrigin, "x-forwarded-for": "203.0.113.7" };
    for (let i = 0; i < 30; i++) {
      const ok = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/anonymous",
        headers,
        payload: {},
      });
      expect(ok.statusCode, `sign-in ${String(i + 1)}`).toBe(200);
    }
    const limited = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/anonymous",
      headers,
      payload: {},
    });
    expect(limited.statusCode).toBe(429);
  });

  it("trusts only its own origin and sets no default proxies or Secure on http", () => {
    const config = testConfig();
    const auth = createAuth({
      db: database.db,
      secret: config.betterAuthSecret,
      origin: config.appOrigin,
    });
    expect(auth.options.trustedOrigins).toEqual([config.appOrigin]);
    expect(auth.options.advanced.ipAddress.trustedProxies).toEqual([]);
    expect(auth.options.advanced.defaultCookieAttributes).toBeUndefined();
  });

  it("NFR-4.9: on an https origin every cookie is Secure", () => {
    const config = testConfig();
    const auth = createAuth({
      db: database.db,
      secret: config.betterAuthSecret,
      origin: "https://szop.test",
    });
    expect(auth.options.advanced.defaultCookieAttributes).toEqual({
      secure: true,
    });
  });
});
