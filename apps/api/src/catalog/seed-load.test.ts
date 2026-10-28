import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({ readFileSync: () => "units: 5\n" }));

const { loadSeed } = await import("./seed.ts");

describe("loadSeed", () => {
  it("names seed.yaml in the error of a bad seed, and keeps the cause", () => {
    expect(() => loadSeed()).toThrow(/^seed\.yaml: units: /);
    try {
      loadSeed();
    } catch (error) {
      expect((error as Error).cause).toBeInstanceOf(Error);
    }
  });
});
