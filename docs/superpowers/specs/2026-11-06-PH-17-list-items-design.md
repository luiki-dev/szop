# PH-17 List items: design

## Contents

- [Goal](#goal)
- [Decisions](#decisions)
- [The design](#the-design)
  - [Data](#data)
  - [API](#api)
  - [Quantities and money](#quantities-and-money)
  - [The list screen](#the-list-screen)
  - [Adding an item](#adding-an-item)
  - [Checking and the haul](#checking-and-the-haul)
  - [Editing an item](#editing-an-item)
  - [Picking a category](#picking-a-category)
  - [Removing an item](#removing-an-item)
  - [The sort setting](#the-sort-setting)
  - [The checkboxes' side](#the-checkboxes-side)
  - [Changes show at once](#changes-show-at-once)
  - [The blink behind ✕](#the-blink-behind-)
- [Acceptance criteria](#acceptance-criteria)
- [Tests](#tests)
- [Documentation](#documentation)
- [Demo check](#demo-check)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

A user adds items to a list by name, edits every field, checks them into the haul and puts them back, removes them with an undo, and sees the list sorted by category or in the order added ([PH-17](../../roadmap.md#ph-17-list-items)).

## Decisions

[ADR 0071](../../decisions/0071-list-items-phase-details.md#decisions).

## The design

The UI's words are English, as everywhere in Szop. Every control has a tap target of at least 44 px (48 px where the design system says so), a visible focus ring, and works with the keyboard alone. The list's existing screen (`apps/web/src/lists/list-page.tsx`, `list-screen.tsx`) gains the items; the look follows [the list and the haul](../../architecture/visual-design.md#the-list-and-the-haul) in the design system. The mockups approved in the brainstorm are in [`2026-11-06-PH-17-list-items/`](2026-11-06-PH-17-list-items/):

- `checkbox-side.png`: rows with the checkbox right and left, light and dark, and the "Checkboxes" setting in the menu;
- `edit-item.png`: the edit sheet on a phone and the dialog on a desktop, the category picker inside it, and the toast after Remove;
- `category-picker-v3.png`: the category picker, browsing and searching;
- `sort-setting-v2.png`: "Sort by category" in the ⋮ menu, on and off;
- `haul-ph17.png`: the haul collapsed, the drawer open, nothing checked, light and dark, checkboxes right and left;
- `addbar-ph17.png`: the add bar's own band (b, chosen) and a fade (c, rejected) over the scrolling list, light and dark, with both toasts at their final width; it supersedes the toast's width in `edit-item.png`.

The mockups show sums such as "€28.47 of €45.01" in a few places drawn before the haul's review; in PH-17 the haul shows no sums (`haul-ph17.png` is the reference for the haul).

### Data

A new table `list_items` (`apps/api/src/db/schema.ts`, a migration):

| Column | Type | Rule |
|---|---|---|
| `workspace_id` | uuid | part of the key |
| `id` | uuid | part of the key; made in the browser (UUIDv7) |
| `list_id` | uuid | `(workspace_id, list_id)` → `lists`, on delete cascade |
| `name` | text | 1 to 100 characters, checked by the database |
| `quantity` | integer, null | thousandths of the unit, 1 to 9 999 000 (0.001 to 9,999) |
| `unit_id` | uuid, null | `(workspace_id, unit_id)` → `units`, on delete set null (`unit_id`) |
| `price` | integer, null | cents per unit, 0 to 9 999 999 (€0 to €99,999.99) |
| `category_id` | uuid, null | `(workspace_id, category_id)` → `categories`, on delete set null (`category_id`) |
| `note` | text, null | at most 500 characters, checked by the database |
| `checked_at` | timestamptz, null | set when checked, the time of the latest check |
| `created_at`, `updated_at` | timestamptz | as on `lists` |

The key is `(workspace_id, id)`, like every workspace table. The foreign keys include `workspace_id`, so an item can only point at records of its own workspace. `ON DELETE SET NULL (column)` clears only the named column (PostgreSQL 15 and later; Szop runs 18 everywhere). An index on `(workspace_id, list_id)` serves reading a list's items. There is no `position`: the order added is the IDs' order, which UUIDv7 makes time-ordered ([ADR 0071](../../decisions/0071-list-items-phase-details.md), decision 16).

`lists` gains `sort_by_category boolean not null default true`. It is the first migration that changes an existing table, so it is tested with data ([OP-052](https://github.com/luiki-dev/szop/issues/93)): migrate to the previous migration, insert lists, apply this one, check that the lists are still there with `sort_by_category` true.

The limits (name 1 to 100, note 500, the quantity and price ranges above, _Claude's call_: a line total stays within a 32-bit integer) live once in a zod schema in `packages/shared`, used by the API and by the forms ([LIM-2](../../requirements/LIM-limits.md#lim-2)).

### API

New routes next to the lists' (`apps/api/src/lists/` or a new `items/` beside it), all inside the session's workspace like today's:

- **Read** a list's items, with the list itself (its name and `sort_by_category`), in one request the list screen needs; not paged, since a list holds at most 500 items ([LIM-1](../../requirements/LIM-limits.md#lim-1).2, enforced with the quotas in [PH-20](../../roadmap.md#ph-20-quotas-and-rate-limits)). The units and categories come from the existing catalog read (`readCatalog`), which already returns the workspace's units, default data included.
- **Create** an item with its ID from the browser. Sent twice with the same ID, it makes one item, as a list does ([NET-1](../../requirements/NET-connectivity.md#net-1).6): the insert ignores a key that exists (`onConflictDoNothing`, as `insertList`) and the second answer returns the item as stored, unchanged. Removing and then Undo use this route with the removed item's ID and all its fields, `checked_at` included.
- **Update** an item's fields; any subset.
- **Check and uncheck:** `checked: true` or `checked: false`, the state wanted, never a toggle ([ITM-7](../../requirements/ITM-list-items.md#itm-7).2). Every `true` sets `checked_at` to the server's current time; `false` clears it. It may be a field of the update rather than its own route.
- **Delete** an item.
- **Update a list's `sort_by_category`**, next to the rename.

A list, category or unit ID that belongs to another workspace, in the path or in the body, gets the same 404 as one that does not exist ([NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4).10). The database's foreign keys enforce it; the route turns a foreign-key violation into that 404.

### Quantities and money

A quantity is stored in whole thousandths (1.5 kg is `1500`), a price per unit in whole cents. The line total is `round(price × quantity / 1000)`, or the price itself when there is no quantity, in one function in `packages/shared` used by the rows, the edit form's hint and the chips ([ADR 0071](../../decisions/0071-list-items-phase-details.md), decision 17). The rounding is half away from zero.

The fields accept a decimal comma and a decimal point ("0,5" and "0.5"); a quantity has at most three decimals, a price at most two. Values are shown with a decimal point and the € sign before the amount ("€1.98"), one fixed currency until [PH-21](../../roadmap.md#ph-21-shop-in-a-store) ([ITM-1](../../requirements/ITM-list-items.md#itm-1).3). A quantity shows with its unit's short name ("6 pcs", "1.5 kg") or alone without a unit.

### The list screen

From top to bottom, as in the design system: the header (←, name, ⋮, the raccoon tile), the unchecked items, the add bar pinned above the haul, the haul. The list area scrolls under the pinned add bar and haul. The add bar sits on its own band in the page color, with rounded top corners like the haul, a soft shadow above it and a thin top edge; the band reaches under the haul, so the cards slide under its rounded edge instead of being cut at a straight line (`addbar-ph17.png`, b; [ADR 0071](../../decisions/0071-list-items-phase-details.md), decision 25).

**An item's row** (`checkbox-side.png`): the name (wrapping to two lines) with the note under it in muted text, cut to one line; on the right of the name, the quantity and unit above the line total; and the round checkbox at the right edge (or the left, [The checkboxes' side](#the-checkboxes-side)). Tapping the name, note, quantity or price opens the edit ([ITM-6](../../requirements/ITM-list-items.md#itm-6).3); the checkbox only checks. Rows are separated by thin lines; a row is at least 56 px high.

**With sorting on** ([ORD-2](../../requirements/ORD-list-display-and-ordering.md#ord-2), [ORD-3](../../requirements/ORD-list-display-and-ordering.md#ord-3)): one card per category that has unchecked items, at any level of the tree, in the global category order (`packages/shared`, PH-15a's rule: depth-first, each category before its subcategories), each headed by that category's own name and "N left" _(Claude's call: a subcategory's card does not name its parent)_; items sorted by name with Polish rules (`compareNames`). An item labeled with a parent category sits in the parent's card, before the cards of its subcategories. Items without a category are in a last card named "No category", in italics. A card disappears when its last item is checked.

**With sorting off** ([ORD-5](../../requirements/ORD-list-display-and-ordering.md#ord-5).5): one card with no name, its header saying only "N left", the items in the order added, oldest first.

**States** (the design system's table): skeleton cards while loading; "Nothing on this list yet" pointing at the add bar and no haul when the list is empty; "Everything's in the haul" when every item is checked; the existing error card with "Try again" when the read fails.

### Adding an item

The add bar is a field with the placeholder "+ Add item", its accessible name "Add an item to *list name*", and an "Add" button ([APP-6](../../requirements/APP-app-wide-behavior.md#app-6).1). Enter or "Add" adds the typed name, trimmed, as an item with no category, quantity, unit, price or note ([ITM-2](../../requirements/ITM-list-items.md#itm-2).3); the item appears at once in the "No category" card (sorting on) or at the bottom (sorting off). The field then clears and keeps the focus ([ITM-2](../../requirements/ITM-list-items.md#itm-2).4), so the next item can be typed straight away; on a phone the keyboard stays open.

An empty or whitespace-only name adds nothing. The field takes at most 100 characters (`maxlength`): further characters are not typed, and a longer paste is cut, with no message, so the add bar never shows an error and never moves ([LIM-2](../../requirements/LIM-limits.md#lim-2).2; [ADR 0071](../../decisions/0071-list-items-phase-details.md), decision 24). The list name's field (PH-16a) changes the same way: it drops "At most 100 characters." for `maxlength`, so every text field with a limit behaves alike. While the field has the focus, the haul folds to one line, "The haul · 6 of 11 items" ([ORD-1](../../requirements/ORD-list-display-and-ordering.md#ord-1).8, the count instead of the amount until PH-21) _(Claude's call)_.

### Checking and the haul

Checking an item moves its row out of its card and its chip first into the haul, in 150 to 200 ms, without motion when the system asks for reduced motion ([ORD-1](../../requirements/ORD-list-display-and-ordering.md#ord-1).1). The checkbox is a checkbox named after the item.

The haul is the approved one ([visual design](../../architecture/visual-design.md#the-list-and-the-haul), `haul-ph17.png`) without its sums and without "Put all back" ([ADR 0071](../../decisions/0071-list-items-phase-details.md), decision 12):

- **Collapsed:** a handle; "The haul" and "*k* of *n* items" (*k* checked of all *n* items on the list); the progress bar, following the count; one row of chips, newest check first, as many as fit, then "+N more" ([ORD-1](../../requirements/ORD-list-display-and-ordering.md#ord-1).3). A chip shows the name and the line total, or the name alone without a price, cut with "…" at about 12 characters; a tap on it puts the item back ([ORD-1](../../requirements/ORD-list-display-and-ordering.md#ord-1).4). Before anything is checked, "Check items off to drop them here" replaces the chips.
- **The drawer** (Base UI Drawer): opened by dragging the handle up, tapping the header or "+N more"; closed by dragging down, tapping the dimmed list or Esc ([ORD-1](../../requirements/ORD-list-display-and-ordering.md#ord-1).6). It covers 75% of the screen's height, keeps the header pinned, and shows "Newest first · ↶ puts an item back" and a row per checked item: name, quantity and unit, line total and a ↶ button, which alone puts the item back ([ORD-1](../../requirements/ORD-list-display-and-ordering.md#ord-1).7). The ↶ button follows the checkboxes' side. The drawer ends at its last row.
- **Order:** by `checked_at`, newest first ([ORD-2](../../requirements/ORD-list-display-and-ordering.md#ord-2).5).
- **Desktop:** the add bar and the haul are pinned at the bottom of the content column (at most 720 px), and the drawer opens within it ([ORD-1](../../requirements/ORD-list-display-and-ordering.md#ord-1).11).
- **Accessibility** ([ORD-1](../../requirements/ORD-list-display-and-ordering.md#ord-1).10): chips and ↶ buttons are buttons named "Put *item* back"; "+N more" is "Show all N items in the haul"; the drawer is a dialog named "The haul" that holds the focus while open and returns it when closed; the progress bar exposes its value and maximum.

Putting an item back sends `checked: false`; the item returns to its place in its card.

### Editing an item

Tapping an item's name opens "Edit item" (`edit-item.png`): a bottom sheet over the dimmed list on a phone (Base UI Drawer), a centered dialog on a desktop (from `lg`). It has ✕ at the top right. No field takes the focus on opening, so the phone's keyboard does not cover the sheet.

The fields, in order, each with a visible label ([APP-6](../../requirements/APP-app-wide-behavior.md#app-6).1):

1. **Name**, required, at most 100 characters.
2. **Quantity** with − and + (Base UI NumberField): + on an empty field gives 1, otherwise adds 1; − subtracts 1 and is disabled at 1 or below, so it never empties the field; clearing the field removes the quantity. A unit may be set without a quantity, and clearing the quantity keeps the unit _(Claude's call)_. Next to it in one row, **Unit**, a select of the workspace's units with "No unit" first.
3. **Price per unit**, in €, with the line total under it ("6 × €0.33 = €1.98") once both a quantity and a price are set.
4. **Category**: a button showing the chosen category's name, or "No category" in italics; it opens the picker.
5. **Note**, a text area that grows with its text, at most 500 characters.

Buttons: **Remove** on the left in the destructive text color; **Cancel** and **Save** on the right. Save checks the form, closes the sheet and shows the change at once. Cancel, ✕, Esc and tapping the dimmed list close it without saving. An error shows under its field, in words, when the field is left and when Save is pressed ([APP-6](../../requirements/APP-app-wide-behavior.md#app-6).2): "Enter a name." and "Enter a number, such as 1.5." The name and the note take at most 100 and 500 characters through `maxlength`, with no message, as the add bar The form is React Hook Form with the shared zod schema.

Editing an item changes only that item ([ITM-6](../../requirements/ITM-list-items.md#itm-6).2); PH-17 has no catalog products behind items, and later phases keep it so.

### Picking a category

The Category field opens a second sheet over the edit sheet; on a desktop it replaces the dialog's content, with ← back to the form (`category-picker-v3.png`). It has the title "Category", ✕, a field "Search categories" and the tree:

- the rows sit in one bordered box with thin lines between them, as on the Catalog page, each at least 52 px high and ending with a radio circle; the current category's circle is filled and its name bold;
- **a row has two targets:** the chevron (44 × 52 px) at the left opens and closes its subcategories; the rest of the row picks the category and goes back to the form. A category without subcategories keeps the chevron's space empty, so names line up;
- every level below the top sits on one muted band and is indented 20 px per level;
- **"No category"** is the first row, in italics, and picking it clears the category;
- **searching** narrows the tree as the Catalog page does (`foldForSearch`, `findMatch`): matching categories with their ancestors, the match highlighted.

The tree is the workspace's categories (the default data's order until [PH-27](../../roadmap.md#ph-27-categories)), from the catalog read the Catalog page uses. The picker is a radio group named "Category", so a screen reader announces the choice; picking returns the focus to the Category field.

### Removing an item

Remove in the edit sheet closes it and takes the item off the list at once; there is no "Are you sure?" ([APP-3](../../requirements/APP-app-wide-behavior.md#app-3).2). A toast (Base UI Toast) above the add bar says "Removed *Bananas*" with an "Undo" button, for about 5 seconds; it stays while it has the focus or the pointer is over it, and is announced politely to screen readers. Undo creates the item again with the same ID and every field, so it returns to its place, checked or not ([OP-051](https://github.com/luiki-dev/szop/issues/103)). A second removal while a toast is showing replaces it.

The toast is the app's first ([APP-3](../../requirements/APP-app-wide-behavior.md#app-3).1): one toast region in the app shell, used for messages that are not tied to a field. A toast is 75 % of the screen's width, centered, so it does not read as part of the list (`addbar-ph17.png`; [ADR 0071](../../decisions/0071-list-items-phase-details.md), decision 23).

### The sort setting

The list's ⋮ menu gains a first item, **"Sort by category"**, a check item (✓ when on, empty when off), then a separator, the "Checkboxes" group (Left or Right, the chosen one with a ✓; see the checkboxes' setting below), another separator, then Rename and Delete (`sort-setting-v2.png`, `checkbox-side-menu.png`; [ORD-5](../../requirements/ORD-list-display-and-ordering.md#ord-5).1). A tap switches it, closes the menu and re-orders the list at once; the change is saved on the server for the list. New lists have it on. Checked items go to the haul either way ([ORD-5](../../requirements/ORD-list-display-and-ordering.md#ord-5).3). It uses the same check as the rename: in PH-17 that is the workspace's owner; the list's editors gain it with sharing ([ORD-5](../../requirements/ORD-list-display-and-ordering.md#ord-5).4) _(Claude's call)_.

### The checkboxes' side

A new choice in the menu's footer, under Color scheme: **"Checkboxes"**, Left or Right, the same radio control as the color scheme (`apps/web/src/shell/color-scheme-control.tsx`), each option with a small picture of a row (`checkbox-side.png`; [APR-2](../../requirements/APR-appearance.md#apr-2)). Right is the default. It is kept in `localStorage` per device like the color scheme, applies to every list's rows and to the drawer's ↶ buttons, and still switches the page for as long as it is open when the browser cannot store it.

With Right, a row reads: name and note, then quantity and line total, then the checkbox at the right edge. With Left: the checkbox, name and note, then quantity and line total.

### Changes show at once

Adding, editing, checking, unchecking, removing, Undo and the sort setting update the screen at once, without a spinner ([APP-7](../../requirements/APP-app-wide-behavior.md#app-7).1), through TanStack Query's optimistic updates on top of PH-16d's machinery: the 10-second time limit, one send per change, the reload after a failure ([ADR 0070](../../decisions/0070-resilient-changes-phase-details.md)).

When the server refuses or loses a change, the screen goes back to what the server holds after the reload, and a toast in the Undo toast's place, with no button, says the change was not saved (`addbar-ph17.png`; [APP-7](../../requirements/APP-app-wide-behavior.md#app-7).2): "*Bananas* wasn't saved. Check your connection and try again." Changes to one item are sent in order: a check and an edit of the same item made in quick succession do not overtake each other. PH-16d's mutations wait for the server and have no optimistic update or ordering; this phase adds both, with TanStack Query's `onMutate` and rollback, and a mutation `scope` per item, which runs one item's changes one after another. A failed Undo shows the "wasn't saved" toast in place of the Undo toast.

### The blink behind ✕

Bug [#397](https://github.com/luiki-dev/szop/issues/397): when Select starts on the lists page, the ✕ button that appears shows its hover background and border for a moment. ✕ shows no background when it appears; the hover look shows only on hover or focus. The fix is in the lists page's selection controls, on a phone and a desktop, light and dark.

## Acceptance criteria

The wording is the reviewed one ([ADR 0071](../../decisions/0071-list-items-phase-details.md), decision 22); the criteria below are ✅ in this phase.

- [ITM-1](../../requirements/ITM-list-items.md#itm-1).1 and ITM-1.2, whole; ITM-1.3 is PH-21's.
- [ITM-2](../../requirements/ITM-list-items.md#itm-2).3 and ITM-2.4, whole.
- [ITM-6](../../requirements/ITM-list-items.md#itm-6).1, ITM-6.2 and ITM-6.3, whole.
- [ITM-7](../../requirements/ITM-list-items.md#itm-7).1 to ITM-7.4, whole.
- [ORD-1](../../requirements/ORD-list-display-and-ordering.md#ord-1).1 to ORD-1.4, ORD-1.6, ORD-1.7 and ORD-1.9 to ORD-1.11, whole; ORD-1.5 and ORD-1.8 in part (the count; the amounts are PH-21's).
- [ORD-2](../../requirements/ORD-list-display-and-ordering.md#ord-2).1 to ORD-2.5, whole (the list's part of ORD-2.1 to ORD-2.3).
- [ORD-3](../../requirements/ORD-list-display-and-ordering.md#ord-3).1, whole (the list's part).
- [ORD-5](../../requirements/ORD-list-display-and-ordering.md#ord-5).1 to ORD-5.3 and ORD-5.5, whole; ORD-5.4 in part (the owner; editors with sharing).
- [APP-3](../../requirements/APP-app-wide-behavior.md#app-3).1 and APP-3.2, whole.
- [APP-6](../../requirements/APP-app-wide-behavior.md#app-6).1 and APP-6.2, whole.
- [APP-7](../../requirements/APP-app-wide-behavior.md#app-7).1 and APP-7.2, whole.
- [APR-2](../../requirements/APR-appearance.md#apr-2).1 to APR-2.3, whole.
- [LIM-2](../../requirements/LIM-limits.md#lim-2).1 and LIM-2.2, in part: item names and notes.
- [ACC-1](../../requirements/ACC-accounts-and-guest-mode.md#acc-1).5, whole.
- [NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4).10, in part: references between records.

## Tests

Each criterion's test name starts with its ID.

- **Shared (Vitest):** the line total and its rounding, parsing "0,5" and "0.5", the limits of the item schema, the sort with sorting on and off.
- **API (Vitest against PostgreSQL):**
  - the routes: create (twice with the same ID makes one), read, update, check and uncheck with the state wanted (ITM-7.2: `true` twice stays checked, with the later time, ITM-7.4), delete, Undo's create with `checked_at`, the sort setting;
  - LIM-2.1: names over 100 and notes over 500 refused by the API and by the database;
  - NFR-4.10: an item pointing at another workspace's list, category or unit gets 404; so does a request for another workspace's item;
  - deleting a category or unit leaves its items with no category or unit; deleting a list deletes its items;
  - ACC-1.5: a guest's item with a default category and unit is saved;
  - OP-052: the migration test with data for `sort_by_category`.
- **Web (Vitest, Testing Library, MSW):** adding (the field clears, the focus stays), LIM-2.2: the add bar, the name, the note and the list name's field take no character past their limit, the row's two targets, the edit form's fields, errors and Save, the category picker's two targets and search, Remove and Undo, the toast's timing, the sort setting, the checkboxes' setting, the haul's chips, drawer and order, the optimistic update and its rollback with the "wasn't saved" toast (APP-7.2), #397.
- **E2E (Playwright):** a journey that adds three items, edits one's quantity, price and category, checks two, puts one back from a chip and one from the drawer, removes one and undoes it, switches the sort off and on, and reloads to see it all kept; on a phone-sized and a desktop-sized window; an axe check of the list screen, the edit sheet, the picker and the open drawer.
- **Mutation testing:** the run over the changed logic (the line total and parsing, the sort, the optimistic updates and rollback, the routes' checks), each survivor killed or accepted with a reason ([definition of done](../../development/definition-of-done.md), item 2).

## Documentation

- `docs/architecture/architecture.md`: the `list_items` table and its foreign keys, `sort_by_category`, quantities and money as integers, the optimistic updates, the toast region.
- `docs/architecture/visual-design.md`: the row with the checkbox right or left, the edit sheet, the category picker, the toast, the sort setting, the haul without sums until PH-21, with the built screens.
- `docs/architecture/stack-overview.md`: React Hook Form, optimistic updates, Base UI's Drawer, Toast and NumberField.
- `docs/architecture/threat-model.md`: references between records checked by the database's foreign keys.
- `docs/glossary.md`: any new term (none expected beyond the stack's).
- `docs/development/testing.md`: the migration test with data.
- `docs/requirements/`: the reviewed criteria at 🚧, the new ITM-2.4, ITM-2.5, ITM-5.3, ITM-6.3, ITM-7.4, ORD-5.5 and APR-2, the finalized requirements. Done in the spec's commit, except the ✅s.
- `docs/roadmap.md`: PH-17's **Delivers**, PH-21's, PH-23's and PH-24's ([ADR 0071](../../decisions/0071-list-items-phase-details.md#changes-to-the-roadmap)), and the PH-17 row 🚧 with the spec. Done in the spec's commit.

## Demo check

All local, in the production-like environment; nothing needs AWS.

- On a phone-sized window (and a real phone if at hand), one-handed: add items one after another; check and put back; open the drawer by dragging and by "+N more"; edit an item and pick a category in the picker; remove and undo.
- The checkboxes' setting both ways, light and dark; the sort setting both ways, and the order after a reload.
- The edit dialog, the picker and the drawer on a desktop-sized window, with the keyboard only.
- With DevTools' network offline or a held request: a check and an edit roll back with "wasn't saved".
- The browser console shows no content security policy violation while the drawer, the sheet and the toast open.
- #397: Select on the lists page, phone and desktop, light and dark.

Checked by hand: [ORD-1](../../requirements/ORD-list-display-and-ordering.md#ord-1).6, [ORD-1](../../requirements/ORD-list-display-and-ordering.md#ord-1).11, [APP-7](../../requirements/APP-app-wide-behavior.md#app-7).2, [APR-2](../../requirements/APR-appearance.md#apr-2).1.

## Risks

- **The phase is large** (an experiment with merged PH-17a and PH-17b, [context-size audit](../../audits/2026-11-06-ph-17-context-experiment.md)): the plan may pass eight tasks. The plan says so instead of splitting the phase.
- **Base UI's Drawer under the content security policy** has not been seen working in Szop. Its docs say it uses classes and CSS variables; the first task that uses it proves it with the E2E suite, which runs under the real policy. If it injects styles, the fallback is the existing `Sheet` (Base UI Dialog) without the swipe.
- **Optimistic updates out of order:** a quick check and an edit of one item could overtake each other. Changes to one item are sent in sequence (the mutation scope by item).
- **UUIDv7 is not monotonic within one millisecond** (`packages/shared/src/uuid.ts`): two items added in the same millisecond could swap their places with sorting off. Typed adds are seconds apart; a batch add in PH-24 makes increasing IDs.

## Out of scope

- Catalog suggestions in the add bar, the quick quantity after one ([ITM-2](../../requirements/ITM-list-items.md#itm-2).1, ITM-2.2, ITM-2.5; [PH-23](../../roadmap.md#ph-23-smart-input)).
- The haul's sums, the list owner's currency and "Put all back" ([ITM-8](../../requirements/ITM-list-items.md#itm-8), [ITM-1](../../requirements/ITM-list-items.md#itm-1).3, [LST-5](../../requirements/LST-shopping-lists.md#lst-5); [PH-21](../../roadmap.md#ph-21-shop-in-a-store)).
- Swiping to check, moving items by hand (💡 future extensions).
- The user's own category order ([PH-27](../../roadmap.md#ph-27-categories)).
- A settings menu or screen ([OP-133](https://github.com/luiki-dev/szop/issues/398)).
- Suggesting a quantity increase for a duplicate name ([ITM-4](../../requirements/ITM-list-items.md#itm-4)).

## Left to the builder

- The routes' paths and whether checking is its own route or a field of the update.
- The query keys and how the list's read and the catalog's read are combined on the list screen.
- The names of the components and where they live under `apps/web/src/lists/`.
- The exact animation and its easing, within 150 to 200 ms.
- How a foreign-key violation is told apart and turned into the 404.
- The note's one-line cut in a row (`line-clamp` or `truncate`).
