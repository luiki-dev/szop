import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { captureLog } from "../test/log.ts";
import { fakeEmail, registerAndGetLink } from "../test/registration.ts";

describe("verify-email", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;
  let fake: ReturnType<typeof fakeEmail>;
  let log: ReturnType<typeof captureLog>;
  let failTransaction = false;

  afterEach(async () => {
    vi.useRealTimers();
    failTransaction = false;
    await app.close();
  });

  function start() {
    fake = fakeEmail();
    log = captureLog();
    // Fails the next transactions on demand: the seam for the hook's failure.
    const db = new Proxy(database.db, {
      get(target, property) {
        if (property === "transaction" && failTransaction) {
          return () => Promise.reject(new Error("boom"));
        }
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value;
      },
    });
    app = buildApp({
      config: testConfig({ logLevel: "info" }),
      db,
      catalog: testCatalog,
      email: fake.sender,
      breachFetch: () => Promise.resolve(new Response("")),
      logStream: log.stream,
    });
  }

  const register = () => ({
    name: "Ania",
    email: `${randomUUID()}@example.com`,
    password: "correct horse battery",
  });

  const verify = (token: string) =>
    app.inject({
      method: "GET",
      url: `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
    });

  async function verified(email: string) {
    const { rows } = await database.db.execute<{ email_verified: boolean }>(
      sql`SELECT email_verified FROM users WHERE email = ${email}`,
    );
    return rows[0]?.email_verified;
  }

  it("ACC-3.9: a verification answers { verified: true } and signs in", async () => {
    start();
    const body = register();
    const { token } = await registerAndGetLink(app, fake, body);

    const response = await verify(token);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ verified: true });
    expect(response.cookies).toHaveLength(1);
    expect(await verified(body.email)).toBe(true);
    expect(JSON.stringify(log.lines())).not.toContain(token);
  });

  it("ACC-3.9: a second use answers { verified: false } with no cookie", async () => {
    start();
    const { token } = await registerAndGetLink(app, fake, register());
    await verify(token);

    const response = await verify(token);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ verified: false });
    expect(response.cookies).toHaveLength(0);
  });

  it("ACC-3.9: a link past 24 hours answers TOKEN_EXPIRED", async () => {
    start();
    const body = register();
    const { token } = await registerAndGetLink(app, fake, body);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + (24 * 60 * 60 + 1) * 1000);

    const response = await verify(token);

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "TOKEN_EXPIRED" });
    expect(await verified(body.email)).toBe(false);
  });

  it("ACC-2.9: the first link after a replacement answers INVALID_TOKEN", async () => {
    start();
    const body = register();
    const first = await registerAndGetLink(app, fake, body);
    await registerAndGetLink(app, fake, body);

    const response = await verify(first.token);

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "INVALID_TOKEN" });
    expect(await verified(body.email)).toBe(false);
  });

  it("beforeEmailVerification runs before the account is verified", async () => {
    start();
    const body = register();
    const { token } = await registerAndGetLink(app, fake, body);
    failTransaction = true;

    const failed = await verify(token);

    expect(failed.statusCode).toBe(500);
    expect(await verified(body.email)).toBe(false);
    failTransaction = false;
    const again = await verify(token);
    expect(again.json()).toEqual({ verified: true });
    expect(await verified(body.email)).toBe(true);
  });
});
