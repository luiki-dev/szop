import { createHash, randomInt, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { Email, EmailSender } from "../email/sender.ts";
import { sameOrigin, signIn } from "../test/auth.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { captureLog } from "../test/log.ts";

describe("sign-up", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;
  let sent: Email[];
  let log: ReturnType<typeof captureLog>;

  afterEach(async () => {
    await app.close();
  });

  const notFound = () => Promise.resolve(new Response(""));

  function start(breachFetch: typeof fetch = notFound) {
    sent = [];
    log = captureLog();
    const email: EmailSender = {
      send(message) {
        sent.push(message);
        return Promise.resolve();
      },
    };
    app = buildApp({
      config: testConfig({ logLevel: "info" }),
      db: database.db,
      catalog: testCatalog,
      email,
      breachFetch,
      logStream: log.stream,
    });
  }

  const address = () => `${randomUUID()}@example.com`;
  const body = (extra: object = {}) => ({
    name: "Ania",
    email: address(),
    password: "correct horse battery",
    ...extra,
  });

  function signUp(
    payload: object,
    options: { cookie?: string; ip?: string } = {},
  ) {
    return app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: {
        ...sameOrigin,
        "x-forwarded-for":
          options.ip ?? `203.0.113.${String(randomInt(1, 255))}`,
        ...(options.cookie ? { cookie: options.cookie } : {}),
      },
      payload,
    });
  }

  async function users(email: string) {
    const result = await database.db.execute<{
      id: string;
      name: string;
      email: string;
      email_verified: boolean;
      registered_by_guest: string | null;
      keep_guest_data: boolean;
    }>(
      sql`SELECT id, name, email, email_verified, registered_by_guest, keep_guest_data FROM users WHERE lower(email) = lower(${email})`,
    );
    return result.rows;
  }

  // The keys that differ by nature between two answers.
  function comparable(response: { body: string }) {
    const parsed = JSON.parse(response.body) as {
      user: Record<string, unknown>;
    };
    const user = Object.fromEntries(
      Object.entries(parsed.user).filter(
        ([key]) => !["id", "createdAt", "updatedAt"].includes(key),
      ),
    );
    return { ...parsed, user };
  }

  it("ACC-2.1 ACC-2.2: a sign-up answers 200 with no session and one verification email", async () => {
    start();
    const payload = body({ name: "  Ania  " });

    const response = await signUp(payload);

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(payload.email);
    expect(sent[0]?.text).toContain("http://localhost/verify?token=");
    const [user] = await users(payload.email);
    expect(user?.email_verified).toBe(false);
    expect(user?.name).toBe("Ania");
  });

  it('ACC-2.2: 14 and 129 code units are refused, 15 and 128 and "  😀  …" accepted', async () => {
    start();
    const refused = [14, 129].map((n) => "a".repeat(n));
    for (const password of refused) {
      expect((await signUp(body({ password }))).statusCode).toBe(400);
    }
    const accepted = [
      "a".repeat(15),
      "a".repeat(128),
      "  😀  " + "a".repeat(10),
    ];
    for (const password of accepted) {
      expect((await signUp(body({ password }))).statusCode).toBe(200);
    }
  });

  it("ACC-2.3: a breached password answers 400 password_breached and deletes nothing", async () => {
    start(() => Promise.resolve(new Response("")));
    const pending = body();
    await signUp(pending);
    await app.close();
    start((url) => {
      const suffix = createHash("sha1")
        .update(pending.password)
        .digest("hex")
        .toUpperCase()
        .slice(5);
      expect(url as string).toContain("/range/");
      return Promise.resolve(new Response(`${suffix}:9`));
    });
    const [before] = await users(pending.email);
    const response = await signUp(pending);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      code: "password_breached",
      message: "This password appears in known data leaks. Choose another.",
    });
    const [after] = await users(pending.email);
    expect(after?.id).toBe(before?.id);
  });

  it("ACC-2.4: the service failing accepts the password", async () => {
    start(() => Promise.reject(new Error("down")));
    expect((await signUp(body())).statusCode).toBe(200);
    expect(
      log
        .lines()
        .filter(
          (l) => l.msg === "Breach check failed; the password was accepted",
        ),
    ).toHaveLength(1);
  });

  it("ACC-2.12: an empty, a 51-character and a control-character name answer 400", async () => {
    start();
    for (const name of ["", "a".repeat(51), "An\u0007ia"]) {
      const response = await signUp(body({ name }));
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toHaveProperty("message");
    }
  });

  it("refuses a keepGuestData that is not a boolean, and an address on the anonymous plugin's domain", async () => {
    start();
    const notBoolean = body({ keepGuestData: "yes" });
    const placeholder = body({ email: "temp@anonymous.placeholder.invalid" });

    expect((await signUp(notBoolean)).statusCode).toBe(400);
    expect((await signUp(placeholder)).statusCode).toBe(400);
    expect(await users(notBoolean.email)).toHaveLength(0);
    expect(await users(placeholder.email)).toHaveLength(0);
  });

  it("sets registered_by_guest from a guest's session, and keep_guest_data from the body", async () => {
    start();
    const cookie = await signIn(app);
    const [guest] = (
      await database.db.execute<{ id: string }>(
        sql`SELECT id FROM users WHERE is_anonymous`,
      )
    ).rows;
    const payload = body({ keepGuestData: true });

    await signUp(payload, { cookie });

    const [user] = await users(payload.email);
    expect(user?.registered_by_guest).toBe(guest?.id);
    expect(user?.keep_guest_data).toBe(true);
  });

  it("leaves registered_by_guest null with no session", async () => {
    start();
    const payload = body();

    await signUp(payload);

    const [user] = await users(payload.email);
    expect(user?.registered_by_guest).toBeNull();
    expect(user?.keep_guest_data).toBe(false);
  });

  it("ACC-2.5 ACC-2.6: a new, an unverified and a verified address answer the same keys and values", async () => {
    start();
    const cookie = await signIn(app);
    const payload = body({ keepGuestData: true });

    const fresh = await signUp(payload, { cookie });
    const unverified = await signUp(payload, { cookie });
    await database.db.execute(
      sql`UPDATE users SET email_verified = true WHERE email = ${payload.email}`,
    );
    sent.length = 0;
    const verified = await signUp(payload, { cookie });

    expect(fresh.statusCode).toBe(200);
    expect(unverified.statusCode).toBe(200);
    expect(verified.statusCode).toBe(200);
    expect(comparable(unverified)).toEqual(comparable(fresh));
    expect(comparable(verified)).toEqual(comparable(fresh));
    // The ID's version would tell a new address from an existing one.
    for (const response of [fresh, unverified, verified]) {
      expect(
        (JSON.parse(response.body) as { user: { id: string } }).user.id,
      ).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    }
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toBe("You already have a Szop account");
  });

  it("ACC-2.9: a second sign-up for an unverified address replaces it", async () => {
    start();
    const payload = body({ name: "First" });
    await signUp(payload);
    const [first] = await users(payload.email);

    await signUp({ ...payload, name: "Second" });
    await signUp({
      ...payload,
      email: payload.email.toUpperCase(),
      name: "Third",
    });

    const rows = await users(payload.email);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Third");
    expect(rows[0]?.id).not.toBe(first?.id);
    const orphans = await database.db.execute(
      sql`SELECT 1 FROM accounts WHERE user_id = ${first?.id}
          UNION ALL SELECT 1 FROM sessions WHERE user_id = ${first?.id}`,
    );
    expect(orphans.rows).toHaveLength(0);
  });

  it("ACC-2.9: a refused sign-up leaves the unverified account and the guests", async () => {
    start();
    const cookie = await signIn(app);
    const payload = body();
    await signUp(payload, { cookie });

    const short = await signUp({ ...payload, password: "a" }, { cookie });
    const placeholder = await signUp(
      { ...payload, email: "x@anonymous.placeholder.invalid" },
      { cookie },
    );

    // Better Auth refuses these only after the hook has run.
    const extras = [
      { image: 1 },
      { convertedAt: "x" },
      { registeredByGuest: "x" },
      { rememberMe: "no" },
      { callbackURL: 1 },
    ];
    for (const extra of extras) {
      const refused = await signUp({ ...payload, ...extra }, { cookie });
      expect(refused.statusCode).toBe(400);
    }
    expect(short.statusCode).toBe(400);
    expect(placeholder.statusCode).toBe(400);
    expect(await users(payload.email)).toHaveLength(1);
    const guests = await database.db.execute(
      sql`SELECT 1 FROM users WHERE is_anonymous`,
    );
    expect(guests.rows).toHaveLength(1);
  });

  it("ACC-2.9: two sign-ups at once end in one account and two equal answers", async () => {
    start();
    const payload = body();

    const [a, b] = await Promise.all([signUp(payload), signUp(payload)]);

    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(comparable(a)).toEqual(comparable(b));
    expect(await users(payload.email)).toHaveLength(1);
  });

  it("logs no address", async () => {
    start();
    const verified = body();
    await signUp(verified);
    await database.db.execute(
      sql`UPDATE users SET email_verified = true WHERE email = ${verified.email}`,
    );
    await signUp(verified);
    const raced = body();
    await Promise.all([signUp(raced), signUp(raced)]);

    const text = JSON.stringify(log.lines());
    expect(text).not.toContain(verified.email);
    expect(text).not.toContain(raced.email);
  });
});
