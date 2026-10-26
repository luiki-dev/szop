# List display and ordering (ORD)

How a list shows its items: the haul, the order of the items and the "sort by category" setting. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## ORD-1

🎯 [MVP] Checked items leave the list and go to **the haul**, a tray apart from the list that shows what is already in the basket. Putting an item back returns it to the list.

## ORD-2

🎯 [MVP] The list's items are sorted by the global category order, then alphabetically by name. Uncategorized items come last. The haul shows the most recently checked items first.

## ORD-3

🎯 [MVP] Items labeled with a parent category come before items labeled with its subcategories.

## ORD-4

✖️ Dropped by [ADR 0022](../decisions/0022-ring-tail-redesign.md): it was "a toggle hides checked items". Checked items now leave the list for the haul ([ORD-1](#ord-1)), so there is nothing to hide.

## ORD-5

🎯 [MVP] Each list has a "sort by category" setting, on by default. When it is off, items appear in the order they were added, and checked items still go to the haul ([ORD-1](#ord-1)). The owner and editors can change the setting.
