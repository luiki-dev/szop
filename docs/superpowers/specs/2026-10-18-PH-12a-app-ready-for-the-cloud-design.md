# PH-12a App ready for the cloud — design

- **Phase:** [PH-12a](../../roadmap.md#ph-12a-app-ready-for-the-cloud) ([#219](https://github.com/luiki-dev/szop/issues/219))
- **Date:** 2026-10-18
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-043](https://github.com/luiki-dev/szop/issues/84) (PH-12a part, then on to PH-12c); [OP-017](https://github.com/luiki-dev/szop/issues/68) (PH-12a part, then on to PH-12c); [OP-085](https://github.com/luiki-dev/szop/issues/88) and [OP-072](https://github.com/luiki-dev/szop/issues/85) (settled); [OP-097](https://github.com/luiki-dev/szop/issues/224) and [OP-098](https://github.com/luiki-dev/szop/issues/225) (new candidates)

The app gets ready for Elastic Container Service (ECS) and RDS before it gets there, so that the first real deploy in [PH-12c](../../roadmap.md#ph-12c-app-on-ecs-and-rds) meets no app-side surprise. Everything in this phase runs and is tested locally; no AWS resource changes. The phase was split from PH-12 First deploy at the start of its brainstorm ([decision 1](#decisions-taken-in-the-brainstorm)). The decisions below are recorded in ADR 0033.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Files](#files)
  - [The migration check](#the-migration-check)
  - [Resetting the local database](#resetting-the-local-database)
  - [TLS to the database](#tls-to-the-database)
  - [The shutdown deadline](#the-shutdown-deadline)
  - [Quieter health checks](#quieter-health-checks)
- [Documentation and records](#documentation-and-records)
- [Roadmap and GitHub changes](#roadmap-and-github-changes)
- [Owner steps](#owner-steps)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: the app is ready for ECS and RDS before it gets there. It refuses to start, with a clear log message, against a database holding migrations it does not know or one it would skip; it connects to the database with TLS and full certificate verification when configured to; it exits within ECS's stop timeout even while connections stay open; and the load balancer's health checks no longer fill the log.

The phase is done when:

- the app refuses to start, logging one error that names each mismatched migration, its case and the remedy, and exits with code 1, in each of the three cases of [decision 3](#decisions-taken-in-the-brainstorm) (unknown, skipped, edited); tests prove each case and the matching case that starts normally;
- `pnpm db:reset` wipes the local database and brings it back empty and healthy;
- `DATABASE_TLS` is a required setting; unit tests prove that `none` gives a pool without TLS options and `verify-full` a pool with the committed RDS bundle and `rejectUnauthorized: true` (the handshake itself is proven in PH-12c, [decision 5](#decisions-taken-in-the-brainstorm)); a missing or unknown value fails startup like any other bad setting;
- the shutdown check of [decision 6](#decisions-taken-in-the-brainstorm) is done and its result recorded, and a shutdown held open by a connection ends within the deadline, as a check by hand shows;
- a successful `GET /api/health` writes no log line, and a failing one still logs `database check failed`, as API tests prove;
- `pnpm test`, the lint and type checks, and the E2E suite pass;
- the docs and records listed under [Documentation and records](#documentation-and-records) are updated, and the roadmap and GitHub as in [Roadmap and GitHub changes](#roadmap-and-github-changes).

## Out of scope

- **The demo's side of each item**: [PH-12c](../../roadmap.md#ph-12c-app-on-ecs-and-rds) sets `DATABASE_TLS=verify-full` on ECS and proves the handshake with RDS; sets ECS's deployment to a minimum of 0% and a maximum of 100% healthy tasks; tunes the health check, the stop timeout and the load balancer's deregistration delay; and writes the runbook's explanation of the migration check's message and of switching branches on the demo ([OP-043](https://github.com/luiki-dev/szop/issues/84), [OP-018](https://github.com/luiki-dev/szop/issues/73)).
- **The database role the app uses on RDS** ([OP-074](https://github.com/luiki-dev/szop/issues/86)): PH-12c.
- **Keeping data between demo sessions** ([OP-097](https://github.com/luiki-dev/szop/issues/224)) and **a representative seed** ([OP-098](https://github.com/luiki-dev/szop/issues/225)): candidates ([decision 2](#decisions-taken-in-the-brainstorm)).
- **The health route's `"unknown"` schema version**: it stays as it is. The app no longer starts in that state, so the route can only show it if the database changes under a running app.
- **A local PostgreSQL with TLS to test the handshake**: [decision 5](#decisions-taken-in-the-brainstorm).

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | The phase's scope | Keep PH-12 whole; split it in two (the app's preparation, then all the infrastructure); split it in three | **PH-12 First deploy is retired and split into three phases:** PH-12a App ready for the cloud (the app-side changes, no AWS), PH-12b Network and the demo-up button (the network, the load balancer with a placeholder page, the certificate, the DNS record and the real `demo-up`) and PH-12c App on ECS and RDS. PH-12 held about twenty tasks and two new concepts, the network with the push-button deploy, and the app on ECS with a managed database ([ADR 0014](../../decisions/0014-roadmap.md), decision 6). Two phases would have left one of about twelve tasks with both concepts. ECS and RDS stay together: the app does not start without a database, so either alone ends with nothing working. |
| 2 | Data that survives | Data disposable for good; keep it from now; keep the door open | **Data stays disposable today, and the door stays open for data that survives.** The owner does not want to rule out real data. Keeping it does not grow harder as the app grows, since every demo database until then is empty and thrown away; what could grow is an assumption of an empty database baked into the code. So: the migration check's remedy lives in its message and the docs, not in its logic; a seed, if one comes, is an explicit command and never runs at startup; and the check catches edited migrations, harmless on a throwaway database but not on a kept one. The options for keeping data (a snapshot between sessions, a stopped database in base, a dump to S3, Aurora scaling to zero), with their costs and what they change for branch deploys, are candidate [OP-097](https://github.com/luiki-dev/szop/issues/224); the owner's idea of a seed that shows the system in the middle of use is candidate [OP-098](https://github.com/luiki-dev/szop/issues/225). |
| 3 | The migration check ([OP-043](https://github.com/luiki-dev/szop/issues/84)) | Rely on Drizzle; check unknown and skipped migrations; check those and edited ones | **Before migrating, the app compares the migrations recorded in the database with its own, and refuses to start on any of three cases.** **Unknown:** a recorded migration this code does not have (an older commit on a newer database). **Skipped:** a migration of this code, not recorded, older than the newest recorded one, which Drizzle 0.45 would skip without a word ([ADR 0020](../../decisions/0020-database-details.md), consequences). **Edited:** a recorded migration whose content differs from this code's file with the same timestamp. Each case comes from switching branches against one database, on the demo or locally, and each would otherwise fail later and far from its cause, or not at all. Refines [ADR 0008](../../decisions/0008-hosting.md), decision 14. |
| 4 | The remedy, locally *(Claude's call)* | Document the Docker commands; a script | **`pnpm db:reset`** wipes the local database and starts it again, empty; the next `pnpm dev` migrates it. On the demo the remedy is `demo-down`, then `demo-up` (PH-12c's runbook). The check's message names both. |
| 5 | TLS to the database ([OP-017](https://github.com/luiki-dev/szop/issues/68)) *(Claude's call)* | A flag; a path to a certificate bundle; a mode named after libpq's `sslmode` | **A required setting `DATABASE_TLS`, `none` or `verify-full`**, written like `TRUSTED_PROXIES=none` and with no default ([ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 2). `verify-full` uses the RDS bundle committed in PH-08 ([ADR 0028](../../decisions/0028-container-image-details.md)) and rejects a certificate it does not vouch for or one issued for another host. Local development, Compose and the tests use `none`. Unit tests prove the pool's options for each value; the handshake itself is proven on the demo in PH-12c, since a local PostgreSQL with TLS would take a test CA, a server certificate and a second Compose service to prove what the demo proves anyway. |
| 6 | The shutdown deadline ([OP-085](https://github.com/luiki-dev/szop/issues/88)) | Leave shutdown as it is; Fastify's `forceCloseConnections: true`; a deadline | **A 10-second deadline, kept even if the 145-second hang turns out to be gone.** The hang in PH-06a's browser check was most likely WSL's mirrored networking, since dropped, which held connections to closed ports open; the phase checks that first, now that Chrome runs inside Linux. A slow client or a long request can still hold a shutdown past ECS's 30-second kill, which cuts off requests and skips closing the pool, and the deadline is a few lines. `forceCloseConnections: true` would cut every request in flight at once. Refines [ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 8. |
| 7 | Quieter health checks ([OP-072](https://github.com/luiki-dev/szop/issues/85)) *(Claude's call)* | Raise the route's `logLevel` to `warn`; turn request logging off for the route | **Request logging is off for `/api/health` only: Fastify's `disableRequestLogging` gets a function that is true for that route.** Its two request lines per check go, its own `database check failed` warning stays, so an outage still shows, and `LOG_LEVEL` still governs everything. A route `logLevel` was the first idea, but the spec's builder check found that Fastify 5.12 gives such a route a logger fixed at that level: the route would log warnings even with `LOG_LEVEL=silent`, including in the tests. |

## Design

### Files

```text
apps/api/src/
  db/migration-check.ts       new: compares recorded and local migrations
  db/migration-check.test.ts  new
  db/database.ts              DATABASE_TLS → the pool's ssl options
  config.ts                   the DATABASE_TLS setting
  app.ts                      no request lines for /api/health
  server.ts                   the check before migrating; the deadline
  test/config.ts              DATABASE_TLS for the tests
apps/api/.env.example         DATABASE_TLS=none
compose.yaml                  DATABASE_TLS: none for the app profile
package.json                  db:reset
Dockerfile                    the bundle's comment names PH-12a and PH-12c
```

The plan may add files, such as a small module for the deadline's timing so that it can be unit-tested.

### The migration check

It runs in `server.ts` after the pool is created and before `runMigrations`, so a mismatch stops startup before Drizzle touches the database.

- **This code's migrations** come from Drizzle's own reader of the migrations folder (`readMigrationFiles` from `drizzle-orm/migrator`), which gives each migration's timestamp (the journal's `when`) and the hash Drizzle records for it. Using Drizzle's reader keeps the hashes identical to what Drizzle writes. The names (`0000_init`) come from the journal, as the health route's do.
- **The recorded migrations** are every row of `drizzle.__drizzle_migrations` (`hash`, `created_at`). On a new, empty database the schema and table do not exist yet: that counts as nothing recorded, and the check passes.
- **The comparison** is a pure function from the two lists to the three lists of mismatches, so it is unit-tested with a table of cases (`it.each`): unknown (a recorded `created_at` matching no local timestamp), edited (a matching timestamp, a different hash) and skipped (a local migration not recorded, older than the newest recorded `created_at`). A local migration newer than every recorded one is pending, not a mismatch: Drizzle runs it next.
- **On a mismatch** startup stops with one error log line and exit code 1, through the same path as any other failed start. The line names, per case, each migration (by name; an unknown one by its timestamp, since this code has no name for it) and the remedy: "Reset the database: `pnpm db:reset` locally; on the demo, `demo-down` then `demo-up`." The remedy is text in the message and the docs only, so a kept database ([OP-097](https://github.com/luiki-dev/szop/issues/224)) can get another one without changing the check.
- **Tests against a real database** cover the reading of recorded rows and one case end to end. Changing `drizzle.__drizzle_migrations` in a worker's shared test database would break other files' tests, so these tests use a database of their own, or restore the table in `finally`; the plan picks.

### Resetting the local database

`pnpm db:reset` at the root stops the Compose `postgres` service, removes its named volume (`postgres-data`) and starts it again with `--wait`, so it returns empty and healthy. The test databases live in the same server and go too; the next `pnpm test` recreates them. It touches only the `postgres` service and its volume.

### TLS to the database

`config.ts` reads `DATABASE_TLS` into `database.tls`, `"none"` or `"verify-full"`; anything else, or nothing, fails startup with the usual configuration error. `createDatabase` passes no `ssl` option for `none`. For `verify-full` it reads `apps/api/certs/rds-global-bundle.pem`, resolved from the module's own location like `migrationsFolder`, and passes `ssl: { ca, rejectUnauthorized: true }`; node-postgres then checks the certificate chain and the host name. A missing bundle with `verify-full` fails startup. The unit tests read the options back from the pool.

### The shutdown deadline

1. **The check first.** `pnpm start`, open the app in the Linux Chrome, close the tab, send SIGTERM, and time the exit. The result goes into ADR 0033's decision and OP-085's "settled by" comment, whichever way it goes.
2. **The deadline.** The SIGTERM and SIGINT handler starts a 10-second timer next to the existing `app.close()`. If the timer fires, the app logs a warning with the number of connections still open, closes them all (`closeAllConnections()` on the HTTP server), and the normal path finishes: the pool closes and the process exits with code 0. If it has still not exited 5 seconds later, it exits with code 1. Both timers are `unref`'d, so they never keep the process alive on their own. The whole shutdown therefore ends within 15 seconds, inside ECS's 30.
3. **Testing.** `server.ts` stays checked by hand ([ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 10): a connection held open (for example `nc` sending half a request) delays the exit by the deadline and no more. Timing logic moved to a module of its own gets a unit test with fake timers.

### Quieter health checks

`buildApp` passes Fastify `disableRequestLogging` as a function that is true for the health route (matched by its route URL, `/api/health`, not by the raw request URL, so a query string does not slip through). An API test reads the log at `info` and checks that a healthy request to `/api/health` writes nothing, that a request with the database down writes the `database check failed` warning, and that a request to another path still writes its request lines ([Reading the log](../../development/testing.md#reading-the-log)).

## Documentation and records

- **ADR 0033 "App ready for the cloud details"**: the decisions above. ADR 0008's decision 14, ADR 0019's decision 8 and their status lines get their notes.
- **`docs/development/tools/drizzle.md`**: the migration check, its three cases with an example of each, its message, and `pnpm db:reset`; the existing advice to regenerate a migration on top of `main` stays.
- **`docs/development/scripts.md`**: `db:reset`.
- **`docs/development/setup.md`** and **`apps/api/.env.example`**: `DATABASE_TLS`, and that an existing `.env` needs the line.
- **`docs/development/testing.md`**: `testConfig()`'s new field, if the description lists the fields.
- **`docs/development/tools/docker.md`**: the bundle's use, naming PH-12a and PH-12c.
- **`docs/architecture/architecture.md`**: the startup order (configuration, the migration check, migrations, listening), the shutdown deadline and the health route's silence in the log.
- **`docs/architecture/stack-overview.md`**: TLS certificate verification (a certificate authority bundle, `verify-full`), if not explained yet.
- **`docs/glossary.md`**: any acronym the phase brings that is not there yet (for example CA).

## Roadmap and GitHub changes

Already done in the brainstorm (the branch's first commit and on GitHub): the split of PH-12 into PH-12a, PH-12b and PH-12c, with their issues, owner steps and open points, the roadmap, its table and the README's diagram, and the links in the living docs; the candidates OP-097 and OP-098.

Before the PR, listed in it:

- The stage table's row: spec, plan and PR links; the issue's Spec and Plan fields; PH-12a's body from the roadmap entry.
- [OP-043](https://github.com/luiki-dev/szop/issues/84), [OP-017](https://github.com/luiki-dev/szop/issues/68): PH-12a part ticked, re-parented to PH-12c.
- [OP-085](https://github.com/luiki-dev/szop/issues/88), [OP-072](https://github.com/luiki-dev/szop/issues/85): closed by the PR, each with a "settled by" comment; OP-085's names the shutdown check's result.

## Owner steps

None: nothing in this phase touches AWS or a GitHub setting.

## Tasks

About five, for the plan to detail:

1. The migration check: the comparison and its unit tests, reading the recorded rows, the wiring in `server.ts`, the database tests.
2. `pnpm db:reset`, and the migration check's docs in `drizzle.md` and `scripts.md`.
3. `DATABASE_TLS`: the setting, the pool's options, `.env.example`, Compose, `testConfig`, and their docs.
4. Shutdown: the check, then the deadline; and the health route's request logging with its API test.
5. ADR 0033, the notes in ADRs 0008 and 0019, the architecture and the other living docs, the glossary, the roadmap and the GitHub changes.

## To verify during implementation

- That `readMigrationFiles` is exported from `drizzle-orm/migrator` in 0.45 and hashes exactly what the migrator records (the whole SQL file, SHA-256).
- That node-postgres 8.23 checks the host name with `ssl: { ca, rejectUnauthorized: true }` when connecting by a DNS name, as RDS endpoints are (it passes the host as `servername`).
- ✅ **A route's `logLevel`:** Fastify 5.12 fixes such a route's logger at that level whatever `LOG_LEVEL` says; settled by [decision 7](#decisions-taken-in-the-brainstorm) (found by the builder check).
- That `disableRequestLogging`'s function sees the matched route (`request.routeOptions.url`) when it runs, for both request lines.
- That `closeAllConnections()` lets a pending `app.close()` resolve in Fastify 5.12.
- That `docker compose` removes the named volume as `pnpm db:reset` expects (the volume's full name is `szop_postgres-data`).
