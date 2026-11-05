# PH-16d Resilient changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementers:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md) before your task.

**Goal:** A change sent on a weak connection fails visibly after about 10 s instead of hanging, keeps what was typed and is sent again only on a retry, shows as saved when the server did apply it, cannot be left while in flight; a guest's writes need no session check first, two fresh tabs share one session; and the lists page and the empty list get their fixes (OP-131, OP-132).

**Architecture:** All of it is in the SPA; the API does not change. `apps/web/src/api/client.ts` gives every request a 10 s deadline (one deadline shared by every request of a change), sends a write first and signs in as a guest only on a `401`, under a Web Lock. The shell holds one React Router blocker while any mutation is pending. The list's screen, the new list's screen and the delete dialog show the in-flight and "not saved" states and check after a failure whether the change was applied.

**Tech Stack:** React 19, React Router 8 (`useBlocker` on the data router), TanStack Query, Web Locks API, Vitest, Testing Library, MSW, Playwright, Stryker.

**Spec:** [`docs/superpowers/specs/2026-11-05-PH-16d-resilient-changes-design.md`](../specs/2026-11-05-PH-16d-resilient-changes-design.md), with the mockups in [`2026-11-05-PH-16d-resilient-changes/`](../specs/2026-11-05-PH-16d-resilient-changes/); decisions in [ADR 0070](../../decisions/0070-resilient-changes-phase-details.md). The criteria are in the spec's [Acceptance criteria](../specs/2026-11-05-PH-16d-resilient-changes-design.md#acceptance-criteria), the tests in its [Tests](../specs/2026-11-05-PH-16d-resilient-changes-design.md#tests), the docs to update in its [Documentation](../specs/2026-11-05-PH-16d-resilient-changes-design.md#documentation); each task below names the docs it updates.

## Order of work

1. [Task 1: The time limit and the session](#task-1-the-time-limit-and-the-session)
2. [Task 2: Saving a rename](#task-2-saving-a-rename)
3. [Task 3: Saving a create and a delete](#task-3-saving-a-create-and-a-delete)
4. [Task 4: Selecting lists without moving them](#task-4-selecting-lists-without-moving-them)
5. [Task 5: The raccoon under the sidebar](#task-5-the-raccoon-under-the-sidebar)
6. [Task 6: The mutation run](#task-6-the-mutation-run)

## Global Constraints

- The branch is `feat/ph-16d-resilient-changes`. Scopes: `connectivity` (NET-1), `accounts`, `lists`, `web`, `e2e`.
- The UI's words are exactly the spec's: "Saving…", "Creating…", "Deleting…", "Not saved.", "Try again", "Not saved. Check your connection and create again.", "Couldn't delete the list. Check your connection and try again.", "Couldn't delete the lists. Check your connection and try again.". The text a timeout becomes, shown in a read's error card, is "The server didn't answer in time." (a builder's call, recorded in Task 1).
- The limit is one constant, `timeLimit = 10_000` ms, in `client.ts`.
- No queue and no retry on its own: a change is sent only when the person acts, and a failed one is sent again only by "Try again", Enter, Create or Delete.
- The API does not change: a write without a session keeps answering `401`.
- Every new control has a 48 px tap target, a visible focus ring, and works with the keyboard alone.
- A test covering a criterion starts with its ID: `it("NET-1.7: …")`; an open point's test starts with its ID too (`OP-116: …`).
- `pnpm check` passes after every task; `pnpm test:e2e` after Tasks 1 to 5.

## Review Focus

1. **A delete checked against a stale list of lists.** A list created in this session is not in the cached `["lists"]` data until it is refetched, so "the deleted list is not among the lists" can be true of old data. Expected: only lists fetched after the delete was sent count; a failed delete never closes the dialog on old data. Task 3 tests it.
2. **The SPA's own navigation right after a change.** A new list opening, the list's screen going to `/` after a delete, the selection's exit after a delete. Expected: none of them is blocked by the blocker of the change that just ended. Task 3 tests all three.
3. **A server refusal with its own message** (a `400` for a name the server refuses, a `404` on a rename of a list deleted elsewhere). Expected: today's text in today's place, no "Not saved." and no "Try again". Task 2 tests it.
4. **A second Enter or "Try again" while a change is in flight.** Expected: one request, not two. Task 2 tests it.
5. **A sign-in that fails or hangs.** Expected: the change ends as "not saved" within the 10 s, the lock is released, and the next change can sign in. Task 1 tests it.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/api/client.ts` | The deadline on every request, the write-first session, the lock, `notSaved` |
| `apps/web/src/shell/app-shell.tsx` | The one blocker while a mutation is pending; OP-131's header |
| `apps/web/src/lists/list-screen.tsx` | ← greyed out while saving; `TitleField`'s "Saving…" and "Not saved." states; the raccoon |
| `apps/web/src/lists/use-lists.ts` | The refetch after a failed rename; `useLists(enabled)` |
| `apps/web/src/lists/list-page.tsx` | The rename's states and its "applied" check |
| `apps/web/src/lists/new-list-page.tsx` | "Creating…", its "not saved" text and "applied" check |
| `apps/web/src/lists/delete-lists-dialog.tsx` | "Deleting…", its texts and "applied" check |
| `apps/web/src/lists/lists-page.tsx` | The selection controls in Select's row |
| `e2e/tests/lists.spec.ts`, `e2e/tests/frame.spec.ts` | The E2E checks of the spec's Tests |

### Task 1: The time limit and the session

**Files:**
- Modify: `apps/web/src/api/client.ts`, `apps/web/src/api/client.test.ts`, `e2e/tests/lists.spec.ts`
- Docs: `docs/architecture/architecture.md` (§3 Frontend: the session handling, write first, the lock; the time limit in "Offline (NET-1)"), `docs/architecture/stack-overview.md` (§17: a deadline built from `AbortController` and a timer and why a weak connection needs one; the Web Locks API), `docs/glossary.md` (Web Locks API); ADR 0070's "Settled while building" (the deadline built with a timer, see Step 3; the timeout's text)

**Interfaces:**
- Produces: `export const timeLimit = 10_000`. `export const timeoutMessage = "The server didn't answer in time."`. Every exported function keeps its signature (`getHealth`, `getCatalog`, `getLists`, `getList`, `createList`, `renameList`, `deleteList`, `deleteLists`); each now rejects with `new Error(timeoutMessage)` when no answer comes within `timeLimit`, and a write's whole run (the write, the lock, the session check, the sign-in, the retried write) shares one deadline.

- [x] **Step 1: Write the failing tests** in `client.test.ts`, with `vi.useFakeTimers({ shouldAdvanceTime: true })` where a test waits for the limit and MSW's `delay("infinite")` for a request with no answer. Rewrite the `lists` block's session tests for the new order (`stubApi` stays; `get-session` is now asked only inside the sign-in):
  - `"NET-1.4: a read with no answer fails after the limit"`: `GET /api/lists` never answers; after `advanceTimersByTimeAsync(9_999)` `getLists()` is still pending; after 1 ms more it rejects with `timeoutMessage`.
  - `"NET-1.4: the limit covers the whole change"`: `POST /api/lists` answers `401` after `delay(6_000)`, `get-session` answers `null`, the sign-in never answers; `createList` rejects with `timeoutMessage` at 10 000 ms, not at 16 000 (it has rejected after advancing 10 000 ms in total).
  - `"OP-116: a write with a session sends one request"`: `calls` is `["POST /api/lists"]`.
  - `"OP-116: a 401 signs in once and sends the write once more"`: with `postStatuses` `[401, 201]` and `get-session` answering `null`, `calls` is `["POST /api/lists", "GET /api/auth/get-session", "POST /api/auth/sign-in/anonymous", "POST /api/lists"]`.
  - `"OP-116: a second 401 is an error with no third try"`: `postStatuses` `[401]`; rejects with `{ status: 401, message: "Sign in" }`; two `POST /api/lists` in `calls`.
  - Keep, in the new order: the sign-in when `get-session` answers non-JSON or a `429` JSON body (both count as no session), and "fails when the anonymous sign-in is refused".
  - `"ACC-1.6: two sign-ins that meet make one sign-in request"`: install a fake `navigator.locks` with `Object.defineProperty` (`request(name, options, callback)` runs callbacks one after another on a promise chain and returns the callback's promise; remove it after the test). The handlers keep a `signedIn` flag: `POST /api/lists` answers `401` until it is set, `get-session` answers `null` or a session by it, the sign-in sets it. Two `createList` calls with different IDs started together both resolve, and `calls` holds one `POST /api/auth/sign-in/anonymous`.
  - `"a failed sign-in releases the lock for the next change"` (Review Focus 5): with the fake locks, the first sign-in answers `500`, so the first `createList` rejects; the second `createList` signs in and resolves.
- [x] **Step 2: Run** `pnpm --filter @szop/web test -- client`. Expected: FAIL.
- [x] **Step 3: Implement** in `client.ts`:
  - `function deadline(): AbortSignal`: an `AbortController` aborted with `new Error(timeoutMessage)` by `setTimeout(…, timeLimit)`. Not `AbortSignal.timeout`: Vitest's fake timers do not drive it (checked while planning), and aborting with our own error makes `fetch` reject with that error, so no conversion is needed. Record this in ADR 0070's "Settled while building".
  - Every `fetch` gets a `signal`: a read and the health check `deadline()`; `send(method, path, body, signal)` takes it.
  - `withSession(write: (signal: AbortSignal) => Promise<Response>)`: one `deadline()`; the write goes first; on a `401`, `guestSignIn(signal)`, then the write once more and its answer returned whatever it is.
  - `guestSignIn(signal)`: under `navigator.locks.request("szop-guest-sign-in", { signal }, callback)`, or the callback alone when `navigator.locks` is missing (jsdom). The callback asks `GET /api/auth/get-session` (same reading as today: not ok, not JSON or `null` mean no session) and calls `signIn(signal)` only when there is none.
  - Update the comments on `withSession` and the file's top: get-session is no longer asked before each write.
- [x] **Step 4: Run** the tests again. Expected: PASS.
- [x] **Step 5: Write the E2E test** in `e2e/tests/lists.spec.ts`: `"ACC-1.6: two fresh tabs that create a list at the same moment share one workspace"`. Two pages in the test's fresh context, each on `/lists/new` with a name typed; both Enters pressed in one `Promise.all`; both reach `/lists/<id>`; after `reload` of `/` on each page, both names are on both pages.
- [x] **Step 6: Run** `pnpm test:e2e -- lists`. Expected: PASS. Then `pnpm check`. Expected: PASS.
- [x] **Step 7: Update the docs** listed above and commit: `feat(connectivity): give every request a time limit and sign in only on a 401`.

### Task 2: Saving a rename

**Files:**
- Modify: `apps/web/src/api/client.ts`, `apps/web/src/shell/app-shell.tsx`, `apps/web/src/lists/list-screen.tsx`, `apps/web/src/lists/use-lists.ts`, `apps/web/src/lists/list-page.tsx`, and their tests (`client.test.ts`, `list-page.test.tsx`, `use-lists.test.tsx`, `app-shell.test.tsx` if the blocker test fits better there), `e2e/tests/lists.spec.ts`
- Docs: `docs/architecture/architecture.md` ("Offline (NET-1)": the "not saved" state, the refetch, the retry, the blocked leaving; replace the paragraph's banner-only text with what is built and what PH-22 adds), `docs/architecture/visual-design.md` ("Saving…" and "Not saved." under the name; ← greyed out while saving), `docs/architecture/stack-overview.md` (§17: `useBlocker`); ADR 0070's "Settled while building" (the blocker in the shell, `notSaved`'s rule)

**Interfaces:**
- Consumes: Task 1's `timeLimit`, `timeoutMessage`.
- Produces:
  - `export function notSaved(error: Error): boolean` in `client.ts`: `false` only for an `ApiRequestError` with a `4xx` status other than `401` (a refusal with its own message); `true` for everything else (a timeout, no network, a `5xx`, a second `401`, an unreadable answer).
  - In `AppShell`, `useBlocker(() => queryClient.isMutating() > 0)`, and a blocked navigation is `reset()` at once, so Back and every in-app link do nothing while a change is in flight. A function, not a value: it is read at the moment of the navigation, when a change that just ended is no longer counted, so the SPA's own navigation from a mutation's `onSuccess` is never blocked.
  - `ListHeader`'s ← reads `useIsMutating() > 0`: while true it has `aria-disabled="true"`, the muted look of a disabled button, and its click is prevented.
  - `TitleField` gains `failed?: boolean`. Without `create`: while `pending`, "Saving…" in the muted text colour under the field; with `failed`, "Not saved." in the destructive colour followed by a link-style "Try again" button that does what Enter does, both in the `role="alert"` paragraph. With `failed`, leaving the field sends nothing. While `pending`, Esc does nothing.
  - `useRenameList(id)`'s `onError` invalidates `["lists", id]` and `["lists"]` (exact).

- [ ] **Step 1: Write the failing tests** (the spec's Tests, rename part), in `list-page.test.tsx` unless named otherwise:
  - `"NET-1.3: a rename started offline is sent at once and nothing is sent later"`: `navigator.onLine` stubbed `false`; the PATCH handler counts requests and answers with `HttpResponse.error()`; after Enter one request and "Not saved."; after `window.dispatchEvent(new Event("online"))` and waiting, still one.
  - `"NET-1.4: a rename with no answer shows Not saved. after the limit"` (fake timers, `delay("infinite")`), and `"NET-1.4: a list read with no answer shows its error card"`: "The list could not be loaded." with `timeoutMessage`.
  - `"NET-1.5: a rename whose answer was lost shows the saved name"`: PATCH answers `HttpResponse.error()`, and `GET /api/lists/:id` answers the new name from then on; the alert goes, the field shows the new name.
  - `"NET-1.7: after a failed rename the typed name stays and only a retry sends it"`: after the failure the field holds the typed name; blur sends no request; "Try again" sends one; after a second failure Enter sends one; Esc puts the saved name back and the alert goes.
  - `"NET-1.8: while a rename is saved, the screen cannot be left"`: PATCH held on a promise the test resolves; "Saving…" shows; ← has `aria-disabled="true"` and clicking it stays on the list; Esc keeps the typed name and "Saving…"; `router.navigate(-1)` (the memory router started with `/` before the list) stays on the list; after the answer, ← leads to `/`.
  - Review Focus 3: a PATCH answering `400` with an API error body shows that message, no "Try again"; a PATCH answering `404` shows its message as today.
  - Review Focus 4: two Enters, and Enter then "Try again", while the PATCH is held send one request.
  - In `client.test.ts`: `notSaved` is `false` for `ApiRequestError` `400`, `404`, `429`, and `true` for `401`, `500`, `new Error(timeoutMessage)` and a `TypeError`.
- [ ] **Step 2: Run** `pnpm --filter @szop/web test -- list-page client`. Expected: FAIL.
- [ ] **Step 3: Implement** the Interfaces above. In `ListPage`: `failed` is `rename.isError && notSaved(rename.error) && rename.variables !== name`; `error` is passed only for a refusal with its own message (`rename.isError && !notSaved(rename.error)`); keep `saveOnBlur`: a rename that never failed still saves on blur, and `TitleField` skips it while `failed`.
- [ ] **Step 4: Run** the tests again, then the whole web suite. Expected: PASS.
- [ ] **Step 5: Write the E2E test** in `e2e/tests/lists.spec.ts`: `"NET-1.7, NET-1.8: a rename on a held connection shows Saving…, cannot be left, then Not saved."`. Create a list, then `page.route` on `PATCH /api/lists/*` that never answers; rename; "Saving…" shows; `page.goBack()` keeps the list's URL; after the limit "Not saved." with the typed name in the field; `page.unroute`, "Try again"; the heading shows the new name.
- [ ] **Step 6: Run** `pnpm test:e2e -- lists`, then `pnpm check`. Expected: PASS.
- [ ] **Step 7: Update the docs** listed above and commit: `feat(lists): show a rename as saving or not saved and hold the screen while it runs`.

### Task 3: Saving a create and a delete

**Files:**
- Modify: `apps/web/src/lists/use-lists.ts`, `apps/web/src/lists/list-screen.tsx` (the Create button's label), `apps/web/src/lists/new-list-page.tsx`, `apps/web/src/lists/delete-lists-dialog.tsx`, and their tests (`new-list-page.test.tsx`, `delete-lists-dialog.test.tsx`, `lists-page.test.tsx`, `list-page.test.tsx`)
- Docs: `docs/architecture/visual-design.md` ("Creating…", "Deleting…" and the two failure texts); ADR 0070's "Settled while building" (the "applied" check through `useLists(enabled)` and `dataUpdatedAt`)

**Interfaces:**
- Consumes: Task 2's `notSaved`, the shell's blocker, `TitleField`'s states.
- Produces: `useLists(enabled = true)`. The "applied" check of a create and a delete observes `["lists"]` with `useLists(<mutation>.isError)`: a failure turns the observer on, which refetches the stale lists; a later failure turns it on again. Only lists fetched after the change was sent count: `lists.dataUpdatedAt > <mutation>.submittedAt` (Review Focus 1).

- [ ] **Step 1: Write the failing tests:**
  - New list's screen: `"NET-1.8: while a list is created, Create reads Creating… and the screen cannot be left"` (← disabled, Esc stays, navigation held, then the list opens: Review Focus 2); `"NET-1.6: Create after a failed Create sends the same ID"` (the two POST bodies have one `id`); `"NET-1.7: after a failed create the name stays and Create sends it again"` with "Not saved. Check your connection and create again."; a `400` with an API body shows its message, as today; `"NET-1.5: a create whose answer was lost opens the new list"` (POST answers `HttpResponse.error()`, `GET /api/lists` then holds the list; the URL becomes `/lists/<id>`).
  - Dialog: `"NET-1.8: while lists are deleted, Delete reads Deleting…"` (Cancel disabled, Esc keeps it open); `"NET-1.7: a failed delete keeps the dialog and its message, and Delete sends again"`, for one list ("Couldn't delete the list. Check your connection and try again.") and for several ("…the lists…"); `"NET-1.5: a delete whose answer was lost closes the dialog"` (`GET /api/lists` then lacks the IDs; `onDeleted` is called once); Review Focus 1: a failed delete whose cached lists already lack the ID, while the refetch is held, keeps the dialog open.
  - List's screen: a delete that succeeds goes to `/` (not blocked).
  - Lists page: during a delete from the selection, `router.navigate(-1)` keeps the selection; after the delete the selection ends and the focus goes to the page title, as in PH-16c (Review Focus 2).
- [ ] **Step 2: Run** `pnpm --filter @szop/web test -- new-list-page delete-lists-dialog lists-page list-page`. Expected: FAIL.
- [ ] **Step 3: Implement:** `TitleField`'s Create button reads "Creating…" while `pending`; `NewListPage` passes `error` only for a refusal with its own message and otherwise shows the spec's text; when the check finds `id.current` among fresh lists, it navigates as `onSuccess` does. In the dialog, Delete reads "Deleting…" while pending; the failure text follows `notSaved`; when the check finds none of the IDs among fresh lists, an effect runs the same steps as `onSuccess` (`reset`, `onOpenChange(false)`, `onDeleted()`).
- [ ] **Step 4: Run** the tests again, then the whole web suite. Expected: PASS.
- [ ] **Step 5: Run** `pnpm test:e2e`, then `pnpm check`. Expected: PASS.
- [ ] **Step 6: Update the docs** listed above and commit: `feat(lists): show a create and a delete as saving or not saved, and see a lost answer`.

### Task 4: Selecting lists without moving them

**Files:**
- Modify: `apps/web/src/shell/app-shell.tsx`, `apps/web/src/lists/lists-page.tsx`, `apps/web/src/lists/lists-page.test.tsx`, `e2e/tests/lists.spec.ts`
- Docs: `docs/architecture/visual-design.md` (the selection bar in Select's row; the title stays)

**Interfaces:**
- Produces: `AppShell` no longer reads the selection: the phone header and the desktop title row show while selecting, and the screen-reader-only `h1` for the selection goes. `ListsPage` renders the selection controls (✕, the count, Select all or Deselect all, Delete) in the same `mt-4` row where Select stands; the row keeps Select's height (48 px), so the cards do not move.

- [ ] **Step 1: Write the failing test** in `lists-page.test.tsx`: `"OP-131: selecting keeps the page's heading and puts the controls where Select was"`: while selecting, the heading "Lists" (level 1) is visible (not `sr-only`), on a phone (☰ present) and on a desktop ("New list" link beside it); the controls are in the element that held Select. The focus moves to that `h1` after a delete from the selection, as before.
- [ ] **Step 2: Run** `pnpm --filter @szop/web test -- lists-page app-shell`. Expected: FAIL.
- [ ] **Step 3: Implement** the Interfaces above, removing the `isSelecting` import from the shell if nothing else uses it.
- [ ] **Step 4: Run** the tests again. Expected: PASS.
- [ ] **Step 5: Write the E2E test** `"OP-131: selecting lists does not move them"`: with two lists, the first card's `boundingBox().y` is the same before and after Select, on the phone and the desktop projects.
- [ ] **Step 6: Run** `pnpm test:e2e -- lists`, then `pnpm check`. Expected: PASS.
- [ ] **Step 7: Update the docs** and commit: `fix(lists): keep the page's header and the lists in place while selecting`.

### Task 5: The raccoon under the sidebar

**Files:**
- Modify: `apps/web/src/lists/list-screen.tsx`, `e2e/tests/frame.spec.ts`
- Docs: `docs/architecture/visual-design.md` (the raccoon under the sidebar on a desktop)

**Interfaces:**
- Produces: `EmptyList`'s raccoon from `lg` keeps the phone's rotation (`rotate-90`), offset (`-left-[65px]`), opacity and grey, positioned from the sidebar's right edge (the sidebar is `w-64`, so `lg:left-[calc(16rem-65px)]`), behind the sidebar (the sidebar paints over it). The `lg:right-[…]`, `lg:left-auto` and `lg:-rotate-90` classes go; the comment above `EmptyList` says where it peeks in from.

- [ ] **Step 1: Rewrite the E2E check** in `frame.spec.ts` as `"LST-1.9, OP-132: on a desktop the empty list's raccoon peeks in from under the sidebar"`: on a desktop project, the raccoon's `left` is less than the `aside`'s `right`, its `right` is greater than it, and `right - asideRight` is `200 - 65`; the `aside` is on top at a point inside both (`document.elementFromPoint` returns the aside or its child). The phone check stays.
- [ ] **Step 2: Run** `pnpm test:e2e -- frame`. Expected: FAIL.
- [ ] **Step 3: Implement** the Interfaces above. If the sidebar does not paint over the raccoon (it is `sticky` with no stacking context of its own above `-z-10`), give the `aside` `relative z-10`, not the raccoon a new z-index.
- [ ] **Step 4: Run** the test again, then `pnpm check`. Expected: PASS. Look at it in light and dark on a desktop width (Playwright screenshot or the dev server) against `op132-desktop-2-proposed.png`.
- [ ] **Step 5: Update the docs** and commit: `fix(lists): let the empty list's raccoon peek in from under the sidebar`.

### Task 6: The mutation run

**Files:**
- Modify: whatever the owner's decisions touch (tests, `// Stryker disable next-line <Mutator>: <reason>` comments)

- [ ] **Step 1: Run** `pnpm test:mutation --mutate` over `apps/web/src/api/client.ts`, `apps/web/src/shell/app-shell.tsx`, `apps/web/src/lists/{list-screen,use-lists,list-page,new-list-page,delete-lists-dialog,lists-page}.tsx`/`.ts`.
- [ ] **Step 2: List the survivors** for the owner, each with a proposal: a test that kills it, or a disable comment with the reason. Stop until the owner decides.
- [ ] **Step 3: Apply** the decisions; run `pnpm check`. Expected: PASS.
- [ ] **Step 4: Commit**: `test(web): kill or accept the PH-16d mutants`.
