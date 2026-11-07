# List display and ordering (ORD)

How a list shows its items: the haul, the order of the items and the "sort by category" setting. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## ORD-1

🎯 [MVP] · 🚧 In progress (9 of 11) · ❔ Criteria not finalized

Checked items leave the list and go to **the haul**, a tray apart from the list that shows what is already in the basket. Putting an item back returns it to the list.

| ID | Criterion | Status |
|---|---|---|
| ORD-1.1 | Checking an item moves it out of its category card into the haul, a dark tray at the bottom of the list; putting it back returns it to its place in its card. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-1.2 | A category card's header shows how many of its items are left, and the card disappears when all of them are checked. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-1.3 | The collapsed haul keeps a fixed height and shows one row of chips, most recently checked first, as many as fit, then "+N more". | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-1.4 | A chip shows the item's name and line total, or the name alone without a price, cut with "…" at about 12 characters; tapping it puts the item back. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-1.5 | The haul's header shows the checked amount of the total ("€28.47 of €36.54"), a progress bar with the items checked ("8 of 11 items") and the amount left ("€8.07 to go"); the bar follows the count of items, not the money. | 🚧 [PH-21](../roadmap.md#ph-21-shop-in-a-store) (the amounts) · the count since [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-1.6 | Dragging the handle up, tapping the haul's header or tapping "+N more" opens the drawer at 75% of the screen's height; dragging it down, tapping the dimmed list or pressing Esc closes it. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-1.7 | The drawer keeps the haul's header pinned and lists every checked item, newest first, with its name, quantity and unit, line total and a ↶ button; only the button puts an item back. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-1.8 | While the phone's keyboard is open for the add bar, the haul folds to one line with its amount ("The haul · €28.47"). | 🚧 [PH-21](../roadmap.md#ph-21-shop-in-a-store) (the amounts) · the count since [PH-17](../roadmap.md#ph-17-list-items), only with the keyboard open in [PH-46](../roadmap.md#ph-46-list-items-polish) |
| ORD-1.9 | Before anything is checked, the haul says "Check items off to drop them here"; when everything is checked, the list says "Everything's in the haul"; an empty list says "Nothing on this list yet" and hides the haul. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-1.10 | The chips and ↶ buttons are named "Put *item* back", "+N more" is named "Show all N items in the haul", the drawer is a dialog named "The haul", and the progress bar exposes its value and maximum. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-1.11 | On a wide screen, the haul and the add bar sit at the bottom of the content column, and the drawer opens within it. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |

## ORD-2

🎯 [MVP] · ✅ Done (5 of 5) · ✅ Criteria finalized ([PH-17](../roadmap.md#ph-17-list-items))

The list's items are sorted by the global category order, then alphabetically by name. Uncategorized items come last. The haul shows the most recently checked items first.

| ID | Criterion | Status |
|---|---|---|
| ORD-2.1 | The unchecked items are grouped in category cards, in the global category order: depth-first, each category before its subcategories, siblings in the order the user gave them. | ✅ [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · the rule in `packages/shared`; the list in [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-2.2 | Within a category, items are sorted alphabetically by name. | ✅ [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · the rule in `packages/shared`; the list in [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-2.3 | Names sort by Polish alphabetical rules, so "śmietana" comes after "ser" and before "tofu". | ✅ [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · the rule in `packages/shared`; the list in [PH-17](../roadmap.md#ph-17-list-items) · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| ORD-2.4 | Uncategorized items come last, in a card named "No category" in italics. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-2.5 | The haul shows the most recently checked item first. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |

## ORD-3

🎯 [MVP] · ✅ Done (1 of 1) · ✅ Criteria finalized ([PH-17](../roadmap.md#ph-17-list-items))

Items labeled with a parent category come before items labeled with its subcategories.

| ID | Criterion | Status |
|---|---|---|
| ORD-3.1 | Items labeled with a parent category come before the items of its subcategories. | ✅ [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · the rule in `packages/shared`; the list in [PH-17](../roadmap.md#ph-17-list-items) |

## ORD-4

✖️ Dropped by [ADR 0022](../decisions/0022-ring-tail-redesign.md): it was "a toggle hides checked items". Checked items now leave the list for the haul ([ORD-1](#ord-1)), so there is nothing to hide.

## ORD-5

🎯 [MVP] · 🚧 In progress (4 of 5) · ✅ Criteria finalized ([PH-17](../roadmap.md#ph-17-list-items))

Each list has a "sort by category" setting, on by default. When it is off, items appear in the order they were added, and checked items still go to the haul ([ORD-1](#ord-1)). The owner and editors can change the setting.

| ID | Criterion | Status |
|---|---|---|
| ORD-5.1 | Each list has a "Sort by category" setting, on for a new list, switched from the list's ⋮ menu. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-5.2 | With the setting off, items appear in the order they were added. The part "items added together in one action keep that action's order" ➡️ [ITM-5](ITM-list-items.md#itm-5).3. | ✅ [PH-17](../roadmap.md#ph-17-list-items) · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| ORD-5.3 | With the setting off, checked items still go to the haul. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-5.4 | The owner and the list's editors can change the setting. | 🚧 editors with sharing · the owner since [PH-17](../roadmap.md#ph-17-list-items) |
| ORD-5.5 | With the setting off, the items are in one card with no category name, the oldest first. | ✅ [PH-17](../roadmap.md#ph-17-list-items) |
