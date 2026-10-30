import { describe, expect, it } from "vitest";
import { uuidv7 } from "./uuid.ts";

describe("uuidv7", () => {
  it("has the version 7 layout", () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("starts with the time in milliseconds", () => {
    const now = 1_761_900_000_123;
    expect(uuidv7(now).replace("-", "").slice(0, 12)).toBe(
      now.toString(16).padStart(12, "0"),
    );
  });

  it("sorts later times after earlier ones", () => {
    expect(uuidv7(2000) > uuidv7(1000)).toBe(true);
  });

  it("gives different IDs for the same millisecond", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(5)));
    expect(ids.size).toBe(1000);
  });
});
