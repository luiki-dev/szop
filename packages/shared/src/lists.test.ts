import { describe, expect, it } from "vitest";
import {
  createListSchema,
  deleteListsSchema,
  listNameSchema,
} from "./lists.ts";

describe("listNameSchema", () => {
  it("LST-1.1: trims the name", () => {
    expect(listNameSchema.parse("  Weekly  ")).toBe("Weekly");
  });

  it("LST-1.1: keeps a composed letter as one code point", () => {
    const name = listNameSchema.parse("ó");
    expect(name).toBe("ó");
    expect(Array.from(name)).toHaveLength(1);
  });

  it.each(["", "   "])("LST-1.1: refuses %j", (name) => {
    const result = listNameSchema.safeParse(name);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Name is required");
  });

  it.each(["a", "🛒"])(
    "LIM-2.1, LST-1.1: counts code points of %s, at most 100",
    (c) => {
      expect(listNameSchema.safeParse(c.repeat(100)).success).toBe(true);
      const over = listNameSchema.safeParse(c.repeat(101));
      expect(over.success).toBe(false);
      expect(over.error?.issues[0]?.message).toBe(
        "Name is too long (at most 100 characters)",
      );
    },
  );

  it.each(["a\u0000b", "a\tb", "a\nb", "a\u202eb", "a\u200bb"])(
    "LST-1.1: refuses control characters in %j",
    (name) => {
      const result = listNameSchema.safeParse(name);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        "Name can't contain control characters",
      );
    },
  );

  it.each(["Żółw", "🛒 Weekly", "Big shop", "👨‍👩‍👧", "🏴󠁧󠁢󠁳󠁣󠁴󠁿"])(
    "LST-1.1: accepts %j",
    (name) => {
      expect(listNameSchema.safeParse(name).success).toBe(true);
    },
  );
});

describe("deleteListsSchema", () => {
  const ids = (n: number) =>
    Array.from(
      { length: n },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );

  it.each([1, 100])("LST-1.8: accepts %i distinct IDs", (n) => {
    expect(deleteListsSchema.safeParse({ ids: ids(n) }).success).toBe(true);
  });

  it.each([
    ["none", []],
    ["101", ids(101)],
    ["a duplicate", [ids(1)[0], ids(1)[0]]],
    ["a non-UUID", ["x"]],
  ])("LST-1.8: refuses %s", (_label, value) => {
    expect(deleteListsSchema.safeParse({ ids: value }).success).toBe(false);
  });
});

describe("createListSchema", () => {
  it("LST-1.1: refuses an ID that is not a UUID", () => {
    expect(
      createListSchema.safeParse({ id: "not-a-uuid", name: "Weekly" }).success,
    ).toBe(false);
  });
});
