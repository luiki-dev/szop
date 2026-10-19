# Scalability and isolation analysis

- **Date:** 2026-10-19
- **Phase:** [PH-36](../roadmap.md#ph-36-scalability-and-isolation-analysis) ([spec](../superpowers/specs/2026-10-19-PH-36-scalability-and-isolation-analysis-design.md))
- **Status:** a point-in-time record. It compares options with that day's code, versions and prices, and stays as written; the decisions taken from it are in ADR 0036.

Szop's design assumes exactly one task. [ADR 0008](../decisions/0008-hosting.md), decision 10 runs "one task, never more"; decision 14 migrates at startup because "with exactly one instance nothing can race"; decision 32 leaves out "more than one instance and autoscaling"; and [ADR 0012](../decisions/0012-security-baseline.md), decision 15 keeps the rate-limit counters in memory for the same reason. The owner wants Szop built the way a scalable system is built, and running at least two tasks, so that the challenges that brings surface and can be learned from. This analysis asks what that takes, what it costs and how much it changes, before [PH-12c](../roadmap.md#ph-12c-app-on-ecs-and-rds) builds the ECS service and RDS. Its second part asks whether Szop's footprint in AWS lets another app share the account.

**One task and several.** "A task" is one running copy of Szop's container on ECS: one Node.js process serving the API and the single-page application (SPA). With several tasks, the load balancer spreads requests across copies that share the database and nothing else. Anything a process keeps to itself (memory, timers, open WebSocket connections) is then seen by one task only, and anything every process does at startup or on a timer happens once per task.

**How options are judged** (the spec's decisions 3 and 4):

- **Cost guides, for the recommendation as a whole** over today's cost: more than **$0.50 per demo hour** (X: what runs while a demo is up) or more than **$2 per month** permanently (Y: paid whether a demo runs or not) is flagged. A flag rules nothing out; the costly parts have to justify themselves against the cheaper options. Each option shows its own X and Y.
- **Adds a layer or rewires.** An option either adds something next to what exists (a lock, a fan-out, a shared store) or changes how existing parts are wired (who migrates, where the cleanup runs). Both are acceptable; what counts is the size, so each option names the files and components it touches and the ADR decisions it changes.
- **Out of bounds:** moving the SPA off the API, splitting the API into services, extracting a module for a future app, other clouds.

**How facts were established.** From the code on `main` at commit `88ca67f` and later, the project's docs, the providers' documentation, and three throwaway local checks ([Local checks](#local-checks)). A fact neither checked nor stated by a cited page is marked *(unconfirmed)*, with the phase that confirms it first.

## Contents

- [Summary](#summary)
- [Part 1: scalability](#part-1-scalability)
  - [S1 Migrations at startup](#s1-migrations-at-startup)
  - [S2 Rolling deploys and two versions at once](#s2-rolling-deploys-and-two-versions-at-once)
  - [S3 Health checks](#s3-health-checks)
  - [S4 Graceful shutdown and connection draining](#s4-graceful-shutdown-and-connection-draining)
  - [S5 The event bus and WebSockets](#s5-the-event-bus-and-websockets)
  - [S6 The rate-limit counters](#s6-the-rate-limit-counters)
  - [S7 The cleanup job](#s7-the-cleanup-job)
  - [S8 Sessions](#s8-sessions)
  - [S9 The seed data](#s9-the-seed-data)
  - [S10 Quotas](#s10-quotas)
  - [S11 Other state in a process](#s11-other-state-in-a-process)
  - [S12 Database connections](#s12-database-connections)
  - [S13 Database availability and growth](#s13-database-availability-and-growth)
  - [S14 Load-based scaling](#s14-load-based-scaling)
  - [S15 Testing with several instances](#s15-testing-with-several-instances)
- [Part 2: isolation](#part-2-isolation)
  - [I1 Account-wide pieces](#i1-account-wide-pieces)
  - [I2 Reach](#i2-reach)
  - [I3 Names and tags](#i3-names-and-tags)
  - [I4 Moving to another account](#i4-moving-to-another-account)
  - [I5 Shared limits](#i5-shared-limits)
  - [I6 The domain and the front page](#i6-the-domain-and-the-front-page)
  - [I7 Each app on and off on its own](#i7-each-app-on-and-off-on-its-own)
- [Costs](#costs)
- [What the roadmap would look like](#what-the-roadmap-would-look-like)
- [Local checks](#local-checks)
  - [Check A: two migrators at once](#check-a-two-migrators-at-once)
  - [Check B: Better Auth's state](#check-b-better-auths-state)
  - [Check C: two API instances behind a proxy](#check-c-two-api-instances-behind-a-proxy)

## Summary

*Written in Task 4.*

## Part 1: scalability

### S1 Migrations at startup

**Today.** ✅ Built. [`server.ts`](../../apps/api/src/server.ts) compares the recorded migrations with its own ([ADR 0033](../decisions/0033-app-ready-for-the-cloud-details.md), decision 3), runs Drizzle's migrator, and only then listens ([ADR 0008](../decisions/0008-hosting.md), decision 14; [ADR 0020](../decisions/0020-database-details.md), decision 11). [`migrate.ts`](../../apps/api/src/db/migrate.ts) notes that Drizzle takes no lock, "which is safe while exactly one instance runs".

**With several tasks.** Tasks that start together migrate together. [Check A](#check-a-two-migrators-at-once) shows two outcomes, every time in five runs each:

- **A schema migration** (a new table): the loser's `CREATE TABLE` collides with the winner's, its transaction rolls back, and its startup fails with a duplicate-key error. On ECS that task exits, a new one starts, finds nothing pending and serves. Untidy but safe: a failed task start per deploy, which the deployment circuit breaker counts.
- **A data migration** (an `UPDATE`): **both migrators succeed, the update runs twice, and the migration is recorded twice.** Nothing fails and nothing logs it. The startup check of ADR 0033, decision 3 does not notice either: it keys recorded migrations by timestamp, so the duplicate row collapses into one ([`migration-check.ts`](../../apps/api/src/db/migration-check.ts), `compareMigrations`). A silent double-applied data change is the worst outcome in this part.

Likely at every deploy that starts two tasks at once, and at every scale-out that coincides with a pending migration; harmful as soon as a data migration exists.

**Options.**

1. **A PostgreSQL advisory lock around the check and the migration.** Each task takes `pg_advisory_lock(<constant>)` on a connection of its own before `checkMigrations`, migrates, then unlocks; the others wait, then find nothing pending. **Adds a layer.** Size: `migrate.ts` and `server.ts` (about 15 lines), one test with two migrators; refines ADR 0008, decision 14. X $0, Y $0. Running: a waiting task's startup lasts as long as the migration, inside the health check's grace period (S3). Teaches: advisory locks, the standard tool for "only one of us at a time" across processes. Check A: correct in every run, with the lock on a separate connection or on the migrator's own.
2. **A one-off ECS task per deployment.** `demo-up` runs the new image once with a "migrate only" command (`aws ecs run-task`) and waits for it, then updates the service; the API no longer migrates at startup and only checks. **Rewires.** Size: a migrate-only entry point in the API, a step and its permissions in `demo-up.yml` (`ecs:RunTask`, `iam:PassRole`), the runbook; supersedes ADR 0008, decision 14 and refines [ADR 0010](../decisions/0010-ci-cd.md), decision 11. X: one extra Fargate task for about a minute per deploy, under $0.01. Y $0. Running: a migration failure fails the deploy before any task changes, which is cleaner; a local `pnpm dev` and the tests still need option 1's path or a separate script. Teaches: release phases as a separate step, the pattern of Heroku's release phase and Kubernetes jobs.
3. **Keep migrating without a lock and make migrations idempotent.** Rejected: idempotent data migrations are a discipline, not a guarantee, and check A shows the cost of one slip.

**Recommendation.** Option 1. It closes the hole with the least change and keeps "the app migrates itself", which local development, the tests and the demo all rely on. Option 2 is the better shape for an always-on service with long migrations; option 1 does not rule it out later.

**When.** Before a second task ever runs: in PH-12c if PH-12c starts two tasks, otherwise in the phase that moves to two. Small enough to be built as part of that phase.

### S2 Rolling deploys and two versions at once

**Today.** ⬜ Future, for the service; 📝 designed for one task. [OP-043](https://github.com/luiki-dev/szop/issues/84) plans a minimum of 0% and a maximum of 100% healthy tasks for PH-12c, so the old task stops before the new one starts and the two versions never meet. The startup check refuses to start on a database holding a migration the code does not know ([ADR 0033](../decisions/0033-app-ready-for-the-cloud-details.md), decision 3).

**With several tasks.** OP-043's setting means downtime: every task stops before the new ones start. Without downtime, ECS starts new tasks while old ones still serve, so **old code runs on the new schema** for the length of the deploy. A migration that renames or drops a column breaks the old tasks' requests during that window. And if the deploy fails and ECS rolls back, the old version starts on a database that already holds the new migration: ADR 0033, decision 3 makes it refuse, so the rollback fails too.

**Options.**

1. **Rolling deploys with backward-compatible migrations (expand, then contract).** A minimum of 100% and a maximum of 200% with two tasks (ECS's defaults): two new tasks start, become healthy, and the old two drain and stop. Every migration is safe for the previous version: add before use, remove only in a later release once nothing reads it ("expand, then contract"). The deployment circuit breaker stops a failing deploy **without** rollback, and the fix rolls forward; the startup check keeps refusing an unknown migration, which still catches the branch switches it was made for. **Adds a layer** (a rule and its review, not code). Size: the ECS service's deployment settings in PH-12c, a section in `drizzle.md` and the definition of done, OP-043's PH-12c part changed; refines ADR 0008, decision 14 and OP-043. X $0 (two old and two new tasks overlap for a minute or two), Y $0. Running: deploys without downtime. Teaches: zero-downtime deploys and the expand-and-contract pattern.
2. **Stop-first deploys (OP-043 as planned) with several tasks.** Every deploy takes the site down for a minute or two. Simplest, and acceptable for a demo watched live, but gives up the main reason to run several tasks. **No change** in shape.
3. **Blue/green deploys through CodeDeploy.** A second target group and a traffic switch; the old version stays up for a quick switch back. **Rewires** the deploy (CodeDeploy, an application, a deployment group, two target groups, `demo-up`'s deploy step). X: a few cents per deploy, Y $0. Much more to learn and to run than the demo needs; expand-and-contract is still required for the switch back.

**Recommendation.** Option 1.

**When.** PH-12c, which creates the service: the deployment settings and OP-043's change. The migration rule goes into `drizzle.md` with it, before the first real table arrives in PH-16.

### S3 Health checks

**Today.** ✅ Built route, ⬜ future target group. `GET /api/health` checks the database and answers 503 when it is down ([ADR 0020](../decisions/0020-database-details.md), decisions 5 and 11). The load balancer will use it, so a database outage marks every task unhealthy and ECS replaces them in a loop; [OP-075](https://github.com/luiki-dev/szop/issues/87) accepted that for one task and leaves the grace period, the thresholds and the circuit breaker to PH-12c.

**With several tasks.** The same as with one: replacing tasks does not bring the database back, whether there is one task or five. What several tasks add is the grace period: a task waiting for another's migration (S1, option 1) must not be killed meanwhile. A split into a process-only check for the load balancer and a database check for people is the usual answer for an always-on service, where restarting healthy processes during a database blip adds load at the worst moment.

**Options.**

1. **Keep one combined check, tuned** (OP-075): a grace period that covers a migration waited for behind the lock, and thresholds that ride out a short blip. **No change** in shape. X $0, Y $0.
2. **Split liveness from readiness:** the load balancer checks a process-only route; `/api/health` keeps the database and the schema version for `demo-up`'s wait and for people. **Rewires** the check (a route, the target group's path); refines ADR 0020, decision 11. X $0, Y $0.

**Recommendation.** Option 1. Several tasks do not change the trade-off ADR 0020, decision 11 made; option 2 belongs with an always-on Szop ([OP-033](https://github.com/luiki-dev/szop/issues/116)).

**When.** PH-12c, as OP-075 plans, with the grace period sized for S1.

### S4 Graceful shutdown and connection draining

**Today.** ✅ Built in the app: on SIGTERM, [`server.ts`](../../apps/api/src/server.ts) stops accepting, lets requests finish, and [`shutdown.ts`](../../apps/api/src/shutdown.ts) ends the process within 10 seconds plus 5 of grace, well inside ECS's 30-second stop timeout ([ADR 0033](../decisions/0033-app-ready-for-the-cloud-details.md), decision 6). ⬜ Future in the load balancer.

**With several tasks.** When ECS stops a task behind a load balancer, it first deregisters it from the target group and waits for the target group's **deregistration delay**, during which the load balancer sends no new requests but lets open ones finish; only then does the task get SIGTERM ([Elastic Load Balancing, deregistration delay](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#deregistration-delay)). The default delay is 300 seconds, so a rolling deploy of two tasks would wait about five minutes per batch for requests that last milliseconds. WebSocket connections (S5) are long-lived: they stay open through the delay and close when the task stops, and the browser must reconnect, to another task.

**Options.**

1. **A short deregistration delay** (about 30 seconds) on the target group, **and a reconnecting WebSocket client** that refetches the lists it watches after reconnecting, so nothing missed while disconnected stays missed. **Adds a layer.** Size: one Terraform argument in PH-12c; the reconnect in PH-33's client, which needs it anyway for flaky mobile networks ([PH-22](../roadmap.md#ph-22-offline-state)). X $0, Y $0. Teaches: draining, and why long-lived connections make deploys harder than requests do.

**Recommendation.** Option 1.

**When.** The delay in PH-12c; the reconnect-and-refetch in PH-33.

### S5 The event bus and WebSockets

**Today.** 📝 Designed for [PH-33](../roadmap.md#ph-33-live-updates). After a change, a service publishes a small event ("list 42: item changed") on an **in-process event bus**; the WebSocket hub forwards it to that list's subscribers, and the browser refetches ([architecture.md](../architecture/architecture.md)). Nothing is built yet: no WebSocket library is installed.

**With several tasks.** A change handled by task A reaches only the browsers connected to task A. Two people shopping from the same list on different tasks stop seeing each other's changes, with no error anywhere. Certain with two tasks: the load balancer spreads connections across them.

**Options.**

1. **PostgreSQL `LISTEN/NOTIFY` behind the bus.** Each task holds one connection that `LISTEN`s on a channel; publishing becomes `NOTIFY` (from the same transaction as the change, so an event is sent only if the change commits); each task's hub forwards what it hears to its own subscribers. **Adds a layer** behind the existing bus. Size: the bus module and one dedicated connection per task, in PH-33; refines architecture.md's event bus. X $0, Y $0. Limits: a payload of under 8000 bytes (the events are tiny), delivery only to listeners connected at the time (a reconnecting task misses events, which S4's refetch covers), and a dedicated connection that RDS Proxy cannot multiplex (S12) ([PostgreSQL, `NOTIFY`](https://www.postgresql.org/docs/current/sql-notify.html)). Teaches: fan-out between instances, and the database as a message channel.
2. **Redis publish/subscribe behind the bus.** The same shape with ElastiCache for Redis (or Valkey) as the channel. **Adds a layer**, plus a new component: a cache cluster, its security group and subnet group in `infra/demo`, the deploy role's permissions, a client library, a Redis in `compose.yaml` for development and CI. X: the smallest Redis's hourly price ([Costs](#costs)). Y $0. Teaches: a dedicated message broker, the common choice at larger scale.
3. **Sticky sessions on the load balancer.** Rejected: it keeps one browser on one task, but two people on one list may still sit on different tasks, which is the problem.

**Recommendation.** Option 1: no new component, no cost, and transactional events. Option 2 earns its cost only together with S6, if S6 picks Redis too; see S6.

**When.** PH-33, built for several tasks from the start, so it never has an in-process-only version.

### S6 The rate-limit counters

**Today.** 📝 Designed for [PH-20](../roadmap.md#ph-20-quotas-and-rate-limits): `@fastify/rate-limit` for anonymous-session creation, registration and per-session limits, and Better Auth's limiter for logins, both counting in memory ([ADR 0012](../decisions/0012-security-baseline.md), decision 15; [architecture.md](../architecture/architecture.md)). Neither library is installed yet.

**With several tasks.** Each task counts on its own, so every limit is about N times looser, more where the load balancer happens to alternate. [Check B](#check-b-better-auths-state) shows it for Better Auth: two processes with memory storage allowed 6 requests against a limit of 4; with database storage, exactly 4 between them. A brute-force login limit of 10 in 15 minutes becomes 20 with two tasks.

**Options.**

1. **PostgreSQL for both.** Better Auth's built-in `storage: "database"` (its `rateLimit` table, counted with conditional increments, shown correct across processes by check B). `@fastify/rate-limit` has no PostgreSQL store, but takes a custom `store` with `incr` and `child` methods ([its README](https://github.com/fastify/fastify-rate-limit#custom-store), version 11.2.1); a small one over a counters table is about 40 lines. **Adds a layer.** Size: a table and a store module in PH-20; refines ADR 0012, decision 15. X $0, Y $0. Running: a write per limited request; at the demo's traffic, nothing. Teaches: shared state in the database, and an atomic `INSERT … ON CONFLICT … RETURNING` counter.
2. **Redis for both.** `@fastify/rate-limit`'s `redis` option (ioredis) and Better Auth's `secondaryStorage` with `increment`. **Adds a layer** and the Redis of S5, option 2. X: the Redis's hourly price, shared with S5 if both use it. Y $0. The standard choice for counters at scale.
3. **Keep memory, accept looser limits.** Rejected: the limits are part of the security baseline (ADR 0012), and "N times looser, depending on the number of tasks" is not a limit anyone chose.

**Recommendation.** Option 1, unless the owner wants Redis for its own sake; then option 2 together with S5, option 2, so one Redis serves both.

**When.** PH-20, built with shared counters from the start.

### S7 The cleanup job

**Today.** 📝 Designed for [PH-31](../roadmap.md#ph-31-automatic-cleanup): a scheduled task inside the API process deletes expired anonymous users and unverified registrations ([ACC-7](../requirements/functional-requirements.md#acc-7), [ACC-8](../requirements/functional-requirements.md#acc-8); [architecture.md](../architecture/architecture.md)).

**With several tasks.** Every task runs it on its own timer. The deletes are by age, so a second run finds less to do; running twice is waste, and two runs at once can contend for the same rows and fail one of them. Harmless, but untidy, and N times the work.

**Options.**

1. **A try-lock per run.** Each run starts with `pg_try_advisory_lock(<constant>)`; the task that gets it cleans up, the others skip this round. **Adds a layer.** Size: a few lines in PH-31's job; one test. X $0, Y $0. Teaches: the non-blocking variant of S1's lock, "whoever gets there first".
2. **A scheduled task outside the API** (EventBridge Scheduler starting an ECS task with a cleanup command). **Rewires.** Size: a cleanup entry point, the schedule, its role and permissions in `infra/demo`, the deploy role's permissions. X: a short task per run, under $0.01 an hour; Y $0. More to learn about AWS, more to run, and nothing it does better here.

**Recommendation.** Option 1.

**When.** PH-31.

### S8 Sessions

**Today.** 📝 Designed for [PH-16](../roadmap.md#ph-16-guest-workspace-and-lists) and [PH-18](../roadmap.md#ph-18-registration-and-login): Better Auth keeps users, sessions and accounts in PostgreSQL, its cookie cache off so a revoked session stops at once ([architecture.md](../architecture/architecture.md)).

**With several tasks.** Works unchanged: any task finds the session in the database. [Check B](#check-b-better-auths-state) found no session or anonymous-user state kept in a process in Better Auth 1.7.11. Its one in-process lock (around consuming a single-use verification value) only orders work inside one process; the single-use guarantee itself is a delete inside a database transaction, which holds across tasks. Every task must use the same Better Auth secret, which the shared configuration already gives them.

**Options.** None needed.

**Recommendation.** No change.

**When.** —

### S9 The seed data

**Today.** 📝 Designed for [PH-15](../roadmap.md#ph-15-seed-catalog-read-only): the catalog, categories and units every visitor starts with, held in memory, read-only ([architecture.md](../architecture/architecture.md)).

**With several tasks.** Works unchanged: every task loads the same data from the same image.

**Options.** None needed.

**Recommendation.** No change.

**When.** —

### S10 Quotas

**Today.** 📝 Designed for PH-16 to PH-28: services count a workspace's rows before inserting, without locking, and two concurrent requests can overshoot a quota by a few rows, judged harmless ([architecture.md](../architecture/architecture.md), "Quotas").

**With several tasks.** The race does not depend on the number of tasks: one Node.js process already handles concurrent requests between its `await`s, so two requests from one workspace can interleave on one task as easily as on two. More tasks only make room for more concurrent requests, which the per-session rate limit (S6) caps anyway.

**Options.** None needed.

**Recommendation.** No change.

**When.** —

### S11 Other state in a process

**Today.** ✅ Built: nothing else is kept in the API's memory besides the database pool and the shutdown timers. The client's IP is taken from `X-Forwarded-For`, trusted only from the addresses in `TRUSTED_PROXIES` ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decision 7). Logs go to standard output, one CloudWatch log stream per task. Request IDs are Fastify's default: a counter per process (`req-1`, `req-2`, …) ([`app.ts`](../../apps/api/src/app.ts)).

**With several tasks.** The client IP works unchanged on every task. Request IDs collide: two tasks both log `req-1`, so searching the log group by request ID finds several unrelated requests. The log stream still tells them apart, but only if one searches by stream.

**Options.**

1. **Request IDs that are unique across tasks:** Fastify's `genReqId` returning `crypto.randomUUID()`, or `requestIdHeader` set to the load balancer's `X-Amzn-Trace-Id`, which also ties a log line to the load balancer's own logs. **Adds a layer.** Size: a few lines in `app.ts`, a test; no ADR decides request IDs today. X $0, Y $0.

**Recommendation.** Option 1, with the trace ID header where present and a UUID otherwise *(the header's trust is the same question as `X-Forwarded-For`'s, settled where it is built)*.

**When.** The phase that moves to several tasks, or PH-12c if PH-12c starts two.

### S12 Database connections

*Written in Task 2.*

### S13 Database availability and growth

*Written in Task 2.*

### S14 Load-based scaling

*Written in Task 2.*

### S15 Testing with several instances

*Written in Task 2.*

## Part 2: isolation

*Written in Task 3.*

### I1 Account-wide pieces

*Written in Task 3.*

### I2 Reach

*Written in Task 3.*

### I3 Names and tags

*Written in Task 3.*

### I4 Moving to another account

*Written in Task 3.*

### I5 Shared limits

*Written in Task 3.*

### I6 The domain and the front page

*Written in Task 3.*

### I7 Each app on and off on its own

*Written in Task 3.*

## Costs

*Written in Task 2.*

## What the roadmap would look like

*Written in Task 4.*

## Local checks

All three ran on the owner's machine (WSL2, Docker 29.6.2, Node.js 24.21.0) against throwaway containers, never `compose.yaml`'s database. Their scripts lived in the session's scratch folder and are not kept; what they did is described here so they can be repeated.

### Check A: two migrators at once

**Setup.** PostgreSQL 18.6 in a container of its own. A script started two migrators at once in one Node.js process, each with its own pool from the API's `createDatabase`, running Drizzle's `migrate` (drizzle-orm 0.45.4, pg 8.23.1) on a copy of `apps/api/drizzle/` with throwaway migrations added. Each scenario ran five times, from a reset database. Three modes: no lock; `pg_advisory_lock` on a separate connection of the pool around `migrate`; the same lock on the migrator's own connection (a pool of one).

**Results.**

| Scenario | No lock | Lock, separate connection | Lock, same connection |
|---|---|---|---|
| Fresh database, `0000` (empty) and `0001` (a table and an index) | 5 of 5: one fails, `duplicate key value violates unique constraint "pg_namespace_nspname_index"` (both create the `drizzle` schema); 2 rows recorded | 5 of 5 correct: both succeed, the second finds nothing pending; 2 rows | 5 of 5 correct; 2 rows |
| `0000` applied, `0001` (a table and an index) pending | 5 of 5: one fails, `duplicate key value violates unique constraint "pg_class_relname_nsp_index"`; its transaction rolls back; 2 rows recorded | 5 of 5 correct; 2 rows | 5 of 5 correct; 2 rows |
| `0000` and `0001` (a table with one row, `n = 0`) applied, `0002` (`UPDATE counters SET n = n + 1`) pending | **5 of 5: both succeed; `n = 2`; 4 rows recorded (`0002` twice)** | 5 of 5 correct: `n = 1`; 3 rows | 5 of 5 correct: `n = 1`; 3 rows |

**Reading.** Drizzle reads the last applied migration, then applies the rest in one transaction. Two migrators read the same "last applied" before either commits. Where their statements collide, PostgreSQL makes the second wait and then fail; where they do not, as with an `UPDATE`, the second waits for the first's row locks and then applies its update on top. A lock taken before reading closes the window in both cases. The migration check of ADR 0033, decision 3 does not flag the doubled row, since `compareMigrations` keys recorded migrations by their timestamp (read from the code, not run).

### Check B: Better Auth's state

**Setup.** Better Auth is not installed in Szop yet (it arrives in PH-16), so version 1.7.11, the latest on the day, was installed with `pg` 8.23.1 into an empty scratch folder. Its built code was read for state kept in a process (module-level maps, timers, caches), then a script ran two separate Node.js processes at once, each with its own Better Auth instance over a throwaway PostgreSQL 18.6, its schema created by Better Auth's own migrations. Each process sent 3 requests to `/api/auth/ok` from the same client address, with the rate limit at 4 requests a minute.

**Results.**

- **Rate limiter, `storage: "memory"`** (the default when no secondary storage is configured, `context/create-context.mjs`): a module-level `Map` (`api/rate-limiter/index.mjs`). Two processes answered `200 200 200` each: **6 allowed against a limit of 4.** Two instances inside one process would share the map and hide the problem, so the check needed two processes.
- **Rate limiter, `storage: "database"`:** its `rateLimit` table, updated with conditional increments. Two processes answered `200 200 200` and `200 429 429`: **exactly 4 allowed between them.**
- **Rate limiter, `storage: "secondary-storage"`:** used when `secondaryStorage` (for example Redis) is configured with an `increment` method (read, not run).
- **Other in-process state:** a per-instance map of locks around consuming a single-use verification value (`db/internal-adapter.mjs`, `withVerificationConsumeLock`), which only orders work inside one process; the consumption itself is a `consumeOne` inside a database transaction. No session cache (the cookie cache is off in Szop's design), no timers, no state in the anonymous plugin.

### Check C: two API instances behind a proxy

*Written in Task 2.*
