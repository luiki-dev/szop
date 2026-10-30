# Shopping lists (LST)

Creating, viewing, archiving, duplicating and resetting shopping lists. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

## LST-1

🎯 [MVP] · 🚧 In progress (0 of 5) · ❔ Criteria not finalized

Create, rename and delete a list. Deleting requires confirmation.

| ID | Criterion | Status |
|---|---|---|
| LST-1.1 | A user creates a list by giving it a name. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) |
| LST-1.2 | The owner renames a list on its screen, by editing the title or through Rename in the list's menu. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) |
| LST-1.3 | The owner deletes a list after confirming it. | ❔ Draft |
| LST-1.4 | On the lists page, "New list" is the main action, pinned at the bottom on a phone. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) |
| LST-1.5 | "New list" opens the new list's screen with its name field focused; Enter with a non-empty name creates the list, and Esc or an empty name leaves without creating anything. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) |

## LST-2

🎯 [MVP] · 🚧 In progress (0 of 3) · ❔ Criteria not finalized

View all active lists. View archived lists separately.

| ID | Criterion | Status |
|---|---|---|
| LST-2.1 | The lists page, the home screen, shows every active list, newest first. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) |
| LST-2.2 | Archived lists are on a page of their own, "Archive" in the menu. | ❔ Draft |
| LST-2.3 | With no list yet, the lists page shows the raccoon and "Create your first list" and offers "New list". | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) |

## LST-3

🎯 [MVP] · ❔ Draft (0 of 4) · ❔ Criteria not finalized

Archive and unarchive a list. An archived list is read-only until unarchived.

| ID | Criterion | Status |
|---|---|---|
| LST-3.1 | The owner archives a list; it leaves the active lists and appears in the archive. | ❔ Draft |
| LST-3.2 | The owner unarchives a list; it returns to the active lists. | ❔ Draft |
| LST-3.3 | An archived list's name and items cannot be changed, added, checked or removed; the API answers such a change with 409. | ❔ Draft |
| LST-3.4 | On an archived list, unarchiving, deleting, duplicating and saving as a template still work. | ❔ Draft · [OP-047](https://github.com/luiki-dev/szop/issues/111) |

## LST-4

🎯 [MVP] · ❔ Draft (0 of 2) · ❔ Criteria not finalized

Duplicate a list. The items are copied and all start unchecked. Shares are not copied.

| ID | Criterion | Status |
|---|---|---|
| LST-4.1 | The owner duplicates a list: the copy has every item, all unchecked. | ❔ Draft |
| LST-4.2 | A duplicate has no shares. | ❔ Draft |

## LST-5

🎯 [MVP] · ❔ Draft (0 of 1) · ❔ Criteria not finalized

"Uncheck all" resets every item on the list.

| ID | Criterion | Status |
|---|---|---|
| LST-5.1 | "Put all back", at the end of the haul's drawer, returns every checked item to the list. | ❔ Draft |

## LST-6

🎯 [MVP] · ❔ Draft (0 of 1) · ❔ Criteria not finalized

"Save as template" creates a template from the list's items.

| ID | Criterion | Status |
|---|---|---|
| LST-6.1 | "Save as template" creates a template with the list's items, without their checked state. | ❔ Draft |
