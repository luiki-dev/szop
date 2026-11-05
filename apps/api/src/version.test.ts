import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readVersion } from "./version.ts";

describe("readVersion", () => {
  it("returns the version of the root package.json", () => {
    const root = new URL("../../../package.json", import.meta.url);
    const { version } = JSON.parse(readFileSync(root, "utf8")) as {
      version: string;
    };

    expect(version).toMatch(/^\d+\.\d+\.\d+/);
    expect(readVersion()).toBe(version);
  });
});
