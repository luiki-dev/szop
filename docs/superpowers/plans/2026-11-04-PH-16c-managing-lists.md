# PH-16c Managing lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementers:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md) before your task.

**Goal:** A guest deletes a list from its screen, or several at once from the lists page after selecting them, always after a confirmation; an address that leads nowhere shows a not-found page; and the lists screens get their pending fixes.

**Architecture:** `@szop/shared` gains the name's character check and the delete body's schema. The API gains `DELETE /api/lists/:id` and `POST /api/lists/delete`, both behind the session hook and the access layer, and `version` in `/api/health`. The SPA gains one dialog component that deletes one or several lists, a selection mode on the lists page held in the history entry's state (so Back stops it), a catch-all not-found route, an ID check before `/lists/:id` sends anything, and a Create button on the new list's screen.

**Tech Stack:** Fastify 5 with `fastify-type-provider-zod`, Drizzle ORM, Zod, React 19, React Router, TanStack Query, shadcn/ui on Base UI, Vitest, Testing Library, MSW, Playwright, Stryker.

**Spec:** [`docs/superpowers/specs/2026-11-04-PH-16c-managing-lists-design.md`](../specs/2026-11-04-PH-16c-managing-lists-design.md); decisions in [ADR 0066](../../decisions/0066-managing-lists-phase-details.md). The criteria are in the spec's [Acceptance criteria](../specs/2026-11-04-PH-16c-managing-lists-design.md#acceptance-criteria), the docs to update in its [Documentation](../specs/2026-11-04-PH-16c-managing-lists-design.md#documentation); each task below names the docs it updates.

## Order of work

1. [Task 1: The name's characters and the delete API](#task-1-the-names-characters-and-the-delete-api)
2. [Task 2: The version in the menu](#task-2-the-version-in-the-menu)
3. [Task 3: The confirmation dialog and deleting from the list's screen](#task-3-the-confirmation-dialog-and-deleting-from-the-lists-screen)
4. [Task 4: Selecting lists](#task-4-selecting-lists)
5. [Task 5: The not-found pages](#task-5-the-not-found-pages)
6. [Task 6: The new list's screen and the raccoon](#task-6-the-new-lists-screen-and-the-raccoon)
7. [Task 7: The mutation run](#task-7-the-mutation-run)

## Global Constraints

- The branch is `feat/ph-16c-managing-lists`. Scopes: `lists`, `shared`, `api`, `web`, `e2e`, `docs`.
- The UI's words are exactly the spec's: `Delete list "<name>"?`, `Delete <N> lists?`, "This can't be undone.", Cancel, Delete, "Couldn't delete the list.", "Couldn't delete the lists.", Select, "Cancel selection", "`N` selected", "Select all", "Deselect all", "Nothing here", "This page doesn't exist.", "This list doesn't exist or was deleted.", "Back to lists", Create, "Name can't contain control characters", `Version 0.2.0 · a1b2c3d`.
- Every new control has a 48 px tap target, a visible focus ring, and works with the keyboard alone.
- A missing, a foreign and a non-UUID list answer the same `404` body, byte for byte, on every route ([NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4).10). Neither delete route creates a workspace.
- A test covering a criterion starts with its ID: `it("LST-1.3: …")`.
- `pnpm check` passes after every task; `pnpm test:e2e` after Tasks 3 to 6.

## Review Focus

1. **A name holding an emoji sequence** such as 👨‍👩‍👧 (joined by U+200D) or 🏴󠁧󠁢󠁳󠁣󠁴󠁿 (tag characters U+E0020 to U+E007F). Both are `Cf`, so a plain `Cf` check would refuse them. Expected: the name is accepted. Task 1 tests it and records the exception in ADR 0066's "Settled while building".
2. **Deleting a list that another tab has already deleted.** `DELETE` answers `404`. Expected: the list is gone either way, so the app treats it as deleted: the dialog closes and the list's screen goes to `/`. Task 3 tests it.
3. **The click that follows a long press.** Expected: it does not toggle the just-selected list off again, and it does not open the list. Task 4 tests it.
4. **A selected list that disappears from the lists query** (deleted in another tab, then refetched). Expected: the count, "Select all" and the delete count only the lists still shown. Task 4 tests it.
5. **A finger that moves during the press (a scroll).** Expected: no selection starts. Task 4 tests it with a pointer move beyond the threshold.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/lists.ts` | Character check in `listNameSchema`; `deleteListsSchema` |
| `packages/shared/src/health.ts` | `version` in both variants |
| `apps/api/src/lists/{repository,routes}.ts` | `deleteList`, `deleteLists`; the two routes |
| `apps/api/src/version.ts` (new) | `readVersion()` from the root `package.json` |
| `apps/api/src/health/routes.ts`, `apps/api/src/app.ts`, `Dockerfile` | `version` in the health answer |
| `apps/web/src/api/client.ts` | `DELETE`, a `204` without a body, `deleteList`, `deleteLists`, encoded IDs |
| `apps/web/src/components/ui/alert-dialog.tsx` (new, shadcn CLI) | The dialog primitive |
| `apps/web/src/lists/delete-lists-dialog.tsx` (new) | The confirmation that deletes one or several lists |
| `apps/web/src/lists/use-lists.ts` | `useDeleteLists` |
| `apps/web/src/lists/use-long-press.ts` (new) | The long press on a coarse pointer |
| `apps/web/src/lists/lists-page.tsx`, `apps/web/src/shell/app-shell.tsx` | The selection mode and its bar |
| `apps/web/src/not-found/not-found.tsx` (new), `apps/web/src/brand/trash-can.svg` (new), `apps/web/src/routes.tsx` | The not-found pages |
| `apps/web/src/lists/{list-page,list-screen,new-list-page}.tsx` | Delete in the menu, the ID check, Create, the raccoon |
| `apps/web/src/shell/api-status.tsx` | The version line |

### Task 1: The name's characters and the delete API

**Files:**
- Modify: `packages/shared/src/lists.ts`, `lists.test.ts`, `index.ts` (if it lists exports); `apps/api/src/lists/repository.ts`, `routes.ts`, `routes.test.ts`, `repository.test.ts`
- Docs: `docs/architecture/architecture.md` (the delete routes), `docs/architecture/threat-model.md` (the two delete routes and their guards); ADR 0066's "Settled while building" (the emoji exception)

**Interfaces:**
- Produces: `deleteListsSchema = z.object({ ids })`, where `ids` is an array of 1 to 100 UUIDs without duplicates, and `type DeleteLists`. `deleteList(db: Executor, context: WorkspaceContext, id: string): Promise<boolean>` returns whether a row was deleted. `deleteLists(db: Executor, context: WorkspaceContext, ids: string[]): Promise<void>`.

- [x] **Step 1: Write the failing shared tests** in `lists.test.ts`. `listNameSchema` refuses `"a\u0000b"`, `"a\tb"`, `"a\nb"`, `"a‮b"` and `"a​b"`, each with the message `"Name can't contain control characters"`. It accepts `"Żółw"`, `"🛒 Weekly"`, `"Big shop"`, `"👨‍👩‍👧"` and `"🏴󠁧󠁢󠁳󠁣󠁴󠁿"` (Review Focus 1). `deleteListsSchema` refuses `[]`, 101 IDs, a duplicated ID and `"x"`, and accepts 1 and 100 distinct UUIDs.
- [x] **Step 2: Run** `pnpm --filter @szop/shared test`. Expected: FAIL.
- [x] **Step 3: Implement** the check as one more `.refine` after the length checks, with `/(?![‍\u{E0020}-\u{E007F}])[\p{Cc}\p{Cf}]/u` (the joiner and the tag characters build emoji). Then implement `deleteListsSchema`. Run the tests again. Expected: PASS.
- [x] **Step 4: Write the failing API tests** with the existing helpers (`signIn`, `sameOrigin`, `twoWorkspaces`). The test names and their assertions are in the spec's [Tests](../specs/2026-11-04-PH-16c-managing-lists-design.md#tests), under API. Use the names `"LST-1.3: …"` and `"LST-1.8: …"` where the spec ties them. For the forced failure in the middle, delete through a transaction that throws after `deleteLists` in a repository test, then check that every list remains.
- [x] **Step 5: Run** `pnpm --filter @szop/api test -- lists`. Expected: FAIL.
- [x] **Step 6: Implement** the repository functions and the routes in `routes.ts`, next to `PATCH`, using the same `idParams` guard and `notFound`.
  - `DELETE` uses `requireListAccess`, then `deleteList`, then `204`.
  - `POST /lists/delete` takes `body: deleteListsSchema`. It runs `findOwnWorkspace`, which gives `204` when there is no workspace. Otherwise it runs `deleteLists` in `db.transaction`, then answers `204`.
  - A request without a session answers `401` on both routes: check `request.user === null` the way `ownWorkspace` does.
- [x] **Step 7: Run** `pnpm --filter @szop/api test`, then `pnpm check`. Expected: PASS.
- [x] **Step 8: Update** the docs listed under **Files**, and tick this task's steps. **Commit** `feat(lists): delete lists through the API and refuse control characters in names`. Its body carries `Closes #346`.

### Task 2: The version in the menu

**Files:**
- Create: `apps/api/src/version.ts`, `version.test.ts`
- Modify: `packages/shared/src/health.ts`, `apps/api/src/health/routes.ts` and its test, `apps/api/src/app.ts` (or wherever `commit` reaches `healthRoutes`), `Dockerfile`, `apps/web/src/shell/api-status.tsx`, `api-status.test.tsx`, `apps/web/src/test/server.ts` (`healthyBody`)
- Docs: `docs/architecture/architecture.md` (`version` in the health answer); ADR 0066's "Settled while building" (how the version reaches the image)

**Interfaces:**
- Produces: `readVersion(): string` returns the root `package.json`'s `version`, parsed with Zod. `HealthRoutesOptions.version: string`. `Health` gains `version: string` in both variants.

- [ ] **Step 1: Write the failing tests.**
  - API: `readVersion()` equals the root `package.json`'s version. `GET /api/health` has `version` in the `200` and in the `503`.
  - Web, in `api-status.test.tsx`: with `commit: "a1b2c3d4e5…"` (40 characters) and `version: "0.2.0"`, the menu shows `Version 0.2.0 · a1b2c3d`. With `commit: "unknown"`, it shows `Version 0.2.0`. Both hold with the database up and with it down.
- [ ] **Step 2: Run** the API and web tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `readVersion` reads `new URL("../../../package.json", import.meta.url)` with `readFileSync`.
  - The API reads it once at startup and passes it to `healthRoutes`.
  - The `Dockerfile`'s final stage gains `COPY package.json ./`, so the same file is read in the image. This replaces a build argument, since the version is already in the copied tree. Record it in "Settled while building".
  - `api-status.tsx` puts the line above "Schema version" in the same `text-xs text-muted-foreground tabular-nums` style, and in the database-down branch too.
- [ ] **Step 4: Run** `pnpm check`. Expected: PASS. Then build the image (`docker build .`) and run it, or run `pnpm` with the production-like Compose setup if that is quicker. Expected: `/api/health` answers `"version":"0.2.0"`.
- [ ] **Step 5: Update** the docs, tick the steps. **Commit** `feat(api): report the release version in the health check and the menu`. Its body carries `Closes #380`.

### Task 3: The confirmation dialog and deleting from the list's screen

**Files:**
- Create: `apps/web/src/components/ui/alert-dialog.tsx` (with `pnpm dlx shadcn@latest add alert-dialog` in `apps/web`; keep the generated file as shadcn writes it, like `sheet.tsx`), `apps/web/src/lists/delete-lists-dialog.tsx`, `delete-lists-dialog.test.tsx`
- Modify: `apps/web/src/api/client.ts`, `client.test.ts`, `apps/web/src/lists/use-lists.ts`, `list-page.tsx`, `list-page.test.tsx`, `e2e/tests/lists.spec.ts`
- Docs: `docs/architecture/visual-design.md` (the confirmation dialog), `docs/architecture/stack-overview.md` (Base UI's `AlertDialog`: the focus trap, the return of focus, why a click outside does not close it)

**Interfaces:**
- Consumes: `deleteListsSchema` (Task 1).
- Produces:
  - `deleteList(id: string): Promise<void>` and `deleteLists(ids: string[]): Promise<void>` in `client.ts`, both through `withSession`. `send` accepts `"DELETE"` without a body.
  - `useDeleteLists()` is a mutation over `ids: string[]`. One ID calls `deleteList`; more call `deleteLists`. A `404` from `deleteList` counts as success (Review Focus 2). On success it removes `["lists", id]` for each ID and invalidates `["lists"]` (exact). It uses `networkMode: "always"`, as the others do.
  - `DeleteListsDialog({ lists, open, onOpenChange, onDeleted }: { lists: Pick<List, "id" | "name">[]; open: boolean; onOpenChange: (open: boolean) => void; onDeleted: () => void })` owns the mutation and resets it when it closes.

- [ ] **Step 1: Write the failing tests.**
  - `client.test.ts`: `deleteList` sends `DELETE /api/lists/<id>` and resolves on `204`. `deleteLists` sends `POST /api/lists/delete` with `{ ids }`. A `500` rejects with `ApiRequestError`.
  - `delete-lists-dialog.test.tsx`: the spec's APP-3.3 tests, without a click outside. The title is `Delete list "Weekly"?` for one list and `Delete 3 lists?` for three. While the request hangs, Delete and Cancel are disabled and Esc does nothing; Delete sends one request even when pressed twice. A `404` closes the dialog and calls `onDeleted`.
  - `list-page.test.tsx`: LST-1.3, per the spec.
- [ ] **Step 2: Run** `pnpm --filter @szop/web test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add the shadcn component.
  - In the dialog, the title is `lists.length === 1 ? `Delete list "${name}"?` : `Delete ${lists.length} lists?``. Delete uses the button's destructive variant. `initialFocus` points at Cancel. `onOpenChange` ignores closing while `isPending`. The error line uses `role="alert"`.
  - `list-page.tsx`: a Delete item under Rename (lucide `Trash2`) opens the dialog. `onDeleted` runs `navigate("/", { replace: true })`.
- [ ] **Step 4: Run** the web tests. Expected: PASS.
- [ ] **Step 5: Add** the first half of the spec's E2E journey to `lists.spec.ts`: create a list, then delete it from its screen. Check that it lands on `/` without the list, with `expectAccessible` while the dialog is open. **Run** `pnpm check && pnpm test:e2e`. Expected: PASS.
- [ ] **Step 6: Update** the docs, tick the steps. **Commit** `feat(lists): delete a list from its screen after a confirmation`.

### Task 4: Selecting lists

**Files:**
- Create: `apps/web/src/lists/use-long-press.ts`, `use-long-press.test.ts`
- Modify: `apps/web/src/lists/lists-page.tsx`, `lists-page.test.tsx`, `apps/web/src/shell/app-shell.tsx`, `shell.test.tsx`, `e2e/tests/lists.spec.ts`
- Docs: `docs/architecture/architecture.md` (the selection mode's state), `docs/architecture/visual-design.md` (the selection bar); ADR 0066's "Settled while building" (the mode held in the history entry's state)

**Interfaces:**
- Consumes: `DeleteListsDialog` (Task 3).
- Produces:
  - `useLongPress(onLongPress: () => void, { delay = 500 } = {})` returns the pointer and `onContextMenu` handlers to spread on a row, plus `pressed(): boolean`. `pressed()` is true once, for the click that ends a long press, so the row's `onClick` can ignore that click.
  - `isSelecting(state: unknown): boolean`, exported from `lists-page.tsx`, is true for `{ selecting: true }`.

**How the mode is held:** starting the mode runs `navigate(".", { state: { selecting: true } })` (a pushed entry). Selecting is `isSelecting(useLocation().state)`, so the browser's Back stops it without leaving `/`. Every other way out (✕, Esc, a successful delete, and the last deselect after a long-press start) runs `navigate(-1)`, which removes the entry. The selected IDs and "started by a long press" live in component state and are cleared whenever selecting becomes false. While selecting, the shell draws neither its phone header nor its desktop title row, and keeps the title as an `sr-only` h1. The lists page draws the bar in their place.

- [ ] **Step 1: Write the failing tests.**
  - `use-long-press.test.ts`, with fake timers: it fires after 500 ms. It does not fire after a `pointerup` at 300 ms, after a `pointermove` of more than 10 px (Review Focus 5) or after a `pointercancel`. Its `onContextMenu` calls `preventDefault` while a press is held.
  - `lists-page.test.tsx`: LST-1.6, LST-1.7 and LST-1.8, per the spec. Add these:
    - Back (`history.back()` on the memory router, or `navigate(-1)`) stops the mode and keeps `/`.
    - ✕ leaves the history length where it was before the mode started.
    - The click after a long press leaves the list selected and does not navigate (Review Focus 3).
    - A selected list missing from a refetched query is not counted (Review Focus 4).
    - Select is not shown with no lists.
    - The long press works only when `(pointer: coarse)` matches (`stubMatchMedia`).
  - `shell.test.tsx`: with `{ selecting: true }` as the location state, the phone header and the desktop title row are absent and an `sr-only` h1 "Lists" remains.
- [ ] **Step 2: Run** `pnpm --filter @szop/web test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Hook and shell:** implement the hook, then the shell's check.
  - **Rows:** while selecting, each row is a `<label>` holding a checkbox, so a tap anywhere toggles it and Space works on the focused checkbox. Otherwise it is today's `Link`, which gains the long-press handlers on a coarse pointer and `select-none [-webkit-touch-callout:none]`.
  - **The bar:** `aria-live="polite"` on the count. A Select button sits beside the count on a phone and in place of "New list" on a desktop. On a phone, the pinned "New list" is hidden while selecting.
  - **Esc:** a `keydown` listener on `document` while selecting.
- [ ] **Step 4: Run** the web tests. Expected: PASS.
- [ ] **Step 5: Extend** the E2E journey of Task 3: create a second list, select it with Select, delete it, and check the page is empty. Add the phone-sized journey: `hasTouch` and a phone viewport, a long press (`page.touchscreen` or dispatched pointer events held 600 ms), then `page.goBack()` stops selecting and the URL stays `/`. **Run** `pnpm check && pnpm test:e2e`. Expected: PASS.
- [ ] **Step 6: Update** the docs, tick the steps. **Commit** `feat(lists): select several lists and delete them at once`.

### Task 5: The not-found pages

**Files:**
- Create: `apps/web/src/not-found/not-found.tsx`, `not-found.test.tsx`, `apps/web/src/brand/trash-can.svg` (from [`trash-can.png`](../specs/2026-11-04-PH-16c-managing-lists/trash-can.png))
- Modify: `apps/web/src/routes.tsx`, `apps/web/src/lists/list-page.tsx`, `list-page.test.tsx`, `apps/web/src/api/client.ts`, `client.test.ts`, `e2e/tests/lists.spec.ts` (or `shell.spec.ts`)
- Docs: `docs/architecture/architecture.md` (the not-found route), `docs/architecture/threat-model.md` (the SPA's ID check and the encoded path), `docs/architecture/visual-design.md` (the not-found pages and the trash can)

**Interfaces:**
- Produces: `NotFound({ message }: { message: string })` draws the trash can, the "Nothing here" heading, the message and the "Back to lists" link. `notFoundRoute` is a `{ path: "*", element: <NotFound message="This page doesn't exist." />, handle: { title: "Not found" } }` entry, last among the shell's children.

- [ ] **Step 1: Convert the image to SVG.** Turn [`trash-can.png`](../specs/2026-11-04-PH-16c-managing-lists/trash-can.png) into `apps/web/src/brand/trash-can.svg`.
  - Trace it into flat shapes quantized to the raccoon's five colours (`#141c2b`, `#3a4654`, `#6c7882`, `#b4bcc5`, `#f9f7f2`). Use a tracing tool if one can be installed without adding a project dependency (for example `vtracer` or `potrace` run once from the scratchpad), or draw it by hand.
  - Keep the image's pose. Leave out the orange checkered patch under the lid. Keep the file small enough to inline as an asset (aim under 30 KB), with a `viewBox` and no fixed `width` or `height`.
  - Render it on the light and the dark page background, as PNG screenshots next to the original.
- [ ] **Step 2: Stop and show the owner** the SVG and the screenshots. Go on only when the owner approves it; rework it on their comments otherwise. Record the method used in ADR 0066's "Settled while building".
- [ ] **Step 3: Write the failing tests.**
  - APP-5.1 and APP-5.2, per the spec. MSW fails on unhandled requests, so `/lists/not-a-uuid` sending nothing is checked by having no handler.
  - `client.test.ts`: `getList("a/b")` requests `/api/lists/a%2Fb`.
- [ ] **Step 4: Run** the web tests. Expected: FAIL.
- [ ] **Step 5: Implement.**
  - **`NotFound`:** use the trash can with `alt=""` and the shell's heading level.
  - **`list-page.tsx`:**
    - `listSchema.shape.id.safeParse(id)` decides before `useList` fetches; pass `enabled` to the query so no request leaves.
    - A failed check, or a `404`, renders `NotFound` with "This list doesn't exist or was deleted." inside the list's header layout.
    - Other errors keep "Try again".
  - **The client:** apply `encodeURIComponent` to the ID in `getList`, `renameList` and `deleteList`.
- [ ] **Step 6: Run** the web tests. Expected: PASS.
- [ ] **Step 7: Add** an E2E test: an unknown path shows "Nothing here" and its link leads to `/`. `/lists/..%2F..%2Fauth%2Fsign-out` shows the list's message and sends no request to `/api/auth/sign-out` (`page.on("request")`). Run `expectAccessible` on the page. **Run** `pnpm check && pnpm test:e2e`. Expected: PASS.
- [ ] **Step 8: Update** the docs, tick the steps. **Commit** `feat(web): show a not-found page for unknown addresses and lists`. Its body carries `Closes #345`.

### Task 6: The new list's screen and the raccoon

**Files:**
- Modify: `apps/web/src/lists/list-screen.tsx`, `new-list-page.tsx`, `new-list-page.test.tsx`, `lists-page.tsx` (only if the pinned bar is shared), `e2e/tests/lists.spec.ts`, `e2e/tests/frame.spec.ts`
- Docs: `docs/architecture/visual-design.md` (Create on the new list's screen)

**Interfaces:**
- Produces: `TitleField` gains `create?: boolean`. With it, the field keeps its border after blur, and a Create button calls the same `commit()` as Enter. On a phone the button is pinned at the bottom in the bar `NewListLink` uses; on a desktop it sits beside the field. It is disabled while `listNameSchema` refuses the value or while `pending` is true.

- [ ] **Step 1: Write the failing tests**, for LST-1.9, per the spec. ← and Esc still create nothing.
- [ ] **Step 2: Run** the web tests. Expected: FAIL.
- [ ] **Step 3: Implement.** If the pinned bar's markup would otherwise be copied, take it out of `NewListLink` as a small `BottomBar` used by both. `NewListPage` passes `create`.
- [ ] **Step 4: Find the raccoon's gap.** On a desktop-sized window in Chromium and Firefox, with a page short enough to have no scrollbar and one long enough to have it, measure the image's right edge against `innerWidth`. Name the cause, then fix it in `EmptyList` with `scrollbar-gutter: stable` kept.
- [ ] **Step 5: Add** to `frame.spec.ts` (desktop size): on an empty list's screen, the raccoon's box ends at the viewport's right edge. Adapt the `lists.spec.ts` journeys to Create where they now press Enter only for convenience, and keep one that presses Enter. **Run** `pnpm check && pnpm test:e2e`. Expected: PASS.
- [ ] **Step 6: Update** the docs, tick the steps. **Commit** `feat(lists): create a list with a Create button and keep the raccoon at the edge`. Its body carries `Closes #318` and `Closes #323`.

### Task 7: The mutation run

**Files:**
- Modify: whatever the owner's decisions touch (tests, `// Stryker disable next-line <Mutator>: <reason>` comments)

- [ ] **Step 1: Run** `pnpm db:up`, then `pnpm test:mutation --mutate` over:
  - `packages/shared/src/{lists,health}.ts`;
  - `apps/api/src/lists/{repository,routes}.ts` and `apps/api/src/version.ts`;
  - `apps/web/src/api/client.ts`;
  - `apps/web/src/lists/{use-lists,use-long-press,delete-lists-dialog,lists-page,list-page,list-screen,new-list-page}.ts(x)`;
  - `apps/web/src/shell/{app-shell,api-status}.tsx`;
  - `apps/web/src/not-found/not-found.tsx`.
- [ ] **Step 2:** List the survivors for the owner, grouped by file, each with a proposal: a test that kills it, or an accepted reason. Stop and wait for the owner's decisions.
- [ ] **Step 3:** Apply the decisions, and rerun the mutation run on the touched files. Expected: every survivor is killed or carries its reason ([definition of done](../../development/definition-of-done.md), item 2).
- [ ] **Step 4: Run** `pnpm check`. Expected: PASS. **Commit** `test(lists): kill or accept the PH-16c mutation survivors`.
