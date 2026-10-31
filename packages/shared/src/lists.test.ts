import { describe, expect, it } from "vitest";
import { createListSchema, listNameSchema } from "./lists.ts";

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
});

describe("createListSchema", () => {
  it("LST-1.1: refuses an ID that is not a UUID", () => {
    expect(
      createListSchema.safeParse({ id: "not-a-uuid", name: "Weekly" }).success,
    ).toBe(false);
  });
});
