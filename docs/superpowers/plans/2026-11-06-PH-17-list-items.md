# PH-17 List items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementers:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md) before your task.

**Goal:** A user adds items to a list by name, edits every field, checks them into the haul and puts them back, removes them with an undo, and sees the list sorted by category or in the order added.

**Architecture:** A new table `list_items` (key `(workspace_id, id)`, foreign keys that include `workspace_id`) and a column `lists.sort_by_category`; item routes under `/api/lists/:listId/items` beside the lists'; `GET /api/lists/:id` returns the list with its items. The SPA keeps the list and its items in one query, `["lists", id]`, and changes it optimistically, one item's changes in one TanStack Query mutation scope. The shared package holds the item schemas, the limits, the integer amounts and the order of the cards.

**Tech Stack:** PostgreSQL 18, Drizzle, Fastify with zod, React 19, TanStack Query 5, Base UI 1.9 (Drawer, Dialog, Toast, NumberField, Menu), React Hook Form with `@hookform/resolvers`, Vitest, Testing Library, MSW, Playwright with axe, Stryker.

**Spec:** [`docs/superpowers/specs/2026-11-06-PH-17-list-items-design.md`](../specs/2026-11-06-PH-17-list-items-design.md), with the mockups in [`2026-11-06-PH-17-list-items/`](../specs/2026-11-06-PH-17-list-items/); decisions in [ADR 0071](../../decisions/0071-list-items-phase-details.md). The criteria are in the spec's [Acceptance criteria](../specs/2026-11-06-PH-17-list-items-design.md#acceptance-criteria), the tests in its [Tests](../specs/2026-11-06-PH-17-list-items-design.md#tests), the docs to update in its [Documentation](../specs/2026-11-06-PH-17-list-items-design.md#documentation); each task below names the docs it updates.

## Order of work

The plan has 12 tasks, more than the 3 to 8 of [ADR 0014](../../decisions/0014-roadmap.md), decision 6: PH-17 is the [context-size experiment](../../audits/2026-11-06-ph-17-context-experiment.md)'s large phase, and is not split.

1. [Task 1: Items in the shared package](#task-1-items-in-the-shared-package)
2. [Task 2: The table and the migration test with data](#task-2-the-table-and-the-migration-test-with-data)
3. [Task 3: The item routes](#task-3-the-item-routes)
4. [Task 4: Optimistic changes and the toast region](#task-4-optimistic-changes-and-the-toast-region)
5. [Task 5: The list screen and the add bar](#task-5-the-list-screen-and-the-add-bar)
6. [Task 6: Editing and removing an item](#task-6-editing-and-removing-an-item)
7. [Task 7: The category picker](#task-7-the-category-picker)
8. [Task 8: Checking and the haul](#task-8-checking-and-the-haul)
9. [Task 9: The sort setting and the checkboxes' side](#task-9-the-sort-setting-and-the-checkboxes-side)
10. [Task 10: The blink behind ✕](#task-10-the-blink-behind-)
11. [Task 11: The journey and the built screens](#task-11-the-journey-and-the-built-screens)
12. [Task 12: The mutation run](#task-12-the-mutation-run)

## Global Constraints

- The branch is `feat/ph-17-list-items`. Scopes: `items` (ITM), `ordering` (ORD, the haul, the sort), `lists`, `shared`, `api`, `web`, `e2e`; `fix(lists)` for #397.
- **The context-size experiment's rules apply** ([audit](../../audits/2026-11-06-ph-17-context-experiment.md#rules)): the execution runs every task without stopping for the owner, which overrides "stop and summarize" in [`CLAUDE.md`](CLAUDE.md#after-each-task) for this phase only (commit, push and tick the boxes stay); the coordinator measures its context at the start and end of each task and appends it to `.superpowers/brainstorm/341380-1793980036/ph-17-decisions.md`; above 150k at the end of a task it stops and asks the owner for `/compact`.
- The UI's words are exactly the spec's: "+ Add item", "Add", "Add an item to *list name*", "Nothing on this list yet", "Everything's in the haul", "No category", "*N* left", "Edit item", "Name", "Quantity", "Unit", "No unit", "Price per unit", "Category", "Note", "Remove", "Cancel", "Save", "Enter a name.", "Enter a number, such as 1.5.", "Search categories", "Removed *Bananas*", "Undo", "*Bananas* wasn't saved. Check your connection and try again.", "The haul", "*k* of *n* items", "The haul · *k* of *n* items", "Check items off to drop them here", "+*N* more", "Newest first · ↶ puts an item back", "Put *item* back", "Show all *N* items in the haul", "Sort by category", "Checkboxes", "Left", "Right".
- The limits, once, in `packages/shared/src/items.ts`: name 1 to 100 code points, note at most 500, quantity 1 to 9 999 000 thousandths, price 0 to 9 999 999 cents.
- Amounts are integers everywhere (thousandths, cents); no floating-point amount is stored or sent. Prices show as `€1.98`, quantities with a decimal point.
- Every new control has a tap target of at least 44 px (48 px where the design system says so), a visible focus ring, and works with the keyboard alone; motion only under `motion-safe:`.
- The content security policy does not change. Base UI's Drawer, Toast and NumberField are used as installed (`@base-ui/react` 1.9); the first task that opens a Drawer proves it under the real policy with the E2E suite (Task 6).
- A test covering a criterion starts with its ID: `it("ITM-2.4: …")`; an open point's or a bug's test too (`OP-052: …`, `#397: …`).
- `pnpm check` passes after every task; `pnpm test:e2e` after every task from Task 5.

## Review Focus

1. **An item checked, unchecked or edited twice in quick succession on a slow connection.** Expected: the requests reach the server in the order made, and the screen ends in the state of the last change, not of an earlier answer. Task 4 tests it (a held first request, a second change, then both answers).
2. **A change that fails while another item's change is in flight.** Expected: only the failed item goes back; the other keeps its optimistic state until its own answer. Task 4 tests it.
3. **Undo after the remove's own request is still in flight or failed.** Expected: the restore is sent after the delete (same scope), so the item exists afterwards; a failed remove brings the item back with "wasn't saved" and no Undo is needed. Task 6 tests it.
4. **A quantity or price typed out of range or with too many decimals** ("0", "10000", "1,2345", "12.345" for a price, "-1", "1e3"). Expected: an error under the field in words, nothing sent. Tasks 1 and 6 test it.
5. **An item whose category or unit the client does not know** (deleted elsewhere, a stale catalog). Expected: the item shows in "No category" or with no unit, never crashes the screen. Task 1 tests it for the cards, Task 5 for the row.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/items.ts` | The item's limits and zod schemas (API bodies and answers) |
| `packages/shared/src/amounts.ts` | Parsing and formatting quantities and prices, the line total |
| `packages/shared/src/item-order.ts` | The cards with sorting on and off, the haul's order |
| `packages/shared/src/lists.ts` | `sortByCategory` on a list, the list with its items, the list update body |
| `apps/api/src/db/schema.ts`, `apps/api/drizzle/0003_*.sql` | `list_items`, `lists.sort_by_category` |
| `apps/api/src/test/migrations.ts` | A fresh database migrated up to a given migration, for tests with data |
| `apps/api/src/items/repository.ts`, `routes.ts` | Reading and writing items; the item routes |
| `apps/api/src/lists/*` | The list read with its items; the update with `sortByCategory` |
| `apps/web/src/api/client.ts` | The item requests; `getList` answers the list with its items |
| `apps/web/src/lists/use-items.ts` | The optimistic item mutations and the sort setting's |
| `apps/web/src/shell/toasts.tsx` | The app's one toast region and its manager |
| `apps/web/src/lists/items/*` | The rows, cards, add bar, edit sheet, category picker, haul |
| `apps/web/src/shell/checkbox-side.ts`, `checkbox-side-control.tsx` | The checkboxes' setting, kept on the device |
| `apps/web/src/components/ui/dropdown-menu.tsx` | Gains a check item and a separator |
| `e2e/tests/items.spec.ts` | The journey and the axe checks |

### Task 1: Items in the shared package

**Files:**
- Create: `packages/shared/src/items.ts`, `items.test.ts`, `amounts.ts`, `amounts.test.ts`, `item-order.ts`, `item-order.test.ts`
- Modify: `packages/shared/src/lists.ts`, `lists.test.ts`, `index.ts` (exports)
- Docs: `docs/architecture/architecture.md` (quantities and money as integers, the line total's one rule); ADR 0071's "Settled while building" (the line total is a JS number, see Step 3)

**Interfaces:**
- Produces, in `items.ts`:
  - `itemLimits = { name: 100, note: 500, quantity: { min: 1, max: 9_999_000 }, price: { min: 0, max: 9_999_999 } } as const`
  - `itemNameSchema`: `listNameSchema`'s rules (trim, NFC, 1 to 100 code points, no control characters) with the message "Enter a name." when empty.
  - `itemNoteSchema`: at most 500 code points, `""` becomes `null`.
  - `listItemSchema = z.object({ id: z.uuid(), name: z.string(), quantity: z.int().nullable(), unitId: z.uuid().nullable(), price: z.int().nullable(), categoryId: z.uuid().nullable(), note: z.string().nullable(), checkedAt: z.iso.datetime().nullable() })`; `type ListItem`.
  - `createItemSchema`: `{ id: z.uuid(), name: itemNameSchema }` plus optional `quantity`, `unitId`, `price`, `categoryId`, `note`, `checkedAt` (Undo sends them all); quantity and price as integers within the limits; `type CreateItem`.
  - `updateItemSchema`: every field of create but `id` optional, plus `checked: z.boolean().optional()` and no `checkedAt`; at least one key; `type UpdateItem`.
- Produces, in `amounts.ts`:
  - `type ParsedAmount = { ok: true; value: number | null } | { ok: false }`
  - `parseAmount(text: string, decimals: 2 | 3): ParsedAmount`: trimmed; `""` is `{ ok: true, value: null }`; digits with one optional `,` or `.` and at most `decimals` digits after it, else `{ ok: false }`; the value in whole hundredths or thousandths, computed from the digits as a string, never through `parseFloat`. The range is the schemas', not this function's.
  - `formatQuantity(thousandths: number): string` (`1500` → `"1.5"`, `6000` → `"6"`, `1` → `"0.001"`); `formatPrice(cents: number): string` (`198` → `"€1.98"`, `0` → `"€0.00"`, `9_999_999` → `"€99999.99"`); `formatAmountInput(value: number, decimals: 2 | 3): string` for a field's text (`50` with 2 → `"0.50"`, `1500` with 3 → `"1.5"`).
  - `lineTotal({ price, quantity }: Pick<ListItem, "price" | "quantity">): number | null`: `null` without a price; the price without a quantity; else `Math.floor((price * quantity + 500) / 1000)`, half away from zero for these non-negative values.
- Produces, in `item-order.ts`:
  - `type ItemCard = { kind: "category"; category: OrderedCategory; items: ListItem[] } | { kind: "uncategorized"; items: ListItem[] } | { kind: "all"; items: ListItem[] }`
  - `itemCards(items: readonly ListItem[], categories: readonly OrderedCategory[], sortByCategory: boolean): ItemCard[]`: unchecked items only; on: one card per category that has items, in `categories`' order, items by `compareNames`, then one `uncategorized` card last for items with no category or a category not in `categories`; off: one `all` card, items by `id` ascending; no card without items (none at all when nothing is unchecked).
  - `haulItems(items: readonly ListItem[]): ListItem[]`: checked items, `checkedAt` newest first, ties by `id` descending.
- Produces, in `lists.ts`: `listSchema` gains `sortByCategory: z.boolean()`; `listWithItemsSchema = listSchema.extend({ items: z.array(listItemSchema) })`, `type ListWithItems`; `updateListSchema = z.object({ name: listNameSchema.optional(), sortByCategory: z.boolean().optional() })` with at least one key, replacing `renameListSchema` (`type UpdateList`).

- [ ] **Step 1: Write the failing tests:**
  - `amounts.test.ts`: `parseAmount("0,5", 3)` and `parseAmount("0.5", 3)` → `{ ok: true, value: 500 }`; `parseAmount(" 1.25 ", 2)` → `125`; `parseAmount("", 3)` → `{ ok: true, value: null }`; `{ ok: false }` for `"1,2345"` with 3, `"1.234"` with 2, `"-1"`, `"1e3"`, `"1.2.3"`, `"."`, `"abc"`; `lineTotal`: `{ price: 33, quantity: 6000 }` → `198`, `{ price: 199, quantity: 1500 }` → `299` (298.5 rounds up), `{ price: 1, quantity: 500 }` → `1` (0.5 up), `{ price: 1, quantity: 499 }` → `0`, `{ price: 250, quantity: null }` → `250`, `{ price: null, quantity: 1000 }` → `null`, the maxima `{ price: 9_999_999, quantity: 9_999_000 }` → `99_980_000_010`; the formats above.
  - `items.test.ts`: `"ITM-1.1: a name is required"`, `"ITM-1.2: a category, quantity, unit, note and price are optional"`, `"LIM-2.1: a name over 100 characters is refused"`, a name of 100 emoji accepted, `"   "` refused with "Enter a name.", a note of 501 refused, quantity `0` and `9_999_001` refused, price `-1` and `10_000_000` refused, `1.5` refused (not an integer); `updateItemSchema` refuses `{}` and takes `{ checked: true }`.
  - `item-order.test.ts`: `"ORD-2.1: …"` cards follow `orderCategories`; `"ORD-3.1: …"` an item of a parent category sits in the parent's card, before its subcategory's card; `"ORD-2.2: …"` items by Polish rules (`"Ćwikła"` after `"Cebula"`, before `"Dynia"`); `"ORD-2.4: items with no category are in a last card"`, with an item whose category is unknown in it too; `"ORD-5.5: with sorting off one card, oldest first"` by ID; checked items in no card; `"ORD-2.5: the haul newest first"`.
- [ ] **Step 2: Run** `pnpm --filter @szop/shared test`. Expected: FAIL, the modules do not exist.
- [ ] **Step 3: Implement** the three modules and the `lists.ts` changes. The line total of the maxima is about 10^11, past a 32-bit integer and well within a JS number's exact range (2^53): the total is computed, never stored, so it stays a number; record this in ADR 0071's "Settled while building" (it corrects the spec's note on 32 bits).
- [ ] **Step 4: Run** `pnpm --filter @szop/shared test`, then `pnpm check`. Expected: PASS. `listSchema`'s new field breaks the API's and the web's lists fixtures and `toList`: add `sortByCategory: true` to `apps/web/src/test/lists.ts` and wherever typecheck points; `toList` reads the column added in Task 2, so until then return `sortByCategory: true` there with the comment `// Task 2 adds the column`, removed in Task 2.
- [ ] **Step 5: Commit** `feat(items): add the item schemas, amounts and card order`.

### Task 2: The table and the migration test with data

**Files:**
- Modify: `apps/api/src/db/schema.ts`, `apps/api/src/db/schema.test.ts`, `apps/api/src/lists/repository.ts` (`toList` reads `sortByCategory`)
- Create: `apps/api/drizzle/0003_<generated>.sql` and its snapshot, `apps/api/src/test/migrations.ts`, `apps/api/src/db/migration-data.test.ts`
- Docs: `docs/architecture/architecture.md` (the `list_items` table, its foreign keys and checks, `sort_by_category`), `docs/development/testing.md` (a new section "Writing a migration test with data", linked from Contents)

**Interfaces:**
- Produces: `listItems` in `schema.ts`, columns as the spec's [Data](../specs/2026-11-06-PH-17-list-items-design.md#data) table (`workspaceId`, `id`, `listId`, `name`, `quantity`, `unitId`, `price`, `categoryId`, `note`, `checkedAt`, `createdAt`, `updatedAt`); constraints `list_items_pkey (workspace_id, id)`, `list_items_workspace_id_list_id_fkey` → `lists` on delete cascade, `list_items_workspace_id_unit_id_fkey` and `list_items_workspace_id_category_id_fkey` on delete set null of the one column, `list_items_workspace_id_list_id_idx`, checks `list_items_name_check` (`char_length BETWEEN 1 AND 100`), `list_items_note_check` (`<= 500`), `list_items_quantity_check` (`BETWEEN 1 AND 9999000`), `list_items_price_check` (`BETWEEN 0 AND 9999999`). `lists.sortByCategory`: `boolean("sort_by_category").default(true).notNull()`.
- Produces: `migratedDatabase(name: string, upTo: string): Promise<Database>` in `test/migrations.ts`: drops and creates the database `name` (from `testDatabaseName`), applies the journal's migrations up to and including the tag `upTo` (copying those entries and their SQL files into a temporary folder for Drizzle's migrator), and returns it open; `migrateAll(db)` is the existing `runMigrations`.

- [ ] **Step 1: Write the failing tests:** in `schema.test.ts`, the table list gains `list_items`; `"ITM-7: list_items_pkey covers (workspace_id, id)"`; `"deletes a list's items with the list"`; `"deleting a category or unit clears only that column of its items"` (the item keeps its `workspace_id` and other reference); `"LIM-2.1: the database refuses a name of 101 characters and a note of 501"`; `"NFR-4.10: an item cannot point at another workspace's list, category or unit"` (insert fails with code `23503`). In `migration-data.test.ts`, `"OP-052: lists made before 0003 keep their rows and sort by category"`: `migratedDatabase(testDatabaseName(\`m${process.env.VITEST_POOL_ID}\`), "0002_tough_ultron")`, insert a workspace (with its user) and two lists, `runMigrations`, read them back with `sort_by_category = true`.
- [ ] **Step 2: Run** `pnpm --filter @szop/api test src/db`. Expected: FAIL.
- [ ] **Step 3: Add** the table and column to `schema.ts`; run `pnpm --filter @szop/api db:generate`; in the generated SQL, change each `ON DELETE set null` to `ON DELETE set null ("unit_id")` and `("category_id")`, as `0002_tough_ultron.sql` does (Drizzle cannot express the column list; without it PostgreSQL would also null `workspace_id`). Write `test/migrations.ts`. Remove Task 1's `// Task 2 adds the column` stand-in in `toList`.
- [ ] **Step 4: Run** `pnpm --filter @szop/api test`, then `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(items): add the list_items table and the migration test with data`.

### Task 3: The item routes

**Files:**
- Create: `apps/api/src/items/repository.ts`, `repository.test.ts`, `routes.ts`, `routes.test.ts`
- Modify: `apps/api/src/app.ts` (register `itemsRoutes` with prefix `/api`), `apps/api/src/lists/routes.ts`, `repository.ts`, `routes.test.ts`, `repository.test.ts` (rename → update)
- Docs: `docs/architecture/architecture.md` (the API's item routes), `docs/architecture/threat-model.md` (references between records checked by the database's foreign keys, the one 404)

**Interfaces:**
- Consumes: Task 1's schemas, Task 2's `listItems`; `requireListAccess`, `findOwnWorkspace` from `access/workspace.ts`.
- Produces, in `items/repository.ts` (all scoped by `context.workspaceId` and `listId`):
  - `listItemsOf(db: Executor, context: WorkspaceContext, listId: string): Promise<ListItem[]>`
  - `insertItem(db, context, listId, body: CreateItem): Promise<{ item: ListItem; created: boolean } | null>`: `onConflictDoNothing` on the key; on a conflict returns the stored item; `null` on a foreign-key violation.
  - `updateItem(db, context, listId, id, changes: UpdateItem): Promise<ListItem | null>`: `checked: true` sets `checked_at = now()` on every call, `false` sets `null`; `null` when no row matched or on a foreign-key violation.
  - `deleteItem(db, context, listId, id): Promise<boolean>`
  - `isForeignKeyViolation(error: unknown): boolean`: PostgreSQL code `23503` on the error or its `cause` (Drizzle wraps it).
- Produces, the routes: `GET /api/lists/:id` → `listWithItemsSchema` (the list read gains its items); `PATCH /api/lists/:id` with `updateListSchema` (name, `sortByCategory`, or both) → `listSchema`; `POST /api/lists/:listId/items` with `createItemSchema` → `201` created, `200` existing, `listItemSchema`; `PATCH /api/lists/:listId/items/:id` with `updateItemSchema` → `200` `listItemSchema`; `DELETE /api/lists/:listId/items/:id` → `204`. A malformed ID, a list, item, category or unit not in the session's workspace: `404 not_found`, as the lists' `notFound`.
- Produces, in `lists/repository.ts`: `updateList(db, context, id, changes: UpdateList): Promise<List | null>` replacing `renameList` (still writes nothing when nothing changes).

- [ ] **Step 1: Write the failing tests** in `items/routes.test.ts` (with `twoWorkspaces` and `useTestDatabase`, as `lists/routes.test.ts`):
  - `"NET-1.6: creating twice with the same ID makes one item"` (201 then 200, the same body, one row).
  - `"ITM-2.3: an item made from a name has no category, quantity, unit, price or note"`.
  - `"ITM-6.1: …"` an update of each field, and of several at once; `"ITM-6.2: editing an item changes only that item"`.
  - `"ITM-7.2: checked true twice stays checked"`; `"ITM-7.4: a second check stores the later time"` (the second `checkedAt` is later); `checked: false` clears it.
  - `"APP-3.1: Undo's create brings back every field, checkedAt included"`.
  - `"ORD-5.1: the list's sort setting is saved"` (`PATCH /api/lists/:id` `{ sortByCategory: false }`, then `GET` shows it, the name unchanged).
  - `"NFR-4.10: …"` 404 for a create in another workspace's list, a body naming another workspace's category or unit, an update, check or delete of another workspace's item, an item of another list of the same workspace in the path.
  - `"LIM-2.1: the API refuses a name over 100 and a note over 500"` (400).
  - `"ACC-1.5: a guest's item with a default category and unit is saved"`: a guest's first change creates a list, then an item with a seed category's and unit's IDs (from `seedNamespaces`/the catalog fixture) answers 201.
  - `GET /api/lists/:id` returns `sortByCategory` and the items; a 401 without a session for every write.
- [ ] **Step 2: Run** `pnpm --filter @szop/api test src/items src/lists`. Expected: FAIL.
- [ ] **Step 3: Implement** the repository and routes, following `lists/routes.ts` (session hook, typed routes, `z.uuid().safeParse` on path IDs, `requireListAccess` first) and its Stryker comments' style.
- [ ] **Step 4: Run** `pnpm --filter @szop/api test`, then `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(items): add the item routes and the list's sort setting`.

### Task 4: Optimistic changes and the toast region

**Files:**
- Modify: `apps/web/package.json` (add `react-hook-form` and `@hookform/resolvers`, used from Task 5), `apps/web/src/api/client.ts`, `client.test.ts`, `apps/web/src/lists/use-lists.ts` (`remember` merges into the list with items), `apps/web/src/shell/app-shell.tsx` (renders `<Toasts />`)
- Create: `apps/web/src/lists/use-items.ts`, `use-items.test.tsx`, `apps/web/src/shell/toasts.tsx`, `toasts.test.tsx`, `apps/web/src/test/items.ts` (fixtures)
- Docs: `docs/architecture/architecture.md` (§3 Frontend: the optimistic updates, the scope per item, the toast region), `docs/architecture/stack-overview.md` (optimistic updates with `onMutate` and rollback; mutation scopes; Base UI Toast; React Hook Form, why and its resolver), `docs/development/tools/` only if a page lists the web's dependencies

**Interfaces:**
- Consumes: Task 1's types; Task 3's routes.
- Produces, in `client.ts`: `getList(id): Promise<ListWithItems>` (was `List`); `updateList(id, changes: UpdateList): Promise<List>` with `renameList(id, name)` kept as a one-line call to it; `createItem(listId, body: CreateItem): Promise<ListItem>`; `updateItem(listId, id, changes: UpdateItem): Promise<ListItem>`; `deleteItem(listId, id): Promise<void>` (a 404 is success, as `remove` in `use-lists.ts`). All writes go through `withSession`.
- Produces, in `toasts.tsx`: `toastManager` (Base UI `Toast.createToastManager()`), `Toasts()` (the provider with `limit={1}`, so a new toast replaces the shown one, and the viewport: 75% of the screen's width, centered, above the add bar), `showNotSaved(name: string): void` (adds "*name* wasn't saved. Check your connection and try again.", no button).
- Produces, in `use-items.ts`, each hook with `networkMode: "always"` and `scope: { id: itemId }`, `onMutate` that cancels `["lists", listId]` and writes the change into it, and `onError` that puts back only that item's previous version (or takes an added item out), calls `showNotSaved(item name)` and invalidates `["lists", listId]`:
  - `useAddItem(listId: string, itemId: string)`: `mutate(name: string)`.
  - `useUpdateItem(listId: string, itemId: string)`: `mutate(changes: UpdateItem)`; `checked` sets `checkedAt` to the browser's now until the answer replaces it.
  - `useRemoveItem(listId: string, itemId: string)`: `mutate()`.
  - `useRestoreItem(listId: string, itemId: string)`: `mutate(item: ListItem)`, a create with every field.
  - `useSortByCategory(listId: string)`: `mutate(value: boolean)`, scope `list-${listId}`; its failure says "Sorting wasn't saved. Check your connection and try again." (Claude's call: the setting has no item name; record it in ADR 0071's "Settled while building").
  - On success each writes the server's item into the cache.

- [ ] **Step 1: Write the failing tests** in `use-items.test.tsx` (`renderHook` with a fresh `QueryClient`, MSW):
  - `"APP-7.1: an added item is in the list before the server answers"` (MSW `delay("infinite")`).
  - `"APP-7.2: a refused change goes back and says it wasn't saved"`: 500 on the update; the item shows its old name, the toast says "Bananas wasn't saved. Check your connection and try again.", the list is refetched.
  - Review Focus 1: two updates of one item, the first held; the second request is sent only after the first answer; the cache ends with the second's state.
  - Review Focus 2: item A's update fails while item B's is held; B keeps its optimistic state.
  - `deleteItem` treats 404 as done; `remember` keeps the items when a rename answers.
  - `toasts.test.tsx`: a second toast replaces the first; `showNotSaved`'s text; the region is polite (`aria-live="polite"`).
- [ ] **Step 2: Run** `pnpm --filter @szop/web test src/lists/use-items src/shell/toasts src/api`. Expected: FAIL.
- [ ] **Step 3: Implement** the client functions, `toasts.tsx`, `use-items.ts`; add the two dependencies with `pnpm --filter @szop/web add react-hook-form @hookform/resolvers`.
- [ ] **Step 4: Run** `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(items): add optimistic item changes and the toast region`.

### Task 5: The list screen and the add bar

**Files:**
- Create: `apps/web/src/lists/items/item-row.tsx`, `item-cards.tsx`, `add-bar.tsx`, and a test beside each; `e2e/tests/items.spec.ts`
- Modify: `apps/web/src/lists/list-page.tsx` (loads the catalog with `useCatalog`, renders the cards, the states and the add bar; the haul's place is left for Task 8), `list-screen.tsx` (`EmptyList` points at the add bar; `TitleField` takes `maxLength={100}` and drops its too-long message), `list-page.test.tsx`, `new-list-page.test.tsx`
- Docs: ADR 0071's "Settled while building" for anything decided here

**Interfaces:**
- Consumes: `itemCards`, `lineTotal`, `formatQuantity`, `formatPrice` (Task 1); `useAddItem` (Task 4); `useCatalog`, `orderCategories`.
- Produces: `ItemRow({ item, unitName, onEdit }: { item: ListItem; unitName: string | null; onEdit: () => void })`: the row of the spec's [The list screen](../specs/2026-11-06-PH-17-list-items-design.md#the-list-screen), the name, note, quantity and line total one button opening the edit, and a slot for the checkbox that Task 8 fills; `ItemCards({ cards, units, onEdit })`; `AddBar({ listId, listName, onFocusChange }: { listId: string; listName: string; onFocusChange: (focused: boolean) => void })` with React Hook Form and `itemNameSchema`, the next item's ID kept in state (`uuidv7()`) and renewed after each add, so `useAddItem(listId, nextId)` scopes each add to its item.

- [ ] **Step 1: Write the failing tests:**
  - `add-bar.test.tsx`: `"ITM-2.3: Enter adds the typed name with nothing else"`; `"ITM-2.4: the field clears and keeps the focus"`; `"Add" adds too; whitespace adds nothing; `"LIM-2.2: the add bar takes no character past 100"` (`maxLength` is 100; typing 101 leaves 100, no message); the accessible name "Add an item to Weekend groceries".
  - `item-cards.test.tsx`: `"ORD-1.2: a card per category with N left, headed by its own name"` (ORD-2.3 too); the "No category" card in italics, last; `"ORD-5.5: …"` one card with only "N left"; a row is a button for the edit and the checkbox is not part of it (`"ITM-6.3: tapping the name opens the edit"`); an item with an unknown unit shows its quantity alone.
  - `list-page.test.tsx`: skeleton while loading; `"ORD-1.9: …"` "Nothing on this list yet" and no haul when empty, "Everything's in the haul" when every item is checked; the error card's "Try again".
  - `new-list-page.test.tsx` and `list-page.test.tsx`: `"LIM-2.2: the list name takes no character past 100"`, replacing the "At most 100 characters." tests.
  - `e2e/tests/items.spec.ts`: on a phone-sized window, add three items one after another with Enter and see them in "No category"; the add bar's band stays pinned while the list scrolls under it.
- [ ] **Step 2: Run** `pnpm --filter @szop/web test src/lists`. Expected: FAIL.
- [ ] **Step 3: Implement** the components to the spec's [The list screen](../specs/2026-11-06-PH-17-list-items-design.md#the-list-screen) and [Adding an item](../specs/2026-11-06-PH-17-list-items-design.md#adding-an-item), the add bar's band as `addbar-ph17.png` (b): the page color, rounded top corners, a soft shadow above and a thin top edge, pinned within the 720 px column; the note's cut with `line-clamp-1`.
- [ ] **Step 4: Run** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(items): show a list's items and add them by name`.

### Task 6: Editing and removing an item

**Files:**
- Create: `apps/web/src/lists/items/edit-item.tsx`, `edit-item.test.tsx`, `item-form.ts`, `item-form.test.ts`, `undo-remove.tsx`, `undo-remove.test.tsx`
- Modify: `apps/web/src/lists/list-page.tsx` (opens the edit for the tapped item; holds the removed item for Undo), `e2e/tests/items.spec.ts`, `e2e/tests/csp-guard.spec.ts` if the guard lists the screens it opens
- Docs: `docs/architecture/stack-overview.md` (Base UI's Drawer and NumberField), ADR 0071's "Settled while building"

**Interfaces:**
- Consumes: `useUpdateItem`, `useRemoveItem`, `useRestoreItem`, `toastManager` (Task 4); `parseAmount`, `formatAmountInput`, `lineTotal`, `itemLimits` (Task 1).
- Produces, in `item-form.ts`: `type ItemFormValues = { name: string; quantity: string; unitId: string; price: string; categoryId: string | null; note: string }` (`unitId` `""` for "No unit"); `toFormValues(item: ListItem): ItemFormValues`; `itemFormSchema`, a zod schema from `ItemFormValues` to `UpdateItem` for React Hook Form's resolver: "Enter a name." for an empty name, "Enter a number, such as 1.5." for a quantity or price `parseAmount` refuses or out of `itemLimits` (Claude's call: one message for every bad number, no new copy; record it).
- Produces: `EditItem({ item, open, onOpenChange, onRemoved, units, catalog }: { item: ListItem; open: boolean; onOpenChange: (open: boolean) => void; onRemoved: (item: ListItem) => void; units: CatalogUnit[]; catalog: Catalog })`: a Base UI Drawer from the bottom below `desktopQuery`, a centered Base UI Dialog from it; the Category button opens Task 7's picker (until then it shows the name only). `UndoRemove({ listId, item }: { listId: string; item: ListItem })`, rendered by `ListPage` with `key={item.id}` for the latest removed item: adds "Removed *name*" with "Undo" to `toastManager` (`timeout: 5000`) on mount, and its Undo calls `useRestoreItem(listId, item.id).mutate(item)`, in the same scope as the remove.

- [ ] **Step 1: Write the failing tests:**
  - `item-form.test.ts`: `"APP-6.2: …"` both messages; "0", "10000", "1,2345" refused for a quantity; "12.345" refused for a price; "0,5" becomes `500`; an empty quantity becomes `null` and keeps `unitId`; an empty note becomes `null`.
  - `edit-item.test.tsx`: `"ITM-6.1: every field is edited and saved"`; the fields' order and labels (`"APP-6.1: …"`); no field has the focus on opening; + on an empty quantity gives 1, − is disabled at 1; the line total hint "6 × €0.33 = €1.98"; `"LIM-2.2: the name and note take no character past 100 and 500"`; errors show on leaving the field and on Save, nothing is sent; Cancel, ✕ and Esc close without saving.
  - `undo-remove.test.tsx`: `"ITM-7.3: …"` and `"APP-3.2: Remove takes the item off at once, without asking"`; `"APP-3.1: Undo brings the item back to its place, checked or not"`; the toast stays while hovered or focused (fake timers past 5 s); Review Focus 3: Undo while the delete is held is sent after it; a second removal replaces the toast.
  - `e2e/tests/items.spec.ts`: on a phone, edit an item's quantity, price and note in the sheet and see the row change; remove and undo. This is the first Drawer under the real content security policy: the run's CSP guard must stay clean. If Base UI's Drawer injects a style, stop the task, switch the edit sheet to a bottom Base UI Dialog without the swipe (the spec's fallback), and record it.
- [ ] **Step 2: Run** `pnpm --filter @szop/web test src/lists/items`. Expected: FAIL.
- [ ] **Step 3: Implement** to the spec's [Editing an item](../specs/2026-11-06-PH-17-list-items-design.md#editing-an-item) and [Removing an item](../specs/2026-11-06-PH-17-list-items-design.md#removing-an-item) and `edit-item.png`. The quantity is Base UI's NumberField with its Increment and Decrement; if its input refuses "0,5" or reformats what is typed, keep NumberField's buttons around a plain text input bound to the form's string and record it. The unit is a native `<select>`.
- [ ] **Step 4: Run** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(items): edit and remove an item with an undo`.

### Task 7: The category picker

**Files:**
- Create: `apps/web/src/lists/items/category-picker.tsx`, `category-picker.test.tsx`
- Modify: `apps/web/src/lists/items/edit-item.tsx` (the Category field opens the picker), `e2e/tests/items.spec.ts`

**Interfaces:**
- Consumes: `buildCatalogTree`, `searchTree`, `findMatch` (`apps/web/src/catalog/`), called with the catalog's categories and no products (`{ ...catalog, products: [] }`).
- Produces: `CategoryPicker({ catalog, value, onPick, onBack }: { catalog: Catalog; value: string | null; onPick: (categoryId: string | null) => void; onBack: () => void })`: a radio group named "Category"; on a phone it is a second Drawer over the edit sheet, on a desktop it replaces the dialog's content with ← back; picking calls `onPick` and returns the focus to the Category field.

- [ ] **Step 1: Write the failing tests:** the chevron opens and closes a category's subcategories without picking it; the rest of the row picks it and closes the picker; "No category" first, and picking it clears the category; `"Search categories"` narrows the tree to matches with their ancestors, the match highlighted (`<mark>`), with Polish folding ("zywnosc" finds "Żywność"); the current category's radio is checked; a category without subcategories keeps the chevron's space empty (same left offset as one with); the E2E picks a subcategory on a phone and on a desktop with the keyboard only.
- [ ] **Step 2: Run** `pnpm --filter @szop/web test src/lists/items/category-picker`. Expected: FAIL.
- [ ] **Step 3: Implement** to the spec's [Picking a category](../specs/2026-11-06-PH-17-list-items-design.md#picking-a-category) and `category-picker-v3.png`: one bordered box, rows at least 52 px, the chevron's target 44 × 52 px, every level below the top on one muted band indented 20 px per level, the radio circle at the end.
- [ ] **Step 4: Run** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(items): pick an item's category from the tree`.

### Task 8: Checking and the haul

**Files:**
- Create: `apps/web/src/lists/items/haul.tsx`, `haul.test.tsx`, `fit-chips.ts`, `fit-chips.test.ts`, `item-checkbox.tsx`
- Modify: `apps/web/src/lists/items/item-row.tsx` (the checkbox), `apps/web/src/lists/list-page.tsx` (the haul under the add bar; folds while the add bar has the focus), `e2e/tests/items.spec.ts`

**Interfaces:**
- Consumes: `haulItems`, `lineTotal`, `formatPrice`, `formatQuantity` (Task 1); `useUpdateItem` (Task 4); `AddBar`'s `onFocusChange` (Task 5).
- Produces: `ItemCheckbox({ listId, item })`: a checkbox named after the item, sending `checked: true` or `false`. `fitChips(widths: readonly number[], available: number, moreWidth: number, gap: number): number`: how many chips fit in one row, leaving room for "+N more" when not all fit. `Haul({ listId, items, folded }: { listId: string; items: ListItem[]; folded: boolean })`: hidden when the list has no items; collapsed with the handle, "The haul", "*k* of *n* items", the progress bar (`role="progressbar"` with `aria-valuenow` and `aria-valuemax`), the chips (measured with a `ResizeObserver` and `fitChips`); `folded` shows only "The haul · *k* of *n* items"; the drawer (Base UI Drawer, 75% of the height, a dialog named "The haul").

- [ ] **Step 1: Write the failing tests:**
  - `fit-chips.test.ts`: all fit → all, no "+N more"; one too many → leaves room for "+N more"; none fit → 0.
  - `haul.test.tsx`: `"ITM-7.1: checking moves the item to the haul"` (out of its card, its chip first); `"ORD-1.3: the chips are newest first"`; `"ORD-1.4: a chip puts its item back"` (`checked: false`, named "Put Bananas back"); a chip shows the name and line total, or the name alone; "Check items off to drop them here" before any check; `"ORD-1.5: the header counts k of n items"`; `"ORD-1.6: the header and +N more open the drawer, Esc closes it"`; `"ORD-1.7: the drawer's ↶ puts an item back"`; `"ORD-1.8: with the add bar focused the haul folds to one line"`; `"ORD-1.10: …"` the names of chips, "+N more", the dialog and the progress bar; `"ORD-2.5: the drawer lists newest first"`; `"ORD-1.2: a card disappears when its last item is checked"`; `"ORD-1.9: …"` "Check items off to drop them here" before any check.
  - `e2e/tests/items.spec.ts`: check two items, put one back from a chip and one from the drawer opened by dragging the handle up; on a desktop the haul and the drawer stay within the 720 px column (`"ORD-1.11: …"`).
- [ ] **Step 2: Run** `pnpm --filter @szop/web test src/lists/items`. Expected: FAIL.
- [ ] **Step 3: Implement** to the spec's [Checking and the haul](../specs/2026-11-06-PH-17-list-items-design.md#checking-and-the-haul) and `haul-ph17.png`, without sums and "Put all back"; the move into the haul in 150 to 200 ms under `motion-safe:` (ORD-1.1); chips cut with "…" at about 12 characters (`max-w-[12ch] truncate`).
- [ ] **Step 4: Run** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ordering): check items into the haul and put them back`.

### Task 9: The sort setting and the checkboxes' side

**Files:**
- Create: `apps/web/src/shell/checkbox-side.ts`, `checkbox-side.test.ts`, `checkbox-side-control.tsx`, `checkbox-side-control.test.tsx`
- Modify: `apps/web/src/components/ui/dropdown-menu.tsx` (adds `DropdownMenuCheckboxItem` and `DropdownMenuSeparator` on Base UI Menu), `apps/web/src/lists/list-page.tsx` (the menu's first item), `apps/web/src/shell/menu.tsx` (the control under Color scheme), `item-row.tsx` and `haul.tsx` (follow the side), `e2e/tests/items.spec.ts`
- Docs: `docs/architecture/architecture.md` (the device's second setting), ADR 0071's "Settled while building" if anything is decided

**Interfaces:**
- Consumes: `useSortByCategory` (Task 4).
- Produces, in `checkbox-side.ts`, after `color-scheme.ts`: `type CheckboxSide = "left" | "right"`, `checkboxSideKey = "szop-checkbox-side"`, `readCheckboxSide(): CheckboxSide` (Right unless "left" is stored; this visit's choice when the storage throws), `storeCheckboxSide(side: CheckboxSide): void` (Right removes the key), and `useCheckboxSide(): CheckboxSide` through `useSyncExternalStore`, so a change in the menu re-lays every row and the drawer at once. `CheckboxSideControl()`: the radio group "Checkboxes" with Left and Right, each with a small picture of a row, styled as `ColorSchemeControl`.

- [ ] **Step 1: Write the failing tests:** `"ORD-5.1: Sort by category is the menu's first item, a check item"`; `"ORD-5.2: switching it re-orders the list at once and closes the menu"`; `"ORD-5.3: checked items go to the haul either way"`; `"ORD-5.4: …"` the setting is sent to the server; `"APR-2.1: the checkboxes are on the right by default"`; `"APR-2.2: Left moves the checkbox and ↶ to the left"`; `"APR-2.3: the choice is kept on the device and holds when the storage throws"`; the E2E switches the sort off and on and reloads to see it kept, and switches the checkboxes' side.
- [ ] **Step 2: Run** `pnpm --filter @szop/web test src/shell src/lists`. Expected: FAIL.
- [ ] **Step 3: Implement** to the spec's [The sort setting](../specs/2026-11-06-PH-17-list-items-design.md#the-sort-setting) and [The checkboxes' side](../specs/2026-11-06-PH-17-list-items-design.md#the-checkboxes-side), `sort-setting-v2.png` and `checkbox-side.png`.
- [ ] **Step 4: Run** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ordering): add the sort setting and the checkboxes' side`.

### Task 10: The blink behind ✕

**Files:**
- Modify: `apps/web/src/lists/lists-page.tsx` (or `components/ui/button.tsx` if the cause is there), `e2e/tests/lists.spec.ts`

- [ ] **Step 1: Find the cause** with `superpowers:systematic-debugging`: open the lists page in the Chrome DevTools MCP browser, start Select and record the ✕ button's computed `background-color` and `border-color` frame by frame (a performance trace or `requestAnimationFrame` sampling). Likely suspects: the ghost button's `transition-all` animating from a hover or focus look, the focus moving to ✕, or the pointer still over ✕'s place.
- [ ] **Step 2: Write the failing E2E** `"#397: ✕ shows no background when Select starts"` in `lists.spec.ts`: after clicking Select, sample ✕'s computed background in the first frames; it is transparent throughout. Run `pnpm test:e2e`. Expected: FAIL.
- [ ] **Step 3: Fix** the cause found, in the selection controls only unless the cause is the shared button.
- [ ] **Step 4: Run** `pnpm check` and `pnpm test:e2e`. Expected: PASS. Check by eye on a phone-sized and a desktop-sized window, light and dark.
- [ ] **Step 5: Commit** `fix(lists): show no background behind ✕ when Select starts`.

### Task 11: The journey and the built screens

**Files:**
- Modify: `e2e/tests/items.spec.ts`, `e2e/prodlike/screens.spec.ts` (if the screens' shots are taken there), `docs/architecture/visual-design.md`, `docs/architecture/visual-design/` (the built screens), `docs/glossary.md` (only if a new term appeared)

- [ ] **Step 1: Write the journey** of the spec's [Tests](../specs/2026-11-06-PH-17-list-items-design.md#tests), E2E item, on a phone-sized and a desktop-sized window, joining the earlier tasks' pieces into one test: add three, edit one's quantity, price and category, check two, put one back from a chip and one from the drawer, remove one and undo, sort off and on, reload and see it all kept. Add the axe check (`e2e/support/accessibility.ts`) of the list screen, the edit sheet, the picker and the open drawer.
- [ ] **Step 2: Run** `pnpm test:e2e`. Expected: PASS (it builds on what Tasks 5 to 9 made; a failure is a bug to fix here).
- [ ] **Step 3: Update** `visual-design.md` to the spec's [Documentation](../specs/2026-11-06-PH-17-list-items-design.md#documentation): the row right and left, the edit sheet, the picker, the toast, the sort setting, the haul without sums until PH-21, each with a screenshot of the built screen taken with the Chrome DevTools MCP browser, light and dark, into `docs/architecture/visual-design/`.
- [ ] **Step 4: Run** `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit** `test(e2e): add the list items journey and the built screens`.

### Task 12: The mutation run

**Files:**
- Modify: tests, and `// Stryker disable next-line <Mutator>: <reason>` comments, where the run calls for them

- [ ] **Step 1: Run** `pnpm test:mutation --mutate` over `packages/shared/src/{items,amounts,item-order,lists}.ts`, `apps/api/src/items/*.ts` (not the tests), `apps/api/src/lists/{routes,repository}.ts`, `apps/web/src/lists/use-items.ts`, `apps/web/src/lists/items/{item-form,fit-chips}.ts`, `apps/web/src/shell/{toasts.tsx,checkbox-side.ts}`.
- [ ] **Step 2: Kill or accept** each survivor without stopping (the experiment's rule 3): a test that kills it, or a disable comment with the reason, as the existing comments do. Write every accepted one, with its reason, into the ledger's `## Findings` table as a Minor finding of source "Mutation run", so `/finish-phase` shows them to the owner.
- [ ] **Step 3: Run** `pnpm check`. Expected: PASS.
- [ ] **Step 4: Commit** `test(items): kill or accept the PH-17 mutants`.
