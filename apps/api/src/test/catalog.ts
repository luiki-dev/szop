import type { Catalog } from "@szop/shared";

// A small valid catalog for tests that pass one to buildApp: two categories
// (one inside the other), two products and one unit. The IDs are UUIDs, since
// the tables' columns are.
export const testCatalog: Catalog = {
  categories: [
    {
      id: "00000000-0000-5000-8000-000000000001",
      parentId: null,
      position: 0,
      name: "Dairy & eggs",
    },
    {
      id: "00000000-0000-5000-8000-000000000002",
      parentId: "00000000-0000-5000-8000-000000000001",
      position: 0,
      name: "Milk",
    },
  ],
  products: [
    {
      id: "00000000-0000-5000-8000-000000000003",
      name: "Oat milk",
      categoryId: "00000000-0000-5000-8000-000000000002",
      unitId: "00000000-0000-5000-8000-000000000004",
    },
    {
      id: "00000000-0000-5000-8000-000000000005",
      name: "Salt",
      categoryId: null,
      unitId: null,
    },
  ],
  units: [{ id: "00000000-0000-5000-8000-000000000004", name: "l" }],
};
