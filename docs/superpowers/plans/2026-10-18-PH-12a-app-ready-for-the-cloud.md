# PH-12a App ready for the cloud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The API refuses to start against a database whose migrations do not match its own, can connect with TLS and full certificate verification, ends its shutdown within 15 seconds, and leaves successful health checks out of the log.

**Architecture:** A pure comparison of recorded and local migrations runs in `server.ts` before Drizzle migrates; a new required setting `DATABASE_TLS` turns into the pool's `ssl` options; a small shutdown module adds a deadline next to `app.close()`; `buildApp` switches request logging off for `/api/health` only. Nothing touches AWS.

**Tech Stack:** Node 24, TypeScript run by type stripping, Fastify 5.12, Drizzle ORM 0.45 (`drizzle-orm/migrator`), node-postgres 8.23, Zod, Vitest, Docker Compose.

**Spec:** [`docs/superpowers/specs/2026-10-18-PH-12a-app-ready-for-the-cloud-design.md`](../specs/2026-10-18-PH-12a-app-ready-for-the-cloud-design.md)

## Global Constraints

- Every setting is required, with no default ([ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 2). `DATABASE_TLS` takes exactly `none` or `verify-full`.
- The CA bundle is `apps/api/certs/rds-global-bundle.pem`, resolved from the module's own location (like `migrationsFolder`), never from the working directory.
- Migration check message, exact remedy line: ``Reset the database: `pnpm db:reset` locally; on the demo, `demo-down` then `demo-up`.``
- Shutdown: deadline 10 000 ms, then a further 5 000 ms before exiting with code 1; both timers `unref`'d.
- The health route is matched by its route URL `/api/health` (`request.routeOptions.url`), never by the raw URL.
- `server.ts` stays checked by hand (ADR 0019, decision 10); logic it calls is tested. Read `docs/development/testing.md` before writing tests: one test run at a time, a test that changes shared database state restores it or uses a database of its own.
- No change to `infra/`, workflows or AWS. Never merge.
- Every commit follows Conventional Commits with a scope from `commitlint.config.js` (`api`, `adr`, `plan`, …) and ends with the two attribution lines (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Claude-Session: https://claude.ai/code/session_01L2h5LTxJe93QgahR4JhLqf`), naming the model that wrote the commit. Never commit to `main`.
- Docs: niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon; requirements linked, never plain IDs; long docs keep their `## Contents` in sync; ADR notes in three places (CLAUDE.md, "Documentation").
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit, `git push` the phase branch, then stop and summarize the task for the owner; start the next task only when the owner says so (`docs/superpowers/plans/CLAUDE.md`).

## Review Focus

1. **A brand-new, empty database.** The `drizzle` schema and its table do not exist before the first migration; the check must pass, not crash on `relation does not exist`. Task 1, step 6 pins it.
2. **A database whose migrations are all pending.** Recorded `0000` only, code with `0000` and a newer `0001`: that is a normal upgrade, not "skipped". Task 1's table has the case.
3. **Two migrations with the same hash.** An empty migration and another empty one hash alike; matching must go by timestamp first, so neither is reported as edited. Task 1's table has the case.
4. **`DATABASE_TLS` missing from an existing `apps/api/.env`.** Every developer's `pnpm dev` and the tests stop with `DATABASE_TLS: missing`; the setup guide and the PR must say to add the line. Task 3, step 7.
5. **A non-health route losing its request lines.** The `disableRequestLogging` function must be true only for the health route; a 404 on `/api/health/x` or `/api/healthz` keeps its lines. Task 5's test has the case.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `apps/api/src/db/migration-check.ts`, `.test.ts` | Read local and recorded migrations, compare, describe, throw | 1 |
| `apps/api/src/server.ts` | The check before migrating; the shutdown deadline | 1, 4 |
| `package.json` | `db:reset` | 2 |
| `docs/development/tools/drizzle.md`, `docs/development/scripts.md` | The check and the reset | 2 |
| `apps/api/src/config.ts`, `config.test.ts`, `test/config.ts` | `DATABASE_TLS` | 3 |
| `apps/api/src/db/database.ts`, `db/database.test.ts` | The pool's `ssl` options | 3 |
| `apps/api/.env.example`, `compose.yaml`, `Dockerfile`, `docs/development/setup.md`, `docs/development/tools/docker.md` | The setting in every place that sets the others | 3 |
| `apps/api/src/shutdown.ts`, `shutdown.test.ts` | The deadline's timers | 4 |
| `apps/api/src/app.ts`, `health/routes.test.ts` | No request lines for `/api/health` | 5 |
| `docs/decisions/0033-app-ready-for-the-cloud-details.md`; ADRs 0008, 0019 | ADR 0033 and its notes | 6 |
| `docs/architecture/{architecture,stack-overview}.md`, `docs/development/testing.md`, `docs/glossary.md` | Living docs | 6 |
| `docs/roadmap.md` | PH-12a's row and entry | 6 |

---

### Task 1: The migration check

**Files:**
- Create: `apps/api/src/db/migration-check.ts`, `apps/api/src/db/migration-check.test.ts`
- Modify: `apps/api/src/server.ts` (the startup `try`)

**Interfaces:**
- Consumes: `Journal`, `readJournal()` (`db/schema-version.ts`); `migrationsFolder` (`db/migrate.ts`); `readMigrationFiles` (`drizzle-orm/migrator`); `Database` (`db/database.ts`); test helpers `testDatabaseSettings`, `createDatabase`, `runMigrations`.
- Produces:
  - `interface LocalMigration { name: string; createdAt: number; hash: string }`
  - `interface RecordedMigration { createdAt: number; hash: string }`
  - `interface MigrationMismatch { unknown: RecordedMigration[]; skipped: LocalMigration[]; edited: LocalMigration[] }`
  - `readLocalMigrations(journal: Journal): LocalMigration[]`: `readMigrationFiles({ migrationsFolder })` joined with the journal by `when` = `folderMillis`.
  - `readRecordedMigrations(db: Database): Promise<RecordedMigration[]>`: every row of `drizzle.__drizzle_migrations`; `[]` when `to_regclass('drizzle.__drizzle_migrations')` is null. `created_at` comes back as a string: convert with `Number`.
  - `compareMigrations(local: LocalMigration[], recorded: RecordedMigration[]): MigrationMismatch`
  - `describeMismatch(mismatch: MigrationMismatch): string`
  - `class MigrationMismatchError extends Error { readonly mismatch: MigrationMismatch }`, message from `describeMismatch`.
  - `checkMigrations(db: Database, journal: Journal): Promise<void>`: throws `MigrationMismatchError` when any list is non-empty.

- [x] **Step 1: Write the failing unit tests for `compareMigrations` and `describeMismatch`**

An `it.each` table over `compareMigrations`, with `L(name, createdAt, hash)` and `R(createdAt, hash)` helpers. Rows (expected lists as `{ unknown, skipped, edited }`, by name or `createdAt`):

| Case | local | recorded | expected |
|---|---|---|---|
| nothing recorded | `0000@100 h0` | — | all empty |
| in step | `0000@100 h0` | `100 h0` | all empty |
| pending only | `0000@100 h0`, `0001@200 h1` | `100 h0` | all empty |
| unknown | `0000@100 h0` | `100 h0`, `300 hx` | unknown `[300]` |
| skipped | `0000@100 h0`, `0001@150 h1` | `100 h0`, `200 h2` | unknown `[200]`, skipped `[0001]` |
| edited | `0000@100 h0` | `100 hX` | edited `[0000]` |
| same hash, two timestamps | `0000@100 hE`, `0001@200 hE` | `100 hE`, `200 hE` | all empty |

`describeMismatch` tests: the text contains `unknown`, the unknown one's timestamp, `skipped`, the skipped one's name, `edited`, the edited one's name, and the exact remedy line of Global Constraints; a case with an empty list is not mentioned.

- [x] **Step 2: Run them and see them fail**

Run: `pnpm vitest run apps/api/src/db/migration-check.test.ts`
Expected: FAIL, module `./migration-check.ts` not found.

- [x] **Step 3: Implement `compareMigrations`, `describeMismatch` and `MigrationMismatchError`**

Match by timestamp: a recorded row whose `createdAt` is no local `createdAt` is unknown; a local migration with a recorded twin but another hash is edited; a local migration with no recorded twin and `createdAt` below the newest recorded `createdAt` is skipped. The message: a first line saying the database's migrations do not match this code's, one indented line per mismatched migration naming its case, then the remedy line.

- [x] **Step 4: Run them and see them pass**

Run: `pnpm vitest run apps/api/src/db/migration-check.test.ts`
Expected: PASS.

- [x] **Step 5: Write the failing tests for `readLocalMigrations`**

`readLocalMigrations(readJournal())` returns one migration, `{ name: "0000_init", createdAt: 1791307052475 }`, whose `hash` equals the SHA-256 hex of `apps/api/drizzle/0000_init.sql`'s content (computed in the test with `node:crypto`), which is also the `hash` the template database recorded (Step 6 compares them).

- [x] **Step 6: Write the failing database tests for `readRecordedMigrations` and `checkMigrations`**

In a `describe` that creates its own database `szop_test_migrations_${VITEST_POOL_ID}` through the `postgres` maintenance database (`testDatabaseSettings("postgres")`) in `beforeEach`, and drops it `WITH (FORCE)` in `afterEach`, after ending the pool:

- `readRecordedMigrations` on the new, empty database returns `[]`;
- `checkMigrations` on it resolves;
- after `runMigrations`, `readRecordedMigrations` returns one row with `createdAt` 1791307052475 and the hash `readLocalMigrations` gives, and `checkMigrations` resolves;
- after inserting a row `(hash 'x', created_at 1891307052475)` into `drizzle.__drizzle_migrations`, `checkMigrations` rejects with a `MigrationMismatchError` whose `mismatch.unknown` holds `createdAt` 1891307052475.

- [x] **Step 7: Implement `readLocalMigrations`, `readRecordedMigrations` and `checkMigrations`; run the file**

Run: `pnpm vitest run apps/api/src/db/migration-check.test.ts`
Expected: PASS.

- [x] **Step 8: Call the check in `server.ts`**

In the startup `try`, `await checkMigrations(db, journal)` before `await runMigrations(db)`, reading the journal once (`const journal = readJournal()`) and passing it to `currentSchemaVersion` too. A mismatch reaches the existing `catch`, which logs `startup failed` with the error (its message carries the details) and exits with code 1. Add a comment naming ADR 0033, decision 3.

- [x] **Step 9: Check by hand**

With PostgreSQL up: `pnpm --filter @szop/api start` logs `migrations applied`. Stop it, run `docker compose exec postgres psql -U szop -d szop -c "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('x', 1891307052475)"`, start again: the log shows `startup failed` with the unknown migration and the remedy, and the exit code is 1. Remove the row with the matching `DELETE`; the next start succeeds.

- [x] **Step 10: Run all checks and commit**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: all pass.

```bash
git add apps/api/src/db/migration-check.ts apps/api/src/db/migration-check.test.ts apps/api/src/server.ts docs/superpowers/plans/2026-10-18-PH-12a-app-ready-for-the-cloud.md
git commit -m "feat(api): refuse to start when the database's migrations do not match"
```

---

### Task 2: Resetting the local database, and the check's docs

**Files:**
- Modify: `package.json` (`scripts`), `docs/development/scripts.md`, `docs/development/tools/drizzle.md`

**Interfaces:**
- Consumes: the message of Task 1.
- Produces: the root script `db:reset`.

- [ ] **Step 1: Add the script**

`"db:reset": "docker compose down --volumes && docker compose up -d --wait"`, next to `db:up` and `db:down`. Without `--profile app`, `down` leaves the app profile's services alone; `--volumes` removes the declared volume `szop_postgres-data`.

- [ ] **Step 2: Check it**

Run: `pnpm db:reset`, then `docker volume ls` and `pnpm --filter @szop/api start`.
Expected: the volume is recreated (new creation time in `docker volume inspect szop_postgres-data`), PostgreSQL is healthy, and the API logs `migrations applied` with `0000_init` on the empty database. Then `pnpm test` passes (it recreates the test databases).

- [ ] **Step 3: Document**

- `scripts.md`, the database table: `pnpm db:reset` — Wipe the local database — what it runs — when the API refuses to start because the database's migrations do not match the code's, or to start from empty; it also removes the test databases, which the next `pnpm test` recreates.
- `drizzle.md`: a section on the check (when it runs, the three cases with a one-line branch-switching example each, the message, the remedy locally and on the demo, and that the remedy is the environment's, not the check's: [OP-097](https://github.com/luiki-dev/szop/issues/224)); the existing advice to regenerate a migration on top of `main` stays and points to the "skipped" case. Keep its `## Contents` in sync.

- [ ] **Step 4: Commit**

Run: `pnpm format:check`
Expected: PASS.

```bash
git add package.json docs/development/scripts.md docs/development/tools/drizzle.md docs/superpowers/plans/2026-10-18-PH-12a-app-ready-for-the-cloud.md
git commit -m "feat: add db:reset and document the migration check"
```

---

### Task 3: TLS to the database

**Files:**
- Modify: `apps/api/src/config.ts`, `config.test.ts`, `test/config.ts`, `db/database.ts`, `apps/api/.env.example`, `compose.yaml`, `Dockerfile` (the bundle's comment), `docs/development/setup.md`, `docs/development/tools/docker.md`
- Create: `apps/api/src/db/database.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `DatabaseSettings.tls: "none" | "verify-full"`; `export const rdsCaBundle: string` (absolute path) in `db/database.ts`.

- [ ] **Step 1: Write the failing config tests**

In `config.test.ts`: `valid` gains `DATABASE_TLS: "none"`, the expected config's `database` gains `tls: "none"`; `verify-full` is read as `tls: "verify-full"`; `DATABASE_TLS` joins the "reported when missing" table (it is in `names` through `valid`); a value such as `require` is rejected and the message names `DATABASE_TLS`.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run apps/api/src/config.test.ts`
Expected: FAIL on the new expectations.

- [ ] **Step 3: Implement the setting**

`DATABASE_TLS: z.enum(["none", "verify-full"])` in `envSchema`, with a comment (`verify-full` on RDS from PH-12c, `none` locally); `tls` in `DatabaseSettings` and `loadConfig`. `testConfig()`'s `database` gains `tls: "none"`.

- [ ] **Step 4: Write the failing pool tests**

`db/database.test.ts`, no connection opened (the pool connects on the first query; end it in `afterEach`):
- `tls: "none"` gives `db.$client.options.ssl` falsy;
- `tls: "verify-full"` gives `ssl.rejectUnauthorized === true` and `ssl.ca` equal to the content of `rdsCaBundle`, which starts with `-----BEGIN CERTIFICATE-----`;
- `rdsCaBundle` ends with `apps/api/certs/rds-global-bundle.pem`.

- [ ] **Step 5: Implement the pool's options; run the tests**

`rdsCaBundle` from `new URL("../../certs/rds-global-bundle.pem", import.meta.url)`; for `verify-full`, `ssl: { ca: readFileSync(rdsCaBundle, "utf8"), rejectUnauthorized: true }`, read when the pool is created, so a missing bundle fails startup.

Run: `pnpm vitest run apps/api/src/db/database.test.ts apps/api/src/config.test.ts`
Expected: PASS.

- [ ] **Step 6: Set it everywhere the other settings are set**

`DATABASE_TLS=none` in `apps/api/.env.example` (with a comment: `verify-full` on the demo) and `DATABASE_TLS: none` in `compose.yaml`'s app service; add the line to your own `apps/api/.env`. The `Dockerfile`'s bundle comment names PH-12a and PH-12c instead of PH-12. CI copies `.env.example`, so it needs nothing more.

- [ ] **Step 7: Document**

`setup.md`: `DATABASE_TLS` where the API's `.env` is described, and a note that an `.env` made before PH-12a needs `DATABASE_TLS=none` added. `docker.md`: the bundle used by `DATABASE_TLS=verify-full`, set on the demo in PH-12c.

- [ ] **Step 8: Run all checks and commit**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm check:image`
Expected: all pass; the image still starts healthy under Compose.

```bash
git add apps/api/src/config.ts apps/api/src/config.test.ts apps/api/src/test/config.ts apps/api/src/db/database.ts apps/api/src/db/database.test.ts apps/api/.env.example compose.yaml Dockerfile docs/development/setup.md docs/development/tools/docker.md docs/superpowers/plans/2026-10-18-PH-12a-app-ready-for-the-cloud.md
git commit -m "feat(api): add DATABASE_TLS for verified TLS to the database"
```

---

### Task 4: The shutdown deadline

**Files:**
- Create: `apps/api/src/shutdown.ts`, `apps/api/src/shutdown.test.ts`
- Modify: `apps/api/src/server.ts` (the signal handler)

**Interfaces:**
- Consumes: Fastify's `app.server` (a Node `http.Server`) and `app.log`.
- Produces: `startShutdownDeadline(options: { server: Pick<http.Server, "getConnections" | "closeAllConnections">; log: Pick<FastifyBaseLogger, "warn" | "error">; deadlineMs: number; graceMs: number; exit: (code: number) => void }): void`

- [ ] **Step 1: The check (spec, decision 6)**

`pnpm build`, then `pnpm start`. With the chrome-devtools MCP (the Linux Chrome), open `http://localhost:3000`, wait for the page, close the page. Send SIGTERM to the `node` process (`pkill -TERM -f "node --env-file=.env src/server.ts"`) and time from the signal to the exit (for example `time` around `pnpm start` in a second shell, or the log's timestamps of `shutting down` and the shell prompt). Note the seconds and Node's and Fastify's versions for the task summary, ADR 0033 and OP-085's comment. Expected: under a second, which confirms the hang of PH-06a was WSL's mirrored networking.

- [ ] **Step 2: Write the failing tests**

`shutdown.test.ts` with `vi.useFakeTimers()`, a fake server (`getConnections` calling back `(null, 2)`, `closeAllConnections` a spy), a fake log and an `exit` spy:
- before 10 000 ms nothing is called;
- at 10 000 ms `log.warn` is called with `{ openConnections: 2 }` and `"shutdown deadline reached, closing connections"`, and `closeAllConnections` once; `exit` not yet;
- at 15 000 ms `log.error` with `"shutdown did not finish, exiting"` and `exit(1)`;
- the timers are unref'd: spy on `setTimeout` (`vi.spyOn(globalThis, "setTimeout")`) and check `hasRef()` is false on each returned handle.

- [ ] **Step 3: Run them and see them fail**

Run: `pnpm vitest run apps/api/src/shutdown.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement `startShutdownDeadline`; run the tests**

Run: `pnpm vitest run apps/api/src/shutdown.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in `server.ts`**

In the signal handler, after logging `shutting down` and before `app.close()`: `startShutdownDeadline({ server: app.server, log: app.log, deadlineMs: 10_000, graceMs: 5_000, exit: (code) => process.exit(code) })`. The existing path is unchanged: when `app.close()` resolves (also after `closeAllConnections()`), the pool ends and the process exits with 0. Comment: ECS kills a task at 30 seconds (ADR 0033, decision 6).

- [ ] **Step 6: Check by hand**

`pnpm start`; in a second shell, `printf 'GET / HTTP/1.1\r\nHost: x\r\n' | nc -q 30 127.0.0.1 3000` (half a request held open); SIGTERM the server. Expected: the warning with `openConnections: 1` about 10 seconds after `shutting down`, then a clean exit with code 0. Without the `nc`, the exit stays immediate.

- [ ] **Step 7: Run all checks and commit**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: all pass.

```bash
git add apps/api/src/shutdown.ts apps/api/src/shutdown.test.ts apps/api/src/server.ts docs/superpowers/plans/2026-10-18-PH-12a-app-ready-for-the-cloud.md
git commit -m "feat(api): bound the shutdown with a 10-second deadline"
```

---

### Task 5: No request lines for health checks

**Files:**
- Modify: `apps/api/src/app.ts` (the `Fastify({...})` options), `apps/api/src/health/routes.test.ts`

**Interfaces:**
- Consumes: `captureLog()` (`test/log.ts`), `testConfig`, `useTestDatabase`.
- Produces: —

- [ ] **Step 1: Write the failing tests**

In `health/routes.test.ts`, a `describe("the log")` with `captureLog()` and `testConfig({ logLevel: "info" })`:
- a healthy `GET /api/health` writes no line whose `msg` is `incoming request` or `request completed`;
- `GET /api/health?probe=1` writes none either;
- with the unreachable database of the existing 503 test, a line with `msg: "database check failed"` is written and no request lines;
- `GET /api/healthz` and `GET /api/health/x` each write an `incoming request` line.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run apps/api/src/health/routes.test.ts`
Expected: FAIL on the first two cases (request lines present).

- [ ] **Step 3: Implement**

`disableRequestLogging: (request) => request.routeOptions.url === "/api/health"` in `buildApp`'s Fastify options, with a comment: the load balancer checks every few seconds; the route's own warning still logs (ADR 0033, decision 7).

- [ ] **Step 4: Run them and see them pass, then all checks; commit**

Run: `pnpm vitest run apps/api/src/health/routes.test.ts && pnpm test && pnpm lint && pnpm typecheck`
Expected: PASS.

```bash
git add apps/api/src/app.ts apps/api/src/health/routes.test.ts docs/superpowers/plans/2026-10-18-PH-12a-app-ready-for-the-cloud.md
git commit -m "feat(api): leave successful health checks out of the log"
```

---

### Task 6: ADR 0033, the living docs, the roadmap and GitHub

**Files:**
- Create: `docs/decisions/0033-app-ready-for-the-cloud-details.md`
- Modify: `docs/decisions/0008-hosting.md`, `docs/decisions/0019-api-skeleton-details.md`, `docs/architecture/architecture.md`, `docs/architecture/stack-overview.md`, `docs/development/testing.md`, `docs/glossary.md`, `docs/roadmap.md`

**Interfaces:**
- Consumes: the spec's decisions 1–7 and Task 4, step 1's result.
- Produces: —

- [ ] **Step 1: Write ADR 0033 "App ready for the cloud details"**

Shaped like ADR 0032: Status ✅ Accepted, Date, **Refines:** ADR 0008, decision 14 (decision 3) and ADR 0019, decision 8 (decision 6); Context; the spec's decision table, with decision 6 stating the check's result; Consequences (every `.env` needs `DATABASE_TLS`; PH-12c sets `verify-full`, the deployment percentages, the stop timeout and the runbook's remedy; the candidates OP-097 and OP-098).

- [ ] **Step 2: The notes in the earlier ADRs**

ADR 0008's status line and decision 14's cell: `<br>✏️ **Refined by [ADR 0033](0033-app-ready-for-the-cloud-details.md), decision 3:** …`; ADR 0019's status line and decision 8's cell, the same for decision 6.

- [ ] **Step 3: The living docs**

- `architecture.md`: startup order (configuration, the migration check, migrations, listening), `DATABASE_TLS`, the shutdown deadline, no request lines for health checks.
- `stack-overview.md`: certificate verification with a certificate authority (CA) bundle, if not explained yet.
- `testing.md`: `testConfig()`'s description, if it lists the database fields; a database test that needs a database of its own (Task 1's pattern).
- `glossary.md`: CA and any other acronym the phase added, if missing.

- [ ] **Step 4: Check and commit**

Run: `pnpm format:check && pnpm lint`
Expected: PASS.

```bash
git add docs/decisions docs/architecture docs/development/testing.md docs/glossary.md docs/superpowers/plans/2026-10-18-PH-12a-app-ready-for-the-cloud.md
git commit -m "docs: add ADR 0033 and document the app's cloud readiness"
```

- [ ] **Step 5: GitHub and the roadmap, before the PR**

- OP-043 (#84) and OP-017 (#68): the PH-12a part ticked with the PR, re-parented to PH-12c (#221), Status ⬜ Backlog.
- OP-085 (#88) and OP-072 (#85): `Closes` in the PR; OP-085's "settled by" comment names Task 4, step 1's result.
- PH-12a's row: ✅, PR link; README diagram ●; the issue's body from the roadmap entry.
- The PR description lists every issue change and says that every `apps/api/.env` needs `DATABASE_TLS=none`.
