import { describe, expect, it } from "vitest";
import { orderCategories, type CatalogCategory } from "./catalog.ts";
import { haulItems, itemCards } from "./item-order.ts";
import type { ListItem } from "./items.ts";

const cat = (
  id: string,
  parentId: string | null,
  position: number,
  name: string = id,
): CatalogCategory => ({ id, parentId, position, name });

const item = (
  id: string,
  name: string,
  categoryId: string | null,
  checkedAt: string | null = null,
): ListItem => ({
  id,
  name,
  quantity: null,
  unitId: null,
  price: null,
  categoryId,
  note: null,
  checkedAt,
});

const categories = orderCategories([
  cat("dairy", null, 0),
  cat("milk", "dairy", 0),
  cat("veg", null, 1),
]);
const names = (items: { name: string }[]) => items.map((i) => i.name);

describe("itemCards", () => {
  it("ORD-2.1: cards follow the category order", () => {
    const cards = itemCards(
      [item("1", "Kale", "veg"), item("2", "Cheese", "dairy")],
      categories,
      true,
    );
    expect(
      cards.map((c) => (c.kind === "category" ? c.category.id : c.kind)),
    ).toEqual(["dairy", "veg"]);
  });

  it("ORD-3.1: an item of a parent sits in the parent's card, before its subcategory's", () => {
    const cards = itemCards(
      [item("1", "Skyr", "milk"), item("2", "Cheese", "dairy")],
      categories,
      true,
    );
    expect(
      cards.map((c) => (c.kind === "category" ? c.category.id : c.kind)),
    ).toEqual(["dairy", "milk"]);
    expect(names(cards[0]?.items ?? [])).toEqual(["Cheese"]);
  });

  it("ORD-2.2: items follow Polish rules", () => {
    const [card] = itemCards(
      [
        item("1", "Dynia", "veg"),
        item("2", "Ćwikła", "veg"),
        item("3", "Cebula", "veg"),
      ],
      categories,
      true,
    );
    expect(names(card?.items ?? [])).toEqual(["Cebula", "Ćwikła", "Dynia"]);
  });

  it("ORD-2.4: items with no category are in a last card", () => {
    const cards = itemCards(
      [
        item("1", "Soap", null),
        item("2", "Kale", "veg"),
        item("3", "Mystery", "gone"),
      ],
      categories,
      true,
    );
    expect(cards.map((c) => c.kind)).toEqual(["category", "uncategorized"]);
    expect(names(cards[1]?.items ?? [])).toEqual(["Mystery", "Soap"]);
  });

  it("ORD-5.5: with sorting off one card, oldest first", () => {
    const cards = itemCards(
      [item("b", "Kale", "veg"), item("a", "Soap", null)],
      categories,
      false,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]?.kind).toBe("all");
    expect(cards[0]?.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("puts checked items in no card, and makes none when nothing is unchecked", () => {
    const checked = item("1", "Kale", "veg", "2026-11-06T10:00:00.000Z");
    expect(itemCards([checked], categories, true)).toEqual([]);
    expect(itemCards([checked], categories, false)).toEqual([]);
    expect(itemCards([], categories, true)).toEqual([]);
  });
});

describe("haulItems", () => {
  it("ORD-2.5: the haul is newest first, ties by ID descending", () => {
    const haul = haulItems([
      item("1", "Old", null, "2026-11-06T10:00:00.000Z"),
      item("2", "New", null, "2026-11-06T11:00:00.000Z"),
      item("3", "Tie a", null, "2026-11-06T10:00:00.000Z"),
      item("4", "Open", null),
    ]);
    expect(names(haul)).toEqual(["New", "Tie a", "Old"]);
  });
});
