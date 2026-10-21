# PH-37 Two tasks — design

- **Phase:** [PH-37](../../roadmap.md#ph-37-two-tasks) ([#233](https://github.com/luiki-dev/szop/issues/233))
- **Date:** 2026-10-21
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-103](https://github.com/luiki-dev/szop/issues/249), settled (the gap accepted); [OP-033](https://github.com/luiki-dev/szop/issues/116), its PH-37 part (the migration lock)

PH-12c put the walking skeleton on one ECS task and PH-12d made its redeploys safe, built the way two tasks need. This phase runs two. The direction was settled by [ADR 0036](../../decisions/0036-scalability-and-isolation.md), decisions 1, 2, 10, 11 and 14: two tasks, a PostgreSQL advisory lock around the migrations, request IDs unique across tasks, a pool of at most 5 connections with a budget, and a Compose profile with two app containers behind nginx. This spec holds the details those left to the phase. They are recorded in ADR 0040. The owner settled how the phase is proven (two running tasks in the ECS console, and requests seen reaching both) and accepted OP-103's gap, then left every other detail to Claude, to be argued here.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Files](#files)
  - [The instance ID](#the-instance-id)
  - [Request IDs](#request-ids)
  - [The pool and the connection budget](#the-pool-and-the-connection-budget)
  - [The migration lock](#the-migration-lock)
  - [The Compose profile scale](#the-compose-profile-scale)
  - [demo-up.yml](#demo-upyml)
  - [The watch script](#the-watch-script)
- [Documentation and records](#documentation-and-records)
- [Roadmap and GitHub changes](#roadmap-and-github-changes)
- [Owner steps](#owner-steps)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: the demo runs two tasks, one in each availability zone. They migrate the database one at a time, a request does not depend on which task answers it, and a deploy or a stopped task loses no request. Two instances run locally and in CI too, so a problem between tasks shows up there first.

The phase is done when:

- `pnpm check` passes, with a test of two migrators at once (both succeed, each migration is recorded once, a data migration runs once), and tests for the instance ID in `/api/health`'s two bodies, for request IDs being UUIDs that ignore a client's header, and for the pool's limit;
- `pnpm check:scale` starts two app containers behind nginx on a fresh database, both become healthy, and the answers from `/api/health` through nginx name both instances; CI's `docker` job runs it after `check-image.sh`; `pnpm check:image`, `pnpm check:infra` and `pnpm check:workflows` pass;
- **on the demo:** `demo-up` on the phase branch finishes green; the ECS console shows two tasks Running, in two different availability zones; the [watch script](#the-watch-script), run for half a minute, shows both instances answering `200`; the `max_connections` the app logged at startup is recorded in the runbook and the budget checked against it; `demo-down` reports `Destroy complete!`;
- the docs and records under [Documentation and records](#documentation-and-records) are updated, and the roadmap and GitHub as in [Roadmap and GitHub changes](#roadmap-and-github-changes).

"A deploy or a stopped task loses no request" rests on PH-12d's rolling deploy, already proven with the watch script, and on the load balancer's health checks. It is not run again on the demo *(the owner's choice: two running tasks and requests reaching both are the proof)*; the runbook says how to check it with the same script.

## Out of scope

- **Autoscaling** and checking the budget again at four tasks: [PH-38](../../roadmap.md#ph-38-autoscaling).
- **Shared state for features not built yet:** the rate-limit counters in Redis ([PH-20](../../roadmap.md)), the cleanup job's try-lock ([PH-31](../../roadmap.md)), fan-out of live updates ([PH-33](../../roadmap.md#ph-33-live-updates)). [ADR 0036](../../decisions/0036-scalability-and-isolation.md) places each in its phase.
- **Fixing OP-103's gap** ([decision 1](#decisions-taken-in-the-brainstorm)).
- **Sticky sessions**, for any reason.
- **Multi-AZ RDS** and separate migration and runtime roles: OP-033's always-on parts.
- **The instance ID on the SPA's status page:** the shared schema gains the field, the page stays as it is, as PH-12d did with the commit.
- **Load-balancer access logs** and tracing across services.

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | A page load mixing two SPA versions ([OP-103](https://github.com/luiki-dev/szop/issues/249)) | Sticky sessions on the target group; the previous release's assets kept reachable (storage shared between releases); a client that reloads once when an asset is missing; the gap accepted and recorded | **The gap accepted and recorded** *(the owner's choice)*. The demo is redeployed a few times a phase, its main user is the owner, and a reload fixes the blank page. Sticky sessions fight this phase's goal that a request does not depend on which task answers it; shared asset storage brings a new component; a reload-on-error client is code to maintain for a demo. The runbook and the architecture describe the gap as accepted, citing ADR 0040; OP-103 closes as settled by the PR. If Szop ever runs always-on, the choice is revisited with OP-033's list. |
| 2 | How the demo is proven | A redeploy and a stopped task under the watch script; two tasks in the console; requests seen reaching both | **Two tasks Running in the ECS console, and requests seen reaching both** *(the owner's choice, the second "if it does not take too much effort")*. |
| 3 | How requests are seen reaching both tasks *(Claude's call)* | The task's ID from the ECS metadata endpoint; the host name or IP; a random ID per process | **A random instance ID per process**, 8 hexadecimal characters drawn at startup, in `/api/health`'s two bodies as `instance` and in the `migrations applied` log line. It works the same on ECS, in Compose and in the tests, needs no ECS endpoint, and tells an attacker nothing: it is not an address, and it changes with every start. The watch script prints it, and `check:scale` counts the distinct values. The startup log line ties an ID to its task's log stream in CloudWatch. |
| 4 | Request IDs ([ADR 0036](../../decisions/0036-scalability-and-isolation.md), decision 10, which left trusting the trace ID to this phase) *(Claude's call)* | The load balancer's `X-Amzn-Trace-Id` where present, a UUID otherwise; always a random UUID | **Always a random UUID** (`crypto.randomUUID()` as Fastify's `genReqId`); the trace ID is not used. The load balancer keeps a `Root` field the client sends, so a client could give many requests the same ID, or one that looks like another request's, and make the logs lie. Correlating with the load balancer needs its access logs, which Szop does not keep. Fastify already ignores an incoming `request-id` header by default (`requestIdHeader: false`), which stays. This refines decision 10. |
| 5 | The connection the lock is held on *(Claude's call)* | A separate `pg.Client`; a connection checked out of the app's pool | **A connection checked out of the app's pool** (`pool.connect()`), held from before the migration check until after the migration, then unlocked and released. The audit's [check A](../../audits/2026-10-19-scalability-and-isolation-analysis.md#check-a-two-migrators-at-once) proved this exact shape. It needs no second set of connection settings, and while the lock is held the migration uses a second pooled connection, two of the five. The budget therefore is 5 per task, not ADR 0036's 5 + 1; the ADR's 48 stays a safe upper bound. A session-level lock outlives a released connection, so the code unlocks before it releases, and on an error releases the connection as broken, so the pool closes it and PostgreSQL drops the lock. |
| 6 | Waiting for the lock *(Claude's call)* | `pg_advisory_lock` with no limit; with `lock_timeout`; `pg_try_advisory_lock` in a loop | **`pg_advisory_lock` with no limit**, with a log line before (`waiting for the migration lock`) and after. A holder that dies loses its session and its lock at once. A holder that hangs keeps the waiter from listening, so both fail the load balancer's checks after the 60-second grace period and ECS replaces them, which is the same outcome a timeout would give, with no number to tune. The grace period stays at 60 seconds: the second task waits only as long as the first one's migration. |
| 7 | The lock's key *(Claude's call)* | A hash of a name computed at runtime; a fixed number | **A fixed 64-bit number in the code**, with a comment saying what it guards. PostgreSQL's `hashtext` is not a documented stable API; a constant is plain to read in `pg_locks`. PH-31's cleanup lock will take another constant beside it. |
| 8 | Reading `max_connections` *(Claude's call)* | ECS Exec into a task and `psql`; `db-setup` prints it; the app logs it at startup | **The app logs it at startup**, in the `migrations applied` line as `maxConnections`. The value is then in CloudWatch for every task, with no interactive session and no new permissions; the owner reads it from the first task's log stream. `SHOW max_connections` needs no privilege. |
| 9 | Two app containers in Compose *(Claude's call)* | One service with `deploy.replicas: 2` behind nginx resolving it; two named services | **Two named services, `app-a` and `app-b`**, sharing the existing `app` service's settings through a YAML anchor, under the profile `scale`, with nginx's upstream naming both. Named services make the logs and a failure readable (`app-a` did not become healthy), and nginx resolves a replicated service's name once at startup, a detail the check would depend on without saying so. nginx answers on `127.0.0.1:8081`, so the `app` profile's 8080 stays free. |
| 10 | What `check:scale` checks *(Claude's call)* | Both healthy; answers from both; the migrations table | **Both containers healthy on a fresh database, then 10 requests to `/api/health` through nginx, all `200` and naming exactly two distinct instances, then each migration recorded once in `drizzle.__drizzle_migrations`.** A fresh database of its own, `szop_scale`, which the script creates and drops, leaves the developer's `szop` database alone and makes the two containers migrate at the same time, so the lock is exercised by two real processes, not only in the test. The test of two migrators proves the lock; the script proves the wiring. |
| 11 | The service's count in `demo-up` *(Claude's call)* | Terraform's `desired_count`; `demo-up`'s start step | **`demo-up`'s start step sets 2**, where it sets 1 today; Terraform keeps creating the service at 0 and ignoring its count, as PH-12c decided, so PH-38's autoscaling can own it later. A service already running with another count (a demo started before this phase) is set to 2 the same way, with `--force-new-deployment`. The success condition stays "one deployment, `COMPLETED`, running equals desired". |
| 12 | One task per availability zone *(Claude's call)* | A placement strategy in Terraform; ECS's default for Fargate | **ECS's default:** Fargate services spread tasks across the availability zones of their subnets, and the service already has one public subnet in each of two zones. The owner's check confirms it in the console; a placement strategy is not accepted on Fargate anyway. |

## Design

### Files

| File | Change |
|---|---|
| `apps/api/src/instance.ts` (or beside the config, as the code reads best) | The instance ID, drawn once with `crypto.randomBytes(4).toString("hex")` |
| `apps/api/src/app.ts` | `genReqId: () => randomUUID()`; the instance ID passed to the health routes |
| `apps/api/src/health/routes.ts` and its test | `instance` in both bodies |
| `packages/shared/src/health.ts` | `instance: z.string()` in both variants, with the comment |
| `apps/api/src/db/database.ts` and its test | `max: 5` on the pool, with a comment pointing at the budget |
| `apps/api/src/db/migrate.ts` (or a new `migration-lock.ts`) | The lock around a function, used by `server.ts` |
| `apps/api/src/server.ts` | The check and the migration inside the lock; `instance` and `maxConnections` in the `migrations applied` line |
| A new integration test | Two migrators at once ([The migration lock](#the-migration-lock)) |
| `compose.yaml` | The `app` service's settings as an anchor; `app-a`, `app-b` and `nginx` under the profile `scale` |
| `compose/nginx-scale.conf` (new) | nginx's configuration for the profile |
| `scripts/check-scale.sh` (new), `package.json` | The check, and `"check:scale"` |
| `.github/workflows/ci.yml` | The `docker` job runs `scripts/check-scale.sh --no-build` after `check-image.sh` |
| `.github/workflows/demo-up.yml` | The start step's count: 2 |
| `scripts/watch-demo.sh` | The instance column and the instances in the summary |
| Docs | As listed under [Documentation and records](#documentation-and-records) |

### The instance ID

Drawn once per process when the module loads, so the app, the health routes and the startup line share it. The `200` body becomes `{"status":"ok","commit":"…","instance":"3f9a0c1e","database":{…}}` and the `503` body gains the same field. The health test checks the field is 8 lowercase hexadecimal characters and the same across two requests to one app. The SPA's status page parses the body with the shared schema and ignores the field.

### Request IDs

`buildApp` passes `genReqId: () => randomUUID()` to Fastify. A test sends a request with `request-id` and `x-amzn-trace-id` headers and checks that the logged `reqId` is a UUID unrelated to both, and that two requests get different IDs.

### The pool and the connection budget

`max: 5` on the `pg.Pool`, replacing node-postgres's default of 10. A test reads `db.$client.options.max`. The budget, written in the architecture and in ADR 0040: the worst case is every task doubled by a deploy, 2 × 2 × 5 = 20 connections now and 4 × 2 × 5 = 40 at PH-38's maximum, plus `db-setup`'s one and the owner's occasional `psql`; it must stay under about 80% of the logged `max_connections` (`db.t4g.micro`: at most 112, read on the demo). Szop's requests hold a connection for milliseconds, so 5 per task is far more than a demo's load needs; a request that finds the pool busy waits for a free connection, up to the existing `connectionTimeoutMillis` of 2 seconds.

### The migration lock

A function, say `withMigrationLock(db, log, work)`: check out a connection, log `waiting for the migration lock`, `SELECT pg_advisory_lock(<key>)`, log `migration lock taken`, run `work` (the migration check and the migration, on the pool as today), then `SELECT pg_advisory_unlock(<key>)` and release; if anything throws, release the connection as broken (`client.release(error)`) so the pool closes it and the lock goes with the session, then rethrow. `server.ts` wraps its two calls in it; the startup failure path stays as it is. `migrate.ts`'s comment about "no lock" changes to point at the lock.

**The test of two migrators** (an integration test against the test database, as the existing migration tests run): two `createDatabase` pools on a database of the test's own, fresh, each running the locked check-and-migrate at the same time with `Promise.all`, on a migrations folder of the test's own holding a table with one row and a data migration (`UPDATE … SET n = n + 1`), following the audit's [check A](../../audits/2026-10-19-scalability-and-isolation-analysis.md#check-a-two-migrators-at-once). It passes when both calls succeed, every migration is recorded once and `n = 1`. Without the lock, the audit saw `n = 2`, so the test fails against the unlocked code; the plan has it written first and run red.

The locked function therefore takes the migrations folder (or the whole `work`) as a parameter, so the test can use its own; `checkMigrations` reads the app's own folder today, so either the test's `work` leaves the check out or the folder becomes its parameter too. How is the builder's call.

**Shutdown while waiting:** a task that ECS stops while it waits for the lock holds a checked-out connection, so `pool.end()` does not finish; the existing 10-second shutdown deadline ends the process, and a comment says so *(found by the spec's builder check)*.

### The Compose profile scale

`compose.yaml` gives the `app` service's body an anchor (`x-app: &app`) and keeps `app` as it is. `app-a` and `app-b` use the anchor under `profiles: [scale]`, with the `scale` database (`DATABASE_NAME: szop_scale`), no published ports, and `TRUSTED_PROXIES` set to the Compose network's nginx, or left `none` if nothing in the check needs the client's address. `nginx` (a pinned `nginx:<version>-alpine` image) under the same profile mounts `compose/nginx-scale.conf` read-only, publishes `127.0.0.1:8081:8080`, and depends on both apps being healthy. The configuration: an `upstream` with `app-a:3000` and `app-b:3000`, round-robin (nginx's default), and one `server` proxying everything with the usual `X-Forwarded-For` and `Host` headers.

`scripts/check-scale.sh [--no-build]`, run as `pnpm check:scale`: starts PostgreSQL if needed, drops and creates the `szop_scale` database, starts the profile with `--wait`, then checks [decision 10](#decisions-taken-in-the-brainstorm)'s list, and removes the profile's containers and the database on exit, printing the apps' and nginx's logs on failure. The shape follows `check-image.sh`. CI's `docker` job runs it with `--no-build` after `check-image.sh`, using the image its build step loaded.

### demo-up.yml

The start step's `update-service` sets `--desired-count 2`. The branch that today reads "the service already wants N task(s)" sets 2 with `--force-new-deployment` when the count is neither 0 nor 2, and leaves it alone at 2. The retry branch for a failed deployment, which comes first, sets the count to 2 as well *(found by the spec's builder check)*. The comments say two tasks and cite ADR 0036, decision 1. The wait for `/api/health` stays as it is: the start step has already seen one deployment left with every task running, so no old task can answer, and one answer with the deployed commit is enough.

### The watch script

`scripts/watch-demo.sh` prints the instance after the commit on each line, and its summary lists each instance with how many answers it gave and when it was first and last seen. Bash pattern matching reads it, as it reads the commit.

## Documentation and records

- **ADR 0040 "Two tasks details"**: the decisions above, and what building settles. Notes: [ADR 0036](../../decisions/0036-scalability-and-isolation.md), decisions 1 and 14 (completed), decision 2 (refined: the lock's connection is checked out of the pool, not opened on its own), decision 10 (refined: always a UUID), decision 11 (refined: 5 per task, the lock's connection inside them); [ADR 0008](../../decisions/0008-hosting.md), decision 14 (extended: migrations at startup under a lock); [ADR 0039](../../decisions/0039-safe-redeploys-details.md)'s decision on the watch script (extended: the instance); [ADR 0020](../../decisions/0020-database-details.md)'s decision defining `/api/health`'s body (extended: the instance); [ADR 0033](../../decisions/0033-app-ready-for-the-cloud-details.md), decision 3, if its text says the check runs unlocked; plus their status lines.
- **`docs/architecture/architecture.md`**: two tasks, the lock, the pool and the budget, request IDs, the instance ID, and OP-103's gap as accepted.
- **`docs/architecture/stack-overview.md`**, section 21: brought in line: two tasks today, the lock on a pooled connection, the budget's numbers, OP-103 accepted, the `scale` profile as the "two real containers behind a proxy".
- **`docs/operations/demo-environment.md`**: two tasks; checking that both answer with the watch script; reading `max_connections` from the log and the recorded value; checking a stopped task (stop one in the console while the script runs); the SPA gap as accepted.
- **`docs/architecture/threat-model.md`**: the instance ID on a public route; request IDs no longer taken from anything the client sends.
- **`docs/development/testing.md`**: the test of two migrators and the `scale` check as the layer for what one process hides.
- **`docs/development/scripts.md`**: `check:scale`. **`docs/development/ci-cd.md`**: the `docker` job's new step.
- **`docs/development/tools/`**: a page for nginx, as used by the profile. `drizzle.md`: the lock next to the migration check.
- **`docs/glossary.md`**: advisory lock, availability zone if missing, and any other new term.
- **`docs/architecture/aws-resources.md`**: no resource changes; untouched unless a comment there names the count.

## Roadmap and GitHub changes

At the start: #233 🚧 In progress and Started 2026-10-21; PH-12d's Finished 2026-10-21; the stage table's row and the README's diagram on 🚧 in the branch's first commit (all done).

When the spec and the plan are committed: their links in the stage table and in #233's Spec and Plan fields.

Before the PR, listed in it:

- The roadmap entry's **Delivers**: the instance ID in `/api/health` and the watch script; request IDs as always a UUID. **Owner steps** unchanged in substance; #233's body from the entry; the stage table's row and the README's diagram with the PR link.
- #237's text: two tasks Running in two zones, the watch script showing both instances, `max_connections` read from the log.
- [OP-103](https://github.com/luiki-dev/szop/issues/249): its part ticked, closed by the PR with a "settled by" comment (the gap accepted, ADR 0040, decision 1).
- [OP-033](https://github.com/luiki-dev/szop/issues/116): the PH-37 part ticked with the PR; re-parented to the phase of its next part, [PH-20](https://github.com/luiki-dev/szop/issues/49), Status ⬜ Backlog; it stays open, so the PR does not close it.

## Owner steps

1. **Press `demo-up` on the branch** and approve it. In the ECS console, check that the service shows two tasks Running, in two different availability zones. Run `scripts/watch-demo.sh` for about half a minute and check that the summary names two instances, all `200`. Read `maxConnections` from a task's `migrations applied` line in CloudWatch and give it to Claude for the runbook. **Then press `demo-down`.** (#237)

## Tasks

About seven, for the plan to detail:

1. The instance ID: the module, `/api/health`'s bodies and the shared schema, the startup line, the tests; the watch script's column and summary.
2. Request IDs as UUIDs, and their test.
3. The pool's limit and `maxConnections` in the startup line; the migration lock and the test of two migrators, red first.
4. The Compose profile, nginx's configuration, `check-scale.sh`, `check:scale`, CI's `docker` job; the nginx tool page, `scripts.md`, `ci-cd.md`, `testing.md`.
5. `demo-up.yml`'s count; `pnpm check:workflows` passes.
6. The living docs, ADR 0040 and its notes.
7. The owner's step; `max_connections` and the budget recorded; the roadmap and GitHub changes.

## To verify during implementation

- That `pg_advisory_unlock` before `release()` leaves no lock in `pg_locks`, and that `release(error)` closes the connection (node-postgres 8.x).
- That Fargate spreads the service's two tasks across the two subnets' zones with no placement setting.
- That Fastify 5's default `requestIdHeader` is `false`, so a client's `request-id` is ignored without setting it.
- That nginx's official Alpine image runs as a user that can bind port 8080 inside the container, or which port it should listen on.
- That two Compose services from one anchor can share the `szop:local` image without building it twice.
- That `SHOW max_connections` works for `szop_app` on RDS (it needs no privilege).
