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

    const renamed = await app.inject({
      method: "POST",
      url: "/api/auth/update-user",
      headers: { ...sameOrigin, cookie },
      payload: { name: "Zed" },
    });
    expect(renamed.statusCode).toBe(200);
    const users = await database.db.execute<{ name: string }>(
      sql`SELECT name FROM users`,
    );
    expect(users.rows[0]?.name).toBe("Zed");

    const session = await app.inject({
      method: "GET",
      url: "/api/auth/get-session",
      headers: { cookie },
    });
    expect(session.headers["content-type"]).toMatch(/application\/json/);

    const unknown = await app.inject({
      method: "GET",
      url: "/api/auth/no-such-endpoint",
    });
    expect(unknown.statusCode).toBe(404);
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
