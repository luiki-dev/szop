import type { Catalog } from "@szop/shared";

// A small valid catalog for tests that pass one to buildApp: two categories
// (one inside the other), two products and one unit.
export const testCatalog: Catalog = {
  categories: [
    { id: "dairy", parentId: null, position: 0, name: "Dairy & eggs" },
    { id: "milk", parentId: "dairy", position: 0, name: "Milk" },
  ],
  products: [
    { id: "oat-milk", name: "Oat milk", categoryId: "milk", unitId: "l" },
    { id: "salt", name: "Salt", categoryId: null, unitId: null },
  ],
  units: [{ id: "l", name: "l" }],
};
