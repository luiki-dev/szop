# PH-04 Database — design

- **Phase:** [PH-04](../../roadmap.md#ph-04-database)
- **Date:** 2026-10-05
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-005](../../open-points.md#op-005) (PH-04 part), [OP-006](../../open-points.md#op-006), [OP-011](../../open-points.md#op-011), [OP-012](../../open-points.md#op-012) (PH-04 part), [OP-013](../../open-points.md#op-013) (PH-04 part), [OP-068](../../open-points.md#op-068) (PH-04 part); [OP-067](../../open-points.md#op-067) does not depend on this phase and moves on

PostgreSQL runs locally in Docker Compose, the API applies its migrations at startup, `GET /api/health` reports whether the database is reachable and which schema version it holds, and tests run against isolated test databases, locally and in CI. The direction was settled by [ADR 0002](../../decisions/0002-technical-architecture.md) (PostgreSQL, Drizzle), [ADR 0005](../../decisions/0005-development-environment.md), decision 4 (PostgreSQL in Docker Compose), [ADR 0007](../../decisions/0007-testing-strategy.md), decisions 12 and 13 (a template database, a copy per Vitest worker, `TRUNCATE` between tests), [ADR 0008](../../decisions/0008-hosting.md), decisions 14, 15 and 19 (migrations at startup, the health check, the version matching RDS), [ADR 0010](../../decisions/0010-ci-cd.md), decision 7 (PostgreSQL in CI's `test` job) and [ADR 0019](../../decisions/0019-api-skeleton-details.md) (the database joins `AppDeps`). This spec holds the details those left to the phase, as agreed in the brainstorm.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Local PostgreSQL](#local-postgresql)
  - [Configuration](#configuration)
  - [Layout of `apps/api`](#layout-of-appsapi)
  - [The connection](#the-connection)
  - [Startup and shutdown](#startup-and-shutdown)
  - [Health](#health)
  - [Test databases](#test-databases)
  - [Tests written in this phase](#tests-written-in-this-phase)
  - [CI](#ci)
  - [Tooling changes](#tooling-changes)
- [Documentation and records](#documentation-and-records)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: PostgreSQL runs locally in Docker Compose. The API applies its migrations at startup and reports whether the database is reachable and which schema version it holds. Tests run against isolated test databases, locally and in CI.

The phase is done when:

- `docker compose up -d --wait` starts PostgreSQL 18.6, which turns healthy, and `docker compose exec postgres psql -U szop` connects;
- after adding the `DATABASE_*` settings from `.env.example` to `apps/api/.env`, `pnpm dev` starts the API, logs `migrations applied` with the schema version `0000_init`, and `drizzle.__drizzle_migrations` holds one row;
- `curl http://127.0.0.1:3000/api/health` returns `200 {"status":"ok","database":{"status":"up","schemaVersion":"0000_init"}}`, and `503 {"status":"error","database":{"status":"down"}}` while the container is stopped;
- with the container stopped, `pnpm dev` exits with `startup failed` and the connection error, and `pnpm test` stops at once with a message saying to start it;
- `pnpm test` passes: the health route's tests against the worker's database, the cleanup's test, and the new configuration and schema version unit tests;
- `pnpm lint`, `pnpm format:check` and `pnpm typecheck` pass;
- on the PH-04 PR, CI's `test` job starts PostgreSQL with Compose, the tests pass, and `ci-ok` is green;
- the ADR, the living docs, the tool pages, `setup.md`, `testing.md` and `ci-cd.md` describe all of the above.

## Out of scope

- **Domain tables**: the first arrives with the phase that needs it (PH-15 or PH-16), through a normal `drizzle-kit generate`.
- **The access layer and composite workspace keys** ([OP-054](../../open-points.md#op-054)): the first data phase.
- **A CI check that the migrations match `schema.ts`**: pointless without a table; new **OP-075** (PH-15).
- **Which database role the app uses on RDS**, the master user or a least-privilege role: new **OP-073** (PH-12).
- **The ECS health check's tuning** (grace period, thresholds, the deployment circuit breaker with rollback): new **OP-074** (PH-12).
- **Upgrading to Drizzle 1.0** once it is stable, with its new migrations folder format: new **OP-076** (Candidates).
- **A production build** and the migrations folder's place in it: PH-06 and PH-08 (see [To verify during implementation](#to-verify-during-implementation)).

## Decisions taken in the brainstorm

Each refines an accepted ADR or fills a detail it left open; ADR 0020 records them.

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Drizzle's release line | 0.45 (stable, `latest`); 1.0 release candidate | **0.45.3.** It is what tutorials and Better Auth's Drizzle adapter target today. Moving to 1.0 later is a deliberate step, like a major update, which Dependabot proposes and which changes the migrations folder's layout (OP-076). The release candidate has the future API and format, but would put pre-release software, with documentation still moving, at the base of the project. |
| 2 | Driver | node-postgres (`pg`); postgres.js | **node-postgres**, the most widely used PostgreSQL client for Node and the one Better Auth's documentation shows. Its optional native binding is not installed, so it needs no install script. |
| 3 | Shape of the database settings | Separate variables; `DATABASE_URL` without the password plus `DATABASE_PASSWORD`; one `DATABASE_URL` with the password | **Separate variables:** `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`. On AWS, Terraform sets the first four as plain values and ECS injects the password from one key of the RDS-managed secret ([ADR 0008](../../decisions/0008-hosting.md), decision 22), so nothing is assembled. The pool takes the fields directly, so no password needs URL escaping (a generated one can hold `@`, `/` or `:`), and the tests swap only the name. A URL is the more familiar style, but would need parsing in the tests, and a URL holding the password would have to be assembled at container start. |
| 4 | The first migration | An empty custom migration; a minimal real object (an extension, a small table); no migration yet | **An empty custom migration, `0000_init`**, holding only a comment saying why it exists. It exercises the whole pipeline (journal, the record of applied migrations, startup, the test template, the version in the health check) without deciding now what a later phase should. A table kept only for tests would be dead schema in production; no migration would leave migrations at startup unproven. |
| 5 | The health route's answer | The latest migration's name, 503 when down; the number of applied migrations; reachability only | **The latest migration's name, read from Drizzle's journal; 503 when the database is down.** The version matches the file names in the repository, and a migration the code does not know shows as `"unknown"`. A count needs no journal, but is off by one against the file names (`0000_…` is version 1); reachability alone drops part of the roadmap's goal. The route is public; the name reveals nothing an attacker can use. |
| 6 | PostgreSQL in CI | `docker compose up --wait` with the same `compose.yaml`; a `services:` container in `ci.yml`; a service container whose image is read from `compose.yaml` | **Compose.** One version pin and one configuration, identical locally and in CI, and Dependabot's `docker-compose` updates reach CI too. A service container needs a second pin that Dependabot does not update (its `github-actions` ecosystem ignores service images), so the two would drift apart silently. `services:` is evaluated before any step, so reading the image from the file would need a preparatory job. Refines [ADR 0010](../../decisions/0010-ci-cd.md), decision 7. |
| 7 | How test databases live | Created upfront by `globalSetup`; one database per test file; created lazily per worker | **Upfront, by `globalSetup`:** the template recreated and migrated, then one copy per worker, once per run. The work happens once and in one place, so nothing races, and tests that do not need the database pay nothing. A database per file costs a `CREATE DATABASE` per file and leaves orphans after a crash; lazy creation runs once per file and races on `CREATE DATABASE`. The databases stay after the run, so they can be inspected. |
| 8 | Keeping PostgreSQL running | `restart: unless-stopped`; the tests start the container; manual | **`restart: unless-stopped`.** After one `docker compose up -d`, the container comes back whenever Docker Desktop starts, until it is stopped by hand. The tests still stop with a clear message when it is not running ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 12). Starting it from the tests would hide the database's lifecycle behind `pnpm test`, which ADR 0007 chose against when it rejected Testcontainers. |
| 9 | Credentials in `compose.yaml` | Literals; interpolated from `apps/api/.env` | **Literals** (`szop`), matching `apps/api/.env.example`. They guard a throwaway database reachable only from `127.0.0.1`, and are committed in `.env.example` anyway; real secrets exist only on AWS, where neither file is used. Interpolation would need `--env-file apps/api/.env` on every `docker compose` command (or a second `.env`), a `.env` in CI, and would still not change the password of an existing volume, since the image reads them only when it initialises an empty one. |
| 10 | Where tests get the server's address | `apps/api/.env`; constants in the test code | **`apps/api/.env`**, parsed and validated by the same `loadConfig`; only the database name is replaced. The credentials then live in two committed places side by side, `compose.yaml` and `.env.example`, instead of three. CI copies `.env.example` to `.env`, the same step `setup.md` gives. |
| 11 | An unreachable database at startup | Fail fast: log and exit; start anyway and retry the migrations in the background | **Fail fast.** On ECS, a stopped task is replaced, with an increasing delay for tasks that keep failing, and during a deployment the circuit breaker marks it failed; once the database is back, the next task starts. Starting anyway gives the same loop, slower and less visible (the load balancer fails the health check, then ECS replaces the task), and needs code for a retry and a "migrations pending" state. On the demo the realistic causes are mistakes (a wrong host or password, a missing security group rule), where a clear log line helps most. That a database blip replaces a running task through the combined health check is acceptable with one instance; separate liveness and readiness checks belong to systems with many (OP-074). |
| 12 | Who closes the pool | The code that creates it; `buildApp` on `app.close()` | **The code that creates it:** `server.ts` in production, `useTestDatabase()` in tests. If `buildApp` closed it, tests building a fresh app per test would close the worker's shared pool. |

## Design

### Local PostgreSQL

`compose.yaml` at the repository root:

```yaml
# PostgreSQL for local development and CI (ADR 0005, decision 4; ADR 0020).
name: szop
services:
  postgres:
    # The same major version as RDS (ADR 0008, decision 19). Debian-based, so
    # text sorts with glibc's locales, not Alpine's musl.
    image: postgres:18.6
    # Comes back whenever Docker Desktop starts, until stopped by hand.
    restart: unless-stopped
    # Local-only values, matching apps/api/.env.example.
    environment:
      POSTGRES_USER: szop
      POSTGRES_PASSWORD: szop
      POSTGRES_DB: szop
    # Only this machine can connect; Docker would otherwise publish the port
    # on every network interface.
    ports:
      - "127.0.0.1:5432:5432"
    # From PostgreSQL 18, the image keeps its data in a subfolder per major
    # version, so the volume is mounted one level up.
    volumes:
      - postgres-data:/var/lib/postgresql
    # What `docker compose up --wait` waits for.
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "szop", "-d", "szop"]
      interval: 2s
      timeout: 2s
      retries: 15
volumes:
  postgres-data:
```

- **The version** answers [OP-006](../../open-points.md#op-006): 18 is the newest major version on RDS (PostgreSQL 19 is not offered yet), and 18.6 its newest minor. The minor is pinned so the image is reproducible; Dependabot proposes minor updates and ignores majors (see [Tooling changes](#tooling-changes)).
- **The Debian-based image, not Alpine:** Alpine's musl C library sorts text differently from glibc, which RDS uses, and sorting matters in a shopping list.
- **`szop` is a superuser** locally, which the tests need for `CREATE DATABASE`. What the app uses on RDS is OP-073.
- **`psql`** runs in the container: `docker compose exec postgres psql -U szop`, documented in the tool page; no wrapper script.
- **The owner's step:** Docker Desktop is installed with its WSL integration; it must be running. `setup.md` gains the section it reserved for PH-04.

### Configuration

`config.ts` gains five required variables, validated like the existing ones (decision 3):

| Variable | Rule | Becomes | `.env.example` |
|---|---|---|---|
| `DATABASE_HOST` | a non-empty string | `database.host` | `127.0.0.1` |
| `DATABASE_PORT` | an integer from 1 to 65535 | `database.port` | `5432` |
| `DATABASE_NAME` | a non-empty string | `database.name` | `szop` |
| `DATABASE_USER` | a non-empty string | `database.user` | `szop` |
| `DATABASE_PASSWORD` | a non-empty string | `database.password` | `szop` |

- `Config` becomes `{ host, port, logLevel, database: { host, port, name, user, password } }`. The `database` part is exported as its own type, `DatabaseSettings`, which `createDatabase` takes.
- `loadConfig` already never puts a value in its error, so the password cannot leak through a configuration error.
- `.env.example` comments the block: the values match `compose.yaml`; on AWS the password comes from the RDS-managed secret.
- A developer who copied `.env.example` in PH-03 adds the new lines; the API names each missing one.

### Layout of `apps/api`

```
apps/api/
  drizzle.config.ts        drizzle-kit: dialect, schema path, output folder; no credentials,
                           since `generate` does not connect
  drizzle/                 generated and committed
    0000_init.sql
    meta/_journal.json     each migration's index, timestamp (`when`) and name (`tag`)
    meta/0000_snapshot.json
  src/
    db/
      schema.ts            the Drizzle schema; empty, with a comment saying where tables go
      database.ts          createDatabase(settings) → Database
      migrate.ts           runMigrations(db); the migrations folder's path
      schema-version.ts    readJournal(), schemaVersionFor(journal, createdAt),
                           currentSchemaVersion(db, journal)
      schema-version.test.ts
    test/
      global-setup.ts      the api project's globalSetup
      database.ts          testDatabaseSettings(), useTestDatabase(), truncateAllTables(db)
      database.test.ts
    health/routes.ts       now with the database check
    health/routes.test.ts
    app.ts, config.ts, config.test.ts, server.ts
```

- **Runtime dependencies:** `drizzle-orm` (0.45) and `pg`. **devDependencies:** `drizzle-kit` (0.31) and `@types/pg`.
- **New script** in `apps/api/package.json`: `db:generate`, `drizzle-kit generate`. The first migration is made once with `pnpm --filter @szop/api exec drizzle-kit generate --custom --name=init`, then filled with its comment.

### The connection

`db/database.ts`:

- **`createDatabase(settings: DatabaseSettings): Database`** creates a node-postgres `Pool` from the five fields and returns `drizzle({ client: pool })`. `Database` is that type (`NodePgDatabase` over a `Pool`); the pool is reachable as `db.$client`.
- **The pool** keeps node-postgres's defaults (up to 10 connections), with `connectionTimeoutMillis: 2000`, so an unreachable database fails within two seconds everywhere, including the health check. It connects lazily: creating it opens nothing.

`db/migrate.ts`:

- **`migrationsFolder`**, the path to `apps/api/drizzle/`, resolved from `import.meta.url`, so it does not depend on the working directory.
- **`runMigrations(db)`** calls Drizzle's `migrate(db, { migrationsFolder })`. Drizzle creates the `drizzle` schema and its `__drizzle_migrations` table if needed, then applies the pending migrations in one transaction. It takes no lock, which is safe: exactly one instance runs ([ADR 0008](../../decisions/0008-hosting.md), decision 14), and in tests only `globalSetup` migrates.

### Startup and shutdown

`server.ts`:

1. `loadConfig(process.env)`, as today.
2. `const db = createDatabase(config.database)`.
3. `const app = buildApp({ config, db })`. `AppDeps` becomes `{ config, db }`.
4. `await runMigrations(db)`, then `app.log.info({ schemaVersion }, "migrations applied")`, with the version from `currentSchemaVersion(db, readJournal())` (see [Health](#health)). The app is built first only so this uses its logger.
5. `await app.listen(…)`, as today.

- **A failure in step 4 or 5** is logged as `startup failed` with the error, the pool is closed, and the process exits with code 1 (decision 11).
- **On SIGINT or SIGTERM:** `await app.close()`, then `await db.$client.end()`, then exit (decision 12).

### Health

`buildApp` registers `healthRoutes` with `{ prefix: "/api", db, journal }`, where `journal` is read once by `buildApp` with `readJournal()`. `GET /api/health`:

```
200 {"status":"ok",    "database":{"status":"up","schemaVersion":"0000_init"}}
503 {"status":"error", "database":{"status":"down"}}
```

`db/schema-version.ts`:

- **`readJournal()`** reads `meta/_journal.json` from `migrationsFolder`, the same folder `runMigrations` applies.
- **`schemaVersionFor(journal, createdAt)`**, a pure function: the `tag` of the journal entry whose `when` equals `createdAt`, or `"unknown"` when none does (the database holds a migration this code does not know, such as an older image against a newer database).
- **`currentSchemaVersion(db, journal)`** runs `SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1` and maps the result with `schemaVersionFor`. Drizzle stores the journal's `when` as `created_at` (a `bigint`, which node-postgres returns as a string, so it is converted with `Number`). The one query proves the database reachable and gives the version; a `SELECT 1` would add nothing.

The route:

- **Calls `currentSchemaVersion`.** On success, `200` with the version.
- **On any error** (refused, the two-second connection timeout, anything else): logs it at `warn` with the error and answers `503`. The body carries no error detail; the route is public, and the detail is in the log.
- **No caching** (the load balancer's checks every few seconds cost one query on a one-row table) and **no Fastify response schema** yet (none exists in PH-03; the shared schemas come with the first real contract).

### Test databases

**`test/database.ts`:**

- **`testDatabaseSettings(name)`** reads `apps/api/.env` with `node:util`'s `parseEnv`, which does not touch `process.env`, validates it with `loadConfig`, and returns its `database` settings with `name` replaced (decision 10). A missing file fails with "apps/api/.env is missing: copy apps/api/.env.example (see docs/development/setup.md)".
- **`useTestDatabase()`**, called at the top of a test file that needs the database:
  - `beforeAll`: `createDatabase(testDatabaseSettings(\`szop_test_${process.env.VITEST_POOL_ID}\`))`;
  - `beforeEach`: `truncateAllTables(db)`, before rather than after, so a test starts clean even after a crashed one;
  - `afterAll`: `db.$client.end()`;
  - returns `{ db }`, a getter the test passes to `buildApp({ config, db })`.
- **`truncateAllTables(db)`**, one round trip that reads the table list each time, so it never goes stale ([OP-011](../../open-points.md#op-011)):

  ```sql
  DO $$
  DECLARE tables text;
  BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
      INTO tables FROM pg_tables WHERE schemaname = 'public';
    IF tables IS NOT NULL THEN
      EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
    END IF;
  END $$;
  ```

  Only the `public` schema, where the app's tables live; Drizzle's table is in `drizzle` and is never emptied. `RESTART IDENTITY` resets sequences, so IDs are predictable from test to test.

**`test/global-setup.ts`**, registered as `globalSetup` in `apps/api/vitest.config.ts`, once per run (decision 7):

1. Connect to the `postgres` maintenance database, never `szop`, with `testDatabaseSettings("postgres")`. If it fails, stop the run with "Cannot reach PostgreSQL at 127.0.0.1:5432 (ECONNREFUSED). Start it with `docker compose up -d`." ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 12).
2. `DROP DATABASE IF EXISTS szop_test_template WITH (FORCE)`, then `CREATE DATABASE szop_test_template`. Recreated every run, so the template matches the code's migrations even after switching branches; `WITH (FORCE)` closes connections a crashed run left behind.
3. `runMigrations` on the template, the same function as production, then close that connection: PostgreSQL copies a template only when nothing is connected to it.
4. For each worker `i` from 1 to Vitest's `maxWorkers`: `DROP DATABASE IF EXISTS szop_test_i WITH (FORCE)`, then `CREATE DATABASE szop_test_i TEMPLATE szop_test_template`.
5. Close the maintenance connection. No teardown: the databases stay until the next run, for inspection with `psql`.

Database names are built from the fixed prefix and a number, never from input, so they are interpolated into the statements safely.

### Tests written in this phase

Written first and seen failing, then made to pass ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 3).

- **`health/routes.test.ts`, the first test against the database** ([OP-012](../../open-points.md#op-012)):
  - with `useTestDatabase()`: `GET /api/health` answers 200 and `{ status: "ok", database: { status: "up", schemaVersion: "0000_init" } }`, which also proves the template was migrated;
  - with a database built for `127.0.0.1` port 1 (refused at once), closed after the test: 503 and `{ status: "error", database: { status: "down" } }`.
- **`test/database.test.ts`:** `truncateAllTables` empties a probe table created by the test and leaves Drizzle's table with its row; the probe table is dropped in `finally`.
- **`db/schema-version.test.ts`, unit tests:** a known `created_at` gives its tag (as a number or a numeric string); an unknown one gives `"unknown"`.
- **`config.test.ts`:** the five `DATABASE_*` variables are named when missing, `DATABASE_PORT` is range-checked, empty strings are rejected, `DATABASE_PASSWORD`'s value never appears in the error, and a valid environment gives the nested `database` settings.
- **Checked by hand** ([ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 10): `pnpm dev` logs `migrations applied`; `curl` shows the version, then 503 with the container stopped; `pnpm dev` and `pnpm test` with the container stopped give their messages; Ctrl+C closes the pool without errors.

### CI

The `test` job in `ci.yml` gains two steps before `pnpm test:coverage` (decisions 6 and 10):

```yaml
- run: cp apps/api/.env.example apps/api/.env
- run: docker compose up -d --wait
```

Docker and Compose are preinstalled on `ubuntu-24.04` runners; the runner is discarded after the job, so nothing is torn down. `compose.yaml` is not Markdown, so a change to it runs the tests.

### Tooling changes

- **`.github/dependabot.yml`** ([OP-068](../../open-points.md#op-068), PH-04 part): a `docker-compose` entry at `/`, weekly on Monday with the same cooldown, minor and patch updates grouped, majors ignored (PostgreSQL's major changes on purpose, with RDS, audit m13), commit prefix `build`. The header comment updated.
- **`apps/api/vitest.config.ts`:** `globalSetup: ["src/test/global-setup.ts"]`.
- **`pnpm-workspace.yaml`:** unchanged, unless an install script asks for an `allowBuilds` decision; the owner decides, as in PH-03.
- **Before committing `ci.yml`:** actionlint and zizmor at CI's pinned versions, as in PH-02.

## Documentation and records

- **ADR 0020, "Database details":** the decisions above. **Refines** [ADR 0010](../../decisions/0010-ci-cd.md), decision 7 (Compose rather than a service container). **Completes** [ADR 0005](../../decisions/0005-development-environment.md), decision 4 (the version and the Compose details); [ADR 0007](../../decisions/0007-testing-strategy.md), decisions 12 and 13 (the mechanism); [ADR 0008](../../decisions/0008-hosting.md), decisions 14, 15 and 19 and its consequence on the connection settings. Noted in ADR 0020's header, the earlier ADRs' status lines and their decisions' cells, as `CLAUDE.md` asks.
- **Tool pages** in `docs/development/tools/`: `docker-compose.md` (Compose and the PostgreSQL service: the file explained, `up -d --wait`, `stop` and `down`, `down -v` to start over, `psql`, the PostgreSQL 18 volume path) and `drizzle.md` (the schema, `db:generate`, `--custom`, the journal, how migrations are applied at startup, and that Drizzle applies only migrations newer than the latest one recorded, so a migration with an older timestamp merged later is skipped).
- **`setup.md`:** Docker Desktop with its WSL integration, `docker compose up -d --wait`, the `DATABASE_*` lines in `.env`.
- **`testing.md`:** "Running the tests" (the container must run), a new "Writing a database test" (`useTestDatabase()`, what is emptied and when, inspecting `szop_test_*` with `psql`), the layers.
- **`ci-cd.md`:** the `test` job's new steps.
- **Architecture:** `src/db` in the layout, the startup sequence, the health route's answers, pool ownership.
- **Stack overview:** PostgreSQL in Docker, Drizzle and migrations, template databases.
- **Threat model:** the public health route reveals reachability and the migration name, judged harmless; the local database port is bound to localhost.
- **Glossary:** new terms as they appear.
- **README:** the "Development" section starts the database before `pnpm dev`.
- **Open points:**
  - closed: [OP-005](../../open-points.md#op-005) (its last part), [OP-006](../../open-points.md#op-006) (18.6), [OP-011](../../open-points.md#op-011);
  - PH-04 parts ✅, each entry moved to its next phase's group: [OP-012](../../open-points.md#op-012) (PH-05), [OP-013](../../open-points.md#op-013) (PH-06), [OP-068](../../open-points.md#op-068) (PH-08);
  - [OP-067](../../open-points.md#op-067) moved to PH-05, since it does not depend on this phase;
  - new: **OP-073** (PH-12) the app's database role on RDS; **OP-074** (PH-12) the ECS health check's grace period and thresholds, and the deployment circuit breaker with rollback; **OP-075** (PH-15) a CI check that the migrations match `schema.ts`; **OP-076** (Candidates) upgrading to Drizzle 1.0.
- **Roadmap and README diagram:** the PH-04 row 🚧 with the spec, plan and PR links as they land, ✅ before the merge, in the same commits ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)); "Owner steps" becomes "have Docker Desktop running".

## Tasks

One commit per task.

1. **Local PostgreSQL:** `compose.yaml`, the `docker-compose` entry in `dependabot.yml`, the `setup.md` section, `docker-compose.md`. *Verify:* `docker compose up -d --wait` turns healthy; `psql` connects; `docker compose ps` shows the restart policy.
2. **Database settings (TDD):** `config.ts`, `config.test.ts`, `.env.example`. *Verify:* the new tests failed before the code and pass after.
3. **Drizzle and migrations at startup:** the packages, `drizzle.config.ts`, `0000_init`, `db/database.ts`, `db/migrate.ts`, `db/schema-version.ts` with its unit tests (TDD), `AppDeps`, `server.ts`, `drizzle.md`. *Verify:* `pnpm dev` logs `migrations applied` with `0000_init`; `drizzle.__drizzle_migrations` has one row; a stopped container gives `startup failed`; Ctrl+C exits cleanly.
4. **Test databases:** `global-setup.ts`, `test/database.ts` and its test, the Vitest config, `testing.md`. *Verify:* `pnpm test` passes and `\l` lists `szop_test_template` and one copy per worker; with the container stopped, `pnpm test` stops with the message.
5. **Health with the database (TDD):** `health/routes.ts` and its tests. *Verify:* the tests failed before and pass after; `curl` shows the version, then 503 with the container stopped.
6. **CI:** the two steps in the `test` job, `ci-cd.md`. *Verify:* actionlint and zizmor clean; the PR's `test` job passes.
7. **Records and registers:** ADR 0020 with its cross-references, the architecture, the stack overview, the threat model, the glossary, the README, the open points and the roadmap. *Verify:* links resolve; contents lists in sync; the definition of done is walked through.

## To verify during implementation

- **Drizzle 0.45.3 stores the journal's `when` as `created_at`:** confirmed in its source during the brainstorm (`pg-core/dialect.js`, `migrate`); re-check after installing (task 3).
- **`drizzle-kit generate --custom`** with an empty schema writes `0000_init.sql`, a journal entry and a snapshot (task 3).
- **`migrationsFolder` resolved from `import.meta.url`** works under tsx and Vitest; PH-06's build and PH-08's image must copy `drizzle/` next to the compiled code, noted there if it is not obvious (task 3).
- **Vitest 5's `globalSetup`** receives the project and its resolved `maxWorkers`, and `VITEST_POOL_ID` stays within 1 to `maxWorkers` across both projects (task 4).
- **`CREATE DATABASE … TEMPLATE`** takes about 50–200 ms per copy; measure, and note the run's added time in `testing.md` (task 4).
- **`pg` installs without an install script**, leaving `allowBuilds` unchanged (task 3).
- **`bigint` from node-postgres** arrives as a string; `schemaVersionFor` accepts both forms (task 3).
- **A Compose project named `szop`** does not clash with anything already on the owner's Docker Desktop (task 1).
