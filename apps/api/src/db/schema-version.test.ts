import { describe, expect, it } from "vitest";
import { schemaVersionFor, type Journal } from "./schema-version.ts";

const journal: Journal = {
  entries: [
    { when: 1791232100906, tag: "0000_init" },
    { when: 1791300000000, tag: "0001_lists" },
  ],
};

describe("schemaVersionFor", () => {
  it.each([1791300000000, "1791300000000"])(
    "names the migration recorded at %j",
    (createdAt) => {
      expect(schemaVersionFor(journal, createdAt)).toBe("0001_lists");
    },
  );

  it("says unknown for a migration the journal does not list", () => {
    expect(schemaVersionFor(journal, 1799999999999)).toBe("unknown");
  });

  it("says unknown when no migration is recorded", () => {
    expect(schemaVersionFor(journal, undefined)).toBe("unknown");
  });
});
