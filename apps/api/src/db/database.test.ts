import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import type { DatabaseSettings } from "../config.ts";
import { createDatabase, rdsCaBundle, type Database } from "./database.ts";

const settings: DatabaseSettings = {
  host: "127.0.0.1",
  port: 5432,
  name: "szop",
  user: "szop",
  password: "szop",
  tls: "none",
};

// The pool's options only: it connects on the first query, and these tests
// make none. The handshake with RDS itself is checked on AWS in PH-12c
// (ADR 0033, decision 5).
describe("createDatabase", () => {
  let db: Database | undefined;

  afterEach(async () => {
    await db?.$client.end();
    db = undefined;
  });

  it("uses no TLS for tls none", () => {
    db = createDatabase({ ...settings, tls: "none" });

    expect(db.$client.options.ssl).toBeFalsy();
  });

  it("verifies the server against the RDS bundle for tls verify-full", () => {
    db = createDatabase({ ...settings, tls: "verify-full" });

    const bundle = readFileSync(rdsCaBundle, "utf8");
    expect(bundle).toMatch(/^-----BEGIN CERTIFICATE-----/);
    expect(db.$client.options.ssl).toEqual({
      ca: bundle,
      rejectUnauthorized: true,
    });
  });

  it("finds the bundle next to the API, wherever it starts from", () => {
    expect(rdsCaBundle).toMatch(/\/apps\/api\/certs\/rds-global-bundle\.pem$/);
  });
});
