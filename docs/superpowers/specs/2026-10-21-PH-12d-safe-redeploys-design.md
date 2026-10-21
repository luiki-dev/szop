# PH-12d Safe redeploys — design

- **Phase:** [PH-12d](../../roadmap.md#ph-12d-safe-redeploys) ([#244](https://github.com/luiki-dev/szop/issues/244))
- **Date:** 2026-10-21
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-043](https://github.com/luiki-dev/szop/issues/84) (its last part), [OP-075](https://github.com/luiki-dev/szop/issues/87) and [OP-101](https://github.com/luiki-dev/szop/issues/247), all settled

PH-12c put the walking skeleton on one ECS task, with ECS's and the load balancer's defaults. A redeploy already worked: ECS's defaults start the new task beside the old one. This phase makes that deliberate and safe, and proves it. The direction was settled by [ADR 0036](../../decisions/0036-scalability-and-isolation.md), decisions 3 to 5: rolling deploys at 100% and 200% with the circuit breaker and no rollback, a liveness route for the load balancer with `/api/health` as the readiness check, a 30-second deregistration delay, and the expand-then-contract rule for migrations. This spec holds the details those left to the phase. They are recorded in ADR 0039. The owner settled how the redeploy is proven and asked for the commit in `/api/health`, then left every other detail to Claude, to be argued here.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [What PH-12c showed](#what-ph-12c-showed)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Files](#files)
  - [The commit in the image and in /api/health](#the-commit-in-the-image-and-in-apihealth)
  - [The liveness route](#the-liveness-route)
  - [infra/demo: the target group and the service](#infrademo-the-target-group-and-the-service)
  - [demo-up.yml](#demo-upyml)
  - [db-setup and the deploy role (OP-101)](#db-setup-and-the-deploy-role-op-101)
  - [The redeploy watch script](#the-redeploy-watch-script)
  - [The expand-then-contract rule](#the-expand-then-contract-rule)
- [Documentation and records](#documentation-and-records)
- [Roadmap and GitHub changes](#roadmap-and-github-changes)
- [Owner steps](#owner-steps)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: redeploying a running demo keeps it up. The old and the new version serve side by side until the new one is healthy, a deploy whose tasks keep failing is marked failed instead of retrying for ever, and a database outage no longer replaces healthy tasks.

The phase is done when:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm test` pass, with tests for the commit in the configuration and in `/api/health`'s two bodies, and for `/api/live` answering `200` while the database is down;
- `pnpm check:image` builds the image with a commit and finds that commit in `/api/health`'s answer; `pnpm check:infra` and `pnpm check:workflows` pass;
- `infra/base` is applied from the owner's machine with the deploy role's new permissions, a second `terraform plan` shows no changes, and IAM Access Analyzer reports no errors and no security warnings for the changed policies in the phase PR's plan comment;
- **a fresh demo:** `demo-up` on the phase branch finishes green, and `https://szop.dzwoniec.com/api/health` answers `200` with the branch's commit;
- **a redeploy:** while the [watch script](#the-redeploy-watch-script) runs on the owner's machine, `demo-up` is pressed again with another commit and finishes green. Every line the script prints from the press to the end of the run is `200`, and its summary shows the switch from the old commit to the new one. The output goes into the PR;
- **a failed deploy:** while the watch script runs, `demo-up` is pressed with the `ref` of a throwaway branch whose app exits at startup. The run fails at *Start the app* with the deployment marked `FAILED` and the circuit breaker's reason printed, well before the step's limit. Every line the script prints is still `200` with the old commit. A fix-forward run on the phase branch then finishes green;
- the redeploy's and the destroy's timings are measured and the runbook explains them ([What PH-12c showed](#what-ph-12c-showed));
- `demo-down` reports `Destroy complete!`, and the Tag Editor, searching **eu-central-1** for `group` = `demo`, lists nothing but inactive task definitions and the resources its index still lags behind on, as the runbook describes;
- the docs and records under [Documentation and records](#documentation-and-records) are updated, and the roadmap and GitHub as in [Roadmap and GitHub changes](#roadmap-and-github-changes).

## What PH-12c showed

PH-12c's redeploy took about 3 minutes, and the old task was gone about a minute after it was deregistered. The runbook credits the slowness of a redeploy to the load balancer's default 300 seconds of draining, which did not happen. AWS documents why: *"If a deregistering target has no in-flight requests and no active connections, Elastic Load Balancing immediately completes the deregistration process, without waiting for the deregistration delay to elapse."* Nobody was using the demo during the redeploy. The destroy, by contrast, waited about 7 minutes for the service, so something there held a connection open or waited for another reason. This phase sets the delay to 30 seconds, which bounds both cases, measures both again and corrects the runbook ([decision 13](#decisions-taken-in-the-brainstorm); [OP-101](https://github.com/luiki-dev/szop/issues/247)'s last point).

## Out of scope

- **Two tasks, the migration lock and the connection budget**: [PH-37](../../roadmap.md#ph-37-two-tasks). With one task, the rolling deploy has one new and one old task for about a minute. PH-37 revisits the grace period against the lock's wait ([ADR 0036](../../decisions/0036-scalability-and-isolation.md), decision 2).
- **Rollback**: a failed deploy is fixed forward ([ADR 0036](../../decisions/0036-scalability-and-isolation.md), decision 3). A rollback would start the old version on a schema its migration check refuses.
- **The commit on the SPA's status page** *(Claude's call)*: the owner asked for it in the response, which the watch script reads. The page stays as it is; the shared schema gains the field, so the page can show it later at no cost.
- **WebSocket reconnects**: [PH-33](../../roadmap.md#ph-33-live-updates) ([ADR 0036](../../decisions/0036-scalability-and-isolation.md), decision 5).
- **A custom circuit breaker threshold** ([decision 7](#decisions-taken-in-the-brainstorm)).
- **A page load mixing two versions of the SPA** during the deploy's overlap: [OP-103](https://github.com/luiki-dev/szop/issues/249), for PH-37 ([decision 15](#decisions-taken-in-the-brainstorm)).
- **A Compose setup with two app instances**: PH-37's `scale` profile. A rolling deploy cannot be rehearsed locally; the demo is where it is proven.

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | How the redeploy is proven | Refreshing the page every few seconds; a script asking `/api/health` every second | **A script asking `/api/health` every second during the redeploy** *(the owner's choice)*, printing the time, the HTTP status, the commit and the schema version, with a summary at the end. Refreshing by hand misses a gap of a few seconds, the browser may answer from its cache, and it cannot tell which version answered. The script stays in the repository and the runbook, so PH-37 and PH-38 repeat the same check. |
| 2 | Seeing the switch to the new version | No: only the absence of errors; yes: the commit in the response | **`/api/health` answers with the commit the image was built from** *(the owner's choice)*, in both its `200` and its `503` body, so the script shows the moment the new task starts answering, and which version fails if one does. |
| 3 | Where the app learns its commit *(Claude's call)* | An environment variable in the task definition, from Terraform's `deployed_commit`; a build argument baked into the image | **A build argument `GIT_COMMIT`, baked into the image as an environment variable of the same name.** The image then always tells the truth about its own code, wherever it runs: on ECS, in `pnpm check:image` and in CI. A task definition variable says what was deployed, which is the same thing today but drifts the day someone runs the image another way. `demo-up`'s `build` job already knows the commit, since it tags the image with it. Without the argument (`pnpm dev`, the tests, a plain `docker build`), the value is `unknown` and the app starts as usual. The startup log line `migrations applied` names the commit too, so the log in CloudWatch says which version each task runs. |
| 4 | The commit on a public route *(Claude's call)* | Hide it; show it | **Show it.** It tells an attacker which code to read for weaknesses, but the repository is public and the demo runs for hours, not months; knowing the version adds little to what reading `main` gives. The threat model records it. |
| 5 | The liveness route *(Claude's call)* | `/api/live`; `/api/health/live`; `/livez`; an ECS container health check | **`GET /api/live`, answering `200` with `{"status":"ok"}`**, touching nothing but the process. Under `/api` like every API route, so the SPA's fallback never answers it; a sibling of `/api/health`, not a child, since it is not a part of that check. An ECS container health check would need a client in the slim image and, like a combined load balancer check, would replace tasks while the database is down. The route answers only once the server listens, which is after the migrations ([ADR 0008](../../decisions/0008-hosting.md), decision 14), so a task is never healthy before it has migrated. Neither route is request-logged: the load balancer asks `/api/live` every 10 seconds, and the watch script asks `/api/health` every second. |
| 6 | The load balancer's health check *(Claude's call)* | The defaults (every 30 seconds, 5 successes to be healthy, 2 failures to be unhealthy); tuned | **`/api/live` every 10 seconds, a 5-second timeout, healthy after 2 successes, unhealthy after 3 failures, `200` only.** A new task gets traffic about 20 seconds after it listens, instead of up to two and a half minutes; a hung task leaves the rotation after about 30 seconds, and one slow answer is not enough. Each of the load balancer's nodes checks on its own, so this is a few requests a minute, unlogged. |
| 7 | The deployment and the circuit breaker *(Claude's call)* | ECS's defaults (100% and 200%, no circuit breaker); stop-first (0% and 100%); rolling with the circuit breaker | **A minimum of 100% and a maximum of 200% healthy, the circuit breaker on, rollback off, its threshold left at ECS's default**, as [ADR 0036](../../decisions/0036-scalability-and-isolation.md), decision 3 set. The default threshold is half the wanted count, at least 3: with one task, the deployment is `FAILED` after three tasks in a row fail to start or fail their health checks. ECS can now take a fixed count instead, but 3 is the floor anyway and needs no setting a reader must look up. A `FAILED` deployment launches no more tasks; the old task keeps serving. |
| 8 | The grace period *(Claude's call)* | 60 seconds (PH-12c); 120 seconds; longer | **120 seconds.** ECS ignores the load balancer's verdict for this long after a task starts, so a slow image pull or a long migration does not get the task killed before it listens. A process that crashes is replaced at once regardless, so a long grace period only delays noticing a task that runs but never answers. 120 seconds leaves room for a migration of a minute or more; PH-37 revisits it with the lock. |
| 9 | The deregistration delay *(Claude's call)* | 300 seconds (the default); 30 seconds | **30 seconds**, as [ADR 0036](../../decisions/0036-scalability-and-isolation.md), decision 5 set. Szop's requests take milliseconds; the old task stops taking new requests at once and has 30 seconds to finish what it holds, then ECS sends `SIGTERM`, and the app closes within 15 seconds ([ADR 0033](../../decisions/0033-app-ready-for-the-cloud-details.md), decision 6). Fastify's keep-alive timeout of 72 seconds stays above the load balancer's idle timeout of 60, so the load balancer never sends a request on a connection the app has just closed, which would be a `502`. |
| 10 | `demo-up` and a failed deployment *(Claude's call)* | Wait for the step's limit; read the deployment's rollout state | **The start loop reads the primary deployment's `rolloutState`**: `COMPLETED` with one deployment left is success, `FAILED` stops the run at once with `rolloutStateReason` and the service's latest events. Today a failing deploy would make the loop wait its full 15 minutes. **When the service's count is 0** (a fresh demo), `demo-up` starts it with `--force-new-deployment`, so the first start is a deployment the circuit breaker watches too; on a redeploy, Terraform's new task definition already started one. |
| 11 | `demo-up`'s waits ([OP-101](https://github.com/luiki-dev/szop/issues/247)) *(Claude's call)* | Count tries; measure the time | **Every wait loop runs to a deadline in seconds** (bash's `SECONDS`), not a count of tries, so a slow `curl` cannot stretch "10 minutes" into 20. The limits stay: 10 minutes for `db-setup`, 15 for the start, 10 for `/api/health`. *Download the image* and `docker load` move above *Configure AWS credentials*, so the artifact is in hand before any credentials exist ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18). |
| 12 | OP-101's other points *(Claude's call)* | Here; a later phase | **All of them here.** They touch the files this phase changes (`demo-up.yml`, the deploy role, `db-setup`), and the owner's runs check them for free: the first `demo-up` creates the database and its secret, which the new IAM conditions guard. Moving them would mean another phase with the same base apply and the same demo runs. They add one task to the plan. |
| 13 | The runbook's timings *(Claude's call)* | Keep the 300-second explanation; measure and explain | **Measure the redeploy and the destroy again with the 30-second delay, and replace the explanation** with what AWS documents ([What PH-12c showed](#what-ph-12c-showed)). If the destroy still waits much longer than 30 seconds for the service, the runbook says what the measurement showed, without guessing. |
| 14 | Where the expand-then-contract rule lives *(Claude's call)* | `drizzle.md`; the testing guide; an ADR only | **A section in `docs/development/tools/drizzle.md`**, next to the migration check, as [ADR 0036](../../decisions/0036-scalability-and-isolation.md), decision 3 placed it, before PH-16's first table. ADR 0039 points to it. |
| 15 | A page load mixing two versions of the SPA | Sticky sessions on the target group now; the gap recorded, decided in PH-37; ignored | **Recorded, decided in PH-37** *(the owner's choice)*, as [OP-103](https://github.com/luiki-dev/szop/issues/249). While both tasks are healthy, the load balancer routes each request on its own, so a browser can get `index.html` from the new task and ask the old one for an asset only the new build has; the old task answers `404` and the page loads blank. With one task the window lasts seconds; with PH-37's two tasks replaced one at a time it lasts minutes, and sticky sessions there must be weighed against PH-37's goal that a request does not depend on which task answers it. The runbook and the architecture name the gap. Found by the spec's builder check. |

## Design

### Files

| File | Change |
|---|---|
| `Dockerfile` | `ARG GIT_COMMIT=unknown` and `ENV GIT_COMMIT=$GIT_COMMIT` in the final stage, after the copies, so the argument invalidates no earlier layer |
| `compose.yaml` | The app's build passes `GIT_COMMIT: ${GIT_COMMIT:-unknown}` |
| `scripts/check-image.sh` | Builds with `GIT_COMMIT` set to the checked-out commit and checks that `/api/health` answers it |
| `.github/workflows/ci.yml` | The `docker` job's image build passes `GIT_COMMIT` from `git rev-parse HEAD`, so `check-image.sh --no-build` finds the commit in CI too |
| `apps/api/src/config.ts` and its test | `GIT_COMMIT`: optional; `unknown` when unset; otherwise 40 lowercase hex characters or `unknown`, anything else refused like any other bad setting |
| `packages/shared/src/health.ts` | `commit: z.string()` in both bodies |
| `apps/api/src/health/routes.ts` and its test | `commit` in both bodies; `GET /live` |
| `apps/api/src/app.ts` | The commit passed to the health routes; `/api/live` not request-logged; the comment on logging updated |
| `apps/api/src/server.ts` | The commit in the `migrations applied` line |
| `apps/api/src/db/setup-role.ts` (or `db-setup.ts`) and its tests | `statement_timeout` and `lock_timeout` on `db-setup`'s connection |
| `infra/demo/service.tf` | The target group's health check and deregistration delay; the service's deployment settings and grace period; comments |
| `infra/base/ci_roles.tf` | `ecs:StopTask` on `db-setup`'s tasks; the create-only condition on the master secret; the `CreateDBInstance` conditions |
| `.github/workflows/demo-up.yml` | `build`'s build argument; `deploy`'s step order, deadlines, start loop and `db-setup` stop |
| `scripts/watch-demo.sh` | New: the watch script |
| Docs | As listed under [Documentation and records](#documentation-and-records) |

### The commit in the image and in /api/health

`demo-up`'s `build` job passes `build-args: GIT_COMMIT=<sha>` to `docker/build-push-action`, from the step output it already has. The `200` body becomes `{"status":"ok","commit":"<sha>","database":{"status":"up","schemaVersion":"…"}}` and the `503` body `{"status":"error","commit":"<sha>","database":{"status":"down"}}`. The SPA's status page parses the body with the shared schema and ignores the new field.

### The liveness route

`healthRoutes` registers `GET /live` next to `GET /health`, both under the `/api` prefix. It returns `{ status: "ok" }` and touches no database. A test stops the database (or uses one that cannot connect, as the existing `503` test does) and checks that `/api/live` still answers `200` while `/api/health` answers `503`. `disableRequestLogging` covers both URLs.

### infra/demo: the target group and the service

The target group: `health_check { path = "/api/live", interval = 10, timeout = 5, healthy_threshold = 2, unhealthy_threshold = 3, matcher = "200" }` and `deregistration_delay = 30`. The service: `deployment_minimum_healthy_percent = 100`, `deployment_maximum_percent = 200`, `deployment_circuit_breaker { enable = true, rollback = false }` and `health_check_grace_period_seconds = 120`. The comments cite ADR 0036 and ADR 0039 in place of "until PH-12d". The deploy role already holds `ecs:UpdateService` and the target group's modify actions; the plan and the first run show whether anything is missing.

### demo-up.yml

The `deploy` job's steps, in order: checkout, *Resolve the commit*, **Download the image and load it into Docker**, *Configure AWS credentials*, the account ID, Terraform's setup and init, *Push the image* (now without the load), the apply, `db-setup`, the start, the wait, the summary.

- **Run db-setup:** its own loop to a 10-minute deadline in place of `aws ecs wait tasks-stopped`, so the timeout path can act: on the deadline, `aws ecs stop-task` with a reason naming `demo-up`, then fail with the log stream's name.
- **Start the app:** reads the service's count first. At 0 it runs `update-service --desired-count 1 --force-new-deployment`; at 1 it leaves the service alone (Terraform's apply already started the deployment if the task definition changed). Then, to a 15-minute deadline, every 10 seconds: the primary deployment's `rolloutState` and the number of deployments. `COMPLETED` with one deployment: success. `FAILED`: print `rolloutStateReason` and the last five events, fail at once.
- **Wait for the app:** to a 10-minute deadline; prints the commit `/api/health` reports, and fails if it is not the deployed one, which would mean the old task still answers after the start step called the deployment complete.
- **The comments** lose the 300-second explanation and name the measured timings.
- **The job's `timeout-minutes`** rises from 30 to 45 *(found by the spec's builder check)*: the three deadlines alone add up to 35 minutes, before the apply and the state lock's wait.

### db-setup and the deploy role (OP-101)

- **`db-setup`'s timeouts:** `statement_timeout = 30s` and `lock_timeout = 10s` on its connection, set by the pool's connection options or by `SET` at the start of the session, as the code reads best. `db-setup` takes well under a second of database time; a lock it cannot get, for instance from a stuck migration, makes it fail with a clear error instead of hanging. The app's own pool is unchanged.
- **`ecs:StopTask`** for the deploy role, on tasks in the cluster `szop-demo` started from `szop-demo-db-setup`: the condition is the task's `Name` tag, which `run-task --propagate-tags TASK_DEFINITION` copies from the task definition, or the closest condition ECS supports on `StopTask`, checked with Access Analyzer and the [verification list](#to-verify-during-implementation).
- **The master secret:** `secretsmanager:CreateSecret` on `rds!db-*` gains the condition `aws:ViaAWSService = true`, so the deploy role can create such a secret only through RDS, never by calling Secrets Manager itself. CloudTrail shows PH-12c's two `CreateSecret` calls made with the deploy role's identity, `invokedBy` `rds.amazonaws.com`, and carrying no tags, so `aws:RequestTag` has nothing to match. CloudTrail shows no `TagResource` call on these secrets either: if a plan and the first real `demo-up` show it is not needed, it is removed from the statement; if it is, it gets the same condition.
- **`rds:CreateDBInstance`** gains `rds:ManageMasterUserPassword = true`, a condition key the Service Authorization Reference lists for the action and whose value CloudTrail shows the provider sends (`"manageMasterUserPassword":true`). `PubliclyAccessible` is sent too (`false`), but a condition on it is added only if the reference lists a key for it; otherwise the comment says that the security group and the private subnet group are what keep the database off the internet.

### The redeploy watch script

`scripts/watch-demo.sh [url]`, the URL `https://szop.dzwoniec.com/api/health` by default. Every second it asks the URL with a 2-second limit and prints one line: the local time, the HTTP status (`000` for no answer), the first 12 characters of the commit and the schema version, and `<- new commit` when the commit differs from the line before. On Ctrl+C it prints a summary: how many requests, how many were not `200`, and each commit seen with the times it was first and last seen. Bash and `curl` only: `jq` is not in the setup guide, and the body is small enough to read with bash's pattern matching. It needs no AWS credentials. It is not a `package.json` script, since it runs against the demo, not the code; the runbook shows how to run it.

### The expand-then-contract rule

A section in `drizzle.md`, "Migrations and rolling deploys": during a deploy the old version runs for a minute or more on the new schema, so every migration must work with the code of the release before it. Expand first (add tables, add columns that are nullable or have a default, add indexes), switch the code over, and contract (drop or rename) only in a later release, once no task runs the old code. A rename is an add, a backfill and a later drop. A migration that breaks the old code makes the old task fail its requests while the new one starts, and since a failed deploy is fixed forward, not rolled back, the fix is another migration. The section links ADR 0036, decision 3 and the migration check.

## Documentation and records

- **ADR 0039 "Safe redeploys details"**: the decisions above, and what building settles. Notes: [ADR 0036](../../decisions/0036-scalability-and-isolation.md), decisions 3, 4 and 5 (completed: the settings); [ADR 0038](../../decisions/0038-app-on-ecs-and-rds-details.md), decision 12 (completed: the defaults it kept are tuned); [ADR 0020](../../decisions/0020-database-details.md), the decision defining `/api/health`'s body (extended: the commit); [ADR 0034](../../decisions/0034-network-and-demo-up-details.md)'s waits, if a decision names them (refined: deadlines); plus their status lines.
- **`docs/operations/demo-environment.md`**: the watch script and how to run it during a redeploy; the redeploy's and the destroy's timings, measured, and the corrected explanation; what a failed deployment looks like in `demo-up`'s log and summary and what to do (fix forward and press again; the old task keeps serving); `db-setup`'s stop on timeout; the seconds in which a page load can mix two SPA versions ([OP-103](https://github.com/luiki-dev/szop/issues/249)).
- **`docs/development/ci-cd.md`**: `build`'s build argument and `deploy`'s changed steps.
- **`docs/development/tools/drizzle.md`**: the expand-then-contract section.
- **`docs/architecture/architecture.md`**: the two health routes and the deployment's behaviour, with the SPA's version gap ([OP-103](https://github.com/luiki-dev/szop/issues/249)).
- **`docs/architecture/stack-overview.md`**: rolling deploys, liveness and readiness, the deployment circuit breaker, the deregistration delay and draining, build arguments.
- **`docs/architecture/threat-model.md`**: the commit on a public route; `ecs:StopTask` for the deploy role.
- **`docs/glossary.md`**: any term the phase brings that is not there yet.
- **`docs/development/testing.md`**, if the health route's tests change how a layer is described.

## Roadmap and GitHub changes

At the start: #244 🚧 In progress (done when the brainstorm started), Started set to the branch's first commit's date; PH-12c's Finished 2026-10-21 (done); the stage table's row and the README's diagram on 🚧 in the branch's first commit.

During the brainstorm: [OP-103](https://github.com/luiki-dev/szop/issues/249) created, a sub-issue of PH-37 (#233), ⬜ Backlog.

When the spec and the plan are committed: their links in the stage table and in #244's Spec and Plan fields.

Before the PR, listed in it:

- The roadmap entry's **Delivers** gains the commit in `/api/health`, the watch script and OP-101's hardening; **Owner steps** gains the base apply and the failed deploy; #244's body from the entry. The stage table's row and the README's diagram with the PR link.
- A new owner-step issue for the base apply; #245's text with the watch script and the failed deploy.
- Closed by the PR, each with a "settled by" comment: [OP-043](https://github.com/luiki-dev/szop/issues/84) (its last part ticked), [OP-075](https://github.com/luiki-dev/szop/issues/87), [OP-101](https://github.com/luiki-dev/szop/issues/247).

## Owner steps

1. **Apply `infra/base` from the branch**, check that a second plan shows no changes; again from `main` after the merge. (new issue)
2. **Press `demo-up` on the branch** and approve it; check `/api/health` shows the branch's commit. **Start the watch script, then press `demo-up` again** with the branch's newer commit; let the script run until the run is green, stop it, and put its output in the PR. **Then, with the script running again, press `demo-up` with the `ref` of the throwaway branch** whose app exits at startup; check that the run fails at *Start the app* with the deployment `FAILED`, and that the script saw only `200` and the old commit. **Fix forward: press `demo-up` on the phase branch again**, which records the branch's commit as the deployed one again. Finally **press `demo-down`** and check its summary and the Tag Editor; then **delete the throwaway branch** on GitHub. (#245)

Step 1 comes before the PR's plan comment can show clean Access Analyzer results, and before step 2 can work. The throwaway branch, `test/ph-12d-failing-start`, holds one commit on top of the phase branch that makes `server.ts` exit with code 1 before it listens; Claude pushes it, and it gets no PR. The owner deletes it, since the push hook refuses remote deletes ([ADR 0015](../../decisions/0015-git-push-guard-hook.md)), and only after the fix-forward run: until then the failed run's apply has recorded its commit as `deployed_commit`, which `demo-down` would check out *(found by the spec's builder check)*.

## Tasks

About eight, for the plan to detail:

1. The commit: the Dockerfile, Compose, the configuration, `/api/health`, the shared schema, the startup log, `check:image`, `build`'s build argument; `pnpm typecheck`, `pnpm test` and `pnpm check:image` pass.
2. `/api/live` and its tests; the request logging.
3. `db-setup`'s timeouts and their tests.
4. `infra/demo`'s target group and service; `infra/base`'s deploy role; `pnpm check:infra` passes and a local plan shows the expected changes.
5. `demo-up.yml`'s `deploy` job; `pnpm check:workflows` passes.
6. The watch script; the runbook, `drizzle.md` and the other living docs.
7. The owner's steps with the throwaway branch, and any permission or setting the runs show missing; the timings recorded.
8. ADR 0039 and its notes; the roadmap and GitHub changes.

## To verify during implementation

- That a service created at zero tasks and then scaled to one is, or is not, watched by the circuit breaker without `--force-new-deployment`, and that `--force-new-deployment` at count 0 creates a deployment it watches.
- That a task whose process exits right after starting counts towards the threshold, and how long three failures take with a 120-second grace period, against the start step's 15 minutes.
- How quickly a newly registered target becomes healthy with a healthy threshold of 2, for the runbook's timings.
- Which condition keys `ecs:StopTask` supports (the task's tags, `ecs:cluster`, the task definition), and whether the task's propagated `Name` tag is visible to it.
- That `aws:ViaAWSService` is `true` on RDS's `CreateSecret` call, as its `invokedBy` in CloudTrail suggests, and whether the deploy role needs `secretsmanager:TagResource` at all.
- Whether the Service Authorization Reference lists a condition key for `PubliclyAccessible` on `CreateDBInstance`.
- How long the destroy waits for the service with a 30-second delay, and what the old target's state shows during a redeploy (`aws elbv2 describe-target-health`).
- That Fastify's keep-alive timeout is still its default of 72 seconds in the version Szop uses.
