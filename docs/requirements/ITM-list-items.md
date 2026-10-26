# List items (ITM)

The items on a list: their fields, adding them, editing them, checking them off and their totals. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## ITM-1

🎯 [MVP] · ❔ Draft (0 of 3) · ❔ Criteria not finalized

An item has a name (required) and an optional category, quantity, unit, note and price per unit.

| ID | Criterion | Status |
|---|---|---|
| ITM-1.1 | An item has a name, which is required. | ❔ Draft |
| ITM-1.2 | An item may have a category at any level of the tree, a quantity, a unit, a note and a price per unit. | ❔ Draft |
| ITM-1.3 | Prices are shown in the list owner's currency. | ❔ Draft |

## ITM-2

🎯 [MVP] · ❔ Draft (0 of 3) · ❔ Criteria not finalized

Smart add input: while typing, the app suggests catalog products whose names match. Picking a suggestion adds the product with its defaults (category, unit, price). Pressing enter adds the typed text as an ad-hoc item.

| ID | Criterion | Status |
|---|---|---|
| ITM-2.1 | While the user types in the list's add bar, it suggests catalog products whose names match. | ❔ Draft |
| ITM-2.2 | Picking a suggestion adds the product with its default category, unit and price. | ❔ Draft |
| ITM-2.3 | Pressing Enter adds the typed text as an item of its own, with no catalog product behind it. | ❔ Draft |

## ITM-3

🎯 [MVP] · ❔ Draft (0 of 2) · ❔ Criteria not finalized

After an ad-hoc item is added, the app offers to save it to the catalog. The option is off by default and saving never happens automatically.

| ID | Criterion | Status |
|---|---|---|
| ITM-3.1 | After an item of its own is added, the app offers to save it to the catalog. | ❔ Draft |
| ITM-3.2 | The offer starts switched off, and nothing is saved to the catalog unless the user chooses it. | ❔ Draft |

## ITM-4

🎯 [MVP] · ❔ Draft (0 of 3) · ❔ Criteria not finalized

If an unchecked item with the same name (case-insensitive) is already on the list, the app suggests increasing its quantity instead of adding a duplicate.

| ID | Criterion | Status |
|---|---|---|
| ITM-4.1 | Adding an item whose name matches an unchecked item on the list, ignoring case, suggests increasing that item's quantity instead of adding a second one. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| ITM-4.2 | The suggestion is made only when both items have the same unit, or neither has one. | ❔ Draft · [OP-047](https://github.com/luiki-dev/szop/issues/111) |
| ITM-4.3 | Two increases at the same moment, from two tabs or a double tap, both count. | ❔ Draft · [OP-045](https://github.com/luiki-dev/szop/issues/112) |

## ITM-5

🎯 [MVP] · ❔ Draft (0 of 2) · ❔ Criteria not finalized

Catalog browser: navigate the category tree, select multiple products and add them to the list at once.

| ID | Criterion | Status |
|---|---|---|
| ITM-5.1 | From a list, the user opens the catalog browser and moves through the category tree, or narrows it by searching. | ❔ Draft |
| ITM-5.2 | The user selects several products and adds them to the list in one go, each with its defaults. | ❔ Draft |

## ITM-6

🎯 [MVP] · ❔ Draft (0 of 2) · ❔ Criteria not finalized

Edit any field of an item. Changes affect only that item, never the catalog.

| ID | Criterion | Status |
|---|---|---|
| ITM-6.1 | The user edits any field of an item. | ❔ Draft |
| ITM-6.2 | Editing an item changes only that item, never the catalog product it came from. | ❔ Draft |

## ITM-7

🎯 [MVP] · ❔ Draft (0 of 3) · ❔ Criteria not finalized

Check and uncheck an item. Remove an item.

| ID | Criterion | Status |
|---|---|---|
| ITM-7.1 | The user checks an item and unchecks it. | ❔ Draft |
| ITM-7.2 | Checking and unchecking send the state wanted, not a toggle, so a request repeated after a lost answer does no harm. | ❔ Draft · [OP-040](https://github.com/luiki-dev/szop/issues/99) |
| ITM-7.3 | The user removes an item. | ❔ Draft |

## ITM-8

🎯 [MVP] · ❔ Draft (0 of 4) · ❔ Criteria not finalized

Totals: the list shows the sum of line totals for all items, for remaining (unchecked) items and for checked items. A line total is price × quantity, or just the price when there is no quantity. Items without a price are left out.

| ID | Criterion | Status |
|---|---|---|
| ITM-8.1 | The list shows three totals: of all items, of the checked items, and of the unchecked items, the amount "to go". | ❔ Draft |
| ITM-8.2 | An item's line total is its price times its quantity, or its price alone when it has no quantity. | ❔ Draft |
| ITM-8.3 | Items without a price are left out of every total; when no item has a price, no amount is shown. | ❔ Draft |
| ITM-8.4 | A total always equals the sum of the line totals shown, each rounded to the cent. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
