import type { OrderedCategory } from "./catalog.ts";
import type { ListItem } from "./items.ts";
import { compareNames } from "./names.ts";

export type ItemCard =
  | { kind: "category"; category: OrderedCategory; items: ListItem[] }
  | { kind: "uncategorized"; items: ListItem[] }
  | { kind: "all"; items: ListItem[] };

const byId = (a: ListItem, b: ListItem) => {
  // Stryker disable next-line EqualityOperator: IDs are unique, so `<=` differs only for an item against itself
  if (a.id < b.id) return -1;
  // Stryker disable next-line ConditionalExpression,EqualityOperator: `? 1 : 0` to `0` survives only because V8's sort treats any result >= 0 alike (engine-dependent), and IDs are unique, so `>=` and `<=` differ only for an item against itself
  return a.id > b.id ? 1 : 0;
};
const byName = (a: ListItem, b: ListItem) =>
  compareNames(a.name, b.name) || byId(a, b);

// The cards of the unchecked items (ORD-2, ORD-5.5). Sorting on: a card per
// category with items, in the categories' order, then the items without a
// known category. Off: one card, oldest first (IDs are time-ordered).
export function itemCards(
  items: readonly ListItem[],
  categories: readonly OrderedCategory[],
  sortByCategory: boolean,
): ItemCard[] {
  const open = items.filter((item) => item.checkedAt === null);
  if (!sortByCategory) {
    return open.length ? [{ kind: "all", items: open.sort(byId) }] : [];
  }
  const known = new Set(categories.map((c) => c.id));
  const cards: ItemCard[] = [];
  for (const category of categories) {
    const own = open.filter((item) => item.categoryId === category.id);
    if (own.length) {
      cards.push({ kind: "category", category, items: own.sort(byName) });
    }
  }
  const rest = open.filter(
    // Stryker disable next-line ConditionalExpression: `known` never holds null, so the null check is only for the types
    (item) => item.categoryId === null || !known.has(item.categoryId),
  );
  if (rest.length)
    cards.push({ kind: "uncategorized", items: rest.sort(byName) });
  return cards;
}

// The haul (ORD-2.5): checked items, newest first, ties by ID descending.
export function haulItems(items: readonly ListItem[]): ListItem[] {
  return items
    .filter((item) => item.checkedAt !== null)
    .sort(
      (a, b) =>
        // Stryker disable next-line StringLiteral: the filter above leaves only checked items
        (b.checkedAt ?? "").localeCompare(a.checkedAt ?? "") || byId(b, a),
    );
}
