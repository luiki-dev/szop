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
      },
    });
  });

  it("ignores variables it does not know", () => {
    expect(loadConfig({ ...valid, PATH: "/usr/bin" })).toEqual(
      loadConfig(valid),
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
