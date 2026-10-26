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

**Recommendation: ✅ go.** Running two or more tasks takes no rewiring of Szop's architecture: every change is a layer added next to what exists (a lock, a fan-out behind the event bus, shared counters, a connection budget, unique request IDs) or a setting, and most of them land in phases that have not been built yet, so they are built right the first time instead of reworked. The cost is **+$0.019 per demo hour** (about $0.098 in all) and **$0 a month**, far below the guides of $0.50 and $2. The one finding that is already a bug waiting to happen is S1: without a lock, two tasks apply a data migration twice, silently ([check A](#check-a-two-migrators-at-once)).

Today: ✅ built, 📝 designed, ⬜ future. X per demo hour, Y per month, for the recommended option.

| Aspect | Today | Recommended | Kind and size | X | Y | Phase |
|---|---|---|---|---|---|---|
| [S1 Migrations at startup](#s1-migrations-at-startup) | ✅ | an advisory lock around the check and the migration | adds a layer; `migrate.ts`, `server.ts`, a test | $0 | $0 | the move to two tasks |
| [S2 Rolling deploys](#s2-rolling-deploys-and-two-versions-at-once) | ⬜ | 100% / 200% rolling deploys, expand-then-contract migrations, circuit breaker without rollback | adds a layer; service settings, a rule in `drizzle.md`; OP-043 changes | $0 | $0 | PH-12c |
| [S3 Health checks](#s3-health-checks) | ✅ | one combined check, its grace period sized for S1 | no change; OP-075's tuning | $0 | $0 | PH-12c |
| [S4 Shutdown and draining](#s4-graceful-shutdown-and-connection-draining) | ✅ | a 30-second deregistration delay; WebSocket reconnect and refetch | adds a layer; one argument, PH-33's client | $0 | $0 | PH-12c, PH-33 |
| [S5 Event bus](#s5-the-event-bus-and-websockets) | 📝 | PostgreSQL `LISTEN/NOTIFY` behind the bus | adds a layer; the bus module | $0 | $0 | PH-33 |
| [S6 Rate limits](#s6-the-rate-limit-counters) | 📝 | PostgreSQL stores for both limiters | adds a layer; a table, a store | $0 | $0 | PH-20 |
| [S7 Cleanup job](#s7-the-cleanup-job) | 📝 | a try-lock per run | adds a layer; a few lines | $0 | $0 | PH-31 |
| [S8 Sessions](#s8-sessions) | 📝 | no change | — | $0 | $0 | — |
| [S9 Seed data](#s9-the-seed-data) | 📝 | no change | — | $0 | $0 | — |
| [S10 Quotas](#s10-quotas) | 📝 | no change | — | $0 | $0 | — |
| [S11 Other state](#s11-other-state-in-a-process) | ✅ | request IDs unique across tasks | adds a layer; `app.ts` | $0 | $0 | the move to two tasks |
| [S12 Connections](#s12-database-connections) | ✅ | a pool of 5 and a connection budget | adds a layer; `database.ts` | $0 | $0 | the move to two tasks |
| [S13 Database](#s13-database-availability-and-growth) | ⬜ | Single-AZ; Multi-AZ named for an always-on Szop | no change | $0 (Multi-AZ: +$0.022) | $0 | OP-033 |
| [S14 Autoscaling](#s14-load-based-scaling) | ⬜ | target tracking, 2 to 4 tasks, on CPU | adds a layer; `infra/demo`, the deploy role, a load script | +$0.038 while scaled out | $0 | a new phase |
| [S15 Testing](#s15-testing-with-several-instances) | ✅ | integration tests where the database is the channel; a two-instance Compose profile | adds a layer; a profile, a script, a test per feature | $0 | $0 | the move to two tasks, then each feature |
| [I1 Account-wide pieces](#i1-account-wide-pieces) | ✅ | a shared stack for the zone, the domain-wide records and the OIDC provider; a budget per app | rewires `bootstrap` and `base`; moved without recreating | $0 | cents at most | PH-34 |
| [I2 Reach](#i2-reach) | ✅ | accept the plan role's account-wide reads; say so in the threat model | no change | $0 | $0 | this phase |
| [I3 Names and tags](#i3-names-and-tags) | ✅ | keep the scheme; retag the shared pieces when they move | no change | $0 | $0 | PH-34 |
| [I4 Moving](#i4-moving-to-another-account) | ✅ | nothing now; one account per app kept open | no change | $0 | $0 | a second app |
| [I5 Shared limits](#i5-shared-limits) | ✅ | no change; watch the VPC quota | — | $0 | $0 | — |
| [I6 Domain and front page](#i6-the-domain-and-the-front-page) | ✅ / ⬜ | the zone, its records and the front page in the shared stack | rewires (with I1) | $0 | the front page's hosting | PH-34 |
| [I7 On and off](#i7-each-app-on-and-off-on-its-own) | ✅ | a load balancer per app | no change | $0 | $0 | — |

**Totals for the recommendation:** X **+$0.019** per demo hour for the second task (+$0.057 while scaled out to four), Y **$0** (the per-app budget at most cents, *unconfirmed*). Within the guides by a factor of about 25 for X; nothing flagged. The options that cost more (Valkey +$0.014, Multi-AZ +$0.022, RDS Proxy +$0.036) are all within the guides too, so choosing any of them is a question of what is worth learning, not of money ([Costs](#costs)).

**What is not recommended, and why:** a one-off migration task per deploy (S1, option 2: the better shape for long migrations, more to build now); Redis or Valkey (S5, S6: a new component for what PostgreSQL does at this scale); RDS Proxy (S12: it pins exactly the connections Szop would rely on); blue/green deploys (S2); a shared load balancer (I7); one account per app (I4: right later, too much now).

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

1. **Rolling deploys with backward-compatible migrations (expand, then contract).** A minimum of 100% and a maximum of 200% with two tasks (ECS's defaults for a rolling update, [Amazon ECS, rolling deployments](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html)): two new tasks start, become healthy, and the old two drain and stop. Every migration is safe for the previous version: add before use, remove only in a later release once nothing reads it ("expand, then contract"). The deployment circuit breaker stops a failing deploy **without** rollback, and the fix rolls forward; the startup check keeps refusing an unknown migration, which still catches the branch switches it was made for. **Adds a layer** (a rule and its review, not code). Size: the ECS service's deployment settings in PH-12c, a section in `drizzle.md` and the definition of done, OP-043's PH-12c part changed; refines ADR 0008, decision 14 and OP-043. X $0 (two old and two new tasks overlap for a minute or two), Y $0. Running: deploys without downtime. Teaches: zero-downtime deploys and the expand-and-contract pattern.
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

**With several tasks.** When ECS stops a task behind a load balancer, it first deregisters it from the target group and waits for the target group's **deregistration delay**, during which the load balancer sends no new requests but lets open ones finish; only then does the task get SIGTERM ([Elastic Load Balancing, deregistration delay](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#deregistration-delay); [Amazon ECS, connection draining](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/load-balancer-connection-draining.html)). The default delay is 300 seconds, so a rolling deploy of two tasks would wait about five minutes per batch for requests that last milliseconds. WebSocket connections (S5) are long-lived: they stay open through the delay and close when the task stops, and the browser must reconnect, to another task.

**Options.**

1. **A short deregistration delay** (about 30 seconds) on the target group, **and a reconnecting WebSocket client** that refetches the lists it watches after reconnecting, so nothing missed while disconnected stays missed. **Adds a layer.** Size: one Terraform argument in PH-12c; the reconnect in PH-33's client, which needs it anyway for flaky mobile networks ([PH-22](../roadmap.md#ph-22-offline-state)). X $0, Y $0. Teaches: draining, and why long-lived connections make deploys harder than requests do.

**Recommendation.** Option 1.

**When.** The delay in PH-12c; the reconnect-and-refetch in PH-33.

### S5 The event bus and WebSockets

**Today.** 📝 Designed for [PH-33](../roadmap.md#ph-33-live-updates). After a change, a service publishes a small event ("list 42: item changed") on an **in-process event bus**; the WebSocket hub forwards it to that list's subscribers, and the browser refetches ([architecture.md](../architecture/architecture.md)). Nothing is built yet: no WebSocket library is installed.

**With several tasks.** A change handled by task A reaches only the browsers connected to task A. Two people shopping from the same list on different tasks stop seeing each other's changes, with no error anywhere. Certain with two tasks: the load balancer spreads connections across them.

**Options.**

1. **PostgreSQL `LISTEN/NOTIFY` behind the bus.** Each task holds one connection that `LISTEN`s on a channel; publishing becomes `NOTIFY` (from the same transaction as the change, so an event is sent only if the change commits); each task's hub forwards what it hears to its own subscribers. **Adds a layer** behind the existing bus. Size: the bus module and one dedicated connection per task, in PH-33; refines architecture.md's event bus. X $0, Y $0. Limits: a payload of under 8000 bytes (the events are tiny), delivery only to listeners connected at the time (a reconnecting task misses events, which S4's refetch covers), and a dedicated connection that RDS Proxy cannot multiplex (S12) ([PostgreSQL, `NOTIFY`](https://www.postgresql.org/docs/current/sql-notify.html)). Teaches: fan-out between instances, and the database as a message channel.
2. **Redis publish/subscribe behind the bus.** The same shape with ElastiCache for Redis (or Valkey) as the channel. **Adds a layer**, plus a new component: a cache cluster, its security group and subnet group in `infra/demo`, the deploy role's permissions, a client library, a Redis in `compose.yaml` for development and CI. X **$0.0144 per hour** for the smallest node (`cache.t4g.micro`, Valkey; [Costs](#costs)). Y $0. Teaches: a dedicated message broker, the common choice at larger scale.
3. **Sticky sessions on the load balancer.** Rejected: it keeps one browser on one task, but two people on one list may still sit on different tasks, which is the problem.

**Recommendation.** Option 1: no new component, no cost, and transactional events. Option 2 earns its cost only together with S6, if S6 picks Redis too; see S6.

**When.** PH-33, built for several tasks from the start, so it never has an in-process-only version.

### S6 The rate-limit counters

**Today.** 📝 Designed for [PH-20](../roadmap.md#ph-20-quotas-and-rate-limits): `@fastify/rate-limit` for anonymous-session creation, registration and per-session limits, and Better Auth's limiter for logins, both counting in memory ([ADR 0012](../decisions/0012-security-baseline.md), decision 15; [architecture.md](../architecture/architecture.md)). Neither library is installed yet.

**With several tasks.** Each task counts on its own, so every limit is about N times looser, more where the load balancer happens to alternate. [Check B](#check-b-better-auths-state) shows it for Better Auth: two processes with memory storage allowed 6 requests against a limit of 4; with database storage, exactly 4 between them. A brute-force login limit of 10 in 15 minutes becomes 20 with two tasks.

**Options.**

1. **PostgreSQL for both.** Better Auth's built-in `storage: "database"` (its `rateLimit` table, counted with conditional increments, shown correct across processes by check B). `@fastify/rate-limit` has no PostgreSQL store, but takes a custom `store` with `incr` and `child` methods ([its README](https://github.com/fastify/fastify-rate-limit#custom-store), version 11.2.1); a small one over a counters table is about 40 lines. **Adds a layer.** Size: a table and a store module in PH-20; refines ADR 0012, decision 15. X $0, Y $0. Running: a write per limited request; at the demo's traffic, nothing. Teaches: shared state in the database, and an atomic `INSERT … ON CONFLICT … RETURNING` counter.
2. **Redis for both.** `@fastify/rate-limit`'s `redis` option (ioredis) and Better Auth's `secondaryStorage` with `increment`. **Adds a layer** and the Redis of S5, option 2. X $0.0144 per hour, the same node as S5's if both use it. Y $0. The standard choice for counters at scale.
3. **Keep memory, accept looser limits.** Rejected: the limits are part of the security baseline (ADR 0012), and "N times looser, depending on the number of tasks" is not a limit anyone chose.

**Recommendation.** Option 1, unless the owner wants Redis for its own sake; then option 2 together with S5, option 2, so one Redis serves both.

**When.** PH-20, built with shared counters from the start.

### S7 The cleanup job

**Today.** 📝 Designed for [PH-31](../roadmap.md#ph-31-automatic-cleanup): a scheduled task inside the API process deletes expired anonymous users and unverified registrations ([ACC-7](../requirements/ACC-accounts-and-guest-mode.md#acc-7), [ACC-8](../requirements/ACC-accounts-and-guest-mode.md#acc-8); [architecture.md](../architecture/architecture.md)).

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

**Today.** ✅ Built: each task opens one `pg` pool with node-postgres's default maximum of **10 connections** ([`database.ts`](../../apps/api/src/db/database.ts) sets no `max`). ⬜ Future: RDS `db.t4g.micro`, PostgreSQL 18 ([ADR 0008](../decisions/0008-hosting.md), decision 19), whose default `max_connections` is `LEAST({DBInstanceClassMemory/9531392}, 5000)`, with 3 reserved for superusers (read from RDS's default parameters for `postgres18`, 2026-10-19). With 1 GiB of memory that is **at most 112**, and somewhat less in practice, since `DBInstanceClassMemory` leaves out what the operating system keeps *(unconfirmed: PH-12c reads `SHOW max_connections` on the first demo)*.

**With several tasks.** Connections multiply: tasks × (pool + S1's lock connection at startup + S5's listening connection). Two tasks: 2 × 12 = 24. A rolling deploy briefly doubles the tasks (S2): 48. Autoscaling to 4 tasks (S14), during a deploy: 8 × 12 = 96, close to or over the limit, and then new connections fail with `too many clients`, on every task at once.

**Options.**

1. **A connection budget:** an explicit pool maximum (5), and an autoscaling maximum (S14) chosen so that the worst case, every task doubled by a deploy, stays under about 80% of `max_connections`: 8 × (5 + 2) = 56. **Adds a layer** (a number and its reasoning). Size: one setting in `database.ts`, a line in architecture.md; refines [ADR 0020](../decisions/0020-database-details.md). X $0, Y $0. Teaches: connections as the database's scarcest resource, and capacity arithmetic.
2. **RDS Proxy** in front of the database: it pools connections across tasks. **Adds a layer** and a component (the proxy, its role, a secret in Secrets Manager, TLS to the proxy). X **$0.036 per hour** (two vCPUs at $0.018, the minimum charge). Y $0. It pins (cannot share) a connection that holds a session-level advisory lock or `LISTEN`s, which S1 and S5 rely on, so it saves least exactly where Szop would use it ([RDS Proxy, pinning](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html)).
3. **A larger instance** (`db.t4g.small`, 2 GiB, twice the connections and the price). **Rewires** nothing, but doubles the database's cost for a limit the budget avoids.

**Recommendation.** Option 1.

**When.** The pool maximum in the phase that moves to several tasks; the budget checked again in S14's phase.

### S13 Database availability and growth

**Today.** ⬜ Future: one `db.t4g.micro` in one availability zone, 20 GB, no backups, destroyed with the demo ([ADR 0008](../decisions/0008-hosting.md), decision 19).

**With several tasks.** Nothing breaks, but the database becomes the part that does not scale: two tasks in two availability zones share one database in one, so losing that zone loses the service anyway, and every scale-out adds load to the same instance. What a scalable design adds here, and what each costs per demo hour:

| Step | What it gives | X per demo hour |
|---|---|---|
| **Multi-AZ** (a standby in the second zone) | survives the loss of a zone or the instance; failover in a minute or two | **+$0.022** (the instance $0.037 instead of $0.019; storage $0.274 instead of $0.137 per GB-month) |
| A larger instance | more memory, connections and CPU, one restart | about twice the instance price per size |
| Read replicas | reads spread over copies; the app must send reads there | a second instance and its storage, about **+$0.023** |
| Aurora PostgreSQL | storage that grows by itself, replicas sharing it | not priced: a different engine and its own learning, which no demo-sized load needs |

**Options.**

1. **Single-AZ for the demo; Multi-AZ named as the always-on step** with backups ([OP-033](https://github.com/luiki-dev/szop/issues/116)). **No change.** X $0.
2. **Multi-AZ for the demo too.** **Adds a layer** (one Terraform argument; a failover the owner can trigger to watch). X +$0.022. Teaches: failover, and why the app must reconnect after one (the pool does, [ADR 0020](../decisions/0020-database-details.md), decision 14).

**Recommendation.** Option 1. Multi-AZ is affordable and a good thing to see once, but it protects data and uptime the demo does not have; it belongs with backups in OP-033. *(The owner may well choose option 2 for the learning; it stays well inside the guides.)*

**When.** OP-033, or the phase that moves to several tasks if option 2 is chosen.

### S14 Load-based scaling

**Today.** ⬜ Future: one task of 0.25 vCPU and 0.5 GB, never more ([ADR 0008](../decisions/0008-hosting.md), decisions 10 and 32).

**With several tasks.** A fixed count of two is enough to surface everything in S1 to S12. Load-based scaling adds the moving part: tasks starting and stopping while the demo is in use, which exercises S1 (migrations at scale-out), S4 (draining at scale-in) and S12 (the connection budget) without a deploy.

**Options.**

1. **ECS Service Auto Scaling with target tracking:** a minimum of 2, a maximum of 4, a target of 50% average CPU, ECS's default cool-downs. A scale-out is shown with a short load test run from the owner's machine (a few minutes of a load generator against `/api/health` and a list page). **Adds a layer.** Size: an `aws_appautoscaling_target` and `aws_appautoscaling_policy` in `infra/demo`, the deploy role's permissions for Application Auto Scaling and the two CloudWatch alarms target tracking creates ([Application Auto Scaling, target tracking](https://docs.aws.amazon.com/autoscaling/application/userguide/application-auto-scaling-target-tracking.html)), a load script, a runbook section. X: $0 at the minimum; at the maximum, two more tasks, **+$0.038 per hour** while scaled out; the alarms cost cents a month, prorated to the demo's hours. Y $0. Teaches: target tracking, cool-downs, and why scale-in is the harder half.
2. **A fixed number of tasks** (two), no autoscaling. **No change** beyond the count.
3. **Request-count tracking** (`ALBRequestCountPerTarget`) instead of CPU. The same shape; easier to predict with a load generator, but a number that depends on what the requests cost. A choice for that phase's brainstorm.

**Recommendation.** Option 1, in a phase of its own: autoscaling is one new concept, and it should arrive after two fixed tasks run cleanly.

**When.** A new phase after the move to two tasks.

### S15 Testing with several instances

**Today.** ✅ Built: unit and integration tests in Vitest against the PostgreSQL of `compose.yaml`, Playwright end to end against one API, and the image checked by `pnpm check:image` ([testing.md](../development/testing.md); [ADR 0007](../decisions/0007-testing-strategy.md)). Everything runs one instance.

**With several tasks.** No test today could catch S1, S5 or S6. [Check C](#check-c-two-api-instances-behind-a-proxy) ran two instances of the real image behind a proxy and reproduced S1 on its first start: one instance failed its migration and was restarted. It also showed what tests must watch for: [check B](#check-b-better-auths-state) found that two instances **inside one process** share module-level state and hide exactly the bugs a test is for, so a test with two instances in one Vitest process proves only what goes through the database.

**Options.**

1. **Per layer, as each feature arrives:**
   - **Integration (Vitest), one process:** two migrators at once (S1); an event published through one app instance and received by a WebSocket client of another, each with its own pool (S5), valid because the channel is the database; two cleanup runs at once (S7).
   - **Two processes, behind a proxy:** a Compose profile `scale` with two app containers and nginx, as in check C, for what in-process tests cannot show: rate limits counted across instances (S6), the migration race at real startup, a stop under load. Run by a script like `pnpm check:image`, locally and in CI's `docker` job, which already builds the image.

   **Adds a layer.** Size: the profile and the script with the phase that moves to two tasks; each test with its feature's phase. X $0, Y $0. CI: the `docker` job gains about a minute *(unconfirmed: measured when built)*. Teaches: testing for concurrency, and which tests can and cannot see it.
2. **Only end-to-end tests against two instances.** Slower, and a failure says less about its cause.

**Recommendation.** Option 1.

**When.** The profile and S1's test in the phase that moves to two tasks; S5's in PH-33, S6's in PH-20, S7's in PH-31.

## Part 2: isolation

What lets Szop and a second app each go up and down on its own, and each move to another AWS account on its own. A second app would sit next to Szop much like it: its own subdomain of `dzwoniec.com`, an on-demand demo first. The apps share nothing but the apex domain, unless sharing saves money and each app still runs without the other; a shared piece is created when the first app needs it and removed when the last one stops using it (the spec's decision 5). Read from `infra/` and `.github/workflows/` on the branch, and from the account with read-only calls on 2026-10-19.

### I1 Account-wide pieces

**Today.** ✅ Built. Szop's stacks own five things that are one per account or one per domain:

| Piece | Where | One per |
|---|---|---|
| GitHub's OIDC provider, `token.actions.githubusercontent.com` | `infra/base/github_oidc.tf` | account and URL: a second `CreateOpenIDConnectProvider` for the same URL fails |
| The budget `szop-monthly` ($5 forecast, $10 actual, to the owner) | `infra/bootstrap/budgets.tf` | — but it has no filter, so it counts **the whole account's** costs |
| The hosted zone `dzwoniec.com` and its domain-wide records: CAA (only Amazon's authority issues certificates), null MX, SPF (`v=spf1 -all`) and DMARC (`p=reject`) | `infra/base/dns.tf`, `email.tf` | domain |
| SES's sender identity for the whole domain, and its three DKIM records ([ADR 0030](../decisions/0030-domain-and-base-infrastructure-details.md), decision 7) | `infra/base/email.tf` | domain |
| The state bucket `szop-tfstate-ntrtcr` | `infra/bootstrap/state_bucket.tf` | Szop (bucket names are global) |

Everything else (the CI roles, the registry `szop`, the log group `/szop/app`, the parameter `/szop/better-auth-secret`, the whole demo) is Szop's alone.

**With a second app.**

- **The OIDC provider:** the second app's roles must trust the one Szop created; if Szop's base were ever destroyed or moved, the other app's CI would lose AWS.
- **The budget:** an alert says the account went over, not which app did.
- **The zone and its domain-wide records:** the second app needs its records in a zone that Szop's base owns. A second TXT value on the apex has to join `apex_txt`'s list, since Route 53 keeps one record set per name and type.
- **SES:** both apps would send as the domain, with one set of DKIM keys and one sandbox quota (I5).
- **The state bucket:** the second app needs its own, or a prefix in Szop's, which couples their access.

**Options.**

1. **A shared stack for the shared pieces:** a fourth Terraform root module (`infra/shared`, tagged `project = dzwoniec`, with its own state) owning the zone, the domain-wide records, the OIDC provider and the account-wide budget. Szop's base then looks them up by name, as `infra/demo` already finds the zone ([ADR 0034](../decisions/0034-network-and-demo-up-details.md), decision 1). Moved with Terraform's `removed` and `import` blocks, so nothing is recreated. **Rewires** Szop's bootstrap and base. Size: a new module; `infra/base` and `bootstrap` lose those resources and gain lookups; the runbook and the CI roles' state permissions change. Refines [ADR 0008](../decisions/0008-hosting.md), decision 6 and ADR 0030. X $0, Y $0. Teaches: ownership of shared infrastructure, and moving resources between states.
2. **A budget per app**, filtered on `project = szop`, next to the account-wide one. The cost allocation tags `project` and `group` are already active (read 2026-10-19). **Adds a layer.** Size: one resource in `bootstrap`. X $0, Y: AWS Budgets' price for a second budget, at most cents a month *(unconfirmed: check the Budgets pricing page in that phase)*.
3. **SES identities per app** (`szop.dzwoniec.com` rather than the domain). **Rewires** ADR 0030, decision 7, before PH-18 picks a sender address. X $0, Y $0.
4. **Keep everything in Szop:** a second app looks the pieces up. **No change**, but Szop becomes the owner of everything shared, against "share nothing but the domain".

**Recommendation.** Option 1 for the zone, the domain-wide records and the OIDC provider, together with the shared front page (I6), which needs the same home. Option 2 with it. Option 3 when a second app actually sends mail; until then the domain identity is the simpler one, and it moves to the shared stack with option 1.

**When.** [PH-34](../roadmap.md#ph-34-landing-page-and-demo-status), which builds the shared front page and so needs the shared stack anyway. Option 3 when a second app arrives.

### I2 Reach

**Today.** ✅ Built.

- **`szop-ci-plan`** has AWS's `ReadOnlyAccess` on the whole account. It is denied secret values, log contents, billing and contacts, and S3 objects outside Szop's state ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md)). Only Szop's pull requests can assume it.
- **`szop-ci-deploy`** can create only what carries both `project = szop` and `group = demo`, and change or delete only what already does, in `eu-central-1`. It may change only the `szop` and `_….szop` DNS records ([ADR 0034](../decisions/0034-network-and-demo-up-details.md), decision 8; the record names in `infra/base/ci_roles.tf`). Its `Describe` and `List` reads are account-wide.
- **Both roles' trust** names Szop's repository by its immutable IDs.

**With a second app.** The deploy role cannot touch the other app's resources: their `project` tag differs, and their DNS names are outside its list. The plan role can read the other app's configuration, though not its secrets, logs or objects, and the other app's plan role would read Szop's alike. That is configuration, not data, and it is visible only to the owner's own pull requests.

**Options.**

1. **Accept it, and say it in the threat model.** **No change.** `ReadOnlyAccess` cannot be narrowed by tag in general (most `Describe` and `List` calls take no tag conditions).
2. **One account per app** (I4, option 2) removes the overlap entirely.

**Recommendation.** Option 1 now. Option 2 if a second app holds anything sensitive.

**When.** The threat model's line in this phase's PR.

### I3 Names and tags

**Today.** ✅ Built. Every resource carries `project = szop` and its group (`bootstrap`, `base`, `demo`) through each module's provider default tags ([ADR 0008](../decisions/0008-hosting.md), decision 26). Names start with `szop`: `szop-demo` (VPC, load balancer), `szop-demo-public-a`, `szop-demo-alb`, `szop-ci-plan`, `szop-ci-deploy-demo-network`, `szop-monthly`, `szop-tfstate-ntrtcr`, the registry `szop`, the log group `/szop/app` and the parameter `/szop/…`. DNS records carry no tags; the Tag Editor never lists them. `project` and `group` are active cost allocation tags.

**With a second app.** Each app's resources, costs and IAM conditions can be told apart by `project`. The exceptions are the shared pieces of I1, tagged `project = szop` today, which would wrongly count as Szop's.

**Options.**

1. **Keep the scheme;** retag the shared pieces `project = dzwoniec` when they move (I1, option 1); PH-12c names and tags ECS and RDS like the rest (`szop-demo` and the provider's tags). **No change.**

**Recommendation.** Option 1.

**When.** PH-12c follows the scheme, which needs no decision; the retagging comes with I1's move in PH-34.

### I4 Moving to another account

**Today.** ✅ Built.

- **Account IDs:** none in `infra/` or the workflows. The workflows find their roles through the GitHub variables `AWS_PLAN_ROLE_ARN` and `AWS_DEPLOY_ROLE_ARN`.
- **The region:** `eu-central-1` is written in about 25 places: each module's provider and backend, the deploy role's conditions, the demo's availability zones, and the three workflows.
- **The state bucket's name** is written in the three backends and the roles' policies.

**With a second app**, or to give Szop its own account: in the same region, Szop moves by applying bootstrap, base and demo in the new account and updating the two GitHub variables. The state bucket needs a new name, since S3 names are global and the old one stays taken until it is deleted. Also on the list:

- **SES:** a new identity, with new DKIM records, and production access requested again (it is per account and region).
- **The domain:** either transferred between the accounts, or left where it is, with the zone delegating `szop.dzwoniec.com` to a zone in Szop's new account.
- **Another region:** every region literal changes.

**Options.**

1. **Nothing now;** the runbook gains a "moving to another account" section when a move is planned. **No change.**
2. **One account per app** under AWS Organizations, the domain and the shared stack in their own account, and each app's subdomain delegated to a zone in the app's account. This is AWS's recommended isolation boundary: separate billing, quotas, IAM and blast radius. **Rewires** where everything lives. Size: a phase of its own (the organisation, the accounts, IAM Identity Center access, the delegation, moving Szop). X $0. Y: each delegated zone adds $0.50 a month. Teaches: multi-account AWS.
3. **One `region` local per module.** Pointless while Szop stays in Frankfurt. **No change.**

**Recommendation.** Option 1, keeping option 2 open: I1's shared stack is what option 2 would build on, in its own account.

**When.** When a second app becomes more than a demo.

### I5 Shared limits

**Today.** Quotas in `eu-central-1`, read from Service Quotas and SES on 2026-10-19:

| Quota | Value | Szop uses |
|---|---|---|
| VPCs per region | 5 | the default VPC, and one while a demo runs |
| Internet gateways per region | 5 | the same |
| Elastic IP addresses | 5 | none (the load balancer's and the tasks' public addresses are not Elastic IPs) |
| Application load balancers per region | 50 | one while a demo runs |
| Fargate On-Demand vCPUs | 30 | 0.25 per task, at most 1 with S14's maximum of 4 |
| RDS DB instances | 40 | one while a demo runs |
| SES | sandbox: 200 messages a day, 1 a second | none until PH-18 |

**With a second app.** Every quota is shared by every app in the account. VPCs are the tightest: each app's demo takes one, so four demos plus the default VPC fill the quota. Raising it is a free request. SES's sandbox is shared too, and its production access is per account.

**Options.** None needed: Szop's footprint is far below every quota. The VPC quota is the one to watch.

**Recommendation.** No change.

**When.** —

### I6 The domain and the front page

**Today.**

- ✅ **Built:** the zone `dzwoniec.com` in Szop's base, with `prevent_destroy`. Recreating it would give it new name servers, and the domain would stop resolving until the registration pointed at them. The domain-wide records of I1 sit there too.
- ✅ **Built:** Szop's own records. `szop.dzwoniec.com` and its certificate's validation record are created by `demo-up` and removed by `demo-down`, each demo session getting its own certificate ([ADR 0030](../decisions/0030-domain-and-base-infrastructure-details.md), decision 5).
- ⬜ **Future:** the front page on the apex ([PH-34](../roadmap.md#ph-34-landing-page-and-demo-status)), shared by the owner's apps (the spec's decision 6).

**With a second app.** Its subdomain records and certificate work like Szop's, in the same zone. The rule "created when the first app needs it, removed when the last one stops" fits records, which cost nothing to keep. It does not fit the zone, which has to stay. The apex records and the front page's hosting belong to neither app, so they cannot live in either app's stacks.

**Options.**

1. **The zone, the domain-wide records and the front page in the shared stack** (I1, option 1). Each app keeps its own subdomain records in its own demo stack, as today. **Rewires** (part of I1's move). Y: the front page's hosting, decided in PH-34.
2. **And a delegated zone per app** (`szop.dzwoniec.com` in Szop's stacks, an NS record for it in the shared zone): each app's DNS fully its own, ready for I4's option 2. **Adds a layer.** Y **+$0.50 a month** per app zone.

**Recommendation.** Option 1 in PH-34. Option 2 only with I4's option 2.

**When.** PH-34, whose entry becomes "a front page for the owner's apps, in a shared stack, showing each app's demo status".

### I7 Each app on and off on its own

**Today.** ✅ Built. `demo-up` and `demo-down` touch only Szop's demo state, resources tagged `project = szop` and `group = demo`, and the `szop` and `_….szop` records. Nothing they do reaches another app.

**With a second app.** Each app turns on and off on its own. The one money-saving shared piece is the load balancer: one for both apps would save about $0.037 per hour (the load balancer and its two addresses) while both demos run, with a host rule and a certificate per app on one listener. But it has to exist whenever either app runs. "Create when the first needs it, remove when the last stops" would then need a count of users across two repositories' workflows, and a broken count leaves one app without a load balancer or the other's costs running.

**Options.**

1. **A load balancer per app**, as today. **No change.**
2. **A shared load balancer in the shared stack, always on:** Y +$27 a month ($0.037 × 730). This breaks the guide by far.
3. **A shared load balancer, counted in and out by the apps' workflows.** **Rewires** both apps' deploys around a shared piece, for $0.037 an hour.

**Recommendation.** Option 1. Sharing saves too little for the coupling it brings.

**When.** —

## Costs

**Source.** On-demand prices for `eu-central-1` in US dollars, from the AWS Price List API (`aws pricing get-products`), read 2026-10-19. It is the data behind AWS's public price pages ([Fargate](https://aws.amazon.com/fargate/pricing/), [Elastic Load Balancing](https://aws.amazon.com/elasticloadbalancing/pricing/), [VPC public IPv4 addresses](https://aws.amazon.com/vpc/pricing/), [RDS for PostgreSQL](https://aws.amazon.com/rds/postgresql/pricing/), [RDS Proxy](https://aws.amazon.com/rds/proxy/pricing/), [ElastiCache](https://aws.amazon.com/elasticache/pricing/)) and of the AWS Pricing Calculator. Taxes and the free tier are left out. A month is 730 hours.

**Building blocks.**

| Block | Price | Per demo hour |
|---|---|---|
| Fargate vCPU | $0.04656 per vCPU-hour | — |
| Fargate memory | $0.00511 per GB-hour | — |
| **One task** (0.25 vCPU, 0.5 GB) | 0.25 × 0.04656 + 0.5 × 0.00511 | **$0.0142** |
| Public IPv4 address (in use or idle) | $0.005 per hour | $0.005 each |
| Application load balancer | $0.027 per hour, plus $0.008 per load balancer capacity unit (LCU)-hour used | $0.027, LCUs about $0 at demo traffic |
| RDS `db.t4g.micro`, PostgreSQL, Single-AZ / Multi-AZ | $0.019 / $0.037 per hour | $0.019 / $0.037 |
| RDS gp3 storage, Single-AZ / Multi-AZ | $0.137 / $0.274 per GB-month | 20 GB: $0.0038 / $0.0075 |
| RDS Proxy | $0.018 per vCPU-hour of the instance, two vCPUs minimum | $0.036 |
| ElastiCache `cache.t4g.micro`, Valkey / Redis OSS | $0.0144 / $0.018 per hour | $0.0144 / $0.018 |

**Today's baseline**, the demo as ADR 0008 and PH-12b/PH-12c build it: the load balancer ($0.027) and its public addresses (one per availability zone, $0.010), one task ($0.0142) with its public address ($0.005), the database ($0.019) and its storage ($0.0038): **about $0.079 per demo hour.** [ADR 0008](../decisions/0008-hosting.md)'s "roughly $0.07" holds, a little higher now that the public addresses and the storage are counted. Between sessions, unchanged: the domain (about $13–15 a year), the hosted zone ($0.50 a month), and cents for images, state and logs.

**Each option's X and Y** are in its section. The ones that cost anything:

| Option | X per demo hour | Y per month |
|---|---|---|
| A second task and its public address (S1–S12) | +$0.019 | $0 |
| S1, option 2: a one-off migration task per deploy | under $0.01 per deploy | $0 |
| S5 / S6, option 2: one Valkey node for both | +$0.014 | $0 |
| S12, option 2: RDS Proxy | +$0.036 | $0 |
| S13, option 2: Multi-AZ | +$0.022 | $0 |
| S14, option 1: autoscaling, at its maximum of 4 | +$0.038 while scaled out | $0 |

**The recommendation as a whole** (two fixed tasks, then autoscaling; PostgreSQL for the lock, the fan-out and the counters; Single-AZ): **+$0.019 per demo hour**, $0.098 in all, and up to $0.136 while scaled out to four tasks. **Y: $0**: nothing it adds outlives a demo. Both are far below the guides of $0.50 and $2. Choosing Valkey and Multi-AZ as well would add $0.036 more, still far below.

**A forgotten demo**, up until the nightly teardown at most a day later: 24 × $0.098 ≈ **$2.35**, against about $1.90 today (ADR 0010, decision 13 estimated $1.70). The budget alerts of [ADR 0008](../decisions/0008-hosting.md), decision 26 (a forecast above $5, actual spending above $10 a month) still fit: a month of a forgotten demo every night would be about $70 and trip both, which is what they are for.

## What the roadmap would look like

If the recommendation is taken as it stands. Sizes follow [ADR 0014](../decisions/0014-roadmap.md), decision 6: about 3 to 8 tasks and at most one big new concept per phase.

**Stage 3, in order:** PH-12c, **two tasks** (new), PH-35, PH-13, PH-34 (split in two, below), **autoscaling** (new).

| Phase | Change | Its one new concept | Size |
|---|---|---|---|
| [PH-12c](../roadmap.md#ph-12c-app-on-ecs-and-rds) App on ECS and RDS | still **one task**, but its deploys are built the way two need: rolling deploys at 100% / 200% with the circuit breaker and no rollback (S2, replacing OP-043's 0% / 100%), the 30-second deregistration delay (S4), the health check's grace period (S3, OP-075), the expand-then-contract rule in `drizzle.md` (S2), and `SHOW max_connections` read on the first demo (S12). Its goal's "safe for the single instance" becomes "safe with old and new versions side by side". | (unchanged: ECS and RDS) | about the same; the settings replace OP-043's |
| **New: Two tasks**, right after PH-12c | the migration lock (S1), the pool of 5 and the connection budget (S12), unique request IDs (S11), the service's desired count at 2, the Compose `scale` profile with its check script in CI's `docker` job (S15), S1's two-migrator test, the stack overview's scaling concepts. ADR 0008, decisions 10 and 32 superseded by ADR 0036. | running several instances | about 5 tasks |
| [PH-34](../roadmap.md#ph-34-landing-page-and-demo-status) Landing page and demo status | **split**, since the shared stack is a concept of its own: **PH-34a Shared infrastructure**: `infra/shared` with the zone, the domain-wide records, the OIDC provider and the account budget moved out of Szop's stacks without recreating them, a budget per app, the shared pieces retagged (I1, I3, I6); **PH-34b Front page for the apps**: the page on the apex in the shared stack, showing Szop's demo status as the first entry (I6), with the redirect while the demo is down. | 34a: shared infrastructure; 34b: static hosting | about 4 and 5 tasks |
| **New: Autoscaling**, last in Stage 3 | ECS Service Auto Scaling, 2 to 4 tasks on CPU, the deploy role's permissions, a load script and a runbook section (S14); the connection budget checked again (S12). | autoscaling | about 4 tasks |
| [PH-20](../roadmap.md#ph-20-quotas-and-rate-limits) Quotas and rate limits | both limiters count in PostgreSQL from the start, with a two-instance test (S6, S15). | (unchanged) | +1 task |
| [PH-31](../roadmap.md#ph-31-automatic-cleanup) Automatic cleanup | the try-lock per run, with a test of two runs at once (S7). | (unchanged) | no change in tasks |
| [PH-33](../roadmap.md#ph-33-live-updates) Live updates | the event bus over `LISTEN/NOTIFY`, the client's reconnect and refetch, a test across two instances (S4, S5, S15). | (unchanged: live updates) | +1 task |

**Open points.**

- [OP-033](https://github.com/luiki-dev/szop/issues/116) loses its two scaling parts (the lock goes to the two-task phase, the shared store to PH-20) and gains Multi-AZ next to backups (S13); it stays a candidate.
- [OP-043](https://github.com/luiki-dev/szop/issues/84): its PH-12c part becomes the rolling-deploy settings of S2.
- [OP-075](https://github.com/luiki-dev/szop/issues/87): its grace period is sized for S1's wait.
- **New candidates:** SES identities per app (I1, option 3), for when a second app sends mail; one account per app (I4, option 2), for when a second app becomes more than a demo.

**Unchanged:** PH-35, PH-13 and every MVP phase other than PH-20, PH-31 and PH-33.

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

**Setup.** A throwaway Compose project: PostgreSQL 18.6, two containers of Szop's image built from the branch's `Dockerfile` (as `pnpm image:up` builds it), each with `restart: on-failure` to stand in for ECS starting a new task, and nginx 1.28.0 in front of them, round robin, on a fixed address that `TRUSTED_PROXIES` names (`172.29.36.10/32`). Both app containers started at the same moment on an empty database.

**Results.**

- **Startup:** one instance failed with `Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle" … duplicate key value violates unique constraint "pg_namespace_nspname_index"`, exited, was restarted, found the migration applied and started; the other started at once. S1's race at real startup, with the empty first migration.
- **Spreading:** successive requests alternated between the two instances.
- **Client IP:** a request carrying a forged `X-Forwarded-For: 203.0.113.99` was logged by either instance with the address nginx saw (Docker's gateway), not the forged one: `TRUSTED_PROXIES` works unchanged with two instances.
- **Request IDs:** both instances logged `req-2` and `req-3` for different requests (S11).
- **Stopping one instance under load** (400 requests to `/api/health`, 10 ms apart, `docker compose stop` on one instance midway; it shut down in 0.4 seconds): with nginx's default retry of a failed `GET` on the other instance, **400 of 400 succeeded**; with that retry off, closer to the AWS load balancer, which does not retry *(unconfirmed: PH-37 sees it on the demo)*, **399 succeeded and 1 got a 502**: a request sent to the instance just after it closed its listener. On ECS, the task leaves the target group and drains before it gets SIGTERM (S4), which closes that gap; a proxy that does not know an instance is going cannot.
