import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

const valid = {
  HOST: "127.0.0.1",
  PORT: "3000",
  LOG_LEVEL: "info",
  DATABASE_HOST: "127.0.0.1",
  DATABASE_PORT: "5432",
  DATABASE_NAME: "szop",
  DATABASE_USER: "szop",
  DATABASE_PASSWORD: "szop",
  DATABASE_TLS: "none",
  WEB_ROOT: "../web/dist",
  TRUSTED_PROXIES: "none",
  GIT_COMMIT: "0123456789abcdef0123456789abcdef01234567",
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  APP_ORIGIN: "http://localhost:5173",
};

const names = Object.keys(valid);

// The message loadConfig throws for env.
function errorFor(env: Record<string, string | undefined>): string {
  try {
    loadConfig(env);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected loadConfig to throw");
}

describe("loadConfig", () => {
  it("returns the typed config for a valid environment", () => {
    expect(loadConfig(valid)).toEqual({
      host: "127.0.0.1",
      port: 3000,
      logLevel: "info",
      database: {
        host: "127.0.0.1",
        port: 5432,
        name: "szop",
        user: "szop",
        password: "szop",
        tls: "none",
      },
      webRoot: resolve("../web/dist"),
      trustedProxies: [],
      commit: "0123456789abcdef0123456789abcdef01234567",
      betterAuthSecret: "0123456789abcdef0123456789abcdef",
      appOrigin: "http://localhost:5173",
    });
  });

  it("refuses a BETTER_AUTH_SECRET under 32 characters, without echoing it", () => {
    const secret = "a".repeat(31);
    const message = errorFor({ ...valid, BETTER_AUTH_SECRET: secret });
    expect(message).toContain("BETTER_AUTH_SECRET");
    expect(message).not.toContain(secret);
  });

  it.each(["http://localhost/app", "ftp://localhost", "localhost:5173"])(
    "refuses the APP_ORIGIN %s",
    (value) => {
      expect(errorFor({ ...valid, APP_ORIGIN: value })).toContain("APP_ORIGIN");
    },
  );

  it("normalizes APP_ORIGIN to an origin", () => {
    expect(
      loadConfig({ ...valid, APP_ORIGIN: "https://szop.dzwoniec.com/" })
        .appOrigin,
    ).toBe("https://szop.dzwoniec.com");
  });

  it("ignores variables it does not know", () => {
    expect(loadConfig({ ...valid, PATH: "/usr/bin" })).toEqual(
      loadConfig(valid),
    );
  });

  it("resolves a relative WEB_ROOT against the working directory", () => {
    expect(loadConfig({ ...valid, WEB_ROOT: "../web/dist" }).webRoot).toBe(
      resolve(process.cwd(), "../web/dist"),
    );
  });

  it("keeps an absolute WEB_ROOT as it is", () => {
    expect(loadConfig({ ...valid, WEB_ROOT: "/srv/szop/web" }).webRoot).toBe(
      "/srv/szop/web",
    );
  });

  it.each(names)("names %s when it is missing", (name) => {
    expect(errorFor({ ...valid, [name]: undefined })).toContain(
      `${name}: missing`,
    );
  });

  it("lists every problem at once", () => {
    const message = errorFor({});
    for (const name of names) {
      expect(message).toContain(`${name}: missing`);
    }
  });

  it.each([
    "HOST",
    "DATABASE_HOST",
    "DATABASE_NAME",
    "DATABASE_USER",
    "DATABASE_PASSWORD",
    "WEB_ROOT",
    "TRUSTED_PROXIES",
  ])("rejects an empty %s instead of treating it as missing", (name) => {
    expect(errorFor({ ...valid, [name]: "" })).toMatch(
      new RegExp(`${name}: (?!missing)`),
    );
  });

  it.each(["PORT", "DATABASE_PORT"])("range-checks %s", (name) => {
    for (const port of ["abc", "0", "70000", "3000.5", ""]) {
      expect(errorFor({ ...valid, [name]: port })).toMatch(
        new RegExp(`${name}: (?!missing)`),
      );
    }
  });

  it.each(["loud", "INFO"])("rejects LOG_LEVEL=%j", (level) => {
    expect(errorFor({ ...valid, LOG_LEVEL: level })).toMatch(
      /LOG_LEVEL: (?!missing)/,
    );
  });

  it("reads DATABASE_TLS=verify-full", () => {
    expect(
      loadConfig({ ...valid, DATABASE_TLS: "verify-full" }).database.tls,
    ).toBe("verify-full");
  });

  it.each(["require", "VERIFY-FULL", ""])(
    "rejects DATABASE_TLS=%j",
    (value) => {
      expect(errorFor({ ...valid, DATABASE_TLS: value })).toMatch(
        /DATABASE_TLS: (?!missing)/,
      );
    },
  );

  it.each([
    ["none", []],
    ["10.0.0.0/16", ["10.0.0.0/16"]],
    ["10.0.1.5", ["10.0.1.5"]],
    ["fd00::/8", ["fd00::/8"]],
    ["10.0.0.0/1", ["10.0.0.0/1"]],
    ["10.0.0.0/32", ["10.0.0.0/32"]],
    ["fd00::/1", ["fd00::/1"]],
    ["fd00::/64", ["fd00::/64"]],
    ["fd00::/128", ["fd00::/128"]],
    ["10.0.0.0/16, 10.1.0.0/16", ["10.0.0.0/16", "10.1.0.0/16"]],
  ])("reads TRUSTED_PROXIES=%j", (value, expected) => {
    expect(
      loadConfig({ ...valid, TRUSTED_PROXIES: value }).trustedProxies,
    ).toEqual(expected);
  });

  it.each([
    "10.0.0.0/16,",
    "none,10.0.0.0/16",
    "localhost",
    "abc",
    "10.0.0.0/33",
    "10.0.0.0/x",
    "10.0.0.0/x8",
    "10.0.0.0/8x",
    "10.0.0.0/+8",
    "10.0.0.0/1e1",
    "10.0.0.0/8/8",
    "fd00::/129",
    "0.0.0.0/0",
    "::/0",
  ])("rejects TRUSTED_PROXIES=%j", (value) => {
    expect(errorFor({ ...valid, TRUSTED_PROXIES: value })).toMatch(
      /TRUSTED_PROXIES: (?!missing)/,
    );
  });

  it("reads the commit", () => {
    expect(loadConfig(valid).commit).toBe(
      "0123456789abcdef0123456789abcdef01234567",
    );
  });

  it("accepts unknown", () => {
    expect(loadConfig({ ...valid, GIT_COMMIT: "unknown" }).commit).toBe(
      "unknown",
    );
  });

  it.each(["", "0123456", "0123456789ABCDEF0123456789ABCDEF01234567", "main"])(
    "refuses the commit %j",
    (value) => {
      expect(errorFor({ ...valid, GIT_COMMIT: value })).toMatch(
        /GIT_COMMIT: (?!missing)/,
      );
    },
  );

  it("never puts a value in the error", () => {
    const secret = "s3cr3t-value";
    const message = errorFor({
      HOST: "",
      PORT: secret,
      LOG_LEVEL: secret,
      DATABASE_PORT: secret,
      DATABASE_PASSWORD: secret,
    });
    // The newline and indent make this line PORT's own, not DATABASE_PORT's.
    expect(message).toContain("\n  PORT:");
    expect(message).not.toContain(secret);
  });
});
