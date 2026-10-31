import { describe, expect, it, vi } from "vitest";
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

  it.each(Array.from({ length: 16 }, (_, n) => n))(
    "keeps its layout and maps the random nibble %i to a variant digit, with small bytes",
    (n) => {
      const spy = vi
        .spyOn(crypto, "getRandomValues")
        .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
          (array as unknown as Uint8Array).set([0, n, 0, 0, 0, 0, 0, 0, 0, 0]);
          return array;
        });
      const id = uuidv7(0);
      spy.mockRestore();

      expect(id).toBe(
        `00000000-0000-7000-${"89ab"[n & 3] ?? ""}000-000000000000`,
      );
    },
  );
});
