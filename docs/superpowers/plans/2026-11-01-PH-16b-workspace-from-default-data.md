# PH-16b Workspace from the default data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementers:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md) before your task.

**Goal:** A guest's first change creates their workspace as a copy of the default units, categories and products, with IDs that are UUIDv5 of the names, and the catalog page then shows that copy.

**Architecture:** `parseSeed` gives every entry a name-based UUIDv5. One migration adds `units`, `categories` and `products`, keyed `(workspace_id, id)` with composite foreign keys. `ownWorkspace` copies the startup `Catalog` into those tables when its insert created the workspace, in the caller's transaction. `GET /api/catalog` reads the visitor's workspace when there is one. Repositories take a `WorkspaceContext`, and a schema test over `pg_constraint` keeps every workspace-owned table on the pattern.

**Tech Stack:** Drizzle ORM + drizzle-kit, PostgreSQL 18, Fastify 5 with `fastify-type-provider-zod`, Better Auth, Vitest, `node:crypto`.

**Spec:** [`docs/superpowers/specs/2026-11-01-PH-16b-workspace-from-default-data-design.md`](../specs/2026-11-01-PH-16b-workspace-from-default-data-design.md); decisions in [ADR 0060](../../decisions/0060-workspace-from-default-data-phase-details.md). The criteria are in the spec's [Acceptance criteria](../specs/2026-11-01-PH-16b-workspace-from-default-data-design.md#acceptance-criteria), the docs to update in its [Documentation](../specs/2026-11-01-PH-16b-workspace-from-default-data-design.md#documentation); each task below names the docs it updates.

## Order of work

1. [Task 1: The database tests under load](#task-1-the-database-tests-under-load)
2. [Task 2: The default data's IDs](#task-2-the-default-datas-ids)
3. [Task 3: The catalog tables and the schema test](#task-3-the-catalog-tables-and-the-schema-test)
4. [Task 4: The copy at the first change](#task-4-the-copy-at-the-first-change)
5. [Task 5: Repositories take the context](#task-5-repositories-take-the-context)
6. [Task 6: The catalog route reads the workspace](#task-6-the-catalog-route-reads-the-workspace)
7. [Task 7: The mutation run](#task-7-the-mutation-run)

## Global Constraints

- The branch is `feat/ph-16b-workspace-from-default-data`. Scopes: `api`, `docs`.
- The SPA, `@szop/shared`'s schemas and the E2E journeys do not change; `e2e/tests/catalog.spec.ts` and `lists.spec.ts` keep passing.
- Table conventions are those of [ADR 0057](../../decisions/0057-guests-first-list-phase-details.md), decision 14 and [ADR 0060](../../decisions/0060-workspace-from-default-data-phase-details.md), decision 3. Constraint names follow PostgreSQL's style (`products_workspace_id_category_id_fkey`), and a name over 63 characters is shortened by hand, keeping the table and the column.
- The migration is generated (`pnpm --filter @szop/api db:generate`), and the migration check (`db:generate` writes nothing) stays green.
- The 404 for a missing list and for a foreign list stays byte-identical. `GET /api/catalog` without a session sets no cookie ([ACC-1](../../requirements/ACC-accounts-and-guest-mode.md#acc-1).3).
- A test covering a criterion starts with its ID: `it("ACC-1.4: …")`.
- `pnpm check` passes after every task; `pnpm test:e2e` after Tasks 2 and 6.

## Review Focus

1. **The seed's names with odd casing or spaces** (`" Milk "`, `MILK`). Expected: the ID is computed from the trimmed, lower-cased name, the same way the duplicate check compares names, so `Milk` and `milk` get one ID. Task 2 tests it.
2. **A first change that fails after the copy**, such as an invalid list body passing validation but a constraint failing. Expected: no workspace and no catalog rows are left behind. Task 4 tests a failing copy, and the rollback covers both cases.
3. **A user whose workspace exists but whose copy is empty**, for example a workspace made before this phase on the demo database. Expected: `GET /api/catalog` returns an empty catalog. It does not fall back to the seed, because a fallback would show IDs that the workspace does not hold. Task 6 tests it. The demo database is destroyed at `demo-down`, so no backfill is needed.
4. **Two first `POST /api/lists` requests from one user at once.** Expected: one workspace, one copy and both lists. Task 4 tests it.
5. **`GET /api/catalog` with a session cookie that has expired.** Expected: the seed comes back and the request does not fail with a 401. Task 6 tests it.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/catalog/seed.ts` | `parseSeed` with UUIDv5 IDs; the three namespaces; `uuidv5` |
| `apps/api/src/catalog/repository.ts` (new) | `insertCatalog`, `readCatalog`, both taking a `WorkspaceContext` |
| `apps/api/src/catalog/routes.ts` | Seed or workspace catalog |
| `apps/api/src/db/schema.ts`, `apps/api/drizzle/0002_*.sql` (new) | `units`, `categories`, `products` |
| `apps/api/src/db/schema.test.ts` | The workspace-ownership test and the cross-workspace refusals |
| `apps/api/src/access/workspace.ts` | `ownWorkspace` copies; `requireListAccess` returns the list too |
| `apps/api/src/lists/repository.ts`, `routes.ts` | Repositories take the context; `GET /lists/:id` reads once |
| `apps/api/src/app.ts` | Passes `catalog` and `auth` where the routes need them |
| `apps/api/src/test/catalog.ts` | `testCatalog` with UUIDs |
| `apps/api/src/test/workspaces.ts` (new) | The two-workspace helper |
| `apps/api/src/db/{setup-role,migration-check,migration-lock}.test.ts`, `apps/api/vitest.config.ts` | Whatever the fix for #317 needs |

### Task 1: The database tests under load

**Files:**
- Modify: whatever the cause needs. The likely files are the three test files in `apps/api/src/db/` that run `CREATE DATABASE`, their shared helper (if one is made), and `apps/api/vitest.config.ts`.
- Docs: `docs/development/testing.md` (only if a rule for writing database tests changes)

**Interfaces:**
- Produces: nothing other tasks call.

- [x] **Step 1: Reproduce** [#317](https://github.com/luiki-dev/szop/issues/317). With `pnpm db:up`, load the machine (for example `stress --cpu <cores>`, or a second `pnpm test` running in parallel) and run `pnpm --filter @szop/api test -- setup-role migration-check migration-lock` several times. Record how many runs fail and in which hook. If nothing fails after about 10 loaded runs, record that, and use the timing of `CREATE DATABASE` and `DROP DATABASE … WITH (FORCE)` under load as the signal.
- [x] **Step 2: Find the cause.** Time each statement of the failing hooks (`performance.now()` around them, temporarily). Check `pg_stat_activity` for connections left open by these tests when a hook starts. Look at how many Vitest workers run these files at once. Name the cause from the spec's suspects (the hook timeout, PostgreSQL's speed at creating databases with many workers, connections left open) or another one the evidence shows.
- [x] **Step 3: Fix the cause** at its root, and remove the temporary timing. A longer `hookTimeout` alone is not a fix ([spec](../specs/2026-11-01-PH-16b-workspace-from-default-data-design.md#the-database-tests-under-load)).
- [x] **Step 4: Run** Step 1's loaded runs again. Expected: no `Hook timed out` in 10 runs. Then run `pnpm check`. Expected: PASS.
- [x] **Step 5:** Write the cause, the evidence and the fix in the ledger and in the task summary for the owner (the PR description takes them from there); update `testing.md` if a rule changed. **Commit** `fix(api): <the fix> so the database tests survive load`; the PR's description carries `Closes #317`.

### Task 2: The default data's IDs

**Files:**
- Modify: `apps/api/src/catalog/seed.ts`, `seed.test.ts`, `seed.yaml` (its header comment), `apps/api/src/test/catalog.ts`, any test asserting on `testCatalog`'s old IDs
- Docs: `docs/glossary.md` (UUIDv5), `docs/architecture/stack-overview.md` (UUIDv5, next to UUIDv7), `docs/architecture/architecture.md` (the default data's IDs)

**Interfaces:**
- Produces:
  - `seed.ts`: `export function uuidv5(name: string, namespace: string): string`, a lower-case, hyphenated version 5 UUID, using SHA-1 from `node:crypto` (RFC 9562); `export const seedNamespaces = { units, categories, products }`, three fixed UUIDs chosen once; `parseSeed` keeps its signature, and each entry's `id` is `uuidv5(lower(name.trim()), seedNamespaces.<kind>)`.
  - `testCatalog`: the same shape and names as today, with fixed UUIDs as IDs (any valid UUIDs written as literals), and `parentId`, `categoryId` and `unitId` pointing at them. It keeps one product whose unit is `null` and whose category is `null`.

- [ ] **Step 1: Write the failing tests** in `seed.test.ts`:
  - `uuidv5` matches RFC 9562's example: name `"www.example.com"` in the DNS namespace `6ba7b810-9dad-11d1-80b4-00c04fd430c8` gives `2ed6657d-e927-568b-95e1-2665a8aea6a2`;
  - every ID from `parseSeed(<the real seed.yaml>)` matches `/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`;
  - two parses of the same text give equal catalogs. A product named `Milk` in one seed and `milk` in another gets the same ID, and so does `" Milk "` (Review Focus 1). A category and a product both named `Milk` get different IDs;
  - adding an entry before another leaves the other's ID unchanged;
  - `parentId`, `categoryId` and `unitId` equal the IDs of the entries they name;
  - known values: the IDs of the unit `pcs`, of one top-level category and of one product of the real `seed.yaml`, written as literals. They replace today's `["u1", "u2"]`, `"c1"` and `["p1", "p2"]` assertions.
- [ ] **Step 2: Run** `pnpm --filter @szop/api test -- seed`. Expected: FAIL.
- [ ] **Step 3: Implement** `uuidv5` and `seedNamespaces`, and use them in `parseSeed` in place of the counters. Rewrite the comment at the top of `seed.ts` and the one in `seed.yaml` that say the seed has no IDs and is never put in tables. Give `testCatalog` UUIDs, and fix the tests that assert on its old IDs.
- [ ] **Step 4: Run** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5:** Update the docs listed above. **Commit** `feat(api): give the default data UUIDv5 IDs from their names`.

### Task 3: The catalog tables and the schema test

**Files:**
- Modify: `apps/api/src/db/schema.ts`, `apps/api/src/db/schema.test.ts`
- Create: `apps/api/drizzle/0002_*.sql` and its `meta/` entries (generated)
- Docs: `docs/architecture/architecture.md` (the tables in "Data model highlights"), `docs/architecture/stack-overview.md` (composite foreign keys, `ON DELETE SET NULL (column)`), `docs/development/tools/drizzle.md` (a hand edit, if one was needed), `docs/architecture/threat-model.md` (the schema test as a guard)

**Interfaces:**
- Produces: Drizzle tables `units`, `categories` and `products` exported from `schema.ts`, with the columns and constraints of the spec's [The tables](../specs/2026-11-01-PH-16b-workspace-from-default-data-design.md#the-tables). Their fields are `workspaceId`, `id`, `name`, `parentId`, `position`, `categoryId`, `unitId`, `createdAt` and `updatedAt`.

- [ ] **Step 1: Check Drizzle** (context7, the installed `drizzle-orm` version) for `ON DELETE SET NULL (column)` on a composite `foreignKey()`. If it can be expressed, use it. If not, the generated SQL is edited by hand only if `db:generate` then still writes nothing. If no way keeps the migration check green, stop and report to the owner ([spec, Risks](../specs/2026-11-01-PH-16b-workspace-from-default-data-design.md#risks)).
- [ ] **Step 2: Write the failing tests** in `schema.test.ts`:
  - the table list in the existing `created_at`/`updated_at` test gains `categories`, `products` and `units`;
  - **workspace-owned tables:** from `information_schema.columns` and `pg_constraint`, every public table with a `workspace_id` has it `NOT NULL`, has a foreign key from it to `workspaces (id)`, and has a primary key or unique key whose first two columns are `(workspace_id, id)`. The tables without `workspace_id` equal exactly `["accounts", "sessions", "users", "verifications", "workspaces"]`;
  - **references stay in the workspace:** every foreign key whose target table has a `workspace_id` includes `workspace_id` on both sides (`conkey` and `confkey` both contain it);
  - the database refuses, with error code `23503`, a product in workspace A whose `category_id` exists only in B, and the same for a category's `parent_id` and a product's `unit_id`;
  - deleting a category deletes its subcategories and sets `category_id` to `NULL` on its products while `workspace_id` stays. Deleting a unit sets `unit_id` to `NULL`. Deleting a workspace deletes its rows in all three tables;
  - a `name` of `""` or 101 characters, and a `position` of `-1`, are refused with error code `23514`.
- [ ] **Step 3: Run** `pnpm --filter @szop/api test -- schema`. Expected: FAIL.
- [ ] **Step 4: Implement** the three tables in `schema.ts` following `lists`, then `pnpm --filter @szop/api db:generate`. Apply Step 1's outcome.
- [ ] **Step 5: Run** `pnpm check`. Expected: PASS, the migration check included.
- [ ] **Step 6:** Update the docs listed above. **Commit** `feat(api): add the workspace's units, categories and products tables`.

### Task 4: The copy at the first change

**Files:**
- Create: `apps/api/src/catalog/repository.ts`, `apps/api/src/catalog/repository.test.ts`
- Modify: `apps/api/src/access/workspace.ts`, `access/workspace.test.ts`, `apps/api/src/lists/routes.ts`, `lists/routes.test.ts`, `apps/api/src/app.ts`
- Docs: `docs/architecture/architecture.md` (the workspace created with a copy of the seed)

**Interfaces:**
- Consumes: the tables (Task 3); `testCatalog` with UUIDs (Task 2).
- Produces:
  - `catalog/repository.ts`: `insertCatalog(db: Executor, context: WorkspaceContext, catalog: Catalog): Promise<void>`, which does three multi-row inserts (units, then categories, then products) and skips an empty array.
  - `access/workspace.ts`: `ownWorkspace(db: Executor, user: SessionUser | null, catalog: Catalog): Promise<WorkspaceContext>`. Its insert of the workspace becomes `ON CONFLICT (user_id) DO NOTHING RETURNING id`; when a row comes back it calls `insertCatalog`. Its comment says it must run inside a transaction when it may create the workspace.
  - `listsRoutes(app, { db, auth, catalog })`; `app.ts` passes `catalog` to it.

- [ ] **Step 1: Write the failing tests** (the copy tests in `lists/routes.test.ts`; the `ownWorkspace` unit tests in `access/workspace.test.ts`, updated to pass `testCatalog`):
  - `ACC-1.4`: a new guest's first `POST /api/lists` → 201. Their workspace holds the list, and its `units`, `categories` and `products` rows, mapped to `Catalog`'s shape and sorted by `id`, equal `testCatalog`'s arrays sorted the same way;
  - `UNT-1.1`: an app built with `loadSeed()`; after the first `POST`, the workspace's unit names include `pcs`, `kg`, `g`, `l`, `ml` and `pack`;
  - `ACC-1.6`: two concurrent first `POST`s of one guest (`Promise.all`, different list IDs) → both 201, one `workspaces` row, `count(*)` of each table equal to `testCatalog`'s length for it, and both lists in that workspace (Review Focus 4);
  - a failed copy: an app built with a `Catalog` whose product's `unitId` is a UUID that is not in its units. The first `POST` → 500, and afterwards there are no `workspaces`, `lists`, `units`, `categories` or `products` rows (Review Focus 2);
  - a second `POST` by the same guest copies nothing: the row counts are unchanged.
- [ ] **Step 2: Run** `pnpm --filter @szop/api test -- lists workspace`. Expected: FAIL.
- [ ] **Step 3: Implement** `insertCatalog`, the new `ownWorkspace`, and the `catalog` option of `listsRoutes` and `app.ts`.
- [ ] **Step 4: Run** `pnpm check`. Expected: PASS.
- [ ] **Step 5:** Update the docs listed above. **Commit** `feat(api): copy the default data into a new workspace`.

### Task 5: Repositories take the context

**Files:**
- Create: `apps/api/src/test/workspaces.ts`, `apps/api/src/lists/repository.test.ts`
- Modify: `apps/api/src/lists/repository.ts`, `lists/routes.ts`, `apps/api/src/access/workspace.ts`, `access/workspace.test.ts`, `lists/routes.test.ts`
- Docs: `docs/architecture/architecture.md` (repositories taking the context), `docs/development/testing.md` (the two-workspace helper)

**Interfaces:**
- Consumes: `ownWorkspace` with `catalog` (Task 4); `signIn`, `sameOrigin` (`test/auth.ts`).
- Produces:
  - `lists/repository.ts`: `listLists(db, context: WorkspaceContext)`, `findList(db, context, id)`, `insertList(db, context, { id, name })`, `renameList(db, context, id, name)`, with the same results as today.
  - `access/workspace.ts`: `requireListAccess(db, user, listId): Promise<{ context: WorkspaceContext; list: List }>`, which reads the list once and keeps the same 404s.
  - `test/workspaces.ts`: `twoWorkspaces(app: FastifyInstance, db: Database, catalog: Catalog): Promise<[Guest, Guest]>`, where `interface Guest { cookie: string; context: WorkspaceContext; inject(options: InjectOptions): Promise<LightMyRequest.Response> }`. `inject` adds the cookie and `sameOrigin`. Each guest is signed in through `signIn`, and their workspace is made by `ownWorkspace`, so it holds a copy.

- [ ] **Step 1: Write the failing tests:**
  - `lists/repository.test.ts`: `// @ts-expect-error` on `listLists(db, "00000000-0000-4000-8000-000000000001")`, plus one real call with a context, so the file is type-checked and runs;
  - `lists/routes.test.ts`: `GET /api/lists/:id` sends one query that reads `lists`. Count with a spy on the pool's `query` (`vi.spyOn(database.db.$client, "query")`) and filter the statements on `from "lists"`. The `NFR-4.10` tests still pass unchanged; one of them uses `twoWorkspaces`;
  - `access/workspace.test.ts`: `requireListAccess` resolves to `{ context, list }`, where `list` equals the stored one.
- [ ] **Step 2: Run** `pnpm --filter @szop/api test -- lists workspace` and `pnpm typecheck`. Expected: FAIL (the `@ts-expect-error` is unused, and the counts are wrong).
- [ ] **Step 3: Implement** the signatures. The routes use `requireListAccess`'s `list` for `GET /lists/:id`. `PATCH` keeps its rename and takes the context.
- [ ] **Step 4: Run** `pnpm check`. Expected: PASS.
- [ ] **Step 5:** Update the docs listed above. **Commit** `refactor(api): make repositories take the workspace context`.

### Task 6: The catalog route reads the workspace

**Files:**
- Modify: `apps/api/src/catalog/repository.ts`, `catalog/routes.ts`, `catalog/routes.test.ts`, `apps/api/src/app.ts`
- Docs: `docs/architecture/architecture.md` (`GET /api/catalog` reading the workspace), `docs/architecture/threat-model.md` (the catalog route reads workspace data)

**Interfaces:**
- Consumes: `findOwnWorkspace`, `sessionHook`, `twoWorkspaces` (Task 5); `insertCatalog`'s tables (Task 4).
- Produces:
  - `readCatalog(db: Executor, context: WorkspaceContext): Promise<Catalog>`, which maps the rows to the flat shape.
  - `catalogRoutes(app, { db, auth, catalog })`: the plugin adds `sessionHook(auth)` as its own `preHandler`, like the lists plugin. It answers with `readCatalog` when `findOwnWorkspace(db, request.user)` finds a workspace, and with the seed otherwise.

- [ ] **Step 1: Write the failing tests** in `catalog/routes.test.ts`:
  - without a session, and with a session but no workspace: the body equals the app's catalog and there is no `Set-Cookie` without a session (`ACC-1.3`, kept);
  - a cookie for a session whose row was deleted: 200 with the seed (Review Focus 5);
  - with a workspace: after `UPDATE products SET name = 'Renamed'` in guest A's workspace, A's catalog shows `Renamed` and B's does not (`twoWorkspaces`);
  - a workspace with its catalog rows deleted: `{ units: [], categories: [], products: [] }` (Review Focus 3);
  - `ACC-1.9`: two `buildApp` instances on `database.db`, one with seed A (`testCatalog`) and one with seed B (A plus one product, and with one product renamed, so it gets a new UUID). Guest 1 signs in to the first app and makes a list, and guest 2 does the same in the second. Through the second app, guest 1's catalog equals A and guest 2's equals B. Compare sorted arrays.
- [ ] **Step 2: Run** `pnpm --filter @szop/api test -- catalog`. Expected: FAIL.
- [ ] **Step 3: Implement** `readCatalog` and the route, and pass `db` and `auth` to `catalogRoutes` in `app.ts`.
- [ ] **Step 4: Run** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5:** Update the docs listed above. **Commit** `feat(api): serve a workspace's own catalog`.

### Task 7: The mutation run

**Files:**
- Modify: whatever the owner's decisions touch (tests, `// Stryker disable next-line <Mutator>: <reason>` comments)

- [ ] **Step 1: Run** `pnpm db:up`, then `pnpm test:mutation --mutate` over `apps/api/src/catalog/{seed,repository,routes}.ts`, `apps/api/src/access/workspace.ts` and `apps/api/src/lists/{repository,routes}.ts`, plus any non-test file that Task 1 changed.
- [ ] **Step 2:** List the survivors for the owner, grouped by file, each with a proposal: a test that kills it, or an accepted reason. Stop and wait for the owner's decisions.
- [ ] **Step 3:** Apply the decisions, and rerun the mutation run on the touched files. Expected: every survivor is killed or carries its reason ([definition of done](../../development/definition-of-done.md), item 2).
- [ ] **Step 4: Run** `pnpm check`. Expected: PASS. **Commit** `test(api): kill or accept the PH-16b mutation survivors`.
