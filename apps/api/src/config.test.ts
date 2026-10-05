import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

const valid = { HOST: "127.0.0.1", PORT: "3000", LOG_LEVEL: "info" };

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
    });
  });

  it("ignores variables it does not know", () => {
    expect(loadConfig({ ...valid, PATH: "/usr/bin" })).toEqual(
      loadConfig(valid),
    );
  });

  it.each(["HOST", "PORT", "LOG_LEVEL"])(
    "names %s when it is missing",
    (name) => {
      expect(errorFor({ ...valid, [name]: undefined })).toContain(
        `${name}: missing`,
      );
    },
  );

  it("lists every problem at once", () => {
    const message = errorFor({});
    expect(message).toContain("HOST: missing");
    expect(message).toContain("PORT: missing");
    expect(message).toContain("LOG_LEVEL: missing");
  });

  it("rejects an empty HOST instead of treating it as missing", () => {
    expect(errorFor({ ...valid, HOST: "" })).toMatch(/HOST: (?!missing)/);
  });

  it.each(["abc", "0", "70000", "3000.5", ""])("rejects PORT=%j", (port) => {
    expect(errorFor({ ...valid, PORT: port })).toMatch(/PORT: (?!missing)/);
  });

  it.each(["loud", "INFO"])("rejects LOG_LEVEL=%j", (level) => {
    expect(errorFor({ ...valid, LOG_LEVEL: level })).toMatch(
      /LOG_LEVEL: (?!missing)/,
    );
  });

  it("never puts a value in the error", () => {
    const secret = "s3cr3t-value";
    const message = errorFor({ HOST: "", PORT: secret, LOG_LEVEL: secret });
    expect(message).toContain("PORT:");
    expect(message).not.toContain(secret);
  });
});
