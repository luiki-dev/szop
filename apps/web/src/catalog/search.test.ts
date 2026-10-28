import { describe, expect, it } from "vitest";
import { smallCatalog } from "../test/catalog.ts";
import { foldForSearch, findMatch, searchTree } from "./search.ts";
import { buildCatalogTree } from "./tree.ts";

const tree = buildCatalogTree(smallCatalog);

describe("foldForSearch", () => {
  it("lowercases and removes accents", () => {
    expect(foldForSearch("Crème Fraîche")).toBe("creme fraiche");
  });
});

describe("findMatch", () => {
  it("PRD-2.10: ignores case and accents", () => {
    expect(findMatch("Crème fraîche", "CREME")).toEqual([0, 5]);
    expect(findMatch("Crème fraîche", "fraiche")).toEqual([6, 13]);
  });

  it("gives the indices in the original name", () => {
    expect(findMatch("Oat milk", "milk")).toEqual([4, 8]);
  });

  it("ignores spaces around the query", () => {
    expect(findMatch("Oat milk", "  milk ")).toEqual([4, 8]);
  });

  it("finds a match that starts at index 1", () => {
    expect(findMatch("Oat milk", "at")).toEqual([1, 3]);
  });

  it("returns null for a blank query", () => {
    expect(findMatch("Oat milk", "")).toBeNull();
    expect(findMatch("Oat milk", "   ")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(findMatch("Oat milk", "cheese")).toBeNull();
  });
});

describe("searchTree", () => {
  it("PRD-2.6: keeps a matching product with every ancestor, all open", () => {
    const result = searchTree(tree, "oat milk");

    expect(result?.nodes.map((n) => n.node.category.name)).toEqual([
      "Dairy & eggs",
    ]);
    const milk = result?.nodes[0]?.children[0];
    expect(milk?.node.category.name).toBe("Milk");
    expect(milk?.matched).toBe(false);
    const plant = milk?.children[0];
    expect(plant?.node.category.name).toBe("Plant-based");
    expect(plant?.products.map((p) => p.name)).toEqual(["Oat milk"]);
    expect(result?.open.size).toBe(3);
    expect(result?.productCount).toBe(1);
  });

  it("PRD-2.7: opens a matching category only when something inside it matches", () => {
    const result = searchTree(tree, "cheese");

    const dairy = result?.nodes[0];
    expect(dairy?.children).toHaveLength(1);
    const cheese = dairy?.children[0];
    expect(cheese?.matched).toBe(true);
    expect(cheese?.products.map((p) => p.name)).toEqual(["Cream cheese"]);
    expect(cheese?.shownCount).toBe(1);
    expect(result?.open.has(cheese?.node.category.id ?? "")).toBe(true);
  });

  it("PRD-2.7: keeps a matching category closed, counting its whole contents", () => {
    const result = searchTree(tree, "plant");

    const plant = result?.nodes[0]?.children[0]?.children[0];
    expect(plant?.node.category.name).toBe("Plant-based");
    expect(plant?.matched).toBe(true);
    expect(plant?.shownCount).toBe(1);
    expect(result?.open.has(plant?.node.category.id ?? "")).toBe(false);
    expect(result?.open.size).toBe(2);
    expect(result?.productCount).toBe(1);
  });

  it("PRD-2.12: keeps nothing when nothing matches", () => {
    const result = searchTree(tree, "xyz");

    expect(result?.nodes).toEqual([]);
    expect(result?.productCount).toBe(0);
  });

  it("returns null for a blank query", () => {
    expect(searchTree(tree, "   ")).toBeNull();
    expect(searchTree(tree, "")).toBeNull();
  });

  it.each(["(", "*", "."])(
    "matches %j literally, as no regular expression",
    (query) => {
      expect(searchTree(tree, query)?.nodes).toEqual([]);
    },
  );
});
