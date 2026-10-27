# List display and ordering (ORD)

How a list shows its items: the haul, the order of the items and the "sort by category" setting. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## ORD-1

🎯 [MVP] · ❔ Draft (0 of 11) · ❔ Criteria not finalized

Checked items leave the list and go to **the haul**, a tray apart from the list that shows what is already in the basket. Putting an item back returns it to the list.

| ID | Criterion | Status |
|---|---|---|
| ORD-1.1 | Checking an item moves it out of its category card into the haul, a dark tray at the bottom of the list; putting it back returns it to its place in its card. | ❔ Draft |
| ORD-1.2 | A category card's header shows how many of its items are left, and the card disappears when all of them are checked. | ❔ Draft |
| ORD-1.3 | The collapsed haul keeps a fixed height and shows one row of chips, most recently checked first, as many as fit, then "+N more". | ❔ Draft |
| ORD-1.4 | A chip shows the item's name and line total, or the name alone without a price, cut with "…" at about 12 characters; tapping it puts the item back. | ❔ Draft |
| ORD-1.5 | The haul's header shows the checked amount of the total ("€28.47 of €36.54"), a progress bar with the items checked ("8 of 11 items") and the amount left ("€8.07 to go"); the bar follows the count of items, not the money. | ❔ Draft |
| ORD-1.6 | Dragging the handle up, tapping the haul's header or tapping "+N more" opens the drawer at 75% of the screen's height; dragging it down, tapping the dimmed list or pressing Esc closes it. | ❔ Draft |
| ORD-1.7 | The drawer keeps the haul's header pinned and lists every checked item, newest first, with its name, quantity and unit, line total and a ↶ button; only the button puts an item back. | ❔ Draft |
| ORD-1.8 | While the add bar has focus, the haul folds to one line with its amount ("The haul · €28.47"). | ❔ Draft |
| ORD-1.9 | Before anything is checked, the haul says "Check items off to drop them here"; when everything is checked, the list says "Everything's in the haul"; an empty list says "Nothing on this list yet" and hides the haul. | ❔ Draft |
| ORD-1.10 | The chips and ↶ buttons are named "Put *item* back", "+N more" is named "Show all N items in the haul", the drawer is a dialog named "The haul", and the progress bar exposes its value and maximum. | ❔ Draft |
| ORD-1.11 | On a wide screen, the haul and the add bar sit at the bottom of the content column, and the drawer opens within it. | ❔ Draft |

## ORD-2

🎯 [MVP] · 🚧 In progress (0 of 5) · ❔ Criteria not finalized

The list's items are sorted by the global category order, then alphabetically by name. Uncategorized items come last. The haul shows the most recently checked items first.

| ID | Criterion | Status |
|---|---|---|
| ORD-2.1 | The unchecked items are grouped in category cards, in the global category order: depth-first, each category before its subcategories, siblings in the order the user gave them. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · the rule in `packages/shared`; the list in [PH-17a](../roadmap.md#ph-17a-list-items) |
| ORD-2.2 | Within a category, items are sorted alphabetically by name. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · the rule in `packages/shared`; the list in [PH-17a](../roadmap.md#ph-17a-list-items) |
| ORD-2.3 | Names sort by Polish alphabetical rules, so "śmietana" comes after "ser" and before "tofu". | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · the rule in `packages/shared`; the list in [PH-17a](../roadmap.md#ph-17a-list-items) · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| ORD-2.4 | Uncategorized items come last. | ❔ Draft |
| ORD-2.5 | The haul shows the most recently checked item first. | ❔ Draft |

## ORD-3

🎯 [MVP] · 🚧 In progress (0 of 1) · ❔ Criteria not finalized

Items labeled with a parent category come before items labeled with its subcategories.

| ID | Criterion | Status |
|---|---|---|
| ORD-3.1 | Items labeled with a parent category come before the items of its subcategories. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · the rule in `packages/shared`; the list in [PH-17a](../roadmap.md#ph-17a-list-items) |

## ORD-4

✖️ Dropped by [ADR 0022](../decisions/0022-ring-tail-redesign.md): it was "a toggle hides checked items". Checked items now leave the list for the haul ([ORD-1](#ord-1)), so there is nothing to hide.

## ORD-5

🎯 [MVP] · ❔ Draft (0 of 4) · ❔ Criteria not finalized

Each list has a "sort by category" setting, on by default. When it is off, items appear in the order they were added, and checked items still go to the haul ([ORD-1](#ord-1)). The owner and editors can change the setting.

| ID | Criterion | Status |
|---|---|---|
| ORD-5.1 | Each list has a "sort by category" setting, on for a new list. | ❔ Draft |
| ORD-5.2 | With the setting off, items appear in the order they were added; items added together in one action keep that action's order. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| ORD-5.3 | With the setting off, checked items still go to the haul. | ❔ Draft |
| ORD-5.4 | The owner and the list's editors can change the setting. | ❔ Draft |
