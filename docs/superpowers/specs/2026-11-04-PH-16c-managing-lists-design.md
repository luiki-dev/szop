# PH-16c Managing lists: design

## Contents

- [Goal](#goal)
- [Decisions](#decisions)
- [The design](#the-design)
  - [The list name's characters](#the-list-names-characters)
  - [The delete API](#the-delete-api)
  - [The confirmation dialog](#the-confirmation-dialog)
  - [Deleting from the list's screen](#deleting-from-the-lists-screen)
  - [Selecting lists](#selecting-lists)
  - [The not-found pages](#the-not-found-pages)
  - [The new list's screen](#the-new-lists-screen)
  - [The raccoon on a desktop](#the-raccoon-on-a-desktop)
  - [The version in the menu](#the-version-in-the-menu)
- [Acceptance criteria](#acceptance-criteria)
- [Tests](#tests)
- [Documentation](#documentation)
- [Demo check](#demo-check)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

A guest deletes a list from its screen, or several at once from the lists page, after confirming it; an address that leads nowhere shows a page saying so; and the lists screens get their pending fixes ([PH-16c](../../roadmap.md#ph-16c-managing-lists)).

## Decisions

[ADR 0066](../../decisions/0066-managing-lists-phase-details.md#decisions).

## The design

The UI's words are English, as everywhere in Szop. Every new control has a 48 px tap target, a visible focus ring, and works with the keyboard alone, like the existing ones.

### The list name's characters

`listNameSchema` (`packages/shared/src/lists.ts`) refuses a name holding a character of Unicode's `Cc` or `Cf` category (control and format characters: NUL, tabs, line breaks, bidirectional controls, zero-width characters) with the message "Name can't contain control characters", after the trim and the NFC normalization it does today (decision 8). The API answers `400` with the usual error shape through the schema, so `POST /api/lists` and `PATCH /api/lists/:id` refuse it, and the SPA's forms show the same message. A NUL never reaches the database, so it no longer answers `500` ([#346](https://github.com/luiki-dev/szop/issues/346)).

Names already stored are not checked again.

### The delete API

Two routes in `apps/api/src/lists/routes.ts`, both behind the session hook and the access layer like the others (decision 5):

- **`DELETE /api/lists/:id`:** deletes the list and answers `204`. A missing or foreign list answers the same `404` as `GET` ([NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4).10); an `:id` that is not a UUID answers `404` too.
- **`POST /api/lists/delete`** with `{ ids: string[] }`: 1 to 100 UUIDs, no duplicates after parsing (a body outside that answers `400`). It deletes, in one transaction, the lists among `ids` that belong to the caller's workspace, and answers `204`. IDs of missing or foreign lists are skipped silently: the answer is the same whether they existed elsewhere or not. A failure rolls back every delete.

The body's schema goes into `@szop/shared` next to the other lists schemas. Neither route creates a workspace (deleting needs no copy of the default data). A request without a session answers `401`, as `POST /api/lists` does. A caller with a session but no workspace gets `404` from `DELETE /api/lists/:id`, as `requireListAccess` gives today, and `204` from `POST /api/lists/delete`, the same answer as for IDs that are all foreign _(Claude's call)_.

The SPA's API client learns `DELETE` and a `204` without a body; both new calls go through it. The limit of 100 is above any guest's lists for now; [PH-20](../../roadmap.md#ph-20-quotas-and-rate-limits)'s quotas will bound the lists themselves.

Rows are deleted from `lists`; no soft delete. Items, when [PH-17a](../../roadmap.md#ph-17a-list-items) adds them, reference their list with `ON DELETE CASCADE`.

### The confirmation dialog

shadcn/ui's `AlertDialog` (Radix), added with the shadcn CLI as `apps/web/src/components/ui/alert-dialog.tsx` (decision 4):

- **Title:** `Delete list "<name>"?` for one list, `Delete <N> lists?` for several. The body: "This can't be undone."
- **Buttons:** Cancel, which has the focus when the dialog opens, and Delete in the destructive style. Esc and a click outside cancel; the focus returns to what opened the dialog.
- **While deleting:** Delete shows it is busy and both buttons are disabled; Esc and a click outside do nothing until it ends.
- **On failure:** the dialog stays open and shows "Couldn't delete the list." or "Couldn't delete the lists." under the body, with the buttons enabled again. Delete then tries again.
- **On success:** the dialog closes. No toast ([APP-3](../../requirements/APP-app-wide-behavior.md#app-3).1 is PH-17a's).

The lists query is updated after a delete (invalidated or the deleted lists removed from its cache), so the lists page never shows a deleted list.

### Deleting from the list's screen

The list's ⋮ menu (`list-page.tsx`) gains Delete under Rename (decision 2). It opens the dialog for that list; on success the app navigates to `/` with `replace`, so Back does not lead to the deleted list.

### Selecting lists

On the lists page (`lists-page.tsx`), decision 3:

- **Starting:** a "Select" button in the page's header, on a phone and a desktop. On a phone (a coarse pointer), a long press on a list (about 500 ms, without moving) also starts selecting, with that list selected; it must not open the list or the browser's context menu, and a scroll does not start it.
- **While selecting:**
  - every list shows a checkbox, and a tap or click anywhere on the list's row toggles it instead of opening the list; with the keyboard, the rows are checkboxes (Space toggles);
  - the page's header is replaced by a selection bar: ✕ (labelled "Cancel selection"), "`N` selected" (announced to screen readers when it changes), "Select all" (or "Deselect all" when every list is selected) and Delete, disabled while nothing is selected;
  - on a phone, the pinned "New list" is hidden; on a desktop, the header's "New list" is replaced by the bar.
- **Stopping:** ✕, Esc and Back (the browser's or the phone's) stop selecting and clear the selection. Back stops selecting without leaving the page: starting the mode pushes a history entry, and stopping by another way removes it, so the history keeps no stray entries. Selecting started by a long press also stops when the last list is deselected; selecting started by "Select" stays at zero.
- **Deleting:** Delete opens the dialog for the selected lists, `Delete list "<name>"?` when only one is selected. On success, selecting stops and the page stays, without the deleted lists.

With no lists, "Select" is not shown (the empty page of [LST-2](../../requirements/LST-shopping-lists.md#lst-2).3 stays as it is).

### The not-found pages

Decision 6:

- **A path that is not a page:** a catch-all route (`*`) inside the app shell shows the not-found page: the trash can, "Nothing here" as its heading, "This page doesn't exist." and a "Back to lists" link to `/`. The route's title is "Not found", which the shell shows in the tab as it does for every page.
- **A list that cannot be opened:** `/lists/:id` shows the same layout with "This list doesn't exist or was deleted." when `:id` is not a UUID, without any request, and when the API answers `404`. It replaces today's "This list does not exist." and "Show my lists". Other errors keep today's "The list could not be loaded." with "Try again" ([APP-4](../../requirements/APP-app-wide-behavior.md#app-4).3).
- **The ID check** uses the UUID schema `@szop/shared` already has for list IDs. The API client also encodes the ID it puts into a path (`encodeURIComponent`), so no caller can send a request to another API path even if it skips the check ([#345](https://github.com/luiki-dev/szop/issues/345)).
- **The trash can:** a new `apps/web/src/brand/trash-can.svg`, made from the approved sketch [`not-found-trash-can.svg`](../../architecture/visual-design/not-found-trash-can.svg): a grey, old-style metal can lying on its side, its open end toward the viewer and a little to the right, its empty bottom showing inside, its lid with a handle leaning on the right. It uses only the raccoon's five colours (`#141c2b`, `#3a4654`, `#6c7882`, `#b4bcc5`, `#f9f7f2`) in flat shapes without outlines, as the raccoon does, and is decorative (`alt=""`). The builder may refine the shapes but keeps the pose, the palette and the style; it must read well on the light and the dark page.

### The new list's screen

`/lists/new` (`new-list-page.tsx`), decision 7 and [OP-115](https://github.com/luiki-dev/szop/issues/318):

- The name stays a bordered text field when the focus leaves it; it never turns into the plain title with the dotted underline before the list exists.
- **Create** creates the list, as Enter does. On a phone it is pinned at the bottom of the screen, where "New list" is on the lists page; on a desktop it stands right after the field, in the same row.
- Create is disabled while the name is empty or too long, and while the create is in flight; a too long name shows the field's error as today.
- ← and Esc leave without creating anything, as today ([LST-1](../../requirements/LST-shopping-lists.md#lst-1).5), and "New list" opens an empty field again.

What Esc or ← means while a create is in flight is [#320](https://github.com/luiki-dev/szop/issues/320)'s, in [PH-16d](../../roadmap.md#ph-16d-resilient-changes).

### The raccoon on a desktop

The empty list's raccoon (`EmptyList` in `list-screen.tsx`) peeks in from the window's right edge with no gap, while the page keeps `scrollbar-gutter: stable` (decision 10, [#323](https://github.com/luiki-dev/szop/issues/323)). The builder finds the cause first (the likely one: the `fixed` image placed from the gutter's edge) and checks the fix in Chromium and Firefox, in a window with and without a scrollbar.

### The version in the menu

`GET /api/health` gains `version`, the release version from the root `package.json` (`0.2.0` today, kept by release-please), in both its variants, like `commit` (decision 9). `healthSchema` gains it. In the image it is baked in the way `GIT_COMMIT` is; outside the image, the API reads it from the root `package.json`; it is never "unknown" in the image.

The menu's API status (`api-status.tsx`) shows a line `Version 0.2.0 · a1b2c3d` (the commit's first 7 characters) above "Schema version", in the same small muted style, when the API answers, whether the database is up or down; `Version 0.2.0` alone when the commit is "unknown" (local development).

## Acceptance criteria

The wording below is the reviewed one; the criteria are ✅ in this phase unless marked. [LST-1](../../requirements/LST-shopping-lists.md#lst-1) and [APP-5](../../requirements/APP-app-wide-behavior.md#app-5) are ✅ Criteria finalized.

- [LST-1](../../requirements/LST-shopping-lists.md#lst-1).3, whole: deleting from the list's screen.
- [LST-1](../../requirements/LST-shopping-lists.md#lst-1).6, whole: starting and stopping the selection.
- [LST-1](../../requirements/LST-shopping-lists.md#lst-1).7, whole: the selection bar.
- [LST-1](../../requirements/LST-shopping-lists.md#lst-1).8, whole: deleting several lists, all or none.
- [LST-1](../../requirements/LST-shopping-lists.md#lst-1).9, whole: Create on the new list's screen.
- [APP-3](../../requirements/APP-app-wide-behavior.md#app-3).3, in part: the confirmation of deleting lists. The account's deletion keeps it 🚧 until its phase; APP-3.1 and APP-3.2 are PH-17a's, so APP-3's list is not finalized here.
- [APP-5](../../requirements/APP-app-wide-behavior.md#app-5).1 and APP-5.2, whole.

## Tests

Each criterion's test name starts with its ID.

- **Shared (Vitest):** `listNameSchema` refuses NUL, a tab, a line break, U+202E and U+200B, and still accepts letters with diacritics, emoji and inner spaces.
- **API (Vitest, PostgreSQL):**
  - a name with a NUL or U+202E answers `400` on create and on rename;
  - LST-1.3: `DELETE /api/lists/:id` answers `204` and the list is gone; a foreign, a missing and a non-UUID ID answer the same `404`, and the foreign list is still there (the two-workspace helper);
  - both routes answer `401` without a session; with a session but no workspace, `DELETE` answers `404` and `POST /api/lists/delete` `204`, and neither creates a workspace;
  - LST-1.8: `POST /api/lists/delete` deletes the caller's lists among `ids` and leaves the rest; a foreign ID among them is skipped and its list is still there; an empty, a too long or a duplicated `ids`, and a non-UUID, answer `400`; a failure in the middle (a forced error) leaves every list;
  - `GET /api/health` has `version` in both variants.
- **Web (Vitest, Testing Library, MSW):**
  - APP-3.3: the dialog opens with Cancel focused; Esc, a click outside and Cancel close it without a request; a failed delete keeps it open with the message; the title names the list, or the count;
  - LST-1.3: Delete in the list's menu, confirmed, sends the request and lands on `/`;
  - LST-1.6 and LST-1.7: "Select" starts the mode with nothing selected and it stays at zero; a tap toggles instead of navigating; ✕ and Esc stop it; the count, "Select all" and "Deselect all", and Delete disabled at zero; a long press (fake timers) starts it with the list selected, and deselecting it stops it; a press shorter than the threshold opens the list;
  - LST-1.8: Delete with three selected sends one request with the three IDs, and the page shows the remaining lists, not selecting;
  - LST-1.9: the field stays a field after blur; Create is disabled when empty and too long; Create creates the list as Enter does;
  - APP-5.1: an unknown path renders the not-found page in the shell with a link to `/`;
  - APP-5.2: `/lists/not-a-uuid` shows the list message with no request sent (MSW fails on any unhandled request); a `404` shows it too; a `500` keeps "Try again";
  - the menu shows `Version 0.2.0 · a1b2c3d`, and without the commit when it is "unknown", with the database up and down.
- **E2E (Playwright):**
  - the existing journeys in `lists.spec.ts` still pass, adapted to Create;
  - a journey: create two lists, delete one from its screen, then select the other on the lists page and delete it; the lists page is empty;
  - a phone-sized journey: a long press starts selecting, Back stops it and stays on the page;
  - `frame.spec.ts`: the raccoon's right edge is at the window's right edge on a desktop-sized window.
- **Mutation testing:** the run over the changed logic (the name schema, the delete routes, the selection state, the ID check), each survivor killed or accepted with a reason ([definition of done](../../development/definition-of-done.md), item 2).

## Documentation

- `docs/architecture/architecture.md`: the delete routes; the not-found route; the selection mode's state in the frontend section; `version` in the health answer.
- `docs/architecture/threat-model.md`: the two delete routes as entry points, with their guards; the SPA's ID check and the encoded path.
- `docs/architecture/visual-design.md`: the confirmation dialog, the selection bar, the not-found pages with the trash can, Create on the new list's screen; the sketch `docs/architecture/visual-design/not-found-trash-can.svg` (added with this spec).
- `docs/architecture/stack-overview.md`: Radix's `AlertDialog` and what a modal must do (focus trap, return of focus).
- `docs/requirements/`: LST-1 and APP-5 finalized, the new criteria, the statuses; [ACC-1](../../requirements/ACC-accounts-and-guest-mode.md#acc-1).6 pointing at PH-16d. Done in the spec's commit, except the ✅s.
- `docs/roadmap.md`: PH-16c's **Goal** and **Delivers**, and PH-16d's entry and row ([ADR 0066](../../decisions/0066-managing-lists-phase-details.md#changes-to-the-roadmap)). Done in the spec's commit.

## Demo check

All local, in the production-like environment; nothing needs AWS.

- Delete a list from its screen, then several from the lists page; Cancel and Esc leave them; the dialog's focus and the keyboard alone.
- On a phone-sized window with touch emulation: the long press, a scroll that does not start selecting, Back stopping the mode.
- An unknown path, `/lists/not-a-uuid`, `/lists/..%2F..%2Fauth%2Fsign-out` (no request in the network tools) and a deleted list's address.
- The trash can on the light and the dark page.
- The new list's screen: the field after blur, Create on a phone and a desktop.
- The raccoon's right edge in Firefox and Chromium on a desktop-sized window.
- The version line in the menu.

Checked by hand: [LST-1](../../requirements/LST-shopping-lists.md#lst-1).6, [APP-3](../../requirements/APP-app-wide-behavior.md#app-3).3, [APP-5](../../requirements/APP-app-wide-behavior.md#app-5).2.

## Risks

- **The long press fights the browser:** a touch-and-hold opens a context menu or selects text on some phones, and a press must not fire after a scroll. The builder suppresses both on the list rows only and checks it with touch emulation; if a phone's behavior cannot be tested in E2E, it is checked by hand.
- **Back in the selection mode:** the pushed history entry must be removed when the mode stops by ✕, Esc, a delete or the last deselect, or Back would step through stray entries. A test covers each way out.
- **The trash can's look** is judged by eye; the sketch fixes the pose and the palette, and the demo check looks at it in both themes.

## Out of scope

- Archiving lists ([LST-2](../../requirements/LST-shopping-lists.md#lst-2).2); the bar leaves room for it.
- A toast after deleting, and undo ([APP-3](../../requirements/APP-app-wide-behavior.md#app-3).1 and 3.2, PH-17a).
- Timeouts, the "not saved" state, a change sent twice, the session check and one session across tabs ([PH-16d](../../roadmap.md#ph-16d-resilient-changes)).
- Checking names already stored for control characters.

## Left to the builder

- How the selection state is held (component state or a small hook), and the exact long-press threshold within 400 to 600 ms.
- Whether the delete invalidates the lists query or edits its cache.
- How `version` reaches the API in the image, following `GIT_COMMIT`.
- The trash can's final shapes within the sketch's pose, palette and style.
- The cause and fix of the raccoon's gap.
