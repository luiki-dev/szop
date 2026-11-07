import type { List } from "@szop/shared";

// Three lists in the order the API sends them: newest first.
export const threeLists = [
  {
    id: "0198a000-0000-7000-8000-000000000003",
    name: "Party",
    sortByCategory: true,
    createdAt: "2026-10-30T12:00:00.000Z",
  },
  {
    id: "0198a000-0000-7000-8000-000000000002",
    name: "Weekend groceries",
    sortByCategory: true,
    createdAt: "2026-10-29T12:00:00.000Z",
  },
  {
    id: "0198a000-0000-7000-8000-000000000001",
    name: "Hardware store",
    sortByCategory: true,
    createdAt: "2026-10-28T12:00:00.000Z",
  },
] satisfies List[];
