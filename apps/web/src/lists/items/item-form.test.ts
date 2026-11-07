import { describe, expect, it } from "vitest";
import { bananas } from "../../test/items.ts";
import {
  itemFormSchema,
  toFormValues,
  type ItemFormValues,
} from "./item-form.ts";

const base: ItemFormValues = toFormValues(bananas);
const parse = (changes: Partial<ItemFormValues>) =>
  itemFormSchema.safeParse({ ...base, ...changes });
const messages = (changes: Partial<ItemFormValues>) => {
  const result = parse(changes);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("the item form", () => {
  it("APP-6.2: an empty name and a bad number have their words", () => {
    expect(messages({ name: "  " })).toEqual(["Enter a name."]);
    expect(messages({ quantity: "abc" })).toEqual([
      "Enter a number, such as 1.5.",
    ]);
    expect(messages({ price: "x" })).toEqual(["Enter a number, such as 1.5."]);
  });

  it("LIM-2.1: a quantity of 0, 10000 or with four decimals is refused, a price with three too", () => {
    for (const quantity of ["0", "10000", "1,2345"])
      expect(messages({ quantity }), quantity).toHaveLength(1);
    expect(messages({ price: "12.345" })).toHaveLength(1);
    // F4: "1." is refused with the same message.
    expect(messages({ quantity: "1." })).toEqual([
      "Enter a number, such as 1.5.",
    ]);
  });

  it("ITM-1.3: a decimal comma is read, and the amounts are whole thousandths and cents", () => {
    expect(parse({ quantity: "0,5", price: "1.98" }).data).toMatchObject({
      quantity: 500,
      price: 198,
    });
  });

  it("ITM-6.1: an empty quantity becomes null and keeps the unit; an empty note becomes null", () => {
    expect(parse({ quantity: "", unitId: "u1" }).data).toMatchObject({
      quantity: null,
      unitId: "u1",
      note: null,
    });
    expect(parse({ unitId: "" }).data).toMatchObject({ unitId: null });
  });

  it("ITM-6.1: an item's values come back as the fields' text", () => {
    expect(
      toFormValues({
        ...bananas,
        quantity: 1500,
        price: 33,
        unitId: "u3",
        note: "ripe",
      }),
    ).toMatchObject({
      quantity: "1.5",
      price: "0.33",
      unitId: "u3",
      note: "ripe",
    });
  });

  it("LIM-2.1: the smallest and the largest quantity and price are accepted", () => {
    expect(parse({ quantity: "0,001", price: "0" }).data).toMatchObject({
      quantity: 1,
      price: 0,
    });
    expect(parse({ quantity: "9999", price: "99999,99" }).data).toMatchObject({
      quantity: 9_999_000,
      price: 9_999_999,
    });
  });

  it("APP-6.2: a bad number is a custom issue", () => {
    const result = parse({ quantity: "abc" });
    expect(result.error?.issues[0]?.code).toBe("custom");
  });

  it("ITM-6.1: an item with no unit shows the empty choice", () => {
    expect(toFormValues(bananas).unitId).toBe("");
  });
});
