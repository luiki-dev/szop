import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testCatalog } from "../test/catalog.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { sameOrigin } from "../test/auth.ts";
import { fakeEmail, registerAndGetLink } from "../test/registration.ts";

describe("POST /api/registration/resend", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;
  let fake: ReturnType<typeof fakeEmail>;

  afterEach(() => app.close());

  function start() {
    fake = fakeEmail();
    app = buildApp({
      config: testConfig(),
      db: database.db,
      catalog: testCatalog,
      email: fake.sender,
      breachFetch: () => Promise.resolve(new Response("")),
    });
  }

  const body = () => ({
    name: "Ania",
    email: `${randomUUID()}@example.com`,
    password: "correct horse battery",
  });

  const resend = (email: string, ip = "198.51.100.1") =>
    app.inject({
      method: "POST",
      url: "/api/registration/resend",
      headers: { ...sameOrigin, "x-forwarded-for": ip },
      payload: { email },
    });

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it("ACC-3.5: the same answer for an unknown, an unverified and a verified address; only the unverified gets an email", async () => {
    start();
    const unverified = body();
    const verifiedBody = body();
    await registerAndGetLink(app, fake, unverified);
    const { token } = await registerAndGetLink(app, fake, verifiedBody);
    await app.inject({
      method: "GET",
      url: `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
    });
    const before = fake.sent.length;

    const answers = [
      await resend(`${randomUUID()}@example.com`),
      await resend(unverified.email),
      await resend(verifiedBody.email),
    ];
    await flush();

    expect(answers.map((r) => r.statusCode)).toEqual([204, 204, 204]);
    expect(answers.map((r) => r.body)).toEqual(["", "", ""]);
    expect(fake.sent).toHaveLength(before + 1);
    expect(fake.sent[before]?.to).toBe(unverified.email);
  });

  it("answers 400 to an invalid address", async () => {
    start();

    const response = await resend("not-an-address");

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "invalid_input" } });
  });

  it("ACC-3.5: the fourth request in 60 seconds from one IP answers 429, another IP 204", async () => {
    start();
    const email = `${randomUUID()}@example.com`;

    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await resend(email)).statusCode);
    const other = await resend(email, "198.51.100.2");

    expect(codes).toEqual([204, 204, 204, 429]);
    expect(other.statusCode).toBe(204);
  });

  it("a resent link verifies", async () => {
    start();
    const account = body();
    await registerAndGetLink(app, fake, account);
    const before = fake.sent.length;

    await resend(account.email);
    await flush();
    const token = /verify\?token=([^\s&]+)/.exec(
      fake.sent[before]?.text ?? "",
    )?.[1];
    const response = await app.inject({
      method: "GET",
      url: `/api/auth/verify-email?token=${token ?? ""}`,
    });

    expect(response.json()).toEqual({ verified: true });
  });
});
