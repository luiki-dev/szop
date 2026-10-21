# PH-12c App on ECS and RDS — design

- **Phase:** [PH-12c](../../roadmap.md#ph-12c-app-on-ecs-and-rds) ([#221](https://github.com/luiki-dev/szop/issues/221))
- **Date:** 2026-10-20
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-016](https://github.com/luiki-dev/szop/issues/75), [OP-017](https://github.com/luiki-dev/szop/issues/68), [OP-018](https://github.com/luiki-dev/szop/issues/73), [OP-021](https://github.com/luiki-dev/szop/issues/83), [OP-074](https://github.com/luiki-dev/szop/issues/86), [OP-096](https://github.com/luiki-dev/szop/issues/218) and [OP-099](https://github.com/luiki-dev/szop/issues/228) (settled); [OP-013](https://github.com/luiki-dev/szop/issues/66) and [OP-053](https://github.com/luiki-dev/szop/issues/26) (PH-12c part, then on to PH-18); [OP-019](https://github.com/luiki-dev/szop/issues/77) and [OP-020](https://github.com/luiki-dev/szop/issues/78) (PH-12c part, then on to PH-13); [OP-043](https://github.com/luiki-dev/szop/issues/84) (PH-12c part, then on to [PH-12d](../../roadmap.md#ph-12d-safe-redeploys))

The walking skeleton runs on AWS for the first time. Pressing `demo-up` builds the commit's image, creates the database and one ECS task, and `https://szop.dzwoniec.com` shows the SPA's status page: the API up, the database up, and the schema version. The direction was settled before: ECS on Fargate, RDS for PostgreSQL, the network and the secrets of [ADR 0008](../../decisions/0008-hosting.md), decisions 10, 14 to 16 and 19 to 23; the image built on demand by `demo-up` ([ADR 0010](../../decisions/0010-ci-cd.md), decisions 10 and 11); the deploy role that grows with `infra/demo` ([ADR 0032](../../decisions/0032-ci-access-and-teardown-details.md), decision 3; [ADR 0034](../../decisions/0034-network-and-demo-up-details.md), decisions 8 and 9); the app's TLS and migration check of [ADR 0033](../../decisions/0033-app-ready-for-the-cloud-details.md). This spec holds the details those left to the phase, as agreed in the brainstorm. They are recorded in ADR 0038.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Files](#files)
  - [The database role and db-setup](#the-database-role-and-db-setup)
  - [infra/base: the app's roles and secret](#infrabase-the-apps-roles-and-secret)
  - [infra/demo: the database](#infrademo-the-database)
  - [infra/demo: the service](#infrademo-the-service)
  - [The deploy role](#the-deploy-role)
  - [The plan role](#the-plan-role)
  - [demo-up.yml](#demo-upyml)
- [Documentation and records](#documentation-and-records)
- [Roadmap and GitHub changes](#roadmap-and-github-changes)
- [Owner steps](#owner-steps)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: pressing `demo-up` on a branch builds that commit's image and serves the walking skeleton from one ECS task backed by RDS: `https://szop.dzwoniec.com` shows the API and the database up, with the schema version. `demo-down` removes everything again.

The phase is done when:

- `db-setup`'s integration tests pass locally and in CI: after it runs, `szop_app` can log in, run the migrations and read and write rows, and cannot create a role or a database; a second run changes nothing and succeeds;
- `infra/base` is applied from the owner's machine with the app's roles, `szop_app`'s password and the widened deploy and plan roles, and a second `terraform plan` shows no changes;
- IAM Access Analyzer's policy validation reports no errors and no security warnings for the new and changed policies, as shown in the phase PR's plan comment (the known trust-policy findings of ADR 0032, decision 4, stay accepted);
- `demo-up`, pressed on the phase branch and approved by the owner, finishes green: it builds the image, pushes `szop:<commit>`, applies `infra/demo`, runs `db-setup` to a zero exit code, starts one task, finds `/api/health` answering `200` with `"status":"ok"`, and writes a summary;
- in a browser, `https://szop.dzwoniec.com` shows `API: ok`, `Database: up` and the schema version, with a valid certificate; the task's log in `/szop/app` shows the owner's real IP address for that request, and for a request sent with a forged `X-Forwarded-For: 203.0.113.7`, which proves the load balancer is the one trusted hop ([ADR 0012](../../decisions/0012-security-baseline.md), decision 13; [OP-053](https://github.com/luiki-dev/szop/issues/26)); a Lighthouse run in Chrome's DevTools completes, its scores noted in the PR;
- the app's log shows its connection to RDS with `DATABASE_TLS=verify-full`, and `SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()` run through ECS Exec, following the runbook, returns `true` ([OP-017](https://github.com/luiki-dev/szop/issues/68));
- searching the state of `infra/base` and `infra/demo` for `szop_app`'s password and the master password, as the runbook's check does, finds neither ([OP-016](https://github.com/luiki-dev/szop/issues/75));
- `demo-down`, run by hand from `main` after the merge (or from the branch's commit, which it reads from the state), reports `Destroy complete!` with every resource `demo-up` created, and the Tag Editor, searching **eu-central-1** for `group` = `demo`, finds nothing but inactive task definitions ([decision 15](#decisions-taken-in-the-brainstorm));
- `pnpm check`, `pnpm check:infra` and `pnpm check:workflows` pass;
- the docs and records listed under [Documentation and records](#documentation-and-records) are updated, and the roadmap and GitHub as in [Roadmap and GitHub changes](#roadmap-and-github-changes).

## Out of scope

- **Safe redeploys**: the liveness route, rolling at 100% and 200% with the circuit breaker, the 30-second deregistration delay, the health check's tuning and the expand-then-contract rule are [PH-12d](../../roadmap.md#ph-12d-safe-redeploys). PH-12c keeps ECS's and the load balancer's defaults, except the grace period ([decision 12](#decisions-taken-in-the-brainstorm)). A redeploy works, slowly, with the combined health check.
- **Two tasks** and the migration lock: [PH-37](../../roadmap.md#ph-37-two-tasks).
- **Separate migration and runtime roles** ([decision 4](#decisions-taken-in-the-brainstorm)): a step for an always-on Szop, added to [OP-033](https://github.com/luiki-dev/szop/issues/116).
- **The SES `EmailSender` and the task role's SES permission**: [PH-18](../../roadmap.md#ph-18-registration-and-login), when the app first sends mail. The task role holds only what ECS Exec needs.
- **Keeping the deployed commit through a failed destroy** ([OP-099](https://github.com/luiki-dev/szop/issues/228), [decision 8](#decisions-taken-in-the-brainstorm)).
- **`psql` in the image** *(Claude's call)*: the slim image has no PostgreSQL client; the runbook queries through Node and the app's `pg` instead ([decision 13](#decisions-taken-in-the-brainstorm)).
- **A landing page while the demo is down**: [PH-34](../../roadmap.md#ph-34-landing-page-and-demo-status).

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | The phase's scope | Keep PH-12c whole; split off safe redeploys | **Split** *(the owner's choice)*. With [ADR 0036](../../decisions/0036-scalability-and-isolation.md)'s safe redeploys, PH-12c held about twelve tasks and three concepts new to the project: ECS, RDS and rolling deploys with two versions at once ([ADR 0014](../../decisions/0014-roadmap.md), decision 6). The rolling deploys, the circuit breaker, the deregistration delay, the liveness route, the grace period's tuning and the expand-then-contract rule became [PH-12d Safe redeploys](../../roadmap.md#ph-12d-safe-redeploys), right after PH-12c; [PH-37](../../roadmap.md#ph-37-two-tasks) depends on it. ECS's defaults already deploy at 100% and 200%, so PH-12c's redeploys work, slowly. |
| 2 | The README's roadmap diagram | Twelve phases a row ([ADR 0037](../../decisions/0037-twelve-phases-a-diagram-row.md)); fewer | **At most ten phases a row, so the diagram is about 84 characters wide** *(the owner's choice)*. Stage 3, now thirteen phases, wraps after PH-35 onto a second row; Stage 4's nineteen are ten and nine. No ADR of its own: ADR 0038 records it, refining ADR 0037, decision 1. |
| 3 | What the demo shows | The SPA's status page at `/`; `/` redirecting to `/api/health` | **The SPA's status page** *(the owner's choice)*. It already shows `API: ok`, `Database: up` and the schema version from `/api/health`, and proves the SPA's files are served from the image too. A redirect would hide the page, make the owner's Lighthouse run measure JSON, and have to go again when PH-16 puts lists at `/`. |
| 4 | The database role the app uses ([OP-074](https://github.com/luiki-dev/szop/issues/86)) | RDS's master user; one role owning the database; a migration role and a runtime role | **One role, `szop_app`, owning the database `szop`** *(the owner's choice)*: it logs in, owns the database and so its `public` schema, and creates and changes tables there, since the app migrates itself ([ADR 0008](../../decisions/0008-hosting.md), decision 14); it has no `CREATEROLE`, no `CREATEDB` and no membership in `rds_superuser`. The master user only creates and updates it, and the app never sees the master password. Using the master user in an app is the practice AWS advises against: a compromised app could create roles that survive a password change. The full pattern, a runtime role without DDL, needs migrations run as a step of their own with their own role, which ADR 0036, decision 2 left for later; it is added to [OP-033](https://github.com/luiki-dev/szop/issues/116). Locally the app and the tests keep the superuser `szop`. |
| 5 | Who creates `szop_app` | A one-off ECS task run by `demo-up`; an init container in the app's task | **A one-off task, `db-setup`, run by `demo-up`** *(the owner's choice)*, with its own task definition: the same image, another command, the master password injected. It is explicit and runs once per `demo-up`, so the master password is used once per deploy. An init container would need no workflow step and no CI permission to run tasks, but would hand the master password to every task start. |
| 6 | Starting the service after `db-setup` *(Claude's call)* | Let the first task fail until the role exists; two applies; a service created at zero tasks | **Terraform creates the service at zero tasks and then ignores its count; `demo-up` runs `db-setup`, then sets the count to 1.** A first task started before the role exists would fail and be restarted until it does, filling the log and, from PH-12d, tripping the circuit breaker. On a redeploy the role exists, `db-setup` changes nothing and the count is already 1. Ignoring the count is what PH-38's autoscaling needs anyway. |
| 7 | `szop_app`'s password *(Claude's call)* | Generated by Terraform into state; a write-only SSM parameter in base; IAM database authentication | **An SSM `SecureString` `/szop/db-app-password` in `infra/base`, from an ephemeral random password through a write-only argument**, the Better Auth secret's pattern ([ADR 0030](../../decisions/0030-domain-and-base-infrastructure-details.md), decision 10), so its value never enters state ([ADR 0008](../../decisions/0008-hosting.md), decision 22). It lives in base because the database is recreated each session and the role with it, but the password need not change. IAM authentication would remove the password, but needs the AWS SDK in the app and a token refreshed for every new connection, a concept of its own. |
| 8 | A destroy that fails halfway ([OP-099](https://github.com/luiki-dev/szop/issues/228)) | Keep the deployed commit in an SSM parameter outside Terraform; the runbook's manual step | **The runbook's manual step** *(the owner's choice)*. A destroy is driven by the state, so `main`'s code still removes every resource a failed destroy left; the runbook already says to take the commit from the failed run's summary. A parameter would be another moving part and more permissions for the deploy role. |
| 9 | Building the image ([OP-021](https://github.com/luiki-dev/szop/issues/83)) *(Claude's call)* | In parallel with Terraform; before it, in the job that holds AWS credentials; before it, in a job without them | **A `build` job without AWS credentials builds the image and hands it to `deploy` as a workflow artifact; `deploy` pushes it only if ECR lacks the tag, then applies.** Not in parallel: on a redeploy Terraform swaps the task definition at once, and the new task would try to pull an image not yet pushed. In a job of its own, the Dockerfile's `pnpm install` and build run with no AWS credentials on the runner ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18); `build` needs no approval, so it runs while the owner approves `deploy`. The image is built with `docker build` into the runner's image store, a single-platform image with no attestation manifests, so ECR's lifecycle rules count one image per tag ([OP-013](https://github.com/luiki-dev/szop/issues/66)'s note). Refines [ADR 0012](../../decisions/0012-security-baseline.md), decision 16, whose image and deploy jobs waited together behind one approval: the approval guards the deploy role's token, and `build` asks for none, so only `deploy` declares `environment: demo`. Found by the spec's builder check. |
| 10 | `TRUSTED_PROXIES` on the demo ([OP-053](https://github.com/luiki-dev/szop/issues/26)) *(Claude's call)* | The VPC's range; the public subnets' ranges | **The two public subnets' ranges, `10.0.0.0/24,10.0.1.0/24`**, where the load balancer's nodes live, from `infra/demo`'s locals. The narrowest list that holds every address the load balancer connects from; the task's security group lets nothing else reach the app's port anyway. `config.ts`'s comment changes to match. |
| 11 | The execution role of `db-setup` *(Claude's call)* | Its own role; the app's task execution role | **The app's task execution role**, which may then read the RDS-managed master secret too. The execution role is used by ECS to start a task, never by the code inside it, so the app's container still cannot read the master secret: only a task definition that names it gets it, and only the deploy role registers task definitions. A third role would add an IAM role and its pass permission for no change in what the app can reach. |
| 12 | The health check until PH-12d *(Claude's call)* | ECS's and the load balancer's defaults; tuned now | **Defaults, with a 60-second grace period**: the target group checks `/api/health` (its default interval and thresholds), the deregistration delay stays 300 seconds, and the service ignores failed health checks for 60 seconds after a task starts, so the migrations at startup are not cut short. PH-12d tunes all of these ([OP-075](https://github.com/luiki-dev/szop/issues/87)). |
| 13 | Querying the database while debugging *(Claude's call)* | `psql` added to the image; Node and the app's `pg` through ECS Exec | **Node and the app's `pg`**: the runbook gives a short `node --input-type=module -e '…'` command that connects with the app's own settings and prints a query's rows. Adding the PostgreSQL client to the image would grow it for a tool used rarely, by hand. Refines [ADR 0008](../../decisions/0008-hosting.md), decision 20, which named `psql`. |
| 14 | The database's version and master user *(Claude's call)* | — | **PostgreSQL 18, the major version of `compose.yaml`'s `postgres:18.6`**, given as `engine_version = "18"` so RDS picks its newest minor version, with minor upgrades on; **master user `szop_admin`**, a name that says what it is for (`postgres` and `rdsadmin` are reserved or confusing). If RDS does not offer 18 in `eu-central-1`, the phase stops and asks: compose and RDS keep one major version ([ADR 0008](../../decisions/0008-hosting.md), decision 19). |
| 15 | What may remain after `demo-down` *(Claude's call)* | Delete every leftover; accept named, free ones | **Inactive task definition revisions are accepted.** Terraform's destroy deregisters each revision, which leaves it `INACTIVE`: it costs nothing, cannot start a task and keeps its tags, so the Tag Editor lists it. Deleting them would need `ecs:DeleteTaskDefinitions` and a `demo-down` step for a cosmetic gain. The success criterion and the runbook's check name them as the one expected leftover. The secret RDS creates for the master password is deleted with the instance ([to verify](#to-verify-during-implementation)); if it lingers, it is named the same way or `demo-down`'s check covers it. Found by the spec's builder check. |
| 16 | A read-only root filesystem, or ECS Exec | ECS Exec with a writable root filesystem; a read-only one without ECS Exec, the app logging its TLS state; a `debug` switch on `demo-up` turning ECS Exec on and the read-only filesystem off | **ECS Exec, with a writable root filesystem** *(the owner's choice)*. ECS Exec is not supported with `readonlyRootFilesystem`: the agent it injects writes into the container. The read-only filesystem adds little here: the app runs as `node`, and its files belong to root and are read-only to `node` ([ADR 0028](../../decisions/0028-container-image-details.md), decision 10), so a compromised app cannot change its code, only write to scratch places such as `/tmp`. Compose keeps `read_only: true`, which still proves in CI that the app writes nothing to disk. Refines ADR 0028, decision 10, which prepared the image for ECS's `readonlyRootFilesystem`; keeps [ADR 0008](../../decisions/0008-hosting.md), decision 20. Found by the spec's builder check. |

## Design

### Files

| File | Change |
|---|---|
| `apps/api/src/db/setup-role.ts` | new: `db-setup`'s entry point and the function that creates or updates `szop_app` |
| `apps/api/src/db/setup-role.test.ts` | new: integration tests against the test PostgreSQL |
| `apps/api/src/config.ts` | the `TRUSTED_PROXIES` comment ([decision 10](#decisions-taken-in-the-brainstorm)) |
| `compose.yaml` | the `read_only` comment: it proves the app writes nothing to disk, while ECS keeps the root filesystem writable for ECS Exec ([decision 16](#decisions-taken-in-the-brainstorm)) |
| `infra/base/app_roles.tf` | new: the task execution role and the task role, with their policies |
| `infra/base/secrets.tf` | `/szop/db-app-password` |
| `infra/base/ci_roles.tf` | the plan role's new denies; the deploy role's new managed policies and attachments |
| `infra/base/outputs.tf` | the new roles' ARNs, if a later reader needs them (demo finds them by name) |
| `infra/demo/locals.tf` | base's new names (roles, parameters, registry, log group), the app's settings; the placeholder page removed |
| `infra/demo/data.tf` | lookups of the roles, the registry and the parameters by name |
| `infra/demo/database.tf` | new: the database's security group, subnet group and instance |
| `infra/demo/service.tf` | new: the task's security group, the cluster, the two task definitions, the target group, the service |
| `infra/demo/load_balancer.tf` | the HTTPS listener forwards to the target group; the load balancer's egress rule to the task |
| `infra/demo/variables.tf` | nothing new: the image tag is `deployed_commit` |
| `infra/demo/outputs.tf` | the cluster, `db-setup`'s task definition, the subnets and the task's security group, for `demo-up`'s run-task |
| `.github/workflows/demo-up.yml` | the `build` job; `deploy`'s push, `db-setup`, scaling and health wait |
| `.github/workflows/demo-down.yml` | comments that still say "PH-12c" brought up to date; nothing else expected |

### The database role and db-setup

`apps/api/src/db/setup-role.ts` is run in the image as `node src/db/setup-role.ts`. It reads its own settings, validated with Zod like `config.ts`, and none of the app's others: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_TLS`, `DATABASE_USER` and `DATABASE_PASSWORD` for the master user, and `APP_DATABASE_USER` and `APP_DATABASE_PASSWORD` for the role it sets up. It connects with the same TLS settings as the app ([ADR 0033](../../decisions/0033-app-ready-for-the-cloud-details.md), decision 5), then, in one transaction:

1. creates the role `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT` if it is missing, and sets its password either way (`ALTER ROLE … PASSWORD`), so a rotated parameter reaches the database at the next `demo-up`;
2. makes it the owner of the database (`ALTER DATABASE … OWNER TO`), which on PostgreSQL 15 and later makes it the owner of the `public` schema too (`pg_database_owner`), and lets it create the `drizzle` schema the migrator keeps its journal in;
3. logs what it did, by name only, never a password, and exits `0`; any error exits `1` with the error's message.

Identifiers are quoted with `pg`'s `escapeIdentifier`; the password is passed as a literal through `escapeLiteral`, since `ALTER ROLE` takes no parameters. The role's name is validated as a plain lower-case identifier before use.

**Tests** run against the test PostgreSQL ([testing guide](../../development/testing.md)), in a database of their own, as the superuser `szop`: after setup, the app's migrations run as the new role and a row can be written and read; `CREATE ROLE` and `CREATE DATABASE` as the role fail with "permission denied"; a second run succeeds and changes nothing; a changed password is applied. On RDS the master user is not a superuser but holds `CREATEROLE` and owns the database; the plan checks that the same statements work for such a user (PostgreSQL 16 and later grant the creating role `ADMIN OPTION` on the new role but not membership, which `ALTER DATABASE … OWNER TO` needs), with a test as a non-superuser `CREATEROLE` user if so.

### infra/base: the app's roles and secret

**`szop-app-task-execution`**, trusted by `ecs-tasks.amazonaws.com` with `aws:SourceAccount` set to the account:

- pulls from the registry `szop` (`ecr:GetAuthorizationToken` on `*`; `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchCheckLayerAvailability` on the repository);
- writes to the log group `/szop/app` (`logs:CreateLogStream`, `logs:PutLogEvents` on its streams);
- reads `/szop/db-app-password` (`ssm:GetParameters` on that parameter); the Better Auth secret is added in PH-18, when the app first reads it (`config.ts` has no `BETTER_AUTH_SECRET` today);
- reads the RDS-managed master secret (`secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:eu-central-1:<account>:secret:rds!db-*`, narrowed by a tag condition if RDS tags its secrets with the instance's tags, [to verify](#to-verify-during-implementation)).

Not AWS's `AmazonECSTaskExecutionRolePolicy`, which allows pulling from every registry and writing to every log group.

**`szop-app-task`**, trusted by `ecs-tasks.amazonaws.com` the same way: only the four `ssmmessages:` actions ECS Exec needs, on `*` (they support no resource scoping). The SES permission arrives with PH-18.

**`/szop/db-app-password`**: `ephemeral "random_password"` (64 letters and digits) and `aws_ssm_parameter` with `value_wo` and `value_wo_version = 1`, beside the Better Auth secret.

### infra/demo: the database

- **Security group `szop-demo-db`:** ingress on 5432 from the task's security group only; no egress rule.
- **Subnet group `szop-demo`** of the two private subnets.
- **Instance `szop-demo`:** `engine = "postgres"`, `engine_version = "18"`, `db.t4g.micro`, 20 GB of `gp3`, encrypted with RDS's AWS-managed key, single-AZ, `publicly_accessible = false`; database `szop`, master user `szop_admin`, `manage_master_user_password = true` (RDS creates and keeps the password in Secrets Manager; [OP-016](https://github.com/luiki-dev/szop/issues/75)); `backup_retention_period = 0`, `skip_final_snapshot = true`, `deletion_protection = false`, `apply_immediately = true` ([ADR 0008](../../decisions/0008-hosting.md), decision 19); the default parameter group, whose `rds.force_ssl` is on for PostgreSQL 15 and later ([to verify](#to-verify-during-implementation)); no Performance Insights, no enhanced monitoring.

### infra/demo: the service

- **Security group `szop-demo-task`:** ingress on 3000 from the load balancer's security group only; egress on 443 to anywhere (ECR, CloudWatch Logs, SSM, Secrets Manager, ECS Exec), and on 5432 to the database's group. The load balancer's group gains egress on 3000 to the task's group.
- **Cluster `szop-demo`**, Container Insights off.
- **Task definition `szop-demo-app`:** Fargate, `awsvpc`, 256 CPU units and 512 MB ([ADR 0008](../../decisions/0008-hosting.md), decision 10), `X86_64`, the execution and task roles; one container `app`, image `<registry URL>:<deployed_commit>`, port 3000, a writable root filesystem ([decision 16](#decisions-taken-in-the-brainstorm)), the `awslogs` driver to `/szop/app` with the stream prefix `app`; environment `HOST=0.0.0.0`, `PORT=3000`, `LOG_LEVEL=info`, `DATABASE_HOST` (the instance's address), `DATABASE_PORT=5432`, `DATABASE_NAME=szop`, `DATABASE_USER=szop_app`, `DATABASE_TLS=verify-full`, `WEB_ROOT` as the image sets it, `TRUSTED_PROXIES=10.0.0.0/24,10.0.1.0/24`; the secret `DATABASE_PASSWORD` from `/szop/db-app-password`. `BETTER_AUTH_SECRET` joins in PH-18, when `config.ts` first requires it. The app's stop timeout stays ECS's 30 seconds, which [ADR 0033](../../decisions/0033-app-ready-for-the-cloud-details.md), decision 6's 15-second bound fits.
- **Task definition `szop-demo-db-setup`:** the same image, roles and log group (stream prefix `db-setup`), command `node src/db/setup-role.ts`; environment the database's address, port and name, `DATABASE_TLS=verify-full`, `DATABASE_USER=szop_admin`, `APP_DATABASE_USER=szop_app`; secrets `DATABASE_PASSWORD` from the master secret's `password` key (`<secret ARN>:password::`) and `APP_DATABASE_PASSWORD` from `/szop/db-app-password`.
- **Target group `szop-demo-app`:** `ip` targets on port 3000, HTTP, health check `/api/health` with ECS's and the load balancer's defaults otherwise ([decision 12](#decisions-taken-in-the-brainstorm)).
- **The HTTPS listener** forwards to the target group instead of the fixed response; its `deployed_commit` precondition stays, and the placeholder page and its length check go.
- **Service `szop-demo-app`:** Fargate, the two public subnets with a public IP address ([ADR 0008](../../decisions/0008-hosting.md), decision 16), the task's security group, the target group, `desired_count = 0` with `lifecycle { ignore_changes = [desired_count] }` ([decision 6](#decisions-taken-in-the-brainstorm)), `health_check_grace_period_seconds = 60`, `enable_execute_command = true`, `wait_for_steady_state = false` (`demo-up` waits itself, after scaling).

Every resource carries a `Name` tag next to the provider's default `project` and `group` tags.

### The deploy role

New customer managed policies, one per area, attached to `szop-ci-deploy` ([ADR 0034](../../decisions/0034-network-and-demo-up-details.md), decision 9), with the same scoping: creating only with `project` = `szop` and `group` = `demo` in the request, changing and deleting only what already carries them (decision 8), reads on `*` where the action supports no resource:

- **`szop-ci-deploy-demo-database`:** the RDS instance and subnet group, and what `manage_master_user_password` asks of the caller in Secrets Manager ([to verify](#to-verify-during-implementation)); the database's security group is covered by the existing network policy.
- **`szop-ci-deploy-demo-service`:** the ECS cluster, task definitions (registered and deregistered by family `szop-demo-*`), service and target group; `ecs:RunTask` of `szop-demo-db-setup` in the cluster `szop-demo` only, `ecs:DescribeTasks`, `ecs:UpdateService` and `ecs:DescribeServices` for `demo-up`'s steps; `iam:PassRole` of the two app roles only, with `iam:PassedToService` = `ecs-tasks.amazonaws.com`; reading the two roles and the parameter's metadata for the lookups (never their values).
- **`szop-ci-deploy-image`:** pushing to the registry `szop` only (`ecr:GetAuthorizationToken` on `*`; `ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:PutImage`, `ecr:DescribeImages`, `ecr:DescribeRepositories` on it). Pushing an image is not a change to base's infrastructure: tags are immutable and the lifecycle policy stays base's ([ADR 0010](../../decisions/0010-ci-cd.md), decision 16).

If the ECS or RDS service-linked role does not exist in the account yet, the owner creates it once, following the runbook, rather than the deploy role getting `iam:CreateServiceLinkedRole` ([to verify](#to-verify-during-implementation)).

### The plan role

`DenyDataReads`, a new statement in `ci_plan_denies` ([OP-096](https://github.com/luiki-dev/szop/issues/218)): `rds:DownloadDBLogFilePortion`, `rds:DownloadCompleteDBLogFile` and any other data-plane read `ReadOnlyAccess` (default version as checked) grants on what this phase adds: the plan checks the policy for RDS, ECS (`ecs:ExecuteCommand` is not a read; task definitions hold no secret values), ECR (image layers: the image holds the public code only, so pulling stays allowed, recorded in ADR 0038) and DynamoDB (`dynamodb:GetItem`, `BatchGetItem`, `Query`, `Scan`, though Szop has no table). Secret values and log contents are denied already.

### demo-up.yml

**Job `build`:** no environment, `permissions: { contents: read }`, `timeout-minutes: 20`; checks the ref out as `deploy` does and resolves the commit; `docker build -t szop:<commit> .` with BuildKit; `docker save | gzip` into a workflow artifact `image`, kept one day. No AWS credentials. Runs in parallel with `enable-teardown`.

**Job `deploy`** needs `enable-teardown` and `build`; `timeout-minutes` revisited ([to verify](#to-verify-during-implementation)). After the existing checkout, commit and credential steps:

1. **Push the image:** download the artifact and `docker load` it; log in to ECR with `aws ecr get-login-password`; if `aws ecr describe-images` finds `szop:<commit>`, skip; otherwise tag it with the registry's URL and push. The build ran in another job, so no project code runs while this job holds credentials.
2. **Terraform init and apply**, as today.
3. **Run `db-setup`:** `aws ecs run-task` with the cluster, `db-setup`'s task definition, the public subnets, the task's security group and a public IP address (from `infra/demo`'s outputs); `aws ecs wait tasks-stopped`; fail the step unless the container's exit code is `0`, printing the stop reason and pointing to the log stream.
4. **Start the service:** `aws ecs update-service --desired-count 1` (a no-op on a redeploy), then `aws ecs wait services-stable`.
5. **Wait for the app:** `curl` `https://szop.dzwoniec.com/api/health` every 10 seconds, for up to 10 minutes, until it answers `200` with `"status":"ok"`.
6. **Summary** (always): the URL, the commit and image, whether the image was pushed or already there, and the outcome of each step above, with the nightly teardown line.

`infra-plan.yml` needs no change: it already plans `infra/demo` with the PR's head commit.

## Documentation and records

- **ADR 0038 "App on ECS and RDS details"**: the decisions above, and what building settles. Notes: [ADR 0008](../../decisions/0008-hosting.md), decisions 19 (completed: the version and settings), 20 (refined: Node instead of `psql`), 22 (completed: `szop_app`'s password) and 23 (completed: the roles' permissions); [ADR 0010](../../decisions/0010-ci-cd.md), decisions 10 and 11 (refined: the `build` job, the image before Terraform, `db-setup` and scaling); [ADR 0036](../../decisions/0036-scalability-and-isolation.md), decisions 3 to 5 (refined: built in PH-12d) and decision 17; [ADR 0037](../../decisions/0037-twelve-phases-a-diagram-row.md), decision 1 (refined: ten a row); [ADR 0012](../../decisions/0012-security-baseline.md), decision 16 (refined: `build` outside the `demo` environment); [ADR 0028](../../decisions/0028-container-image-details.md), decision 10 (refined: a writable root filesystem on ECS, for ECS Exec); plus their status lines. Any living doc that says the container runs read-only on ECS is corrected.
- **`docs/operations/demo-environment.md`**: "Spinning up" gains the new steps and timings; a "Debugging" section: the log in CloudWatch (`aws logs tail /szop/app --follow`), ECS Exec into the app's task, querying the database through Node, reading a failed `db-setup`'s log, the migration check's message and how to switch branches (destroy, then spin up; [OP-043](https://github.com/luiki-dev/szop/issues/84)), and a failed destroy (the commit from the summary, [decision 8](#decisions-taken-in-the-brainstorm)); the check that no password is in either state; what a demo costs; any service-linked role the owner creates once.
- **`docs/development/ci-cd.md`**: `demo-up`'s `build` job and the new `deploy` steps.
- **`docs/architecture/threat-model.md`**: the task and the database as components; the master user and `szop_app`, and who can reach each secret; what the deploy role can now reach; the plan role's new denies.
- **`docs/architecture/architecture.md`**: the deployment section with the service, the database and `db-setup`.
- **`docs/architecture/stack-overview.md`**: ECS (cluster, task definition, task, service, Fargate, `awsvpc`), the execution role and the task role, ECS `secrets`, RDS (instance, subnet group, managed master password), one-off tasks, ECS Exec.
- **`docs/development/tools/drizzle.md`** and **`docs/development/testing.md`**, if `db-setup`'s tests or the role change how migrations are described.
- **`docs/glossary.md`**: any acronym the phase brings that is not there yet.
- **`docs/development/scripts.md`**, only if a script is added.

## Roadmap and GitHub changes

Done at the start (the branch's first commit and on GitHub): PH-12d split off, with issue [#244](https://github.com/luiki-dev/szop/issues/244) and owner step [#245](https://github.com/luiki-dev/szop/issues/245); OP-075 moved to it and OP-043's parts split; the stage table's row and the README's diagram on 🚧, at ten phases a row; #221 🚧 In progress, Started 2026-10-20; PH-36's Finished 2026-10-20.

When the spec and the plan are committed: their links in the stage table and in #221's Spec and Plan fields.

Before the PR, listed in it:

- The stage table's row and the README's diagram with the PR link, set to ✅ before the merge; the roadmap entry's **Delivers** gains `db-setup` and `szop_app`, and **Owner steps** the forged-header and ECS Exec checks; #221's body from the entry; #233's (PH-37) **Depends on** now PH-12d (#244); #149's text with the forged-header and ECS Exec checks.
- Closed by the PR, each with a "settled by" comment: [OP-016](https://github.com/luiki-dev/szop/issues/75), [OP-017](https://github.com/luiki-dev/szop/issues/68), [OP-018](https://github.com/luiki-dev/szop/issues/73), [OP-021](https://github.com/luiki-dev/szop/issues/83), [OP-074](https://github.com/luiki-dev/szop/issues/86), [OP-096](https://github.com/luiki-dev/szop/issues/218), [OP-099](https://github.com/luiki-dev/szop/issues/228).
- The PH-12c part ticked with the PR and the issue re-parented: [OP-013](https://github.com/luiki-dev/szop/issues/66) and [OP-053](https://github.com/luiki-dev/szop/issues/26) to PH-18 (#47); [OP-019](https://github.com/luiki-dev/szop/issues/77) and [OP-020](https://github.com/luiki-dev/szop/issues/78) to PH-13 (#42); [OP-043](https://github.com/luiki-dev/szop/issues/84) to PH-12d (#244).
- [OP-033](https://github.com/luiki-dev/szop/issues/116) gains a part: separate migration and runtime roles ([decision 4](#decisions-taken-in-the-brainstorm)).
- The two owner-step issues (#223, #149): closed by the PR.

## Owner steps

1. **Apply `infra/base` from the branch**, check that a second plan shows no changes; again from `main` after the merge. Create a service-linked role first if the runbook says one is missing. (#223)
2. **Press `demo-up` on the branch**, approve the run, open `https://szop.dzwoniec.com` and check the status page, find the request with your IP address in the log, send one with a forged `X-Forwarded-For` and see your real address logged for it too, run Lighthouse, open a shell with ECS Exec and run the TLS query, following the runbook; then **press `demo-down`** and check its summary and the Tag Editor. (#149)

Step 1 comes before the PR's plan comment can show clean Access Analyzer results, and before step 2 can work.

## Tasks

About seven, for the plan to detail:

1. `db-setup`: the script and its integration tests; `pnpm check` passes.
2. `infra/base`: the app's roles, `szop_app`'s password, the plan role's denies, the deploy role's policies; `pnpm check:infra` passes.
3. `infra/demo`: the database, the service, the two task definitions, the target group and the listener; `pnpm check:infra` passes and a local `terraform plan` shows the expected resources.
4. `demo-up.yml`: the `build` job and `deploy`'s new steps; `pnpm check:workflows` passes.
5. The owner's step 1, the push and the plan comment with Access Analyzer's findings; the owner's step 2, and any permission or setting the real runs show missing.
6. The runbook, `ci-cd.md`, the threat model, the architecture, the stack overview, the glossary.
7. ADR 0038 and its notes; the roadmap and GitHub changes.

## To verify during implementation

- That RDS offers PostgreSQL 18 in `eu-central-1`, and that `rds.force_ssl` is on in its default parameter group.
- That a `CREATEROLE` master user on RDS can make `szop_app` the database's owner, and which statement it needs first on PostgreSQL 18 (`GRANT szop_app TO szop_admin`, or `SET ROLE`).
- What the deploy role needs for `manage_master_user_password` (Secrets Manager actions on the secret RDS creates), and whether RDS copies the instance's tags to that secret, which the execution role's condition and the deploy role's scoping would use.
- Whether `AWSServiceRoleForECS` and `AWSServiceRoleForRDS` exist in the account (`aws iam get-role`).
- Every action the new resources need from the deploy role, from the provider's calls and the first real `demo-up` and `demo-down`, and which honour `aws:RequestTag` and `aws:ResourceTag` (ECS's tag-on-create needs `ecs:TagResource` with `ecs:CreateAction`).
- The data-plane reads in `ReadOnlyAccess`'s current default version for RDS, ECS, ECR and DynamoDB.
- That RDS deletes the master password's secret with the instance, with no recovery window that keeps it listed.
- How long the first `demo-up` and `demo-down` take with RDS, for the runbook and the jobs' timeouts (`deploy` is 30 minutes today; the database alone takes 5 to 10 minutes to create and to delete).
- The size of the image artifact and the time to upload and download it.
- That `aws ecs wait services-stable` and `tasks-stopped` fit within their built-in limits (40 checks, 15 seconds apart), or loop them.
