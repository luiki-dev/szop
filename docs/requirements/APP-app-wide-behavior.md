# App-wide behavior (APP)

What every screen shares: the menu and navigation, page titles, messages, loading and empty states, the not-found page, forms, and changes that show at once. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

These are general rules ([ADR 0051](../decisions/0051-acceptance-criteria.md), decision 13): what one screen must do, such as the empty state of the lists page, is a criterion of that screen's requirement. They come from [ADR 0013](../decisions/0013-visual-design.md), decisions 17 and 18, [ADR 0049](../decisions/0049-app-shell-phase-details.md) and the [visual design](../architecture/visual-design.md#5-layout-and-navigation).

## APP-1

🎯 [MVP] · 🚧 In progress (8 of 10) · ❔ Criteria not finalized

Every page sits in one app shell, with one menu that leads to every destination. The lists are the home screen.

| ID | Criterion | Status |
|---|---|---|
| APP-1.1 | On a phone, ☰ in the header opens the menu as a drawer from the left; Esc, a tap on the dimmed page or following a link closes it, and focus returns to ☰. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APP-1.2 | From 1024 px wide, the menu is a permanent sidebar instead of the drawer; crossing that width swaps them without reloading the page. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APP-1.3 | The menu lists only the pages that exist, marks the current one, and has the logo as a link to the home screen. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APP-1.4 | The bottom of the menu shows whether the API and the database answer: "API: ok" and "Database: up", that the database is down, or that the API cannot be reached, and it recovers when they come back. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APP-1.5 | The active lists are the home screen, at `/`. | ✅ [PH-16a](../roadmap.md#ph-16a-guests-first-list) |
| APP-1.6 | Inside a list, a back arrow takes the menu's place. | ✅ [PH-16a](../roadmap.md#ph-16a-guests-first-list) |
| APP-1.7 | On a wide screen, the content is at most 720 px wide. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APP-1.8 | On a phone, a screen's main action (such as "New list" or the add bar) is pinned at the bottom, and a sticky bar never covers the focused element. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) ("New list"; the add bar in [PH-17a](../roadmap.md#ph-17a-list-items)) |
| APP-1.9 | The setup pages (catalog, categories, units, settings) sit under a heading of their own in the menu, apart from the lists, templates and archive. | ✅ [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| APP-1.10 | A page opened from the menu or a link starts at the top; Back and Forward return to where the page was scrolled. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · the catalog's expansion and search in [OP-112](https://github.com/luiki-dev/szop/issues/305) |

## APP-2

🎯 [MVP] · ✅ Done (2 of 2) · ✅ Criteria finalized ([PH-40](../roadmap.md#ph-40-acceptance-criteria))

Every page names itself, in the page and in the browser's tab.

| ID | Criterion | Status |
|---|---|---|
| APP-2.1 | A page's title is its only top-level heading, and the browser's tab reads "*Title* · Szop". | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |
| APP-2.2 | On a phone, a title too long for the header is cut with "…", and ☰ stays whole. | ✅ [PH-14b](../roadmap.md#ph-14b-app-shell) |

## APP-3

🎯 [MVP] · ❔ Draft (0 of 3) · ❔ Criteria not finalized

The app tells the user what happened and what to do, and asks for confirmation only when an action cannot be undone.

| ID | Criterion | Status |
|---|---|---|
| APP-3.1 | Messages appear as toasts that say what happened and what to do; no message is a generic "Something went wrong". | ❔ Draft |
| APP-3.2 | An action that can be reversed offers an undo instead of asking "Are you sure?". | ❔ Draft · [OP-051](https://github.com/luiki-dev/szop/issues/103) |
| APP-3.3 | An action that cannot be undone, such as deleting the account, asks for confirmation first. | ❔ Draft |

## APP-4

🎯 [MVP] · 🚧 In progress (3 of 3) · ❔ Criteria not finalized

Pages show their state while loading, when empty and when their data cannot be loaded.

| ID | Criterion | Status |
|---|---|---|
| APP-4.1 | While a page loads its data for the first time, it shows placeholders shaped like its content; no page shows a full-screen spinner. | ✅ [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |
| APP-4.2 | An empty page says what it is for and offers the next action, such as "Create your first list" with "New list". | ✅ [PH-16a](../roadmap.md#ph-16a-guests-first-list) · the lists page and an empty list; later pages keep it true |
| APP-4.3 | A page whose data cannot be loaded says so and offers "Try again", which loads it again. | ✅ [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) |

## APP-5

🎯 [MVP] · ❔ Draft (0 of 1) · ❔ Criteria not finalized

An address that leads nowhere shows a page saying so.

| ID | Criterion | Status |
|---|---|---|
| APP-5.1 | A path that is not a page shows a not-found page inside the app shell, with a way back to the home screen. | ❔ Draft |

## APP-6

🎯 [MVP] · ❔ Draft (0 of 2) · ❔ Criteria not finalized

Forms are clear about what they ask and what is wrong.

| ID | Criterion | Status |
|---|---|---|
| APP-6.1 | Every form field has a visible label. The list's add bar is the one exception: its placeholder is "+ Add item", its accessible name says which list it adds to, and its button says "Add". | ❔ Draft |
| APP-6.2 | An error appears under its field, in words, when the user leaves the field and when the form is submitted. | ❔ Draft |

## APP-7

🎯 [MVP] · ❔ Draft (0 of 2) · ❔ Criteria not finalized

Changes show at once, and a change that fails is undone and explained.

| ID | Criterion | Status |
|---|---|---|
| APP-7.1 | Checking, adding and editing show their result at once, with no spinner. | ❔ Draft |
| APP-7.2 | When the server refuses or loses a change, the screen goes back to what the server holds and a message says the change was not saved. | ❔ Draft · [OP-040](https://github.com/luiki-dev/szop/issues/99) |
