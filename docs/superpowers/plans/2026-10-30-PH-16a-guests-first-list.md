# PH-16a Guest's first list Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementers:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md) before your task.

**Goal:** A visitor creates their first list, which gives them an anonymous Better Auth session and an empty workspace; they see their lists on the home screen, newest first, open one and rename it, and nobody else can reach them.

**Architecture:** One Drizzle migration adds Better Auth's four tables (generated once by its CLI, then ours), `workspaces` and `lists`. Better Auth is mounted on Fastify at `/api/auth/*`; a `preHandler` on the lists routes puts the session's user on the request, and the access layer (`findOwnWorkspace`, `ownWorkspace`, `requireListAccess`) turns it into a workspace context that the list repository requires. The SPA gets a lists page at `/`, a new-list screen and a list screen; its writes go through one function that makes sure a session exists first.

**Tech Stack:** Better Auth (anonymous plugin, Drizzle adapter), Drizzle ORM + drizzle-kit, PostgreSQL 18 (`uuidv7()`), Fastify 5 with `fastify-type-provider-zod`, Zod 4, React 19, React Router 8, TanStack Query 5, Base UI, Tailwind CSS 4, Vitest + Testing Library + MSW, Playwright + axe, Terraform.

**Spec:** [`docs/superpowers/specs/2026-10-30-PH-16a-guests-first-list-design.md`](../specs/2026-10-30-PH-16a-guests-first-list-design.md); decisions in [ADR 0057](../../decisions/0057-guests-first-list-phase-details.md). The criteria are in the spec's [Acceptance criteria](../specs/2026-10-30-PH-16a-guests-first-list-design.md#acceptance-criteria), the docs to update in its [Documentation](../specs/2026-10-30-PH-16a-guests-first-list-design.md#documentation); each task below names the docs it updates.

## Order of work

1. [Task 1: The data model and the migration check](#task-1-the-data-model-and-the-migration-check)
2. [Task 2: Better Auth and the session](#task-2-better-auth-and-the-session)
3. [Task 3: The lists API and the access layer](#task-3-the-lists-api-and-the-access-layer)
4. [Task 4: The lists page and writes from the SPA](#task-4-the-lists-page-and-writes-from-the-spa)
5. [Task 5: The new-list and list screens](#task-5-the-new-list-and-list-screens)
6. [Task 6: The lists journey](#task-6-the-lists-journey)
7. [Task 7: The demo](#task-7-the-demo)
8. [Task 8: The mutation run](#task-8-the-mutation-run)

## Global Constraints

- The branch is `feat/ph-16a-guests-first-list`. Scopes: `api`, `web`, `shared`, `e2e`, `ci`, `infra`, `docs`.
- Table conventions ([ADR 0057](../../decisions/0057-guests-first-list-phase-details.md), decision 14): tables plural `snake_case`, columns `snake_case`, fields `camelCase`; `created_at` and `updated_at` `timestamptz NOT NULL DEFAULT now()` on every table, `updated_at` with Drizzle's `$onUpdate(() => new Date())`; IDs `uuid`, `DEFAULT uuidv7()` where the server creates the row; constraints named explicitly: `<table>_pkey`, `<table>_<columns>_key`, `<table>_<columns>_fkey`.
- Session: `expiresIn` 30 days, `updateAge` 1 day, no `cookieCache`, no `databaseHooks`, anonymous plugin only, `trustedOrigins: [APP_ORIGIN]`, `advanced.database.generateId: "uuid"`. Cookie `HttpOnly`, `SameSite=Lax`, no `Domain`; `Secure` and the `__Host-` (fallback `__Secure-`) prefix only on an `https` origin.
- List names: trimmed, NFC, 1 to 100 Unicode code points (`[...name].length`, not `.length`).
- Answers: `GET /api/lists` → `{ lists: [{ id, name, createdAt }] }`, newest first (`created_at DESC, id DESC`); a missing or foreign list → 404 `not_found`, the same body either way; malformed ID in the path → 404; `POST` without a session → 401 (code `unauthorized`); invalid body → 400 `invalid_input`; create 201, repeated ID in the same workspace 200 with the stored list.
- Reads without a session set no cookie ([ACC-1](../../requirements/ACC-accounts-and-guest-mode.md#acc-1).3). A read with a session forwards Better Auth's `Set-Cookie` (the sliding refresh).
- UI text, exactly: "Lists" (menu entry, page title, tab "Lists · Szop"), the logo's name "Szop, Lists", "New list", "Create your first list", "List name", "Nothing on this list yet", "Rename", "Back to lists" (the ← link's accessible name), "Try again", "The lists could not be loaded.", "This list does not exist.", "Name is too long (at most 100 characters)". A list's tab title is "<name> · Szop".
- The web baseline is never loosened: no CSP change, the cross-site and JSON-only checks run before Better Auth. If Better Auth cannot work behind them, stop and report ([spec, Risks](../specs/2026-10-30-PH-16a-guests-first-list-design.md#risks)).
- Roles only (`bg-card`, `text-muted-foreground`), never raw palette colors; tap targets `min-h-12`; motion only under `motion-safe:`; the first-screen budget (200 KB Brotli) keeps passing, so the SPA talks to Better Auth with plain `fetch`, not `better-auth/client` (the spec leaves this to the builder; record it in ADR 0057's "Settled while building" in Task 4).
- A test covering a criterion starts with its ID: `it("LST-1.1: …")`.
- `pnpm check` and `pnpm test:e2e` pass after every task.

## Review Focus

1. **A guest who only reads for weeks.** Better Auth slides the session in the database on a read, but if the API's hook drops the `Set-Cookie` it returns, the browser's cookie still dies 30 days after sign-in. Expected: a read with 2 days left answers with a `Set-Cookie` whose `Max-Age` is about 30 days. Task 2 tests it.
2. **A stale cookie at the first write** (the session expired or its row was deleted). Expected: the SPA signs in again and the write succeeds; a second 401 after the retry shows the error and stops, never a loop. Task 4 tests both.
3. **Names at the edges:** only spaces, 100 and 101 emoji, "ó" typed decomposed (`o` + U+0301). Expected: spaces → 400 (and refused in the form), 100 emoji accepted, 101 refused on both sides, the decomposed name stored as NFC. Task 3 tests the API, Task 4 the shared schema.
4. **Enter pressed twice on a new list, or again after a failure.** Expected: one list, since every attempt sends the same ID and the field is read-only while saving. Task 5 tests it.
5. **Esc then leaving the title field.** Expected: Esc restores the old name and the blur that follows saves nothing; Enter then blur saves once. Task 5 tests it.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/db/auth-schema.ts` (new) | Better Auth's tables, generated once, then ours |
| `apps/api/src/db/schema.ts` | Re-exports the auth tables; `workspaces`, `lists` |
| `apps/api/drizzle/0001_*.sql`, `meta/` (new) | The phase's one migration |
| `apps/api/src/auth/auth.ts` (new) | `createAuth`, Better Auth's options |
| `apps/api/src/auth/cli.ts` (new) | An `auth` instance for Better Auth's CLI only |
| `apps/api/src/auth/routes.ts` (new) | `/api/auth/*` on Fastify |
| `apps/api/src/auth/session.ts` (new) | `request.user` and the `preHandler` that sets it |
| `apps/api/src/access/workspace.ts` (new) | `findOwnWorkspace`, `ownWorkspace`, `requireListAccess` |
| `apps/api/src/lists/repository.ts`, `lists/routes.ts` (new) | The list repository and the four routes |
| `apps/api/src/test/auth.ts` (new) | `signIn(app)` for API tests |
| `packages/shared/src/lists.ts`, `src/uuid.ts` (new) | List schemas, `uuidv7()` |
| `apps/web/src/api/client.ts` | Lists calls, `withSession` |
| `apps/web/src/lists/` (new) | `lists-page.tsx`, `new-list-page.tsx`, `list-page.tsx`, `list-screen.tsx`, `use-lists.ts` and tests |
| `apps/web/src/brand/raccoon.svg` (new) | The head without its tile, for the empty states |
| `apps/web/src/components/ui/dropdown-menu.tsx` (new) | shadcn's Base UI menu, for ⋮ |
| `apps/web/src/routes.tsx`, `shell/app-shell.tsx`, `shell/menu.tsx` | The routes, the list header, "Lists" |
| `apps/web/src/start/` | Removed |
| `e2e/tests/lists.spec.ts` (new), `shell.spec.ts` | The journey; Start → Lists |
| `.github/workflows/ci.yml` | The migration check |
| `infra/base/app_roles.tf`, `infra/demo/service.tf`, `infra/demo/locals.tf` | The secret on the demo |

---

### Task 1: The data model and the migration check

**Files:**
- Create: `apps/api/src/db/auth-schema.ts`, `apps/api/src/auth/auth.ts`, `apps/api/src/auth/cli.ts`, `apps/api/src/db/schema.test.ts`, `apps/api/drizzle/0001_*.sql` (generated)
- Modify: `apps/api/package.json`, `apps/api/src/db/schema.ts`, `.github/workflows/ci.yml`, `stryker.config.mjs` only if `auth-schema.ts` needs excluding (prefer a `// Stryker disable all:` first line)
- Docs: `docs/development/tools/drizzle.md` (the conventions, the migration check), `docs/development/ci-cd.md`, `docs/development/scripts.md` (`db:generate` also run by CI), `docs/architecture/architecture.md` ("Data model highlights", lazy creation of the workspace), `docs/architecture/stack-overview.md` (UUIDv7, composite primary keys), `docs/glossary.md` (UUIDv7)

**Interfaces:**
- Produces: `createAuth(options: { db: Database; secret: string; origin: string }): Auth` in `auth/auth.ts` (`Auth = ReturnType<typeof betterAuth<…>>`; Task 2 completes the options and mounts it); tables exported from `db/schema.ts`: `users`, `sessions`, `accounts`, `verifications`, `workspaces` (`id`, `userId`, `createdAt`, `updatedAt`), `lists` (`workspaceId`, `id`, `name`, `createdAt`, `updatedAt`).

- [x] **Step 1:** `pnpm --filter @szop/api add better-auth@latest` (caret range; check `allowBuilds` needs nothing). Write `createAuth` with the Global Constraints' options and the Drizzle adapter (`provider: "pg"`, `schema` mapping `user → users`, `session → sessions`, `account → accounts`, `verification → verifications` through `modelName`). `cli.ts` (first line `// Stryker disable all: only Better Auth's CLI loads it`) exports `auth = createAuth({ db: createDatabase(dummy settings), secret: "x".repeat(32), origin: "http://localhost" })`; `createDatabase` opens no connection.
- [x] **Step 2:** Generate `db/auth-schema.ts` with Better Auth's CLI `generate` (Drizzle output) pointed at `cli.ts`. Edit it by hand to the conventions: `uuid` IDs and foreign keys, `.default(sql\`uuidv7()\`)` on IDs, `timestamptz` (`withTimezone: true`) everywhere, `updated_at` with `$onUpdate`, explicit constraint names, the `is_anonymous` column on `users`. A top comment says it was generated, then owned, and how to compare after an upgrade.
- [x] **Step 3:** In `schema.ts`, replace `export {}` with the re-export and the two tables per the spec's [data model](../specs/2026-10-30-PH-16a-guests-first-list-design.md#the-data-model): `workspaces_user_id_key UNIQUE (user_id)`, `workspaces_user_id_fkey … ON DELETE CASCADE`, `lists_pkey (workspace_id, id)`, `lists_workspace_id_fkey … ON DELETE CASCADE`, index `lists_workspace_id_created_at_idx (workspace_id, created_at DESC)`, `name text NOT NULL` plus `CHECK lists_name_check (char_length(name) BETWEEN 1 AND 100)` (the builder's call the spec allows; a second guard costs nothing). `lists.id` has no default: the browser sends it.
- [x] **Step 4: Write the failing test** `db/schema.test.ts` with `useTestDatabase()`, querying `information_schema` / `pg_constraint`: every table in `public` has `created_at` and `updated_at` as `timestamp with time zone` not null; `lists_pkey` covers `(workspace_id, id)` in that order; `workspaces_user_id_key` exists; deleting a `users` row deletes its workspace and lists (insert one of each with raw SQL first); `uuidv7()` is the default of `workspaces.id` and `users.id`.
- [x] **Step 5: Run** `pnpm test -- schema`. Expected: FAIL (no tables).
- [x] **Step 6:** `pnpm --filter @szop/api db:generate`. Expected: one new `drizzle/0001_*.sql` and its snapshot; read the SQL and check the names and defaults match Step 3. Then `pnpm test -- schema`. Expected: PASS. A developer database that ran an earlier draft of this migration needs `pnpm db:reset`.
- [x] **Step 7: The migration check** in the `lint` job of `ci.yml`, after the format check, its own step with `if: success() || failure()` like the format check:

```yaml
      # A schema change without its migration fails here (OP-076).
      - if: success() || failure()
        run: |
          pnpm --filter @szop/api db:generate
          if [ -n "$(git status --porcelain apps/api/drizzle)" ]; then
            git status --porcelain apps/api/drizzle
            echo "::error::The schema and the migrations differ: run pnpm db:generate and commit the migration."
            exit 1
          fi
```

The change detection already counts every non-Markdown file as code, so `apps/api/src/db/` and `apps/api/drizzle/` are covered: say so in `ci-cd.md`. Check locally: run the step's commands → nothing listed; add a column to `lists`, run them → the error; undo.
- [x] **Step 8:** Docs listed above. **Run** `pnpm check`. Expected: PASS.
- [x] **Step 9: Commit** `feat(api): add the auth, workspace and list tables and the migration check`.

### Task 2: Better Auth and the session

**Files:**
- Create: `apps/api/src/auth/routes.ts`, `auth/routes.test.ts`, `auth/session.ts`, `auth/session.test.ts`, `apps/api/src/test/auth.ts`, `packages/shared/src/uuid.ts`, `uuid.test.ts`
- Modify: `apps/api/src/auth/auth.ts`, `apps/api/src/config.ts`, `config.test.ts`, `apps/api/src/app.ts`, `apps/api/src/test/config.ts`, `apps/api/.env.example`, `compose.yaml`, `e2e/start-server.ts`, `packages/shared/src/index.ts`
- Docs: `docs/development/tools/better-auth.md` (new: what, why, the configuration explained, regenerating `auth-schema.ts` after an upgrade with `cli.ts`), `docs/architecture/stack-overview.md` (Better Auth, anonymous sessions), `docs/architecture/threat-model.md` (the session cookie and anonymous sign-in as entry points), `docs/architecture/architecture.md` (the session's lifetime and storage), `docs/development/setup.md` (the two variables, with the "An `.env` copied before…" paragraph), `docs/development/testing.md` (testing the session by moving `expires_at`), `docs/glossary.md` (anonymous session, sliding expiration)

**Interfaces:**
- Consumes: `createAuth` and the tables from Task 1.
- Produces:
  - `Config` gains `betterAuthSecret: string` (env `BETTER_AUTH_SECRET`, at least 32 characters) and `appOrigin: string` (env `APP_ORIGIN`, an `http`/`https` origin with no path, normalized through `new URL(…).origin`).
  - `authRoutes(app, { auth })` plugin; `buildApp` creates `auth` from `config` and `db` (`AppDeps` unchanged) and registers it after the web baseline.
  - `auth/session.ts`: `interface SessionUser { id: string }`; `declare module "fastify" { interface FastifyRequest { user: SessionUser | null } }`; `sessionHook(auth: Auth): preHandlerAsyncHookHandler`. Task 3 adds it to the lists routes' scope.
  - `test/auth.ts`: `signIn(app: FastifyInstance): Promise<string>` returns the `cookie` header value for later `inject` calls; `sameOrigin` headers constant (`sec-fetch-site: same-origin`, `origin: testConfig().appOrigin`, `content-type: application/json`).
  - `@szop/shared`: `uuidv7(now?: number): string`.

- [x] **Step 1: Write the failing tests:**
  - `config.test.ts`: `BETTER_AUTH_SECRET` of 31 characters → `Invalid configuration` naming it, never its value; `APP_ORIGIN` with a path, with `ftp:`, or missing → refused; `https://szop.dzwoniec.com/` → `appOrigin` `https://szop.dzwoniec.com`.
  - `uuid.test.ts`: matches `/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`; its first 12 hex digits are `now` in hex; two IDs with later `now` sort after earlier ones as strings; 1,000 calls give 1,000 different IDs.
  - `auth/routes.test.ts`: `POST /api/auth/sign-in/anonymous` with `sameOrigin` and body `{}` → 200 and a session cookie; a `users` row with `is_anonymous` true and a `uuid` ID starting with a version-7 nibble; no `workspaces` row ([ADR 0057](../../decisions/0057-guests-first-list-phase-details.md), decision 13). Without `sec-fetch-site` and origin → 403 `forbidden_cross_site`; with `content-type: text/plain` → 415.
  - `NFR-4.9` in `auth/routes.test.ts`, with `testConfig({ appOrigin: "https://szop.test" })`: the cookie's name starts with `__Host-` (or `__Secure-`, see Step 3), and it has `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`. With the default `http` origin: no `Secure`, no prefix.
  - `auth/session.test.ts`, on a throwaway route `GET /api/whoami` registered in a test scope with `sessionHook` and answering `{ user: request.user }`: no cookie → `null` and no `Set-Cookie` (`ACC-1.3`); after `signIn` → the user's ID; `ACC-1.7`: the session row's `expires_at` is 30 days ahead (± 1 minute); with `expires_at` set to now + 2 days, a request moves it back to 30 days **and** answers a `Set-Cookie` whose `Max-Age` is about 30 days (Review Focus 1); with `expires_at` in the past → `null`; with the session row deleted → `null` (`NFR-4.9`, revoked at once).
- [x] **Step 2: Run** `pnpm test -- config uuid auth`. Expected: FAIL.
- [x] **Step 3: Implement.** `config.ts` and `testConfig` (`betterAuthSecret: "test-secret-".padEnd(32, "x")`, `appOrigin: "http://localhost"`). `createAuth` gets `baseURL: origin`, `secret`, `trustedOrigins`, the session options, `advanced.useSecureCookies` from the scheme, and the prefix: try `__Host-` through Better Auth's cookie options; if it only yields `__Secure-`, keep that and record it in ADR 0057's "Settled while building". `generateId: "uuid"`: if Better Auth sends its own v4 ID instead of leaving it to the database, pass `generateId: () => uuidv7()` (spec) and record it there. `uuidv7` in `shared/uuid.ts`: 48-bit milliseconds, then `crypto.getRandomValues`, version and variant bits set, no dependency. `routes.ts` follows Better Auth's Fastify integration: a catch-all `/auth/*` (registered with prefix `/api`, methods GET and POST), the URL built from `appOrigin`, headers through `fromNodeHeaders`, the parsed body re-serialized, every response header copied with `Set-Cookie` values kept separate (`response.headers.getSetCookie()`). `sessionHook` calls `auth.api.getSession({ headers, returnHeaders: true })`, copies each `getSetCookie()` value onto the reply, and sets `request.user` to `{ id }` or `null`; `app.decorateRequest("user", null)` in `buildApp`.
- [x] **Step 4: The environment.** `.env.example`: `BETTER_AUTH_SECRET` (a fixed development value of 32+ characters, with a comment that it signs the cookies, the demo's comes from SSM, and any value works locally) and `APP_ORIGIN=http://localhost:5173` (comment: the address the browser opens; Vite's in development). `compose.yaml`'s app environment: both, the origin the profile publishes (`http://localhost:8080` for `app`; check the nginx profile's port and set its own). `e2e/start-server.ts` overrides: `APP_ORIGIN: http://127.0.0.1:${port}`. CI copies `.env.example`, so it needs nothing more.
- [x] **Step 5: Run** the tests of Step 2. Expected: PASS. Then `pnpm dev`, open `http://localhost:5173`, and in the console run `fetch("/api/auth/sign-in/anonymous", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })`: 200 and a cookie without `Secure`. Note it for the PR.
- [x] **Step 6:** Docs listed above. **Run** `pnpm check`, `pnpm test:e2e`, `pnpm check:image`. Expected: PASS.
- [x] **Step 7: Commit** `feat(api): add Better Auth with anonymous sessions`.

### Task 3: The lists API and the access layer

**Files:**
- Create: `packages/shared/src/lists.ts`, `lists.test.ts`, `apps/api/src/access/workspace.ts`, `access/workspace.test.ts`, `apps/api/src/lists/repository.ts`, `lists/routes.ts`, `lists/routes.test.ts`
- Modify: `packages/shared/src/index.ts`, `apps/api/src/app.ts`
- Docs: `docs/architecture/architecture.md` (the access layer as built, the new routes), `docs/architecture/threat-model.md` (the lists routes behind the access layer)

**Interfaces:**
- Consumes: `sessionHook`, `SessionUser`, `signIn`, `sameOrigin` (Task 2); tables (Task 1).
- Produces:
  - `@szop/shared`: `listNameSchema` (string → trimmed, NFC, 1..100 code points, message "Name is too long (at most 100 characters)" over 100), `listSchema = { id: uuid, name: string, createdAt: iso datetime string }`, `listsResponseSchema = { lists: listSchema[] }`, `createListSchema = { id: z.uuid(), name: listNameSchema }`, `renameListSchema = { name: listNameSchema }`; types `List`, `CreateList`, `RenameList`.
  - `access/workspace.ts`: `interface WorkspaceContext { user: SessionUser; workspaceId: string; role: "owner" }`; `findOwnWorkspace(db: Executor, user: SessionUser | null): Promise<WorkspaceContext | null>`; `ownWorkspace(db: Executor, user: SessionUser | null): Promise<WorkspaceContext>` (throws a 401 `unauthorized` without a user; `INSERT … ON CONFLICT (user_id) DO NOTHING`, then a read); `requireListAccess(db: Executor, user: SessionUser | null, listId: string): Promise<WorkspaceContext>` (404 `not_found` otherwise). `Executor` is `Database` or a Drizzle transaction.
  - `lists/repository.ts`, every function taking `workspaceId` first after `db`: `listLists(db, workspaceId): Promise<List[]>`, `findList(db, workspaceId, id): Promise<List | null>`, `insertList(db, workspaceId, { id, name }): Promise<{ list: List; created: boolean }>` (`ON CONFLICT (workspace_id, id) DO NOTHING`, then a read), `renameList(db, workspaceId, id, name): Promise<List | null>` (writes nothing when the name is unchanged).
  - `listsRoutes(app, { db, auth })` registered with prefix `/api`.

- [x] **Step 1: Write the failing tests** in `shared/lists.test.ts`: `listNameSchema` trims `"  Weekly  "` → `"Weekly"`; `"ó"` → `"ó"` (one code point); `""` and `"   "` refused; 100 × `"a"` accepted, 101 refused; 100 × `"🛒"` accepted, 101 refused (Review Focus 3); `createListSchema` refuses `id: "not-a-uuid"`.
- [x] **Step 2: Write the failing tests** in `access/workspace.test.ts`: `findOwnWorkspace` with `null` or a user without a workspace → `null`; `ownWorkspace(null)` → rejects with status 401; `ACC-1.1`: two `ownWorkspace` calls for one user at once (`Promise.all`) → the same `workspaceId` and one `workspaces` row; `requireListAccess` for a list of another user's workspace and for a missing ID → both reject with status 404.
- [x] **Step 3: Write the failing tests** in `lists/routes.test.ts` (two guests by two `signIn` calls; every write with `sameOrigin`):
  - `LST-1.1`: `POST` → 201 with the list; the same request → 200, the same `createdAt`; the same ID with another name → 200 with the first name; guest B posting guest A's ID → 201, a separate list in B's workspace.
  - `ACC-1.1`: a new guest's first `POST` creates exactly one workspace; two first `POST`s of one guest at once (different IDs) → one workspace, two lists.
  - `POST` without a cookie → 401 `unauthorized`; bodies with a missing `id`, `id: "x"`, `name: "   "`, a 101-character name, an extra unknown field if the schema is strict → 400 `invalid_input`; NFD name stored as NFC (Review Focus 3).
  - `LST-2.1`: three lists created in order → `GET /api/lists` newest first; without a cookie → `{ lists: [] }` and no `Set-Cookie` (`ACC-1.3`); with a session but no workspace → `{ lists: [] }`.
  - `NFR-4.10`: guest B's `GET` and `PATCH /api/lists/<A's id>` → 404 with a body equal to the one for a random UUID; `GET /api/lists/not-a-uuid` → 404; `GET` and `PATCH` without a cookie → 404.
  - `LST-1.2`: `PATCH { name }` → 200, the new name, `updated_at` later; the same name → 200 and `updated_at` unchanged.
- [x] **Step 4: Run** `pnpm test -- lists workspace`. Expected: FAIL.
- [x] **Step 5: Implement** the shared schemas (`.trim().normalize("NFC")` through `z.string().transform` or `.overwrite`, then `.refine` on `[...value].length`), the access layer, the repository (map rows to `List`, `createdAt` as ISO string), and the routes with Zod `body`/`params`/`response` schemas. The path param is parsed in the handler (`z.uuid().safeParse`), so a malformed ID answers 404, not the validator's 400. `POST` runs `ownWorkspace` and `insertList` in one `db.transaction`. The lists plugin adds `sessionHook(auth)` as its own `preHandler`, so only its routes read the session. 401 and 404 go through `sendError`.
- [x] **Step 6: Run** the tests of Step 4. Expected: PASS.
- [x] **Step 7:** Docs listed above. **Run** `pnpm check`. Expected: PASS.
- [x] **Step 8: Commit** `feat(api): add the lists routes behind the access layer`.

### Task 4: The lists page and writes from the SPA

**Files:**
- Create: `apps/web/src/lists/lists-page.tsx`, `lists-page.test.tsx`, `lists/use-lists.ts`, `apps/web/src/brand/raccoon.svg`, `apps/web/src/test/lists.ts`
- Modify: `apps/web/src/api/client.ts`, `client.test.ts`, `apps/web/src/routes.tsx`, `shell/app-shell.tsx`, `shell/menu.tsx`, `shell/shell.test.tsx`, `e2e/tests/shell.spec.ts`, any other test that opens Start
- Delete: `apps/web/src/start/`
- Docs: `docs/architecture/architecture.md` (the lists module and routes in the frontend section; how the SPA gets a session), ADR 0057 "Settled while building" (plain `fetch` for Better Auth in the SPA, Global Constraints)

**Interfaces:**
- Consumes: `listsResponseSchema`, `listSchema`, `List`, `CreateList` (Task 3).
- Produces:
  - `client.ts`: `class ApiRequestError extends Error { status: number }`; `getLists(): Promise<List[]>`; `getList(id: string): Promise<List>` (404 → `ApiRequestError` with status 404); `createList(body: CreateList): Promise<List>`; `renameList(id: string, name: string): Promise<List>`; internal `withSession<T>(write: () => Promise<Response>)`: `GET /api/auth/get-session`, a `null` body → `POST /api/auth/sign-in/anonymous` with `{}`; then the write; a 401 → sign in and retry once.
  - `use-lists.ts`: `useLists()`, `useList(id)` (`retry: false` as `useCatalog`), `useCreateList()`, `useRenameList(id)`: mutations with `networkMode: "always"`; on success set the `["lists", id]` query and invalidate `["lists"]`.
  - `RouteHandle` becomes `{ title?: string; header?: "list"; action?: ReactNode }` (`isRouteHandle` accepts any object; the title still comes from the deepest handle that has one): `action` is shown by the shell next to the desktop h1; `header: "list"` (Task 5) hides the shell's phone header and desktop h1 and leaves `document.title` to the page.
  - `NewListLink({ sticky }: { sticky?: boolean })` exported from `lists-page.tsx`.

- [x] **Step 1: Write the failing tests** in `client.test.ts` (MSW): `createList` with no session → requests in order `GET get-session`, `POST sign-in/anonymous`, `POST /api/lists`; with a session → no sign-in; `POST /api/lists` answering 401 once → sign-in, then the retry, resolved; answering 401 twice → rejects, exactly two `POST /api/lists` (Review Focus 2); `getList` 404 → `ApiRequestError` with `status` 404; a 200 whose body is not a list → an error, as `getCatalog`.
- [x] **Step 2: Write the failing tests** in `lists-page.test.tsx` (the real `routes`, `createMemoryRouter`, MSW fixtures from `test/lists.ts`):
  - `LST-2.3, APP-4.2`: no lists → the text "Create your first list", a decorative image (`alt=""`) and a "New list" link to `/lists/new`.
  - `LST-2.1, APP-1.5`: three lists from the server → three links in the server's order, each to `/lists/<id>` with the name as its text; at `/` the h1 is "Lists", the tab "Lists · Szop".
  - Loading: skeleton cards (`data-testid="skeleton-card"`); an error → "The lists could not be loaded." and "Try again", which refetches.
  - `LST-1.4, APP-1.8`: on a phone one "New list" link, in the sticky bar; on a desktop (`stubMatchMedia` as desktop) one, in the header beside the h1.
  - `shell.test.tsx`: Start's tests rewritten: the menu holds "Lists" (active at `/`), the logo is "Szop, Lists", no "Start" anywhere.
- [x] **Step 3: Run** `pnpm test -- client lists-page shell`. Expected: FAIL.
- [x] **Step 4: Implement.** `raccoon.svg`: `logo.svg` without its `<rect>` tile and with `aria-label` removed. The empty state: the raccoon at about 120 px with `grayscale opacity-55`, the text `text-xl font-semibold text-muted-foreground`, centered. Cards: `rounded-surface bg-card min-h-12 px-4 font-semibold`, the name in `truncate`, `min-w-0` on the column and the card. `NewListLink`: `buttonVariants()` with the Lucide `Plus` icon; `sticky` places it in a bar `sticky bottom-0` with the page's background behind it on a phone. The route `index` gets `handle: { title: "Lists", action: <NewListLink /> }`; the shell renders `action` only on a desktop, and the page renders `<NewListLink sticky />` only on a phone (`useMediaQuery(desktopQuery)`). The menu's entry uses the Lucide `List` icon. Delete `start/`.
- [x] **Step 5: Run** the tests of Step 3. Expected: PASS.
- [x] **Step 6:** Update `e2e/tests/shell.spec.ts` (Start → Lists, the tab order of Step "Tab to the Start link") and any other spec that opens Start. **Run** `pnpm check` and `pnpm test:e2e`. Expected: PASS.
- [x] **Step 7: Commit** `feat(web): make the lists page the home screen`.

### Task 5: The new-list and list screens

**Files:**
- Create: `apps/web/src/lists/list-screen.tsx`, `new-list-page.tsx`, `new-list-page.test.tsx`, `list-page.tsx`, `list-page.test.tsx`, `apps/web/src/components/ui/dropdown-menu.tsx`
- Modify: `apps/web/src/routes.tsx`, `shell/app-shell.tsx`, `shell/shell.test.tsx`, `apps/web/src/index.css` (only if the dotted underline needs a utility)
- Docs: `docs/architecture/visual-design.md` (the title field at rest and focused, "List name" as the third exception in "Forms and focus", the peeking raccoon, "Create your first list" as the empty-state example; Contents if headings change)

**Interfaces:**
- Consumes: `useList`, `useCreateList`, `useRenameList`, `ApiRequestError` (Task 4); `uuidv7`, `listNameSchema` (Tasks 2, 3); `RouteHandle.header` (Task 4).
- Produces (`list-screen.tsx`): `ListHeader({ field, menu }: { field: ReactNode; menu?: ReactNode })` (← link "Back to lists" to `/`, the field, ⋮ when given, the raccoon tile `logo.svg` with `alt=""`); `TitleField(props: { initial: string; autoFocus?: boolean; pending: boolean; error?: string; onSave(name: string): void; onCancel(): void })`; `EmptyList()` ("Nothing on this list yet" and the peeking raccoon, `aria-hidden`).

- [x] **Step 1:** Add shadcn's `dropdown-menu` for Base UI through the shadcn CLI, as `sheet.tsx` was (`components.json`); check it renders no `<style>`.
- [x] **Step 2: Write the failing tests** in `new-list-page.test.tsx`:
  - `LST-1.5`: at `/lists/new` the textbox named "List name" has focus and the placeholder "List name"; no "List actions" button.
  - `LST-1.1, LST-1.5`: typing "Weekly shop" and Enter → one `POST /api/lists` with a v7 `id` and the name; the address becomes `/lists/<id>` with no new history entry (going back lands on `/`).
  - Esc → `/` and no request; Enter with "" or "   " → no request; the ← link with an empty name → `/`, no request.
  - `LIM-2.2`: 101 characters and Enter → "Name is too long (at most 100 characters)", no request.
  - A failed `POST` (500) → a short message next to the field, the text kept; Enter again → a `POST` with the **same** `id` (Review Focus 4). Enter twice quickly → one list ID across all requests, the field read-only while pending.
- [x] **Step 3: Write the failing tests** in `list-page.test.tsx`:
  - `APP-1.6`: at `/lists/<id>` the "Back to lists" link goes to `/`; no "Open menu" button; the tab is "Weekly shop · Szop".
  - `LST-1.2`: clicking the title, typing a new name, Enter → `PATCH` with it, the field shows the server's name; ⋮ ("List actions") → "Rename" focuses the field with its text selected.
  - Leaving the field with a changed name saves once; Esc restores the old name and the blur after it sends nothing; Enter then blur sends one `PATCH` (Review Focus 5); an empty name is not saved and the old one returns.
  - `APP-4.2`: "Nothing on this list yet"; the peeking raccoon is hidden from the accessibility tree.
  - A 404 → "This list does not exist." and a link to the lists page.
- [x] **Step 4: Run** `pnpm test -- new-list-page list-page`. Expected: FAIL.
- [x] **Step 5: Implement.** Routes `lists/new` and `lists/:id`, both `handle: { header: "list" }`; the shell then renders neither `PhoneHeader` nor the desktop h1 and sets no `document.title` (the page does, from the list's name; "New list · Szop" on the new screen). The page's `<h1 className="sr-only">` holds the list's name ("New list" on the new screen), and `TitleField` is the visible `<input>` beside it with the accessible name "List name" on both screens, so the heading outline stays and the field is labelled. At rest: `font-extrabold text-xl truncate bg-transparent`, `border-b-2 border-dotted border-input`; focused: `bg-card rounded-control ring-3 ring-ring`. The ID for a new list comes from `uuidv7()` on the first Enter and is kept in a ref for retries; `navigate(\`/lists/${id}\`, { replace: true })` on success. The peeking raccoon: `raccoon.svg` at 200 px, `grayscale opacity-55`, positioned `fixed` at the left edge halfway down, `rotate-90`, shifted so only the top of the head up to 5 px below the eyes shows; from `lg` at the content area's right edge, `-rotate-90`. Check both against `list-screen-empty.png` in a browser (`pnpm dev`, light and dark, phone and `lg`).
- [x] **Step 6: Run** the tests of Step 4 and `shell.test.tsx`. Expected: PASS.
- [x] **Step 7:** Docs listed above. **Run** `pnpm check` and `pnpm test:e2e`. Expected: PASS (the first-screen budget included).
- [x] **Step 8: Commit** `feat(web): add the new-list and list screens with renaming`.

### Task 6: The lists journey

**Files:**
- Create: `e2e/tests/lists.spec.ts`
- Docs: `docs/development/testing.md` (the lists journey; a fresh browser context is a fresh guest)

**Interfaces:**
- Consumes: the screens of Tasks 4 and 5; `expectAccessible`, `test`/`expect` (with the CSP guard) from `e2e/support/`.

- [ ] **Step 1: Write the journey** `test("ACC-1.1, LST-1.1, LST-1.2, LST-1.5, LST-2.1, LST-2.3: a guest creates, renames and finds a list", …)`: `/` shows "Create your first list" (`expectAccessible`); "New list" → the field focused (`expectAccessible`); "Weekly shop" + Enter → the URL matches `/lists/<uuid>`; rename through ⋮ → "Rename" to "Saturday shop" + Enter → the heading text updates (`expectAccessible`); ← → the lists page shows "Saturday shop"; `page.reload()` → still there.
- [ ] **Step 2: Write** `test("NFR-4.10, ACC-1.3, ACC-1.8: another visitor sees nothing, and clearing the cookies loses the lists", …)`: create a list; a second `browser.newContext()` opens `/` → "Create your first list"; and its `GET /api/lists/<first id>` through `page.request` → 404; back in the first context, `context.clearCookies()` and reload → "Create your first list". Before any write, the first context has no cookie (`context.cookies()` empty after loading `/`).
- [ ] **Step 3: Run** `pnpm test:e2e`. Expected: PASS in all three projects, no CSP violation.
- [ ] **Step 4:** Docs listed above. **Commit** `test(e2e): add the lists journey`.

### Task 7: The demo

**Files:**
- Modify: `infra/base/app_roles.tf`, `infra/demo/locals.tf`, `infra/demo/service.tf`
- Docs: `docs/architecture/aws-resources.md` (the execution role reading `/szop/better-auth-secret`), `docs/operations/demo-environment.md` (the app now reads the secret; apply `infra/base` before the demo)

**Interfaces:**
- Consumes: `BETTER_AUTH_SECRET` and `APP_ORIGIN` (Task 2).

- [ ] **Step 1:** In `app_roles.tf`, the execution role's statement `ReadAppDatabasePassword` becomes `ReadAppSecrets` with both parameters' ARNs (`aws_ssm_parameter.db_app_password.arn`, `aws_ssm_parameter.better_auth_secret.arn`); the comment "joins in PH-18" goes. `locals.tf`: `better_auth_secret_arn` built from `/szop/better-auth-secret` like `db_app_password_arn`. `service.tf`: the app container gets `{ name = "BETTER_AUTH_SECRET", valueFrom = local.better_auth_secret_arn }` in `secrets` and `{ name = "APP_ORIGIN", value = "https://${local.app_hostname}" }` in `environment`. db-setup gets neither.
- [ ] **Step 2: Run** `scripts/check-infra.sh` (fmt, validate, tflint, as CI's infra job does). Expected: PASS.
- [ ] **Step 3:** Docs listed above. Tell the owner, in the task summary, that `infra/base` must be applied from this branch before `demo-up` ([ADR 0008](../../decisions/0008-hosting.md), decisions 21 and 22). **Commit** `feat(infra): give the demo app the Better Auth secret`.

### Task 8: The mutation run

**Files:**
- Modify: whatever the owner's decisions touch (tests, `// Stryker disable next-line <Mutator>: <reason>` comments)

- [ ] **Step 1: Run** `pnpm db:up`, then `pnpm test:mutation --mutate` over the phase's new and changed logic: `apps/api/src/{auth,access,lists}/**/*.ts`, `apps/api/src/config.ts`, `packages/shared/src/{lists,uuid}.ts`, `apps/web/src/api/client.ts`, `apps/web/src/lists/**/*.{ts,tsx}`, `apps/web/src/shell/app-shell.tsx` (tests excluded as in `stryker.config.mjs`).
- [ ] **Step 2:** List the survivors for the owner, grouped by file, each with a proposal: a test that kills it, or an accepted reason. Stop and wait for the owner's decisions.
- [ ] **Step 3:** Apply the decisions; rerun the mutation run on the touched files. Expected: every survivor killed or carrying its reason ([definition of done](../../development/definition-of-done.md), item 2).
- [ ] **Step 4: Run** `pnpm check`. Expected: PASS. **Commit** `test: kill or accept the PH-16a mutation survivors`.
