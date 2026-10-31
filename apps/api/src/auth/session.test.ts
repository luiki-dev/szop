import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { signIn } from "../test/auth.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { createAuth } from "./auth.ts";
import { sessionHook } from "./session.ts";

const day = 24 * 60 * 60 * 1000;

describe("sessionHook", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  beforeEach(() => {
    const config = testConfig();
    // The same secret and origin as the app's own, so the cookies verify.
    const auth = createAuth({
      db: database.db,
      secret: config.betterAuthSecret,
      origin: config.appOrigin,
    });
    app = buildApp({
      config,
      db: database.db,
      catalog: testCatalog,
    });
    // A scope of its own, as the lists routes get theirs (Task 3).
    void app.register((scope) => {
      scope.addHook("preHandler", sessionHook(auth));
      scope.get("/api/whoami", (request) => ({ user: request.user }));
    });
  });

  afterEach(async () => {
    await app.close();
  });

  function whoami(cookie?: string) {
    return app.inject({
      method: "GET",
      url: "/api/whoami",
      headers: cookie === undefined ? {} : { cookie },
    });
  }

  async function expiresAt(): Promise<number> {
    const result = await database.db.execute<{ expires_at: Date }>(
      sql`SELECT expires_at FROM sessions`,
    );
    return new Date(result.rows[0]?.expires_at ?? NaN).getTime();
  }

  it("ACC-1.3: without a cookie there is no user and no Set-Cookie", async () => {
    const response = await whoami();
    expect(response.json()).toEqual({ user: null });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("answers the user's ID after sign-in", async () => {
    const cookie = await signIn(app);
    const response = await whoami(cookie);
    const users = await database.db.execute<{ id: string }>(
      sql`SELECT id FROM users`,
    );
    expect(response.json()).toEqual({ user: { id: users.rows[0]?.id } });
  });

  it("ACC-1.7: a session lasts 30 days", async () => {
    await signIn(app);
    expect(
      Math.abs((await expiresAt()) - (Date.now() + 30 * day)),
    ).toBeLessThan(60_000);
  });

  it("ACC-1.7: a read with 2 days left renews the session and the cookie", async () => {
    const cookie = await signIn(app);
    await database.db.execute(
      sql`UPDATE sessions SET expires_at = now() + interval '2 days'`,
    );

    const response = await whoami(cookie);

    expect(
      Math.abs((await expiresAt()) - (Date.now() + 30 * day)),
    ).toBeLessThan(60_000);
    const header = [response.headers["set-cookie"]].flat().join("\n");
    const maxAge = Number(/Max-Age=(\d+)/i.exec(header)?.[1]);
    expect(Math.abs(maxAge - 30 * 24 * 3600)).toBeLessThan(120);
  });

  it("an expired session is no user", async () => {
    const cookie = await signIn(app);
    await database.db.execute(
      sql`UPDATE sessions SET expires_at = now() - interval '1 minute'`,
    );
    expect((await whoami(cookie)).json()).toEqual({ user: null });
  });

  it("NFR-4.9: a deleted session is no user at once", async () => {
    const cookie = await signIn(app);
    await database.db.execute(sql`DELETE FROM sessions`);
    expect((await whoami(cookie)).json()).toEqual({ user: null });
  });
});
