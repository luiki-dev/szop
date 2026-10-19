# PH-36 Scalability and isolation analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** an analysis of what running Szop as two or more tasks takes and costs, and of how isolated Szop's AWS footprint is, followed by the owner's go / no-go, ADR 0036, and the roadmap and open points revisited to match.

**Architecture:** one point-in-time document in `docs/audits/` holds the analysis: a summary, 15 scalability aspects (S1–S15), 7 isolation items (I1–I7), the costs, a sketch of the roadmap, and the local checks that confirm facts. The plan stops for the owner's decision; then the ADR, the living docs, the roadmap and GitHub follow. No code, infrastructure or workflow changes.

**Tech Stack:** Markdown; Docker 29 with `postgres:18.6` and Compose for throwaway checks; the repository's Drizzle, Better Auth and Fastify versions as installed; the AWS CLI read-only with the owner's SSO profile `szop`; `gh` for issues and the project.

**Spec:** [`docs/superpowers/specs/2026-10-19-PH-36-scalability-and-isolation-analysis-design.md`](../specs/2026-10-19-PH-36-scalability-and-isolation-analysis-design.md)

## Global Constraints

- **The PR changes only Markdown under `docs/` and `README.md`.** Check scripts, Compose files and their output live in the session's scratchpad directory (`$SCRATCH` below: the absolute scratchpad path of the executing session) and are never committed.
- **Throwaway checks never touch the owner's development database.** Postgres for checks runs as its own container `szop-check-pg` (`postgres:18.6`, host port `55432`, no volume); Compose checks run as project `szop-check` (`docker compose -p szop-check -f $SCRATCH/compose.check.yaml`). Both are removed at the end of the task that starts them (`docker rm -f szop-check-pg`; `docker compose -p szop-check down -v`), and `docker ps -a --filter name=szop-check` prints nothing afterwards. `compose.yaml` and its `postgres-data` volume are not used.
- **AWS: read-only calls only**, with the profile `szop`, after the owner has signed in (`aws sso login --profile szop` is the owner's to run). No `terraform apply`/`destroy`, no `gh workflow run`, never trigger `demo-up` or `demo-down`, never merge.
- **Nothing that identifies the account goes into a commit:** no account ID, no ARN with an account number, no portal URL, no email address. Before each commit: `git diff --cached | grep -E '[0-9]{12}|@[a-z0-9.-]+\.[a-z]{2,}|awsapps\.com'` prints nothing (except the attribution line's `noreply@anthropic.com`).
- **Prices:** `eu-central-1`, US dollars, from AWS's public price pages, each figure with its link and "read YYYY-MM-DD".
- **Cost guides, on the recommendation as a whole over today's cost:** X > **$0.50 per demo hour**, Y > **$2 per month** permanent. Guides, not cutoffs: above either, the summary flags it.
- **Out of bounds as options:** moving the SPA off the API, splitting the API into services, extracting a module for a future app, other clouds.
- **Every aspect has the five parts, as bold lead-ins in this order:** `**Today.**`, `**With several tasks.**` (Part 2: `**With a second app.**`), `**Options.**`, `**Recommendation.**`, `**When.**`. Each option says **adds a layer** or **rewires**, its size (files, components, ADR decisions touched), X and Y, what it adds to running and debugging, and what it teaches. An aspect that works unchanged says why and has "None needed" as its options.
- **A fact not confirmed** by a local check or by documentation that states it is written "*(unconfirmed: …)*", and its **When** names the phase that confirms it first.
- **Docs rules** (`CLAUDE.md`, "Writing style"): niche acronyms spelled out on first use and added to `docs/glossary.md`; every status with its icon before the word; requirements, use cases and areas linked, never plain IDs; `## Contents` linking every `##` and `###`; ADR notes in three places.
- **Commits:** Conventional Commits with an allowed scope (`audit`, `adr`, `roadmap`, `plan`); each ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `docs/ph-36-scalability-and-isolation-analysis`; never commit to `main`.
- **After each task:** tick its boxes in this plan within the task's commit, run the link check (Task 1, step 1) on every Markdown file the task changed, `git push` the phase branch, then **stop and summarize the task for the owner**; start the next task only when the owner says so. Also stop where a step says **Stop**. **Never merge:** the PR opens after the last task, or when the owner asks.

## Review Focus

1. **A stale price.** A figure copied from an ADR or from memory instead of read on the day. Task 2, step 6 lists every figure with its link and date, and cross-checks the totals with the AWS Pricing Calculator.
2. **A guess written as a fact.** Behaviour of Drizzle, Better Auth, `@fastify/rate-limit` or the load balancer stated without a check or a cited page. Task 4, step 1 scans every **Recommendation** for its source.
3. **A check that damages the owner's data.** A check pointed at `compose.yaml`'s database or volume. The constraints fix a separate container and port; each check task ends by confirming nothing named `szop-check` is left.
4. **An account identifier in a commit**, from a quota or `sts` command's output pasted into Part 2. The grep in the constraints runs before every commit.
5. **A revisited phase that breaks the size rule** (more than about 8 tasks, or a second big new concept). Task 6, step 2 checks every new or changed phase against [ADR 0014](../../decisions/0014-roadmap.md), decision 6, and proposes a split instead.

---

## File Structure

| File | Change |
|---|---|
| `docs/audits/2026-10-19-scalability-and-isolation-analysis.md` | new: the analysis (Tasks 1–4) |
| `docs/decisions/0036-scalability-and-isolation.md` | new: ADR 0036 (Task 5) |
| `docs/decisions/0008-hosting.md`, `0012-security-baseline.md`, and any other ADR a decision changes | status lines and notes in the decisions' cells (Task 5) |
| `docs/architecture/architecture.md`, `stack-overview.md`, `threat-model.md`, `docs/glossary.md`, `docs/operations/demo-environment.md` | where the decisions change them (Task 5) |
| `docs/roadmap.md`, `README.md` | phases added or changed, the diagram, PH-36's row (Task 6) |
| this plan | ticked boxes |

The analysis's headings, in order (later tasks and the summary refer to them):

```
# Scalability and isolation analysis
## Contents
## Summary
## Part 1: scalability
### S1 Migrations at startup
### S2 Rolling deploys and two versions at once
### S3 Health checks
### S4 Graceful shutdown and connection draining
### S5 The event bus and WebSockets
### S6 The rate-limit counters
### S7 The cleanup job
### S8 Sessions
### S9 The seed data
### S10 Quotas
### S11 Other state in a process
### S12 Database connections
### S13 Database availability and growth
### S14 Load-based scaling
### S15 Testing with several instances
## Part 2: isolation
### I1 Account-wide pieces
### I2 Reach
### I3 Names and tags
### I4 Moving to another account
### I5 Shared limits
### I6 The domain and the front page
### I7 Each app on and off on its own
## Costs
## What the roadmap would look like
## Local checks
### Check A: two migrators at once
### Check B: Better Auth's state
### Check C: two API instances behind a proxy
```

---

### Task 1: The app tier (S1–S11), with checks A and B

**Files:**
- Create: `docs/audits/2026-10-19-scalability-and-isolation-analysis.md`
- Scratch: `$SCRATCH/check-links.py`, `$SCRATCH/check-a/`, `$SCRATCH/check-b/`

**Interfaces:**
- Produces: the document with every heading above (sections not yet written hold "*Written in Task N.*"); `check-links.py FILE...`, which prints each relative link whose file or `#anchor` (GitHub's slug rules) does not exist and exits 1 if any; the results of checks A and B under `## Local checks`.

- [x] **Step 1: Write `$SCRATCH/check-links.py`** and run it on `docs/roadmap.md`. Expected: no output, exit 0.
- [x] **Step 2: Create the document:** the introduction of the spec's "The analysis document", item 1 (why, one task versus two, the cost guides, how rewiring is judged, what is out of bounds); `## Contents`; every heading above, with the placeholders.
- [x] **Step 3: Check A, two migrators at once.** Start `szop-check-pg`. In `$SCRATCH/check-a/`, a script that imports the API's `createDatabase` and `runMigrations` from `apps/api/src/db/` (run with the repo's `tsx`, `DATABASE_URL` pointing at port 55432) and starts two migrations at once on an empty database, then on a database where one new throwaway migration (in a copy of `apps/api/drizzle/` under `$SCRATCH`) is pending. Then the same with `pg_advisory_lock(<constant>)` taken on a dedicated client before migrating and released after: once on the migrator's own connection, once on a separate one. Record for each run: what each migrator did (applied, failed with which error, waited), what `drizzle.__drizzle_migrations` holds, the versions (Drizzle, `pg`, PostgreSQL).
- [x] **Step 4: Check B, Better Auth's state.** From Better Auth's source in `node_modules` (the installed version) and its documentation: what it keeps in a process's memory (its rate limiter's default storage, any cache, the anonymous plugin), and which stores it accepts instead. Confirm the rate limiter's storage by a script in `$SCRATCH/check-b/` that builds two instances of the API's auth setup over `szop-check-pg` and shows whether a limit counted on one is seen by the other. Record versions and result.
- [x] **Step 5: Write S1–S11** from the spec's Part 1, aspects 1–11, with the five parts each, citing checks A and B where they decide a point. S2 covers OP-043's 0% / 100% answer and what the migration check of [ADR 0033](../../decisions/0033-app-ready-for-the-cloud-details.md), decision 3 should allow during a deploy; S3 covers OP-075.
- [x] **Step 6: Remove the check container.** `docker rm -f szop-check-pg`; `docker ps -a --filter name=szop-check` prints nothing.
- [x] **Step 7: Link check and commit.** `python3 $SCRATCH/check-links.py docs/audits/2026-10-19-scalability-and-isolation-analysis.md` prints nothing; the account grep prints nothing.

```bash
git add docs/audits/2026-10-19-scalability-and-isolation-analysis.md docs/superpowers/plans/2026-10-19-PH-36-scalability-and-isolation-analysis.md
git commit -m "docs(audit): analyse the app tier for several tasks"
```

### Task 2: The database, load-based scaling, testing (S12–S15), check C and the costs

**Files:**
- Modify: `docs/audits/2026-10-19-scalability-and-isolation-analysis.md` (S12–S15, `## Costs`, Check C)
- Scratch: `$SCRATCH/compose.check.yaml`, `$SCRATCH/check-c/`

**Interfaces:**
- Consumes: the document and `check-links.py` from Task 1.
- Produces: `## Costs` with today's baseline and a table of building blocks (name, price per hour or month, link, date) that Tasks 3 and 4 use for X and Y.

- [x] **Step 1: Check C, two API instances behind a proxy.** `$SCRATCH/compose.check.yaml`: `postgres:18.6`, two services from the repo's `Dockerfile` (the `app` profile's image, built once), and a proxy in front of them (Claude's choice of a small one, its version recorded) on one host port; `TRUSTED_PROXIES` set to the Compose network. Record: start order with migrations, which instance answers successive requests to `/api/health`, the client IP each logs, and what stopping one instance does to requests in flight. Then `docker compose -p szop-check down -v`; `docker ps -a --filter name=szop-check` prints nothing.
- [x] **Step 2: Write S12**, with the pool size from `apps/api/src/db/database.ts` and `db.t4g.micro`'s `max_connections` from the RDS documentation for the PostgreSQL version `infra/` uses or ADR 0008 names.
- [x] **Step 3: Write S13** (Multi-AZ, a larger instance, read replicas, Aurora, RDS Proxy), saying which the demo needs and which only an always-on Szop would.
- [x] **Step 4: Write S14** (ECS Service Auto Scaling: minimum, maximum, target tracking on CPU or requests per target, task size, the effect on S12, showing a scale-out without real traffic).
- [x] **Step 5: Write S15** from check C: what two instances locally and in CI take, which tests catch S1, S5 and S6, their layer per [testing.md](../../development/testing.md), and what they add to CI's run time.
- [x] **Step 6: Write `## Costs`:** today's baseline read again (the load balancer, a 0.25 vCPU / 0.5 GB Fargate task, `db.t4g.micro`, public IPv4 addresses, and the permanent pieces), the building blocks every option uses (a second task, Multi-AZ, RDS Proxy, the smallest Redis and any minimum charge, load balancer capacity units), the forgotten-demo cost (about $1.70 today), and the budget alerts of [ADR 0008](../../decisions/0008-hosting.md), decision 26. Cross-check one total with the AWS Pricing Calculator. Fill X and Y into S1–S15's options from this table.
- [x] **Step 7: Link check and commit**, as in Task 1, step 7.

```bash
git commit -am "docs(audit): analyse the database, autoscaling, testing and the costs"
```

### Task 3: Isolation (I1–I7)

**Files:**
- Modify: `docs/audits/2026-10-19-scalability-and-isolation-analysis.md` (Part 2)

**Interfaces:**
- Consumes: the costs table from Task 2.

- [x] **Step 1: Stop: ask the owner to sign in** with `aws sso login --profile szop`. If they cannot, use AWS's published defaults for I5, each marked "default, not read from the account".
- [x] **Step 2: Read the quotas for I5** with `aws service-quotas get-service-quota` (VPCs per region, Elastic IP addresses, application load balancers, Fargate On-Demand vCPU) and `aws sesv2 get-account --profile szop --region eu-central-1`; keep the values, never the IDs.
- [x] **Step 3: Read `infra/` and `.github/workflows/`** for I1–I4: account-wide resources and who creates them, each role's reach (`ReadOnlyAccess`, the deploy role's tag conditions and its unconditioned actions, the trust policies), names and tags of every resource, and everything hard-coded to the account or region (`grep -rn` for the region, account-shaped numbers, bucket names).
- [x] **Step 4: Write I1–I7** from the spec's Part 2 with the five parts each, each ending with what changes and when: before PH-12c, in PH-34, or when a second app arrives. I6 covers the hosted zone's name servers on recreation and the shared front page owned by neither app; I7 covers one load balancer shared by both apps and its coupling.
- [x] **Step 5: Link check and commit**, as in Task 1, step 7.

```bash
git commit -am "docs(audit): analyse Szop's isolation in the AWS account"
```

### Task 4: The summary and the owner's decision

**Files:**
- Modify: `docs/audits/2026-10-19-scalability-and-isolation-analysis.md` (`## Summary`, `## What the roadmap would look like`, `## Contents`)

- [x] **Step 1: Scan every Recommendation** in S1–S15 and I1–I7 for its source: a local check, a cited page, or "*(unconfirmed: …)*" with the confirming phase in **When**.
- [x] **Step 2: Write `## Summary`:** a table with a row per aspect (aspect linked to its section, today: ✅ built / 📝 designed / ⬜ future, the recommended option, adds a layer or rewires and its size, X, Y, phase); under it, the totals against today's cost and the guides, flagged if above, and the recommendation: go or no-go, and why.
- [x] **Step 3: Write `## What the roadmap would look like`:** each phase the recommendation adds or changes (goal, delivers, order, size in tasks, its one new concept), and each open point created, split, re-parented or closed, starting from the spec's "The roadmap and the open points".
- [x] **Step 4: Bring `## Contents` in line**, run the link check and the account grep, commit and push.

```bash
git commit -am "docs(audit): summarise the analysis and its recommendation"
git push
```

- [ ] **Step 5: Stop for the owner's decision.** Link the document on GitHub and ask for: go or no-go; the option per aspect, or "no change"; whether the phase placement stands. Record the answers in chat; nothing in the analysis is rewritten for them (it stays a point-in-time record), except obvious errors the owner points out, fixed in a new commit.

### Task 5: ADR 0036 and the living docs

**Files:**
- Create: `docs/decisions/0036-scalability-and-isolation.md`
- Modify: the ADRs it changes; `docs/architecture/architecture.md`, `stack-overview.md`, `threat-model.md`, `docs/glossary.md`, `docs/operations/demo-environment.md` where the decisions change them

- [ ] **Step 1: Write ADR 0036**, in the format of the recent ADRs (status ✅ Accepted, date, `Refines:` / `Supersedes:` lines, context, a decisions table with options considered, consequences), one decision per topic the owner decided, each linking its section of the analysis. With no-go: why one task stays and what is taken anyway.
- [ ] **Step 2: Add the notes** to every decision it changes (at least [ADR 0008](../../decisions/0008-hosting.md), decisions 10, 14, 19 and 32 and [ADR 0012](../../decisions/0012-security-baseline.md), decision 15, if go): the status line, and a line at the bottom of the decision's cell (`<br>✏️ **Refined by [ADR 0036](0036-scalability-and-isolation.md), decision N:** …`, or 🔁 for superseded).
- [ ] **Step 3: Update the living docs:** `architecture.md` where the decisions change the deployment or a design (number of tasks, deploys, event bus, rate limits, cleanup, health check); `stack-overview.md` with the scaling concepts of the spec's "Documentation and records"; `threat-model.md` if a role's reach or a shared piece's owner changes; `glossary.md` for new acronyms; `demo-environment.md` for any cost it quotes.
- [ ] **Step 4: Check:** `grep -rn "one task, never more\|exactly one instance" docs --include=*.md | grep -v "docs/archive\|docs/audits\|docs/decisions\|superpowers"` prints only lines still true after the decisions. Link check on every changed file, the account grep, commit.

```bash
git add docs/decisions docs/architecture docs/glossary.md docs/operations docs/superpowers/plans
git commit -m "docs(adr): add ADR 0036 on scalability and isolation"
```

### Task 6: The roadmap, GitHub and the PR

**Files:**
- Modify: `docs/roadmap.md`, `README.md`

- [ ] **Step 1: Change `roadmap.md`** as the owner decided: new phases with the next free `PH-` number, changed entries (goal, delivers, depends on, owner steps, expected path), the stage tables and `## Contents`; PH-36's row with the PR link, set to ✅ in the last commit before the merge. Redraw the README's diagram by the rules of [ADR 0017](../../decisions/0017-readme-roadmap-diagram.md) and [ADR 0035](../../decisions/0035-wider-roadmap-diagram.md) (at most eleven phases a row), every symbol under its ID.
- [ ] **Step 2: Check each new or changed phase's size** against ADR 0014, decision 6: about 3 to 8 tasks, at most one big new concept. Propose a split to the owner for any that breaks it, before going on.
- [ ] **Step 3: GitHub:** an issue per new phase (label `phase`, its stage's milestone, `Order` between its neighbours, `Path`); the bodies of changed phases' issues from their entries; OP-033 split (its scaling parts to new open points under the phases that do them, or re-parented parts), OP-043 and OP-075 updated, each with a comment naming ADR 0036; new open points with the next free ID (`gh issue list --repo luiki-dev/szop --label open-point --state all --limit 500 --json title --jq '[.[].title | capture("^OP-(?<n>[0-9]+)").n | tonumber] | max'` plus one).
- [ ] **Step 4: Link check, the account grep, commit and push.**

```bash
git commit -am "docs(roadmap): revisit the roadmap after the scalability analysis"
git push
```

- [ ] **Step 5: Open the PR** with the template filled in: `Closes #229`, a `Closes` line for each open point settled, and the list of every issue change. Title: `docs: analyse scalability and isolation (PH-36)`.
