# List items (ITM)

The items on a list: their fields, adding them, editing them, checking them off and their totals. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## ITM-1

🎯 [MVP] An item has a name (required) and an optional category, quantity, unit, note and price per unit.

## ITM-2

🎯 [MVP] Smart add input: while typing, the app suggests catalog products whose names match. Picking a suggestion adds the product with its defaults (category, unit, price). Pressing enter adds the typed text as an ad-hoc item.

## ITM-3

🎯 [MVP] After an ad-hoc item is added, the app offers to save it to the catalog. The option is off by default and saving never happens automatically.

## ITM-4

🎯 [MVP] If an unchecked item with the same name (case-insensitive) is already on the list, the app suggests increasing its quantity instead of adding a duplicate.

## ITM-5

🎯 [MVP] Catalog browser: navigate the category tree, select multiple products and add them to the list at once.

## ITM-6

🎯 [MVP] Edit any field of an item. Changes affect only that item, never the catalog.

## ITM-7

🎯 [MVP] Check and uncheck an item. Remove an item.

## ITM-8

🎯 [MVP] Totals: the list shows the sum of line totals for all items, for remaining (unchecked) items and for checked items. A line total is price × quantity, or just the price when there is no quantity. Items without a price are left out.
