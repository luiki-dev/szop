import { describe, expect, it } from "vitest";
import { compareNames } from "./names.ts";

describe("compareNames", () => {
  it("ORD-2.2, ORD-2.3: sorts by Polish rules", () => {
    expect(["tofu", "śmietana", "ser"].sort(compareNames)).toEqual([
      "ser",
      "śmietana",
      "tofu",
    ]);
  });

  it("ignores case", () => {
    // The collator's default sensitivity ("variant") puts "milk" and "Milk"
    // next to each other, before "Mint", without calling them equal; that is
    // enough for an order and keeps the sort deterministic.
    const sorted = ["Mint", "Milk", "milk"].sort(compareNames);
    expect(sorted[2]).toBe("Mint");
    expect(sorted.slice(0, 2).sort()).toEqual(["Milk", "milk"]);
  });

  it("sorts numbers by value", () => {
    expect(["Pack 10", "Pack 2"].sort(compareNames)).toEqual([
      "Pack 2",
      "Pack 10",
    ]);
  });
});
