import { describe, expect, it } from "vitest";
import { smallCatalog } from "../test/catalog.ts";
import { allCategoryIds, buildCatalogTree } from "./tree.ts";

describe("buildCatalogTree", () => {
  const nodes = buildCatalogTree(smallCatalog);
  const [dairy, bakery, empty] = nodes;

  it("PRD-2.5: sorts products by name and lists them before subcategories", () => {
    expect(nodes.map((node) => node.category.name)).toEqual([
      "Dairy & eggs",
      "Bakery",
      "Empty shelf",
    ]);
    // "Crème fraîche" sorts before "Eggs" under the Polish collator.
    expect(dairy?.products.map((p) => p.name)).toEqual([
      "Crème fraîche",
      "Eggs",
    ]);
    expect(dairy?.children.map((child) => child.category.name)).toEqual([
      "Milk",
      "Cheese",
    ]);
    expect(dairy?.children[0]?.products.map((p) => p.name)).toEqual([
      "Lactose-free milk",
      "Milk",
    ]);
    expect(bakery?.products.map((p) => p.name)[0]).toBe("Bread");
  });

  it("carries the depth of each node", () => {
    const plantBased = dairy?.children[0]?.children[0];
    expect(plantBased?.category.name).toBe("Plant-based");
    expect([
      dairy?.depth,
      dairy?.children[0]?.depth,
      plantBased?.depth,
    ]).toEqual([0, 1, 2]);
  });

  it("counts the products of the whole subtree", () => {
    expect(dairy?.productCount).toBe(7);
    expect(dairy?.children[0]?.productCount).toBe(3);
    expect(bakery?.productCount).toBe(3);
  });

  it("gives a category with nothing in it zero products and no children", () => {
    expect(empty?.productCount).toBe(0);
    expect(empty?.products).toEqual([]);
    expect(empty?.children).toEqual([]);
  });
});

describe("allCategoryIds", () => {
  it("lists every category at every level", () => {
    expect(allCategoryIds(buildCatalogTree(smallCatalog))).toEqual(
      new Set(["c1", "c2", "c3", "c4", "c5", "c6"]),
    );
  });
});
