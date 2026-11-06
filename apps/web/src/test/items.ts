import type { ListItem, ListWithItems } from "@szop/shared";
import { threeLists } from "./lists.ts";

const [party] = threeLists;

export const listId = party?.id ?? "";

export const bananas = {
  id: "0198b000-0000-7000-8000-000000000001",
  name: "Bananas",
  quantity: null,
  unitId: null,
  price: null,
  categoryId: null,
  note: null,
  checkedAt: null,
} satisfies ListItem;

export const milk = {
  ...bananas,
  id: "0198b000-0000-7000-8000-000000000002",
  name: "Milk",
} satisfies ListItem;

// The Party list with its items, as `GET /api/lists/:id` answers.
export function listWith(...items: ListItem[]): ListWithItems {
  return { ...threeLists[0], sortByCategory: true, items } as ListWithItems;
}
