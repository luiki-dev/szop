import { describe, expect, it } from "vitest";
import { createItemSchema, updateItemSchema } from "./items.ts";

const id = "0198a000-0000-7000-8000-000000000001";
const create = (extra: object = {}) =>
  createItemSchema.safeParse({ id, name: "Milk", ...extra });

describe("createItemSchema", () => {
  it("ITM-1.1: a name is required", () => {
    expect(createItemSchema.safeParse({ id }).success).toBe(false);
    const blank = create({ name: "   " });
    expect(blank.success).toBe(false);
    expect(blank.error?.issues[0]?.message).toBe("Enter a name.");
  });

  it("ITM-1.2: a category, quantity, unit, note and price are optional", () => {
    expect(create().success).toBe(true);
    expect(
      create({
        categoryId: id,
        quantity: 1500,
        unitId: id,
        note: "ripe",
        price: 199,
      }).success,
    ).toBe(true);
  });

  it("takes everything Undo sends back, nulls included", () => {
    expect(
      create({
        quantity: null,
        unitId: null,
        price: null,
        categoryId: null,
        note: null,
        checkedAt: "2026-11-06T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("LIM-2.1: a name over 100 characters is refused", () => {
    expect(create({ name: "a".repeat(100) }).success).toBe(true);
    expect(create({ name: "a".repeat(101) }).success).toBe(false);
  });

  it("counts a name in code points", () => {
    expect(create({ name: "🛒".repeat(100) }).success).toBe(true);
  });

  it("a note is at most 500 characters, and an empty one is none", () => {
    expect(create({ note: "a".repeat(500) }).success).toBe(true);
    expect(create({ note: "a".repeat(501) }).success).toBe(false);
    expect(create({ note: "" }).data?.note).toBeNull();
  });

  it.each([0, 9_999_001, 1.5])("refuses the quantity %j", (quantity) => {
    expect(create({ quantity }).success).toBe(false);
  });

  it.each([-1, 10_000_000, 1.5])("refuses the price %j", (price) => {
    expect(create({ price }).success).toBe(false);
  });

  it("accepts the limits themselves", () => {
    expect(create({ quantity: 1, price: 0 }).success).toBe(true);
    expect(create({ quantity: 9_999_000, price: 9_999_999 }).success).toBe(
      true,
    );
  });
});

describe("updateItemSchema", () => {
  it("refuses an empty body", () => {
    expect(updateItemSchema.safeParse({}).success).toBe(false);
  });

  it("takes a check alone", () => {
    expect(updateItemSchema.safeParse({ checked: true }).success).toBe(true);
  });
});
