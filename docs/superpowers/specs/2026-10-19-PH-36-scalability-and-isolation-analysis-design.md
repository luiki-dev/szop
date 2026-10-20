# PH-36 Scalability and isolation analysis — design

- **Phase:** [PH-36](../../roadmap.md#ph-36-scalability-and-isolation-analysis) ([#229](https://github.com/luiki-dev/szop/issues/229))
- **Date:** 2026-10-19
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** none of its own yet; it reads [OP-033](https://github.com/luiki-dev/szop/issues/116), [OP-043](https://github.com/luiki-dev/szop/issues/84) and [OP-075](https://github.com/luiki-dev/szop/issues/87) and changes them if the decisions call for it

The design so far assumes exactly one task: [ADR 0008](../../decisions/0008-hosting.md), decision 10 runs "one task, never more", decision 14 migrates at startup because "with exactly one instance nothing can race", decision 32 leaves out "more than one instance and autoscaling", and [ADR 0012](../../decisions/0012-security-baseline.md), decision 15 keeps the rate-limit counters in memory for the same reason. The owner wants Szop built the way a scalable system is built, and running at least two tasks, so that the design and implementation challenges surface and can be learned from, though Szop will never be widely used. Before [PH-12c](../../roadmap.md#ph-12c-app-on-ecs-and-rds) builds the ECS service and RDS, this phase analyses what that takes, what it costs and how much it changes, and the owner decides whether to go ahead or stay with one task. The phase also checks whether Szop's footprint in AWS lets another app share the account. It changes no code and no infrastructure: its results are an analysis, an ADR, and a revisited roadmap and open points.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [The analysis document](#the-analysis-document)
  - [How each aspect is written](#how-each-aspect-is-written)
  - [Part 1: scalability](#part-1-scalability)
  - [Part 2: isolation](#part-2-isolation)
  - [Costs](#costs)
  - [The owner's decision](#the-owners-decision)
  - [The roadmap and the open points](#the-roadmap-and-the-open-points)
- [Documentation and records](#documentation-and-records)
- [Roadmap and GitHub changes](#roadmap-and-github-changes)
- [Owner steps](#owner-steps)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: we know what it takes for Szop to run as two or more tasks, and whether it is worth it; the owner decides to go ahead or stay with one task, and the roadmap and the open points are adjusted to match. We also know whether what Szop deploys to AWS is isolated and marked well enough for other apps to share the account.

The phase is done when:

- the analysis document covers every aspect listed under [Part 1](#part-1-scalability) and [Part 2](#part-2-isolation), each written as [How each aspect is written](#how-each-aspect-is-written) describes, and opens with the summary table;
- every cost in it names its price source and the date it was read, and is compared with today's cost and with the owner's thresholds;
- the owner has read the analysis and decided go or no-go, and the option for each aspect;
- ADR 0036 records those decisions and their reasons, whichever way they went, with the notes in the ADRs it refines or supersedes;
- every phase the decisions add or change has a goal, a place in the order and a size within [ADR 0014](../../decisions/0014-roadmap.md), decision 6 (at most one big new concept, about 3 to 8 tasks), in `roadmap.md`, the README's diagram and its issue;
- every open point the decisions touch is created, split, re-parented, updated or closed on GitHub, and listed in the PR;
- the living docs say what the decisions change, and the stack overview explains the scaling concepts the analysis uses;
- the PR changes only Markdown files under `docs/` and the README.

## Out of scope

- **Any change to code, infrastructure or workflows.** The changes the analysis recommends go to the phases it assigns them to.
- **A spike that builds something to keep.** Only the migration race exists in code today; the event bus, the shared rate limits and the cleanup job are designs. The analysis reasons from the code, the docs and the providers' documentation, and confirms what it can with throwaway local checks ([decision 11](#decisions-taken-in-the-brainstorm)).- **Moving the SPA off the API (to S3 and a CDN, say) or splitting the API into services** *(the owner's)*: not offered as options. The API keeps serving the SPA ([architecture.md](../../architecture/architecture.md)).
- **Extracting a module shared with a future app** *(the owner's)*: nothing is pulled out of Szop for an app that does not exist. Part 2 says what would be shared and how, not how to build it.
- **The rest of [OP-033](https://github.com/luiki-dev/szop/issues/116)** (backups, a CDN with a web application firewall, alarms and error tracking, SES production access, a storage alarm, a privacy notice): they need less rework than scaling and stay for later, as the owner put it. Only OP-033's scaling parts (the lock, the shared store) are in scope.
- **Other clouds.** "Elsewhere" in Part 2 means another AWS account.

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | What the phase is for | — | **Analyse first, then decide.** The owner wants Szop built like a scalable system and running at least two tasks, to learn from the challenges that brings. If two tasks turn out too expensive, or the changes turn the architecture over, Szop stays with one task: the ADR records why, and the roadmap changes only as far as that needs. |
| 2 | Scope of Part 1 | The app tier only; also the database and load-based scaling; also testing with several instances | **All three:** the app's tasks, the database, load-based scaling, and how a multi-task problem shows up locally and in CI before AWS. |
| 3 | The cost guide | Hard cutoffs; guides | **Guides, not cutoffs** *(the owner's)*, for **the recommendation as a whole**: two or more tasks plus everything they need, over today's cost. It is flagged when it adds **more than $0.50 per demo hour** (X: what runs while a demo is up) or **more than $2 per month** (Y: what is permanent, in `infra/base` or elsewhere, paid whether a demo runs or not). Each option shows its own X and Y, so the owner sees where the cost comes from; a flag rules nothing out, but the costly parts have to justify themselves against the cheaper options. The owner decides how much to run the demo from the hourly figure alone, so no monthly usage is assumed. |
| 4 | Changing the architecture | Prefer adding a layer; judge each change by its size | **Judged by size, case by case** *(the owner's)*. Adding a layer (a lock, a fan-out behind the event bus, a shared store) and rewiring (migrations in a one-off task, the cleanup job moved out of the API) are both acceptable; what counts is how much each changes, which "is hard to pin without an actual case". Each option therefore states its size: the files and components it touches and the ADR decisions it changes. |
| 5 | What isolation means | — | **Each app turns on and off on its own, and can be moved on its own to another AWS account** *(the owner's)*. A second app would sit next to Szop much like it: its own subdomain of `dzwoniec.com`, an on-demand demo first and maybe a working app later. The apps share nothing but the apex domain, unless sharing saves money and each app still runs without the other; a shared piece is created when the first app needs it and removed when the last one stops using it. |
| 6 | The front page on `dzwoniec.com` ([PH-34](../../roadmap.md#ph-34-landing-page-and-demo-status)) | Szop's; shared by the apps | **Shared** *(the owner's)*: a landing page for the owner's apps, with the dzwoniec's picture, owned by neither app. PH-34 is revisited to match. |
| 7 | Isolation in this phase | Its own phase; part of PH-36 | **Part of PH-36**, as a second, smaller part: the same kind of work, no new concept, and it is needed before PH-12c names and tags the ECS and RDS resources. Split off as a phase of its own if it grows. |
| 8 | Where the analysis lives *(Claude's call)* | In the spec; in the ADR; a document of its own | **A document of its own in `docs/audits/`,** a point-in-time record like the [design sanity check](../../audits/2026-09-29-design-sanity-check.md): it compares options at one moment and with that day's prices, and stays as written afterwards. The ADR holds the decisions, the living docs the result. |
| 9 | The decision point *(Claude's call)* | The owner decides per aspect while it is written; once, on the whole | **Once, on the whole analysis:** the plan stops after the analysis is committed, the owner reads it and decides go or no-go and the option per aspect, then the ADR and the roadmap follow. Many options depend on each other (a shared store can also serve the fan-out), so they are decided together. |
| 10 | Price source *(Claude's call)* | AWS's public price pages; the Pricing API; the AWS Pricing Calculator | **AWS's public price pages for `eu-central-1`**, in US dollars, read on the day, with the link and the date next to each figure. They need no AWS access; the calculator is a cross-check for the summary's totals. |
| 11 | Checking facts by trying them | Reason from documentation only; throwaway local checks | **Throwaway local checks** *(the owner's)*, on the owner's machine with Docker and the PostgreSQL of `compose.yaml`, no AWS. Each check is a script or a Compose file in the session's scratch folder, never committed; the analysis records what was run, what happened and the versions, so the result can be repeated. Planned: Drizzle's migrator under an advisory lock, with two migrators started at once with and without it; whether Better Auth keeps state in memory; two API instances behind a proxy in Compose. A recommendation resting on a fact that could not be checked says so, and its phase confirms it first. |

## Design

### The analysis document

`docs/audits/2026-10-19-scalability-and-isolation-analysis.md` (the date is the day the analysis starts). In order:

1. **Introduction:** why the analysis exists, what one task and two tasks mean, the cost guide and how rewiring is judged ([decisions 3 and 4](#decisions-taken-in-the-brainstorm)), and what is out of bounds.
2. **Contents**, as every long document has.
3. **Summary:** one table with a row per aspect: the aspect, its state today (built, designed or future), the recommended option, adds a layer or rewires and its size, X and Y, and the phase the analysis would give it. Under it, the totals for the recommendation as a whole against today's cost, and the recommendation: go or no-go, and why.
4. **Part 1: scalability**, then **Part 2: isolation**, an aspect per section.
5. **Costs:** today's baseline, the price of each building block used by the options, and how the totals are worked out.
6. **What the roadmap would look like:** the phases and open points the recommendation adds or changes, with their goal, order and size, so the owner decides with the consequences in view.

### How each aspect is written

Every aspect has the same five parts:

- **Today:** the current state, as built (with a link to the code), designed (with a link to the document and the phase that builds it) or future, and the ADR decisions behind it.
- **With several tasks** (Part 1) or **With a second app** (Part 2): what goes wrong, how it would show, and how likely and how harmful it is. An aspect that works unchanged says so and why, and has no options.
- **Options:** each with how it works, **adds a layer** or **rewires**, its size (the files and components it touches, the ADR decisions it changes), its cost (X and Y, or "none"), what it adds to running and debugging, and what it teaches.
- **Recommendation:** the option and the reason, or "no change".
- **When:** the phase that should do it, existing or new, and why then: before the second task runs, or built that way in the phase that creates the component.

### Part 1: scalability

The aspects below are the starting list; the analysis adds any it finds.

**The app tier:**

1. **Migrations at startup.** Built: [`server.ts`](../../../apps/api/src/server.ts) runs the migration check and Drizzle's migrator before listening, and [`migrate.ts`](../../../apps/api/src/db/migrate.ts) notes that Drizzle takes no lock ([ADR 0008](../../decisions/0008-hosting.md), decision 14; [ADR 0020](../../decisions/0020-database-details.md), decision 11; [ADR 0033](../../decisions/0033-app-ready-for-the-cloud-details.md), decision 3). Tasks starting together race. Options include a PostgreSQL advisory lock around the migrator and a one-off ECS task per deployment.
2. **Rolling deploys and two versions at once.** During a deploy, old and new tasks serve together, and old code runs on the new schema; an old task that restarts then refuses to start on a migration it does not know (ADR 0033, decision 3). [OP-043](https://github.com/luiki-dev/szop/issues/84)'s answer for one task (a minimum of 0% healthy, so the old task stops first) means downtime with two. Covers the deployment's minimum and maximum percentages, backward-compatible migrations (expand, then contract) and what the migration check should allow.
3. **Health checks.** `/api/health` includes the database ([ADR 0020](../../decisions/0020-database-details.md), decisions 5 and 11), so a database outage marks every task unhealthy and ECS replaces them all; [OP-075](https://github.com/luiki-dev/szop/issues/87) accepted that for one task. Covers a liveness check separate from readiness, the grace period and the circuit breaker.
4. **Graceful shutdown and connection draining.** Built: [`shutdown.ts`](../../../apps/api/src/shutdown.ts) and the 10-second deadline ([ADR 0033](../../decisions/0033-app-ready-for-the-cloud-details.md), decision 6). Covers the load balancer's deregistration delay, and WebSocket connections, which live far longer than a request and move to another task when theirs stops.
5. **The event bus and WebSockets.** Designed for [PH-33](../../roadmap.md#ph-33-live-updates) ([architecture.md](../../architecture/architecture.md), "an in-process event bus"). A change handled by one task does not reach the browsers connected to another. Options include PostgreSQL `LISTEN/NOTIFY` and Redis publish/subscribe behind the existing bus.
6. **The rate-limit counters.** Designed for [PH-20](../../roadmap.md#ph-20-quotas-and-rate-limits): in memory, for `@fastify/rate-limit` and Better Auth ([ADR 0012](../../decisions/0012-security-baseline.md), decision 15). With N tasks each limit is about N times looser. Options include the libraries' own store options backed by PostgreSQL or Redis.
7. **The cleanup job.** Designed for [PH-31](../../roadmap.md#ph-31-automatic-cleanup): a scheduled task inside the API process. Every task runs it. Options include a lock and a scheduled task outside the API.
8. **Sessions.** Better Auth's tables in PostgreSQL, its cookie cache off ([architecture.md](../../architecture/architecture.md)). Expected to work unchanged; the analysis confirms it, including Better Auth's own in-memory state, if any.
9. **The seed data**, held in memory and read-only. Expected to work unchanged.
10. **Quotas.** Checked before inserting, without locking; two requests can overshoot a quota by a few rows ([architecture.md](../../architecture/architecture.md), "Quotas"). More likely with N tasks; the analysis says whether it stays harmless.
11. **Anything else held in a process:** caches, timers, the client IP behind the load balancer (`TRUSTED_PROXIES`), and logs (one log stream per task; telling requests apart across tasks).

**The database:**

12. **Connections.** Each task's pool times the number of tasks, during a deploy too, against what `db.t4g.micro` allows ([ADR 0008](../../decisions/0008-hosting.md), decision 19; [ADR 0020](../../decisions/0020-database-details.md)). Options include smaller pools and RDS Proxy.
13. **Availability and growth.** One instance in one availability zone, without backups (ADR 0008, decision 19). Covers Multi-AZ, a larger instance, read replicas and Aurora, as what a scalable design would add and at what cost; the analysis says which of them the demo needs and which only an always-on Szop would.

**Load-based scaling:**

14. **ECS Service Auto Scaling.** A minimum of two tasks and a maximum, with target tracking on CPU or the load balancer's requests per target, and the task size (0.25 vCPU and 0.5 GB today, ADR 0008, decision 10). Covers what a scale-out does to the database's connections and to the costs, and how the demo could show a scale-out without real traffic.

**Testing with several instances:**

15. **Locally and in CI.** How two API instances run behind a proxy in `compose.yaml`, and which tests then catch a multi-task problem before AWS: the migration race, an event published on one instance and received through the other, a rate limit counted across both ([testing.md](../../development/testing.md); [ADR 0007](../../decisions/0007-testing-strategy.md)). Covers which test layer each belongs to and what it adds to CI's run time.

### Part 2: isolation

What lets Szop and a second app each go up and down on its own, and each move to another AWS account on its own ([decision 5](#decisions-taken-in-the-brainstorm)). The starting list:

1. **Account-wide pieces Szop owns today:** GitHub's OIDC provider, which an account holds once per URL, so a second app's roles would trust the same one; the budget and its alerts in `infra/bootstrap`, which count every app's costs; the SES identity for the domain; the state bucket's name and what is in it. For each: Szop's, shared, or split per app, and who creates and removes a shared one.
2. **Reach:** what each of Szop's roles can see or change beyond Szop: `szop-ci-plan`'s `ReadOnlyAccess` covers the whole account; `szop-ci-deploy`'s tag conditions (`project` and `group`, [ADR 0034](../../decisions/0034-network-and-demo-up-details.md)) and its unconditioned actions; the trust policies, which name Szop's repository.
3. **Names and tags:** whether every resource is named `szop-…` and tagged `project`, so the Tag Editor, the cost reports and IAM conditions can tell the apps apart; whether the `project` tag should be activated as a cost allocation tag. *(Claude's call:)* checked in the Terraform code, since the account holds only what Terraform created, which the runbook's Tag Editor check confirms.
4. **Moving:** what is hard-coded to this account or region (account IDs, ARNs, the region, bucket names) in `infra/` and the workflows, and what moving Szop would take: bootstrap, base and demo applied in the new account, the domain's delegation, the GitHub variables.
5. **Shared limits:** account and regional quotas both apps draw on, such as VPCs and Elastic IP addresses per region, load balancers, Fargate's vCPU, and SES's sending limits.
6. **The domain and the front page:** the hosted zone `dzwoniec.com` lives in `infra/base`, and recreating it gives new name servers that the registrar must then be given, so "create when needed, remove when unused" may suit the zone less well than its records; each app's subdomain records and certificate; the apex records and the shared front page ([decision 6](#decisions-taken-in-the-brainstorm)), which [PH-34](../../roadmap.md#ph-34-landing-page-and-demo-status) builds, and where their code and state would live when neither app owns them.
7. **Each app on and off on its own:** whether anything `demo-up` or `demo-down` touches (the zone, the budget, shared roles) could affect another app, and whether a shared piece could save money while each app still runs without the other, such as one load balancer for both, with what that costs in coupling.

Each item ends with what needs to change and when: before PH-12c (names and tags of the resources it creates), in PH-34, or only when a second app arrives.

### Costs

- **Baseline:** today's demo, about $0.07 an hour while it runs (the load balancer, one task, `db.t4g.micro`, public IP addresses), and between sessions the domain, the zone and a few cents for images, state and logs ([ADR 0008](../../decisions/0008-hosting.md), consequences). The analysis checks these figures against the prices of the day and corrects them if they moved.
- **Per option:** X, what it adds per demo hour, and Y, what it adds per month permanently, against the baseline.
- **For the recommendation as a whole:** X and Y summed and compared with the guides of [decision 3](#decisions-taken-in-the-brainstorm), flagged in the summary if either is above them; the demo's new hourly cost; and the cost of a demo forgotten until the nightly teardown (about $1.70 today, [ADR 0010](../../decisions/0010-ci-cd.md), decision 13).
- **Budgets:** whether the alerts of ADR 0008, decision 26 still fit, and what they become.
- **Load-based scaling:** the cost at the minimum and at the maximum number of tasks.

### The owner's decision

The plan stops when the analysis is committed and pushed. The owner reads it and decides:

- **go or no-go** on running two or more tasks;
- **the option for each aspect** of Part 1 and Part 2, or "no change";
- **the phases:** whether the recommended placement stands.

With no-go, Part 2's decisions still stand on their own, Part 1's recommendations that pay off with one task too (a migration lock, say) may still be taken, and ADR 0036 records why one task stays.

### The roadmap and the open points

After the decision:

- **New or changed phases**, each with its entry (goal, delivers, depends on, owner steps, expected path), its place in the order, and a size within ADR 0014, decision 6. Likely candidates, if go: PH-12c built for two tasks, or a small phase right after it that moves to two (the lock, the deployment settings, the health check); PH-20, PH-31 and PH-33 built for several tasks from the start; a phase for the local and CI multi-instance setup, or that work folded into the first phase that needs it; PH-34 as the shared front page.
- **Open points:** OP-033 loses its scaling parts (the lock, the shared store), which move to the phases that do them, and keeps the rest as a candidate; OP-043 and OP-075 are updated to the decisions; anything left to a later phase becomes a new open point, with the next free `OP-` ID, under that phase.
- **The README's diagram** and the stage tables follow.

## Documentation and records

- **The analysis:** `docs/audits/2026-10-19-scalability-and-isolation-analysis.md`.
- **ADR 0036 "Scalability and isolation"**: the decisions of [The owner's decision](#the-owners-decision), the options considered for each, and the reasons. If go: notes in [ADR 0008](../../decisions/0008-hosting.md), decisions 10, 14, 19 and 32, and [ADR 0012](../../decisions/0012-security-baseline.md), decision 15 (refined or superseded), and in any other decision it changes, plus their status lines.
- **`docs/architecture/architecture.md`**: the deployment section (the number of tasks, how they deploy), and where the decisions change a design (the event bus, the rate limits, the cleanup job, the health check).
- **`docs/architecture/stack-overview.md`**: the concepts the analysis rests on: scaling out and up, stateless processes, shared state, locks, fan-out between instances, rolling deploys with two versions at once, expand-and-contract migrations, autoscaling.
- **`docs/architecture/threat-model.md`**: if Part 2 changes what a role can reach or who owns the shared pieces.
- **`docs/glossary.md`**: any acronym the phase brings that is not there yet.
- **`docs/operations/demo-environment.md`**: the costs it quotes, if they change.

## Roadmap and GitHub changes

Done at the start: the stage table's row and the README's diagram on 🚧; #229 🚧 In progress, Started 2026-10-19; ADR 0035's issue (#231) Finished 2026-10-19.

When the spec and the plan are committed: their links in the stage table and in #229's Spec and Plan fields.

Before the PR, listed in it:

- The stage table's row and the README's diagram with the PR link, set to ✅ before the merge.
- The phases the decisions add or change: their entries, rows and issues (new issues, or the bodies of existing ones updated); a reorder's Order values.
- OP-033, OP-043 and OP-075 as the decisions leave them, each with a comment naming ADR 0036; any new open points.

## Owner steps

None on AWS, GitHub or the domain. The owner's part is [the decision](#the-owners-decision), which the plan waits for.

## Tasks

About six, for the plan to detail:

1. Part 1, the app tier (aspects 1 to 11): today, with several tasks, options, recommendation, when; the local checks of the migration race and the lock, and of Better Auth's state.
2. Part 1, the database, load-based scaling and testing with several instances (aspects 12 to 15), with the local check of two API instances behind a proxy; the costs section with the day's prices.
3. Part 2, isolation (items 1 to 7).
4. The summary table, the recommendation and what the roadmap would look like; the analysis committed and pushed; the owner's decision.
5. ADR 0036 and its notes in the ADRs it changes; the living docs.
6. The roadmap, the README's diagram, the phase issues and the open points; the PR.

## To verify during implementation

Checked locally where marked *(local check)*, from the documentation otherwise.

- How Drizzle's migrator behaves when two start at once, and under a PostgreSQL advisory lock held on the same connection or another one *(local check)*.
- Whether Better Auth keeps anything in a process's memory (its rate limiter's default storage, caches) *(local check, and its documentation)*.
- What two API instances behind a proxy in Compose need: the proxy, `TRUSTED_PROXIES`, the start order with the migration *(local check)*.
- `db.t4g.micro`'s default `max_connections` for the PostgreSQL version RDS runs, and the API's pool size today.
- Whether `@fastify/rate-limit` and Better Auth's rate limiter each take a shared store, and which kinds (PostgreSQL, Redis, a custom one).
- That PostgreSQL `LISTEN/NOTIFY` needs a connection held outside the pool, and its limits (payload size, delivery only to listeners connected at the time).
- The smallest Redis on AWS (ElastiCache Serverless or a `cache.t4g.micro` node) and its price per hour, including any minimum charge.
- The prices in `eu-central-1` of a Fargate task's vCPU and memory, of the load balancer's capacity units, of public IPv4 addresses, of RDS Multi-AZ and RDS Proxy, on the day.
- The load balancer's default deregistration delay and how it treats open WebSocket connections.
- Whether the OIDC provider can be looked up by a second app's Terraform instead of created, and what deleting it would break.
- The quotas named in Part 2 for this account, read with read-only commands (`aws service-quotas get-service-quota`, `aws sesv2 get-account`) once the owner has signed in, or AWS's published defaults, marked as such, if that is not possible.
