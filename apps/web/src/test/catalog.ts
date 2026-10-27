import type { Catalog } from "@szop/shared";

// A small catalog for the page's tests: three levels under "Dairy & eggs",
// a product with no unit (Bread), one whose name needs two lines on a phone
// (40 characters, no "."), an accented name for the search, and a category
// with nothing in it. 3 top-level categories, 10 products.
export const longName = "Wholegrain seeded rye bread with caraway";

export const smallCatalog = {
  units: [
    { id: "u1", name: "pcs" },
    { id: "u2", name: "l" },
    { id: "u3", name: "kg" },
  ],
  categories: [
    { id: "c1", parentId: null, position: 0, name: "Dairy & eggs" },
    { id: "c2", parentId: "c1", position: 0, name: "Milk" },
    { id: "c3", parentId: "c2", position: 0, name: "Plant-based" },
    { id: "c4", parentId: "c1", position: 1, name: "Cheese" },
    { id: "c5", parentId: null, position: 1, name: "Bakery" },
    { id: "c6", parentId: null, position: 2, name: "Empty shelf" },
  ],
  products: [
    { id: "p1", name: "Eggs", categoryId: "c1", unitId: "u1" },
    { id: "p2", name: "Crème fraîche", categoryId: "c1", unitId: "u3" },
    { id: "p3", name: "Milk", categoryId: "c2", unitId: "u2" },
    { id: "p4", name: "Lactose-free milk", categoryId: "c2", unitId: "u2" },
    { id: "p5", name: "Oat milk", categoryId: "c3", unitId: "u2" },
    { id: "p6", name: "Cheddar", categoryId: "c4", unitId: "u3" },
    { id: "p7", name: "Cream cheese", categoryId: "c4", unitId: "u3" },
    { id: "p8", name: "Bread", categoryId: "c5", unitId: null },
    { id: "p9", name: "Croissant", categoryId: "c5", unitId: "u1" },
    { id: "p10", name: longName, categoryId: "c5", unitId: "u1" },
  ],
} satisfies Catalog;
