# Use cases (UC)

Scenarios that show how the requirements work together. End-to-end journeys follow them. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## UC-1 First visit as a guest

A visitor opens Szop and sees an empty lists page; the default catalog and categories are already browsable. They create "Weekly groceries" — this first change creates their anonymous workspace from the seed data — and add items with the smart input.

## UC-2 Plan a grocery trip

The user opens a list and types "mil". They pick "Milk", which is added with category Dairy and unit l. They type "birthday candles" and press enter. The item is added ad-hoc and the app offers "Save to catalog?", which they skip. They open the catalog browser, select 5 products under Vegetables and add them. The list sorts itself by category.

## UC-3 Shop in a store

The user walks the store in category order, checking items off. Checked items drop into the haul, so the list shows only what is left. The haul shows what is in the basket, how many items are done and what is left to spend.

## UC-4 Reuse a weekly list

After shopping, the user taps "Uncheck all" on "Weekly groceries" and reuses it next week.

## UC-5 Build from a template

The user creates a "Camping trip" template from scratch. Before each trip, they create a new list from it and adjust it.

## UC-6 Match the store layout

The user reorders categories (Bakery before Dairy) and moves "Cheese" under Dairy. All their lists re-sort.

## UC-7 Customize the catalog

The user adds "Oat milk" under Dairy › Plant-based, with default unit l and a price. From then on it is suggested in the smart input.

## UC-8 Guest becomes a user

A guest with 3 lists registers and verifies their email. The lists, catalog and categories are now in their account and available on their laptop.

## UC-9 Log in on a device with guest data

A user logs in on a borrowed tablet that holds guest lists. The app asks whether to import or discard them. The user discards them.

## UC-10 Share with a household member

🔜 [Later] The owner invites their partner by email as an editor. The partner sees the list in "Shared with me" and adds items. The owner sees them appear live.

## UC-11 Hand off shopping to someone without an account

🔜 [Later] The owner creates a shopper link and sends it to a teenager. The teenager opens it as a guest and checks items off in the store. The owner sees progress live at home.

## UC-12 Revoke access

🔜 [Later] The owner regenerates the share link. The old link stops working.

## UC-13 Archive after a project

Once a renovation list is done, the owner archives it. It leaves the active view and stays read-only in the archive.

## UC-14 Delete an account

The user deletes their account. All their data is removed, and lists they shared disappear for collaborators.
