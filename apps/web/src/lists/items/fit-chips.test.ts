import { describe, expect, it } from "vitest";
import { fitChips } from "./fit-chips.ts";

describe("fitChips", () => {
  it("ORD-1.3: all chips when they fit, with no room kept for +N more", () => {
    expect(fitChips([50, 50, 50], 166, 40, 8)).toBe(3);
  });

  it("ORD-1.3: one too many leaves room for +N more", () => {
    // 3 chips need 166; two chips and "+1 more" need 156.
    expect(fitChips([50, 50, 50], 160, 40, 8)).toBe(2);
  });

  it("ORD-1.3: none fit when even one chip and +N more do not", () => {
    expect(fitChips([50, 50], 100, 60, 8)).toBe(0);
  });

  it("ORD-1.3: a row that holds the chips and +N more to the pixel keeps them", () => {
    // Two chips, the gap and "+1 more" need exactly 156.
    expect(fitChips([50, 50, 50], 156, 40, 8)).toBe(2);
    expect(fitChips([50, 50, 50], 155, 40, 8)).toBe(1);
  });
});
