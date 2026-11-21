import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { captureLog } from "../test/log.ts";
import { sameOrigin, signIn } from "../test/auth.ts";
import { beforeVerification } from "./verify.ts";
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

  const workspaceOwner = async (listId: string) =>
    (
      await database.db.execute<{ user_id: string }>(
        sql`SELECT w.user_id FROM workspaces w JOIN lists l ON l.workspace_id = w.id WHERE l.id = ${listId}`,
      )
    ).rows[0]?.user_id;

  const userId = async (email: string) =>
    (
      await database.db.execute<{ id: string }>(
        sql`SELECT id FROM users WHERE email = ${email}`,
      )
    ).rows[0]?.id ?? "";

  const converted = async (id: string) =>
    (
      await database.db.execute<{ converted_at: Date | null }>(
        sql`SELECT converted_at FROM users WHERE id = ${id}`,
      )
    ).rows[0]?.converted_at;

  const count = async (table: string, id: string) =>
    Number(
      (
        await database.db.execute<{ n: string }>(
          sql`SELECT count(*) AS n FROM ${sql.raw(table)} WHERE user_id = ${id}`,
        )
      ).rows[0]?.n,
    );

  async function guestWithList(): Promise<{ cookie: string; listId: string }> {
    const cookie = await signIn(app);
    const listId = randomUUID();
    const created = await app.inject({
      method: "POST",
      url: "/api/lists",
      headers: { ...sameOrigin, cookie },
      payload: { id: listId, name: "Groceries" },
    });
    expect(created.statusCode).toBe(201);
    return { cookie, listId };
  }

  const lists = (cookie: string) =>
    app.inject({ method: "GET", url: "/api/lists", headers: { cookie } });

  const cookieOf = (response: { cookies: { name: string; value: string }[] }) =>
    response.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  it("ACC-2.7: ticked, the guest's workspace with its lists, catalog and categories is the account's", async () => {
    start();
    const { cookie, listId } = await guestWithList();
    const body = { ...register(), keepGuestData: true };
    const { token } = await registerAndGetLink(app, fake, body, { cookie });

    const response = await verify(token);

    const account = await userId(body.email);
    expect(await workspaceOwner(listId)).toBe(account);
    const seen = await lists(cookieOf(response));
    expect(seen.json<{ lists: { id: string }[] }>().lists[0]?.id).toBe(listId);
    expect(await count("workspaces", account)).toBe(1);
  });

  it("ACC-2.7: with no workspace at sign-up and a list added before verification, the list is the account's", async () => {
    start();
    const cookie = await signIn(app);
    const body = { ...register(), keepGuestData: true };
    const { token } = await registerAndGetLink(app, fake, body, { cookie });
    const listId = randomUUID();
    await app.inject({
      method: "POST",
      url: "/api/lists",
      headers: { ...sameOrigin, cookie },
      payload: { id: listId, name: "Late" },
    });

    await verify(token);

    expect(await workspaceOwner(listId)).toBe(await userId(body.email));
  });

  it("ACC-2.10: unticked, the account starts with the default catalog and no lists, and the guest's workspace is untouched", async () => {
    start();
    const { cookie, listId } = await guestWithList();
    const body = { ...register(), keepGuestData: false };
    const { token } = await registerAndGetLink(app, fake, body, { cookie });
    const guest = await workspaceOwner(listId);

    const response = await verify(token);

    expect(await workspaceOwner(listId)).toBe(guest);
    expect(
      (await lists(cookieOf(response))).json<{ lists: unknown[] }>().lists,
    ).toEqual([]);
  });

  it("ACC-2.11: verified with a second guest's cookie, that browser is the account's, its own workspace untouched, and the registering guest's next request answers 401 guest_converted", async () => {
    start();
    const first = await guestWithList();
    const second = await guestWithList();
    const body = { ...register(), keepGuestData: true };
    const { token } = await registerAndGetLink(app, fake, body, {
      cookie: first.cookie,
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      headers: { cookie: second.cookie },
    });

    expect(response.json()).toEqual({ verified: true });
    expect(await workspaceOwner(second.listId)).not.toBe(
      await userId(body.email),
    );
    const guestId = await workspaceOwner(second.listId);
    expect(await converted(guestId ?? "")).toBeNull();
    // The first request meets guest_converted and deletes the session, so the
    // next read is a visitor's, with no lists.
    const write = await app.inject({
      method: "POST",
      url: "/api/lists",
      headers: { ...sameOrigin, cookie: first.cookie },
      payload: { id: randomUUID(), name: "X" },
    });
    expect(write.statusCode).toBe(401);
    expect(write.json()).toMatchObject({ error: { code: "guest_converted" } });
    expect((await lists(first.cookie)).json()).toEqual({
      lists: [],
      hasWorkspace: false,
    });
  });

  it("the move run twice leaves one workspace and one conversion", async () => {
    start();
    const { cookie, listId } = await guestWithList();
    const body = { ...register(), keepGuestData: true };
    await registerAndGetLink(app, fake, body, { cookie });
    const account = await userId(body.email);
    const guest = await workspaceOwner(listId);

    await beforeVerification(database.db)({ id: account });
    const first = await converted(guest ?? "");
    await beforeVerification(database.db)({ id: account });

    expect(await workspaceOwner(listId)).toBe(account);
    expect(await count("workspaces", account)).toBe(1);
    expect(await converted(guest ?? "")).toEqual(first);
  });

  it("a verification with no registering guest moves nothing and converts nobody", async () => {
    start();
    const { listId } = await guestWithList();
    const guest = await workspaceOwner(listId);
    const body = { ...register(), keepGuestData: true };
    const { token } = await registerAndGetLink(app, fake, body);

    await verify(token);

    expect(await workspaceOwner(listId)).toBe(guest);
    expect(await converted(guest ?? "")).toBeNull();
  });

  it("the hook run for an account deleted meanwhile fails and moves nothing", async () => {
    start();
    const { cookie, listId } = await guestWithList();
    const body = { ...register(), keepGuestData: true };
    await registerAndGetLink(app, fake, body, { cookie });
    const account = await userId(body.email);
    const guest = await workspaceOwner(listId);
    await database.db.execute(sql`DELETE FROM users WHERE id = ${account}`);

    await expect(
      beforeVerification(database.db)({ id: account }),
    ).rejects.toMatchObject({ body: { code: "INVALID_TOKEN" } });

    expect(await workspaceOwner(listId)).toBe(guest);
    expect(await converted(guest ?? "")).toBeNull();
  });
});
