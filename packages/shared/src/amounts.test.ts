import { describe, expect, it } from "vitest";
import {
  formatAmountInput,
  formatPrice,
  formatQuantity,
  lineTotal,
  parseAmount,
} from "./amounts.ts";

describe("parseAmount", () => {
  it.each([
    ["0,5", 3, 500],
    ["0.5", 3, 500],
    [" 1.25 ", 2, 125],
    ["7", 2, 700],
    ["0.001", 3, 1],
    ["12", 3, 12000],
  ] as const)("parses %j with %i decimals as %i", (text, decimals, value) => {
    expect(parseAmount(text, decimals)).toEqual({ ok: true, value });
  });

  it("an empty text is no value", () => {
    expect(parseAmount("", 3)).toEqual({ ok: true, value: null });
    expect(parseAmount("   ", 2)).toEqual({ ok: true, value: null });
  });

  it.each([
    ["1,2345", 3],
    ["1.234", 2],
    ["-1", 2],
    ["1e3", 3],
    ["1.2.3", 2],
    [".", 2],
    ["abc", 3],
    ["1.", 2],
  ] as const)("refuses %j with %i decimals", (text, decimals) => {
    expect(parseAmount(text, decimals)).toEqual({ ok: false });
  });
});

describe("lineTotal", () => {
  it.each([
    [{ price: 33, quantity: 6000 }, 198],
    [{ price: 199, quantity: 1500 }, 299],
    [{ price: 1, quantity: 500 }, 1],
    [{ price: 1, quantity: 499 }, 0],
    [{ price: 250, quantity: null }, 250],
    [{ price: null, quantity: 1000 }, null],
    // Past 32 bits but exact as a JS number (below 2^53).
    [{ price: 9_999_999, quantity: 9_999_000 }, 99_989_990_001],
  ])("%j gives %j", (item, total) => {
    expect(lineTotal(item)).toBe(total);
  });
});

describe("formats", () => {
  it("formats a quantity", () => {
    expect(formatQuantity(1500)).toBe("1.5");
    expect(formatQuantity(6000)).toBe("6");
    expect(formatQuantity(1)).toBe("0.001");
  });

  it("formats a price", () => {
    expect(formatPrice(198)).toBe("€1.98");
    expect(formatPrice(0)).toBe("€0.00");
    expect(formatPrice(9_999_999)).toBe("€99999.99");
  });

  it("formats a field's text", () => {
    expect(formatAmountInput(50, 2)).toBe("0.50");
    expect(formatAmountInput(1500, 3)).toBe("1.5");
  });
});
