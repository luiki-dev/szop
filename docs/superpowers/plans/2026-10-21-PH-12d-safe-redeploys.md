# PH-12d Safe redeploys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** redeploying a running demo keeps it up: old and new versions serve side by side until the new one is healthy, a deploy whose tasks keep failing is marked failed, and a database outage no longer replaces healthy tasks.

**Architecture:** the image carries its commit (`GIT_COMMIT`, a build argument) and `/api/health` reports it; a new `/api/live` answers from the process alone and becomes the load balancer's check. `infra/demo` sets the rolling deployment (100% / 200%, circuit breaker without rollback), a 120-second grace period, a tuned health check and a 30-second deregistration delay. `demo-up` fails fast on a `FAILED` deployment and waits to deadlines; `db-setup` gets timeouts and can be stopped; the deploy role gains `ecs:StopTask` and two hardening conditions. A watch script proves the redeploy from the owner's machine.

**Tech Stack:** Node 24 with TypeScript run directly, Fastify 5, `pg` 8, Zod 4, Vitest; Docker and Compose; Terraform 1.16.5, `hashicorp/aws` (`~> 6.68`), tflint; GitHub Actions (`docker/build-push-action` v7.4.0, the pins already in `ci.yml` and `demo-up.yml`); the AWS CLI; IAM Access Analyzer and the IAM policy simulator; bash and `curl`.

**Spec:** [`docs/superpowers/specs/2026-10-21-PH-12d-safe-redeploys-design.md`](../specs/2026-10-21-PH-12d-safe-redeploys-design.md)

## Global Constraints

- `GIT_COMMIT`: 40 lowercase hex characters or `unknown`; required by `config.ts` like every setting (ADR 0019, decision 2); the Dockerfile's `ARG GIT_COMMIT=unknown` / `ENV GIT_COMMIT=$GIT_COMMIT` in the final stage, after the `COPY` lines.
- `/api/health` bodies: `{"status":"ok","commit":"<sha>","database":{"status":"up","schemaVersion":"…"}}` and `{"status":"error","commit":"<sha>","database":{"status":"down"}}`. `/api/live`: `200` `{"status":"ok"}`, no database. Neither route request-logged.
- Target group `szop-demo-app`: health check `path = "/api/live"`, `interval = 10`, `timeout = 5`, `healthy_threshold = 2`, `unhealthy_threshold = 3`, `matcher = "200"`; `deregistration_delay = 30`.
- Service `szop-demo-app`: `deployment_minimum_healthy_percent = 100`, `deployment_maximum_percent = 200`, `deployment_circuit_breaker { enable = true, rollback = false }`, `health_check_grace_period_seconds = 120`; everything else as PH-12c left it.
- `demo-up`'s `deploy`: deadlines of 10 minutes (`db-setup`), 15 (start), 10 (`/api/health`), measured with bash's `SECONDS`; `timeout-minutes: 45`; *Download the image* and `docker load` before *Configure AWS credentials*.
- `db-setup`: `statement_timeout` `30s`, `lock_timeout` `10s`, for its own transaction only; the app's pool unchanged.
- `pnpm check` = `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`.
- Region `eu-central-1`; demo resources carry `project = szop`, `group = demo` and a `Name` tag; the deploy role's scoping as ADR 0034, decisions 8 and 9; each managed policy under 6,144 characters.
- Every workflow follows `docs/development/ci-cd.md` "Rules for every workflow". Jobs holding AWS credentials run no project code: Terraform, the AWS CLI, Docker's `load`/`tag`/`push`, git, jq, curl and the shell only.
- Never run `terraform apply` or `destroy` against AWS, never `gh workflow run`, never trigger `demo-up` or `demo-down`, never merge, never delete a remote branch. `terraform plan -lock=false` and read-only AWS calls (`describe-*`, `get-*`, `list-*`, `lookup-events`, `aws iam simulate-*`, `aws accessanalyzer validate-policy`) with the owner's SSO profile `szop` are allowed.
- Nothing that identifies the owner's account goes into a commit: no account ID, no ARN with the account number, no email address.
- Commits follow Conventional Commits and end with `Co-Authored-By: <the model that wrote the commit> <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_015okgLdvBcetFxypZY4nGE6`. The branch is `feat/ph-12d-safe-redeploys`; never commit to `main`.
- Docs: niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon; requirements linked, never plain IDs; long docs keep their `## Contents` in sync; ADR notes in three places (CLAUDE.md, "Documentation").
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit, `git push` the phase branch, then stop and summarize the task for the owner; start the next task only when the owner says so (`docs/superpowers/plans/CLAUDE.md`).

## Review Focus

1. **A `502` at the switch from a keep-alive race.** The load balancer reuses connections to a task for up to 60 seconds; if the app closed idle ones sooner, a request could land on a closed socket. Task 2 pins Fastify's keep-alive timeout above 60 seconds with a test; Task 7's watch-script runs are the end-to-end proof.
2. **A first start the circuit breaker does not watch.** Scaling a completed deployment from 0 to 1 may not be a deployment at all, so a broken first start would loop for 15 minutes. Task 5 starts with `--force-new-deployment` at count 0; Task 7 checks the primary deployment's `rolloutState` after the first run.
3. **A malformed or missing `GIT_COMMIT`.** A short hash, upper case or an empty value would make the watch script lie or the app refuse to start in an unexpected place. Task 1 tests each case in `config.ts`, and `check:image` proves the image's default.
4. **`demo-down` after a failed deploy.** The failed run records the throwaway commit as `deployed_commit`; destroying from it, or after its branch is deleted, would go wrong. Task 7 fixes forward before `demo-down`, and the owner deletes the branch only after.
5. **`ecs:StopTask` reaching the app's tasks.** The new permission must stop only `db-setup`'s tasks. Task 4 simulates `StopTask` on a task tagged `Name = szop-demo-app` and expects `implicitDeny`.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `package.json`, `docs/development/scripts.md`, `docs/development/setup.md` | `pnpm check` | 1 |
| `apps/api/src/config.ts`, `config.test.ts`, `apps/api/.env.example`, `apps/api/src/test/config.ts` | `GIT_COMMIT` → `config.commit` | 1 |
| `packages/shared/src/health.ts`, `apps/web/src/test/server.ts` | `commit` in the health body | 1 |
| `apps/api/src/health/routes.ts`, `routes.test.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts` | the commit in `/api/health` and the startup log | 1 |
| `Dockerfile`, `compose.yaml`, `scripts/check-image.sh`, `.github/workflows/ci.yml`, `.github/workflows/demo-up.yml` (`build`) | the build argument and its check | 1 |
| `apps/api/src/health/routes.ts`, `routes.test.ts`, `apps/api/src/app.ts` | `/api/live`, its logging, the keep-alive test | 2 |
| `apps/api/src/db/setup-role.ts`, `setup-role.test.ts` | `db-setup`'s timeouts | 3 |
| `infra/demo/service.tf`, `infra/base/ci_roles.tf` | the deployment, the target group, the deploy role | 4 |
| `.github/workflows/demo-up.yml` (`deploy`) | order, deadlines, the start loop, `db-setup`'s stop | 5 |
| `scripts/watch-demo.sh` and the living docs | the watch script; runbook, `drizzle.md`, architecture, stack overview, threat model, CI/CD, glossary, testing | 6 |
| — (the owner's runs, a throwaway branch) | proof on AWS, timings | 7 |
| `docs/decisions/0039-safe-redeploys-details.md`, earlier ADRs, `docs/roadmap.md`, `README.md` | records and tracking | 8 |

---

### Task 1: pnpm check, and the commit in the image and in /api/health

**Files:**
- Modify: `package.json`; `docs/development/scripts.md` ("Checks"); `docs/development/setup.md` ("Check that everything works": `pnpm check` and `pnpm check:workflows` in place of the four lines, success described per script as today)
- Modify: `apps/api/src/config.ts`, `apps/api/src/config.test.ts`, `apps/api/src/test/config.ts`, `apps/api/.env.example`
- Modify: `packages/shared/src/health.ts`, `apps/web/src/test/server.ts`
- Modify: `apps/api/src/health/routes.ts`, `apps/api/src/health/routes.test.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts`
- Modify: `Dockerfile`, `compose.yaml`, `scripts/check-image.sh`, `.github/workflows/ci.yml` (`docker` job), `.github/workflows/demo-up.yml` (`build` job)

**Interfaces:**
- Produces: `Config.commit: string`; `testConfig()` defaults `commit` to `"unknown"`; `HealthRoutesOptions.commit: string`; `healthSchema` with `commit: z.string()` in both variants; `pnpm check`.

- [x] **Step 1: `pnpm check`**

Add `"check": "pnpm lint && pnpm format:check && pnpm typecheck && pnpm test"` after `"test:coverage"`. A row in `scripts.md`'s "Checks" table (what it runs, in that order, stopping at the first failure; needs `pnpm db:up` first; no CI job runs it, CI runs its parts as `lint`, `typecheck`, `test`), and the intro sentence there pointing to it. Run `pnpm db:up && pnpm check`. Expected: all four pass.

- [x] **Step 2: Failing tests for `GIT_COMMIT`**

In `config.test.ts`, add `GIT_COMMIT: "0123456789abcdef0123456789abcdef01234567"` to `valid`, and:
- `it("reads the commit")`: `loadConfig(valid).commit` equals that hash.
- `it("accepts unknown")`: `loadConfig({ ...valid, GIT_COMMIT: "unknown" }).commit === "unknown"`.
- `it.each(["", "0123456", "0123456789ABCDEF0123456789ABCDEF01234567", "main"])("refuses the commit %j")`: `errorFor(...)` matches `/GIT_COMMIT: (?!missing)/`.
- the existing missing-setting test's expectations include `GIT_COMMIT: missing` when it is left out.

Run `pnpm test apps/api/src/config.test.ts`. Expected: the new tests fail.

- [x] **Step 3: `GIT_COMMIT` in `config.ts`**

`GIT_COMMIT: z.string().regex(/^([0-9a-f]{40}|unknown)$/, 'must be a full commit hash or "unknown"')` with a comment (baked into the image by the build, `unknown` outside it; spec, decision 3), mapped to `commit`. `testConfig` gets `commit: "unknown"`. `.env.example` gets `GIT_COMMIT=unknown` with a comment saying the image sets the real value. Copy the line into your own `apps/api/.env` too. Run the config tests. Expected: pass.

- [x] **Step 4: Failing tests for the health body**

In `routes.test.ts`: build with `testConfig({ commit: "0123456789abcdef0123456789abcdef01234567" })`; the `200` test expects `commit` with that hash beside `status`; the `503` test the same; both keep the `healthSchema.parse` round trip. Run `pnpm test apps/api/src/health`. Expected: fail.

- [x] **Step 5: The commit in the schema, the routes, the log**

`healthSchema`: `commit: z.string()` in both variants, the comment naming it. `healthRoutes` takes `commit` in its options and puts it in both bodies; `app.ts` passes `config.commit`. `server.ts`'s `migrations applied` line logs `{ schemaVersion, commit: config.commit }`. `apps/web/src/test/server.ts`'s `healthyBody` gets `commit: "unknown"`. Run `pnpm check`. Expected: pass.

- [x] **Step 6: The image, Compose and their check**

Dockerfile as the Global Constraints say, with a comment (who passes it, spec, decision 3). `compose.yaml`'s `app.build` becomes `{ context: ., args: { GIT_COMMIT: "${GIT_COMMIT:-unknown}" } }`. `check-image.sh`: `export GIT_COMMIT="${GIT_COMMIT:-$(git rev-parse HEAD)}"` before the build; a new check after `/`: `curl --silent --max-time 10 http://127.0.0.1:8080/api/health` must contain `"commit":"$GIT_COMMIT"`, else `fail "…"`; the final `OK:` line names the commit. Run `pnpm check:image`. Expected: `OK: …` with the branch's commit.

- [x] **Step 7: The build argument in CI and in demo-up**

`ci.yml`'s `docker` job: a step `id: commit` writing `sha=$(git rev-parse HEAD)` to `$GITHUB_OUTPUT`, then `build-args: GIT_COMMIT=${{ steps.commit.outputs.sha }}` on the build, and `GIT_COMMIT: ${{ steps.commit.outputs.sha }}` in the `env` of the `check-image.sh --no-build` step. `demo-up.yml`'s `build` job: `build-args: GIT_COMMIT=${{ steps.commit.outputs.sha }}`. Comments say why. Run `pnpm check:workflows`. Expected: no findings.

- [x] **Step 8: Commit and push**

```bash
git add package.json docs/development apps packages Dockerfile compose.yaml scripts .github
git commit -m "feat(api): report the image's commit in /api/health"
git push -u origin feat/ph-12d-safe-redeploys
```

---

### Task 2: The liveness route

**Files:**
- Modify: `apps/api/src/health/routes.ts`, `apps/api/src/health/routes.test.ts`, `apps/api/src/app.ts`

**Interfaces:**
- Consumes: Task 1's `healthRoutes` options.
- Produces: `GET /api/live`.

- [x] **Step 1: Failing tests**

In `routes.test.ts`, a `describe("GET /api/live")`:
- `it("answers 200 while the database is up")`: `200`, JSON, body `{ status: "ok" }`.
- `it("answers 200 while the database cannot be reached")`: with the `szop_test_missing` database, `/api/live` is `200` `{ status: "ok" }` and `/api/health` is `503`.
- `it("keeps idle connections longer than the load balancer's 60 seconds")`: `buildApp(...).server.keepAliveTimeout` is greater than `60_000` (Review Focus 1).

In `describe("the log")`: the `it.each` with no request lines gains `"/api/live"`; the one that keeps them gains `"/api/live/x"` and `"/api/livez"`. Run `pnpm test apps/api/src/health`. Expected: the new tests fail (404, request lines).

- [x] **Step 2: The route and its logging**

`GET /live` in `healthRoutes`, returning `{ status: "ok" }`, with a comment (the load balancer's check; touches only the process, so a database outage does not replace the task; ADR 0036, decision 4). `app.ts`'s `disableRequestLogging` matches `/api/health` or `/api/live`; its comment says the load balancer asks `/api/live` every 10 seconds and the watch script `/api/health` every second. Run `pnpm check`. Expected: pass. If the keep-alive test fails, set Fastify's `keepAliveTimeout: 65_000` with a comment instead of relying on the default.

- [x] **Step 3: Commit and push**

```bash
git add apps
git commit -m "feat(api): add a liveness route for the load balancer"
git push
```

---

### Task 3: db-setup's timeouts

**Files:**
- Modify: `apps/api/src/db/setup-role.ts`, `apps/api/src/db/setup-role.test.ts`

**Interfaces:**
- Produces: `export interface SetupTimeouts { statement: string; lock: string }`; `export const setupTimeouts: SetupTimeouts = { statement: "30s", lock: "10s" }`; `setupAppRole(db: Database, appRole: AppRole, timeouts: SetupTimeouts = setupTimeouts): Promise<{ created: boolean }>`.

- [x] **Step 1: Failing test**

In `describe("setupAppRole")`: `it("gives up on a lock it cannot get")`: run `setupAppRole` once to create the role; on a second connection from the same pool, `BEGIN` and `ALTER ROLE <role> PASSWORD 'held'` and keep the transaction open; then `setupAppRole(db, appRole, { statement: "30s", lock: "100ms" })` rejects with an error whose `code` is `55P03` within 2 seconds; finally `ROLLBACK` and release the holder. Run `pnpm test apps/api/src/db/setup-role.test.ts`. Expected: fails (it waits, then the test times out).

- [x] **Step 2: The timeouts**

Right after `BEGIN`: `SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', $2, true)` with the two values, so they last for this transaction only. Comment: a hanging `db-setup` would hold `demo-up` for 10 minutes and block `demo-down` (OP-101). Run `pnpm check`. Expected: pass.

- [x] **Step 3: Commit and push**

```bash
git add apps
git commit -m "fix(api): bound db-setup's statements and lock waits"
git push
```

---

### Task 4: The deployment, the target group and the deploy role

**Files:**
- Modify: `infra/demo/service.tf`, `infra/base/ci_roles.tf`

- [x] **Step 1: `infra/demo`**

Set the target group's and the service's values from the Global Constraints. Comments: the target group's says why each number (spec, decisions 6 and 9) and that ECS takes a task out before `SIGTERM`; the service's cites ADR 0036, decisions 3 to 5 and the spec's decisions 7 and 8, and that a `FAILED` deployment launches no more tasks while the old one keeps serving. Remove "until PH-12d" wording. Run `pnpm check:infra`. Expected: pass.

- [x] **Step 2: `infra/base`**

In `ci_roles.tf`:
- `StopDbSetup`: `ecs:StopTask` on `arn:aws:ecs:eu-central-1:${var.account_id}:task/szop-demo/*`, conditions `aws:RequestedRegion`, `ArnEquals ecs:cluster` = the cluster, `StringEquals aws:ResourceTag/Name = szop-demo-db-setup`; in the policy that holds `RunDbSetup`.
- `CreateMasterSecret`: `secretsmanager:CreateSecret` gains `Bool aws:ViaAWSService = true`; `TagResource` stays only if Step 3 shows it is needed, with the same condition; the comment cites PH-12c's CloudTrail (`invokedBy rds.amazonaws.com`, no tags).
- `CreateInstance`: `Bool rds:ManageMasterUserPassword = true`; check the Service Authorization Reference for a `PubliclyAccessible` key on `CreateDBInstance` and add `Bool … = false` only if it exists; the comment names what guards public access otherwise.

Run `pnpm check:infra`. Expected: pass. Check each changed policy's rendered size under 6,144 characters (`terraform -chdir=infra/base plan -lock=false` with `AWS_PROFILE=szop`, or `jq -c . | wc -c` on the rendered document).

- [x] **Step 3: Simulate (Review Focus 5)**

With `AWS_PROFILE=szop`, render the changed policies and run `aws iam simulate-custom-policy`:
- `ecs:StopTask` on a task ARN in `szop-demo` with context `aws:ResourceTag/Name=szop-demo-db-setup`, `ecs:cluster=<cluster ARN>`: `allowed`; with `Name=szop-demo-app`: `implicitDeny`.
- `secretsmanager:CreateSecret` on `rds!db-x` with `aws:ViaAWSService=true`: `allowed`; with `false`: `implicitDeny`.
- `rds:CreateDBInstance` with the tags and `rds:ManageMasterUserPassword=true`: `allowed`; with `false`: `implicitDeny`.

`aws accessanalyzer validate-policy` on each changed policy: no errors, no security warnings. Look up whether CloudTrail holds any `secretsmanager:TagResource` event by the deploy role (`aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=TagResource`); if none, drop `TagResource` from `CreateMasterSecret`.

- [x] **Step 4: The demo's plan**

With `AWS_PROFILE=szop`: `terraform -chdir=infra/demo plan -lock=false -var deployed_commit=$(git rev-parse HEAD)`. Expected (no demo up): everything to add, with the target group's and the service's new values in the output.

- [x] **Step 5: Commit and push**

```bash
git add infra
git commit -m "feat(infra): deploy the demo rolling, with the circuit breaker and a liveness check"
git push
```

---

### Task 5: demo-up's deploy job

**Files:**
- Modify: `.github/workflows/demo-up.yml`

- [ ] **Step 1: Order and timeout**

Move *Download the image* above *Configure AWS credentials*, and `gunzip -c … | docker load` into a step right after it (*Load the image*); *Push the image* no longer loads. `timeout-minutes: 45`, its comment updated (the three deadlines, the apply, the state lock's wait). Update the header comment's list of steps if it names them.

- [ ] **Step 2: `db-setup`'s wait**

Replace `aws ecs wait tasks-stopped` with a loop to `deadline=$((SECONDS + 600))`, every 10 seconds `describe-tasks … --query 'tasks[0].lastStatus'` until `STOPPED`. At the deadline: `aws ecs stop-task --cluster … --task … --reason "demo-up: db-setup did not stop within 10 minutes"`, then the existing `::error::` with the log stream, exit 1.

- [ ] **Step 3: The start**

Read `desiredCount` first. At `0`: `update-service --desired-count 1 --force-new-deployment`; otherwise no call (Review Focus 2). Then to `deadline=$((SECONDS + 900))`, every 10 seconds, one `describe-services` with `--query 'services[0].[length(deployments), deployments[?status==`PRIMARY`] | [0].rolloutState, runningCount, desiredCount]'`:
- `1`, `COMPLETED`, running = desired: success, print the elapsed seconds;
- `FAILED`: print the primary deployment's `rolloutStateReason` and the five latest events, `::error::The deployment failed: the circuit breaker stopped it; the previous version keeps serving`, exit 1;
- otherwise print the state and continue.

At the deadline: the latest events and the existing error. The comment above says why (ADR 0036, decision 3; spec, decision 10) and drops the 300-second explanation.

- [ ] **Step 4: The wait for the app**

A loop to `deadline=$((SECONDS + 600))`. Success needs `"status":"ok"` and `"commit":"$COMMIT"` (the deployed commit, from `steps.commit.outputs.sha` through `env`); print the body. If the deadline passes with `ok` but another commit, the error says the old version still answers. The summary gains a line with the commit `/api/health` reported.

- [ ] **Step 5: Check**

Run `pnpm check:workflows`. Expected: no findings. Read the job top to bottom once against `docs/development/ci-cd.md`'s rules (no project code in `deploy`, nothing user-controlled in `${{ }}` inside `run:`).

- [ ] **Step 6: Commit and push**

```bash
git add .github
git commit -m "ci(demo-up): fail fast on a failed deployment and wait to deadlines"
git push
```

---

### Task 6: The watch script and the docs

**Files:**
- Create: `scripts/watch-demo.sh` (executable)
- Modify: `docs/operations/demo-environment.md`, `docs/development/tools/drizzle.md`, `docs/development/ci-cd.md`, `docs/architecture/architecture.md`, `docs/architecture/stack-overview.md`, `docs/architecture/threat-model.md`, `docs/glossary.md`; `docs/development/testing.md` and `.github/pull_request_template.md` if they list the four check scripts

- [ ] **Step 1: The script**

`scripts/watch-demo.sh [url]`, `set -euo pipefail`, default `https://szop.dzwoniec.com/api/health`. Every second: `curl --silent --max-time 2 --write-out '\n%{http_code}'`; one line `HH:MM:SS  <status>  <commit, 12 chars or ->  <schemaVersion or ->`, plus `<- new commit` when the commit differs from the previous answer's. Body fields read with bash's `[[ =~ ]]`, no `jq`. A `trap` on `INT` prints the summary: requests, how many were not `200`, and for each commit seen its first and last time. A header comment says what it is for and links the runbook.

- [ ] **Step 2: Try it locally**

`pnpm image:up` in one terminal; `scripts/watch-demo.sh http://127.0.0.1:8080/api/health` in another: lines with `200` and the commit. Stop the container: lines with `000`. Start it again: `200` again. Ctrl+C: the summary counts the `000` lines. Run `shellcheck scripts/watch-demo.sh` if installed. Expected: as described, no findings.

- [ ] **Step 3: The docs**

As the spec's "Documentation and records" lists, apart from ADR 0039 (Task 8): the runbook's redeploy section with the watch script, what a `FAILED` deployment looks like and what to do, `db-setup`'s stop, the SPA version gap (OP-103), and the 300-second explanation replaced by AWS's documented behaviour (timings stay "to be measured" until Task 7); `drizzle.md`'s "Migrations and rolling deploys" section, with a `## Contents` entry if it has one; `ci-cd.md`'s `build` and `deploy` rows; the architecture's health routes and deployment; the stack overview's rolling deploys, liveness and readiness, circuit breaker, deregistration delay and build arguments; the threat model's commit on a public route and `ecs:StopTask`; the glossary's new terms. Run `pnpm format:check`. Expected: pass.

- [ ] **Step 4: Commit and push**

```bash
git add scripts docs .github
git commit -m "docs: add the redeploy watch script and describe safe redeploys"
git push
```

---

### Task 7: The owner's steps on AWS

The controller runs this task itself, with the owner; no subagent.

**Files:**
- Modify: whatever the runs show to be wrong; `docs/operations/demo-environment.md` (timings); this plan.

- [ ] **Step 1: Owner checkpoint 1: base**

Create the owner-step issue for the base apply (as `docs/development/project-tracking.md` describes owner steps), and update #245's text with the watch script, the failed deploy, the fix-forward run and the branch's deletion. Ask the owner to apply `infra/base` from the branch and see a second plan with no changes. Wait.

- [ ] **Step 2: The draft PR**

`gh pr create --draft`, title `feat: make redeploys of the demo safe`, the template filled in as far as it goes, `Closes #244`. Check `infra-plan`'s comment: base without changes, demo with Task 4's values, Access Analyzer without errors or security warnings.

- [ ] **Step 3: The throwaway branch**

From the phase branch: `git switch -c test/ph-12d-failing-start`; in `server.ts`, right after the config is loaded, `console.error("PH-12d: failing on purpose to test the circuit breaker"); process.exit(1);`; commit `test: fail at startup on purpose (PH-12d, not for merging)`; `git push -u origin test/ph-12d-failing-start`; `git switch feat/ph-12d-safe-redeploys`.

- [ ] **Step 4: Owner checkpoint 2: a fresh demo**

Ask the owner to press `demo-up` on the phase branch. On a missing permission: fix under Task 4's rules, simulate, commit `fix(infra): …`, push, the owner applies base and re-runs. Then: `curl -s https://szop.dzwoniec.com/api/health` shows the branch's commit; `aws ecs describe-services --cluster szop-demo --services szop-demo-app --query 'services[0].deployments[].[status,rolloutState]'` shows `PRIMARY COMPLETED` (Review Focus 2); the target group's health check and attributes as set (`aws elbv2 describe-target-groups`, `describe-target-group-attributes`). Record the start's duration and how long the new target took to turn healthy.

- [ ] **Step 5: Owner checkpoint 3: the redeploy**

Push a small commit to the phase branch first if it holds no newer commit than the deployed one (this plan's ticks do). Ask the owner to start `scripts/watch-demo.sh`, press `demo-up` on the branch, stop the script when the run is green, and share its output. Meanwhile, every 10 seconds, `aws elbv2 describe-target-health` to see the old target `draining` and when it goes. Expected: every line `200`, one switch of commit, the run green. Record the redeploy's duration and the old target's draining time.

- [ ] **Step 6: Owner checkpoint 4: the failed deploy and the fix**

Ask the owner to start the script again and press `demo-up` with `ref` = `test/ph-12d-failing-start`. Expected: *Start the app* fails with `FAILED` and the circuit breaker's reason, in well under 15 minutes; the script shows only `200` with the old commit. Record the time to `FAILED`. Then ask the owner to press `demo-up` on the phase branch again (fix forward); expected green, `/api/health` back on the branch's commit.

- [ ] **Step 7: Owner checkpoint 5: demo-down**

Ask the owner to press `demo-down`, then delete `test/ph-12d-failing-start` on GitHub. Expected: `Destroy complete!`; the Tag Editor search (or `aws resourcegroupstaggingapi get-resources --region eu-central-1 --tag-filters Key=group,Values=demo`) lists only inactive task definitions and what the index still lags on. Record how long the service took to go.

- [ ] **Step 8: Timings and fixes**

Into the runbook and `demo-up`'s comments: the measured start, redeploy, draining, time to `FAILED` and destroy, with the explanation the measurements support (spec, decision 13); the watch script's output into the PR. Commit and push.

```bash
git add docs .github infra apps
git commit -m "docs(runbook): record safe redeploys' timings"
git push
```

---

### Task 8: ADR 0039, the roadmap and GitHub

**Files:**
- Create: `docs/decisions/0039-safe-redeploys-details.md`
- Modify: ADRs 0019, 0020, 0034, 0036 and 0038 (status lines and decision notes, where the spec's "Documentation and records" names them); `docs/roadmap.md`; `README.md`

- [ ] **Step 1: ADR 0039 "Safe redeploys details"**

In the form of ADR 0038: context, the spec's sixteen decisions with options and reasoning (decision 3 noting `GIT_COMMIT` is required, per ADR 0019, decision 2), "Settled while building" with what Tasks 1–7 found (the keep-alive timeout, the IAM conditions that worked, whether `--force-new-deployment` was needed, the timings), consequences for PH-37 (the grace period with the lock; OP-103). Header: `Completes:` ADR 0036, decisions 3, 4 and 5; ADR 0038, decision 12; `Extends:` the ADR 0020 decision that defines `/api/health`'s body; `Refines:` any ADR 0034 decision on `demo-up`'s waits.

- [ ] **Step 2: The notes**

In each ADR named: the status line, and the line at the bottom of the decision's cell, as CLAUDE.md "Documentation" describes.

- [ ] **Step 3: Roadmap and README**

PH-12d's row: the PR link, then ✅ Done before the merge; the README's diagram mirrors it. PH-12d's entry: **Delivers** gains the commit in `/api/health`, the watch script, `pnpm check` and OP-101's hardening; **Owner steps** the base apply, the failed deploy and the fix-forward run.

- [ ] **Step 4: GitHub**

"Settled by" comments on OP-043 (#84, its PH-12d part ticked), OP-075 (#87) and OP-101 (#247); #244's body from the roadmap entry. The PR: the template filled in; `Closes #244`, `#84`, `#87`, `#247`, #245 and the base-apply issue; the list of every issue change made in the phase (OP-103 #249 created, the owner-step issues, the fields); marked ready for review.

- [ ] **Step 5: Commit and push**

```bash
git add docs README.md
git commit -m "docs: add ADR 0039 and finish PH-12d on the roadmap"
git push
```
