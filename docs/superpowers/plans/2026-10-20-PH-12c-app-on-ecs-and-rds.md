# PH-12c App on ECS and RDS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pressing `demo-up` on a branch builds that commit's image and serves the walking skeleton from one ECS task backed by RDS: `https://szop.dzwoniec.com` shows the API and the database up, with the schema version; `demo-down` removes everything again.

**Architecture:** the API image gains a second entry point, `db-setup`, which connects as RDS's master user and creates `szop_app`, the role that owns the database and that the app connects as. `infra/base` adds the app's task execution and task roles, `szop_app`'s password as a write-only SSM parameter, new deploy-role policies and a plan-role deny. `infra/demo` replaces the placeholder page with RDS, an ECS cluster, two task definitions (`app`, `db-setup`) and a service created at zero tasks. `demo-up` builds the image in a job without AWS credentials, then pushes it, applies, runs `db-setup` as a one-off task, scales the service to one and waits for `/api/health`.

**Tech Stack:** Node 24 with TypeScript run directly, `pg` 8, Zod 4, Vitest, PostgreSQL 18 (Compose locally, RDS on AWS); Terraform 1.16.5 (tenv), `hashicorp/aws` (`~> 6.68`), `hashicorp/random` (ephemeral `random_password`), tflint; GitHub Actions with `docker/build-push-action` v7.4.0, `actions/upload-artifact` v7.0.2, `actions/download-artifact` v8.0.2, `aws-actions/configure-aws-credentials` v6.3.0, `hashicorp/setup-terraform` v4.0.1; the AWS CLI; IAM Access Analyzer and the IAM policy simulator.

**Spec:** [`docs/superpowers/specs/2026-10-20-PH-12c-app-on-ecs-and-rds-design.md`](../specs/2026-10-20-PH-12c-app-on-ecs-and-rds-design.md)

## Global Constraints

- Region `eu-central-1`. `infra/demo`'s provider default tags `project = "szop"`, `group = "demo"`; base's `group = "base"`; every resource also gets a `Name` tag.
- Names in base: roles `szop-app-task-execution` and `szop-app-task`; SSM parameter `/szop/db-app-password` (`SecureString`, 64 letters and digits, `value_wo`, `value_wo_version = 1`); registry `szop`; log group `/szop/app`.
- Names in demo: database instance and subnet group `szop-demo`; security groups `szop-demo-db` and `szop-demo-task`; cluster `szop-demo`; task definition families `szop-demo-app` and `szop-demo-db-setup`; target group and service `szop-demo-app`; log stream prefixes `app` and `db-setup`.
- Database: PostgreSQL `engine_version = "18"`, `db.t4g.micro`, 20 GB `gp3`, encrypted, single-AZ, not public, database `szop`, master user `szop_admin` with `manage_master_user_password = true`, `backup_retention_period = 0`, `skip_final_snapshot = true`, `deletion_protection = false`, `apply_immediately = true`. App role `szop_app`: `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`, owner of the database `szop`. If RDS does not offer PostgreSQL 18 in `eu-central-1`, stop and ask the owner (spec, decision 14).
- Task: Fargate, `awsvpc`, CPU `256`, memory `512`, `X86_64`, port `3000`, a writable root filesystem (spec, decision 16), public subnets with a public IP; app settings `HOST=0.0.0.0`, `PORT=3000`, `LOG_LEVEL=info`, `DATABASE_PORT=5432`, `DATABASE_NAME=szop`, `DATABASE_USER=szop_app`, `DATABASE_TLS=verify-full`, `TRUSTED_PROXIES=10.0.0.0/24,10.0.1.0/24`, `WEB_ROOT` as the Dockerfile sets it; the password from `/szop/db-app-password`. Service `desired_count = 0` with `ignore_changes = [desired_count]`, `health_check_grace_period_seconds = 60`, `enable_execute_command = true`; target group health check `/api/health`, other health and deregistration settings left at their defaults (PH-12d tunes them).
- Image: `szop:<deployed_commit>` in the registry `szop`, built by `demo-up`'s `build` job with no AWS credentials and no build cache, pushed by `deploy` only if the tag is missing.
- The deploy role's new customer managed policies: `szop-ci-deploy-demo-database`, `szop-ci-deploy-demo-service`, `szop-ci-deploy-image`; scoping as ADR 0034, decisions 8 and 9: creates need `aws:RequestTag/project = szop` and `aws:RequestTag/group = demo`, changes and deletes `aws:ResourceTag/…` likewise, `aws:RequestedRegion = eu-central-1`, tagging only on create. Each policy under 6,144 characters; the role holds at most 10 managed policies.
- Secret values never in git, the image, a task definition, a log line or Terraform state ([ADR 0008](../../decisions/0008-hosting.md), decision 22; [ADR 0030](../../decisions/0030-domain-and-base-infrastructure-details.md), decision 10).
- Every workflow follows `docs/development/ci-cd.md` "Rules for every workflow": `permissions: {}` at the top, per-job grants, `runs-on: ubuntu-24.04`, `timeout-minutes`, actions pinned to full commit SHAs with a version comment (reuse the pins in `ci.yml` and `demo-up.yml`), `persist-credentials: false`, nothing a user controls inside `${{ }}` in `run:`. Jobs holding AWS credentials: `id-token: write` on the job only, no `pnpm install`, no project scripts, no `docker build`; Terraform, the AWS CLI, Docker's `load`/`tag`/`push`, git, jq, curl and the shell only.
- Never run `terraform apply` or `destroy` against AWS, never `gh workflow run`, never trigger `demo-up` or `demo-down`, never merge. `terraform plan -lock=false` and read-only AWS calls (`describe-*`, `get-*`, `list-*`, `aws iam simulate-custom-policy`, `aws accessanalyzer validate-policy`) with the owner's SSO profile `szop` are allowed.
- Nothing that identifies the owner's account goes into a commit: no account ID, no ARN with the account number, no email address.
- Every commit follows Conventional Commits and ends with the two attribution lines: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_015okgLdvBcetFxypZY4nGE6` (the model that wrote the commit). Never commit to `main`; the branch is `feat/ph-12c-app-on-ecs-and-rds`.
- Docs: niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon; requirements linked, never plain IDs; long docs keep their `## Contents` in sync; ADR notes in three places (CLAUDE.md, "Documentation").
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit, `git push` the phase branch, then stop and summarize the task for the owner; start the next task only when the owner says so (`docs/superpowers/plans/CLAUDE.md`).

## Review Focus

1. **`db-setup` on RDS, where the master user is not a superuser.** Local tests run as the superuser `szop`, which can do anything; RDS's `szop_admin` has only `CREATEROLE`, `CREATEDB` and ownership of `szop`. Task 1 runs every integration test as a non-superuser admin built the same way, so `ALTER DATABASE … OWNER TO` and its prerequisites are proven before AWS.
2. **A password escaping into a log line or an error.** `db-setup` sends `szop_app`'s password inside `CREATE ROLE`/`ALTER ROLE` text. Task 1 tests that neither its output nor a failure's message contains a password; Task 6 checks RDS's `log_statement` is `none` and searches both states for the passwords.
3. **A missing deploy-role permission on the first real run** (RDS with its managed secret, ECS with `RunTask` and `PassRole`, the ECR push). Each gap costs the owner another apply of base and another approved run. Task 2 simulates every action under the exact policies before the owner applies.
4. **A redeploy over a running demo.** A second `demo-up` with another commit must push its image before Terraform swaps the task definition, register a new revision and update the service in place, and leave the database alone. Task 6 checks the plan for it while the demo is up.
5. **`demo-down` with a database and running tasks.** The destroy must finish within its timeout, with the service's task stopped before the security groups go, and leave only inactive task definitions (spec, decision 15). Task 6 times it and checks the leftovers.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `apps/api/src/db/setup-role.ts` | `db-setup`'s settings and `setupAppRole` | 1 |
| `apps/api/src/db-setup.ts` | `db-setup`'s entry point: reads `process.env`, runs, exits | 1 |
| `apps/api/src/db/setup-role.test.ts` | its settings tests and integration tests | 1 |
| `apps/api/src/config.ts`, `compose.yaml` | comments (spec, decisions 10 and 16) | 1 |
| `infra/base/app_roles.tf` | the app's two roles and their policies | 2 |
| `infra/base/secrets.tf` | `/szop/db-app-password` | 2 |
| `infra/base/ci_roles.tf`, `infra/base/outputs.tf` | the plan role's deny, the deploy role's three policies | 2 |
| `infra/demo/locals.tf`, `data.tf`, `outputs.tf` | base's names and lookups, the app's settings, the outputs `demo-up` reads | 3 |
| `infra/demo/database.tf` | the database, its subnet group and security group | 3 |
| `infra/demo/service.tf` | the task's security group, cluster, task definitions, target group, service | 3 |
| `infra/demo/load_balancer.tf` | the listener forwards; the load balancer's egress | 3 |
| `.github/workflows/demo-up.yml`, `demo-down.yml` | the `build` job, `deploy`'s new steps; comments | 4 |
| `docs/operations/demo-environment.md`, `docs/development/ci-cd.md`, `docs/architecture/{threat-model,architecture,stack-overview}.md`, `docs/glossary.md` | living docs | 5, 6 |
| `docs/decisions/0038-app-on-ecs-and-rds-details.md`; ADRs 0008, 0010, 0012, 0028, 0036, 0037 | ADR 0038 and its notes | 7 |
| `docs/roadmap.md`, `README.md` | PH-12c's row and entry | 7 |

`db-setup`'s logic and its entry point are two files, as `server.ts` keeps `process.env` out of tested code (ADR 0019, decision 10); the spec's single `setup-role.ts` is split for that reason.

---

### Task 1: db-setup, the app's database role

**Files:**
- Create: `apps/api/src/db/setup-role.ts`, `apps/api/src/db-setup.ts`, `apps/api/src/db/setup-role.test.ts`
- Modify: `apps/api/src/config.ts` (the `TRUSTED_PROXIES` comment: "In AWS, the load balancer's subnets"), `compose.yaml` (the `read_only` comment: it proves the app writes nothing to disk; on ECS the root filesystem stays writable for ECS Exec)

**Interfaces:**
- Consumes: `createDatabase(settings: DatabaseSettings): Database` and `DatabaseSettings` (`config.ts`, `db/database.ts`); `testDatabaseSettings(name)` (`test/database.ts`); `runMigrations(db)` (`db/migrate.ts`).
- Produces: the image runs `node src/db-setup.ts` with `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_TLS`, `APP_DATABASE_USER`, `APP_DATABASE_PASSWORD`; exit code `0` on success, `1` on any failure. Task 3's task definition uses exactly these names.
  - `loadSetupConfig(env: Record<string, string | undefined>): SetupConfig`, where `SetupConfig = { database: DatabaseSettings; appRole: { name: string; password: string } }`; throws `Error("Invalid configuration:\n  NAME: problem…")` listing names and Zod's messages only, as `loadConfig` does. `APP_DATABASE_USER` must match `^[a-z_][a-z0-9_]{0,62}$`.
  - `setupAppRole(db: Database, appRole: { name: string; password: string }): Promise<{ created: boolean }>`, run against the database it should own (`current_database()`).

- [x] **Step 1: Write the failing tests**

In `setup-role.test.ts`:
- `loadSetupConfig`: valid settings give the expected object; a missing `APP_DATABASE_PASSWORD` gives `APP_DATABASE_PASSWORD: missing`; `APP_DATABASE_USER = "Szop-App"` and `"a; DROP ROLE x"` are rejected; no error message contains a given password value.
- `setupAppRole`, integration, in `beforeEach` as the superuser (`testDatabaseSettings("postgres")`, the pattern of `migration-check.test.ts`): per worker `w`, create role `szop_setup_admin_<w>` `LOGIN CREATEROLE CREATEDB PASSWORD '…'` (the shape of RDS's master user, Review Focus 1) and database `szop_setup_<w>` `OWNER szop_setup_admin_<w>`; connect as that admin to that database. `afterEach`: drop the database `WITH (FORCE)`, then the roles `szop_setup_app_<w>` and `szop_setup_admin_<w>` if they exist. Tests:
  - `creates the role, which owns the database`: returns `{ created: true }`; `pg_database.datdba` of the database is the role; `pg_roles` shows `rolcanlogin = true`, `rolsuper`, `rolcreatedb`, `rolcreaterole` all `false`.
  - `lets the role migrate and use the database`: connected as the role with its password, `runMigrations` succeeds; `CREATE TABLE t (x int)`, `INSERT`, `SELECT` return the row.
  - `refuses the role a new role or database`: as the role, `CREATE ROLE x` and `CREATE DATABASE x` reject with messages containing `permission denied`.
  - `is safe to run again`: a second call returns `{ created: false }` and the role still owns the database.
  - `applies a changed password`: after a second call with another password, the old one fails to log in and the new one succeeds.

- [x] **Step 2: Run them to see them fail**

Run: `pnpm --filter @szop/api exec vitest run src/db/setup-role.test.ts`. Expected: FAIL, `setup-role.ts` not found.

- [x] **Step 3: Implement `loadSetupConfig` and `setupAppRole` in `setup-role.ts`**

`setupAppRole` runs in one transaction, quoting with `pg`'s `escapeIdentifier` and `escapeLiteral` on a client taken from `db.$client`: look the role up in `pg_roles`; `CREATE ROLE <name> LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD <literal>` when missing, otherwise `ALTER ROLE <name> PASSWORD <literal>` only (a non-superuser may not touch the `SUPERUSER` attribute, even to keep it off); `GRANT <name> TO CURRENT_USER` (PostgreSQL 16 and later give a role's creator `ADMIN OPTION` but not membership, and `ALTER DATABASE … OWNER TO` needs the right to `SET ROLE` to the new owner as well as `CREATEDB`); `ALTER DATABASE <current_database()> OWNER TO <name>`. If a test shows a statement needs another form on PostgreSQL 18, change it and say why in a comment.

- [x] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @szop/api exec vitest run src/db/setup-role.test.ts`. Expected: PASS.

- [x] **Step 5: The entry point `db-setup.ts`**

Like `server.ts`: `loadSetupConfig(process.env)` (on error, print the message to stderr and exit `1`); `createDatabase(config.database)`, so TLS works as the app's does; `setupAppRole`; end the pool; print one JSON line to stdout, `{"msg":"db-setup done","role":"<name>","created":<bool>}`; on any error print `{"msg":"db-setup failed","error":"<error.message>"}` and exit `1`. Never print the configuration. Check by hand against Compose's PostgreSQL: `docker compose up -d`, then from `apps/api/` run `node src/db-setup.ts` with the `.env` values plus `APP_DATABASE_USER=szop_manual_check APP_DATABASE_PASSWORD=x` on the `szop` database; expected the JSON line with `"created":true`, then `"created":false`; then drop the role again (`ALTER DATABASE szop OWNER TO szop; DROP ROLE szop_manual_check;`).

- [x] **Step 6: Comments and the full check**

The two comments in `config.ts` and `compose.yaml`. Run: `pnpm check`. Expected: pass. Run: `pnpm check:image` (builds the image and starts it). Expected: pass, and `docker run --rm --entrypoint node szop:local src/db-setup.ts` with no settings prints the "Invalid configuration" message and exits `1`.

- [x] **Step 7: Commit and push**

```bash
git add apps/api compose.yaml docs/superpowers/plans
git commit -m "feat(api): add db-setup, which creates the app's database role"
git push
```

---

### Task 2: The app's roles, its password, and the CI roles

**Files:**
- Create: `infra/base/app_roles.tf`
- Modify: `infra/base/secrets.tf`, `infra/base/ci_roles.tf`, `infra/base/outputs.tf`

**Interfaces:**
- Consumes: the registry `szop`, the log group `/szop/app`, the parameter pattern of `better_auth_secret`.
- Produces: roles `szop-app-task-execution` and `szop-app-task` (Task 3 finds them with `data "aws_iam_role"`); parameter `/szop/db-app-password`; managed policies `szop-ci-deploy-demo-database`, `szop-ci-deploy-demo-service`, `szop-ci-deploy-image` attached to `szop-ci-deploy`; statement `DenyDataReads` in `ci_plan_denies`. Outputs `app_task_execution_role_arn` and `app_task_role_arn`.

- [x] **Step 1: The app's roles**

`app_roles.tf`, as the spec's "infra/base: the app's roles and secret" describes. Trust: `ecs-tasks.amazonaws.com` with `aws:SourceAccount` = the account and `ArnLike aws:SourceArn` = `arn:aws:ecs:eu-central-1:<account>:*`. Execution role: inline policy with the ECR pull (registry ARN; `GetAuthorizationToken` on `*`), `logs:CreateLogStream`/`PutLogEvents` on `<log group ARN>:log-stream:*`, `ssm:GetParameters` on `/szop/db-app-password`'s ARN, `secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:eu-central-1:<account>:secret:rds!db-*` (narrowed in Task 6 if RDS tags its secrets). Task role: `ssmmessages:CreateControlChannel`, `CreateDataChannel`, `OpenControlChannel`, `OpenDataChannel` on `*`. A comment on each says what uses it and that SES comes in PH-18.

- [x] **Step 2: The password**

In `secrets.tf`, `ephemeral "random_password" "db_app_password"` (64, `special = false`) and `aws_ssm_parameter.db_app_password` with `value_wo`/`value_wo_version = 1`, commented like the Better Auth secret, including how to rotate it (raise the version, apply base, then `demo-up` runs `db-setup`, which sets the new password).

- [x] **Step 3: The plan role's deny**

`DenyDataReads` in `ci_plan_denies`: `rds:DownloadDBLogFilePortion`, `rds:DownloadCompleteDBLogFile`, `dynamodb:GetItem`, `dynamodb:BatchGetItem`, `dynamodb:Query`, `dynamodb:Scan`, plus any other data-plane read of RDS, ECS or ECR found in `ReadOnlyAccess`'s current default version (`aws iam get-policy-version --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess --version-id $(aws iam get-policy --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess --query Policy.DefaultVersionId --output text)`). Pulling images stays allowed, with a comment: the image holds only the public code (spec, The plan role).

- [x] **Step 4: The deploy role's policies**

As the spec's "The deploy role" describes, in `ci_roles.tf`'s style (one `data "aws_iam_policy_document"`, `aws_iam_policy` and attachment per policy, a `sid` and a comment per statement). Work out the exact actions from the AWS Service Authorization Reference and the provider's calls for every resource of Task 3, with these pinned:
- **database:** `rds:CreateDBInstance`, `rds:CreateDBSubnetGroup`, `rds:AddTagsToResource` (on create only, where RDS supports a create-action condition; otherwise with the request tags), `rds:Describe*`, `rds:ListTagsForResource`, `rds:ModifyDBInstance`, `rds:DeleteDBInstance`, `rds:ModifyDBSubnetGroup`, `rds:DeleteDBSubnetGroup`, `rds:RemoveTagsFromResource`; the Secrets Manager actions `manage_master_user_password` needs of the caller (at least `secretsmanager:CreateSecret` and `secretsmanager:TagResource`, scoped to `rds!db-*` names); the security group's egress rules (`ec2:AuthorizeSecurityGroupEgress` with tags) if `szop-ci-deploy-demo-network` lacks them.
- **service:** ECS `CreateCluster`, `DeleteCluster`, `RegisterTaskDefinition`, `DeregisterTaskDefinition`, `CreateService`, `UpdateService`, `DeleteService`, `Describe*`, `List*`, `TagResource` (with `ecs:CreateAction`), `UntagResource`; `ecs:RunTask` on `task-definition/szop-demo-db-setup:*` with `ecs:cluster` = the cluster's ARN; `ecs:DescribeTasks`; Elastic Load Balancing `CreateTargetGroup`, `ModifyTargetGroup`, `ModifyTargetGroupAttributes`, `DeleteTargetGroup`, `RegisterTargets`/`DeregisterTargets` if the provider calls them, tagged as in `szop-ci-deploy-demo-load-balancer`; `iam:GetRole` and `iam:PassRole` on the two app roles, `PassRole` with `iam:PassedToService = ecs-tasks.amazonaws.com`; `ssm:DescribeParameters` (metadata only).
- **image:** `ecr:GetAuthorizationToken` on `*`; `ecr:BatchCheckLayerAvailability`, `InitiateLayerUpload`, `UploadLayerPart`, `CompleteLayerUpload`, `PutImage`, `DescribeImages`, `DescribeRepositories`, `BatchGetImage` on the registry's ARN.

- [x] **Step 5: Static checks and the plan**

Run: `pnpm check:infra`. Expected: pass. With `AWS_PROFILE=szop`: `terraform -chdir=infra/base plan -lock=false`. Expected: two roles with their policies, the parameter, three policies and their attachments to add, `ci_plan_denies` changed in place, nothing destroyed.

- [x] **Step 6: Validate and simulate (Review Focus 3)**

Each rendered policy through `aws accessanalyzer validate-policy` (identity policies) and the two trust policies as resource policies. Expected: no `ERROR`, no `SECURITY_WARNING`. Then `aws iam simulate-custom-policy` with the deploy role's six managed policies together, for every create (with the request tags, the region, and `ecs:CreateAction`/`elasticloadbalancing:CreateAction` for tagging), every change and delete (with the resource tags), `ecs:RunTask` with `ecs:cluster`, and `iam:PassRole` with `iam:PassedToService`. Expected: `allowed`. Negative cases: `RunTask` of `szop-demo-app`; `PassRole` of `szop-ci-deploy` or to `ec2.amazonaws.com`; `ecr:PutImage` on another repository; `rds:DeleteDBInstance` with `aws:ResourceTag/group=base`; the plan role's `rds:DownloadDBLogFilePortion` against `ReadOnlyAccess` plus its denies. Expected: `implicitDeny` or `explicitDeny`. Keep the commands in the task's report.

- [x] **Step 7: Commit and push**

```bash
git add infra/base docs/superpowers/plans
git commit -m "feat(infra): add the app's roles and let CI deploy ECS and RDS"
git push
```

---

### Task 3: The database and the service

**Files:**
- Create: `infra/demo/database.tf`, `infra/demo/service.tf`
- Modify: `infra/demo/locals.tf`, `data.tf`, `load_balancer.tf`, `outputs.tf`

**Interfaces:**
- Consumes: Task 1's settings names and command; Task 2's role and parameter names; PH-12b's subnets, `aws_security_group.alb`, `aws_lb_listener.https`, `var.deployed_commit`.
- Produces: outputs `cluster` (`szop-demo`), `db_setup_task_definition` (the ARN of the revision), `service` (`szop-demo-app`), `task_subnets` (the two public subnets' IDs, comma-separated), `task_security_group` (its ID); `deployed_commit` and `url` unchanged. Task 4 reads them with `terraform output -raw`.

- [x] **Step 1: Locals and lookups**

`locals.tf`: base's new names beside the domain (the two roles, `/szop/db-app-password`, `szop`, `/szop/app`), with the existing comment that they change with base; `trusted_proxies = join(",", [local.public_a_cidr, local.public_b_cidr])`; the placeholder page removed. `data.tf`: `aws_iam_role` for the two roles, `aws_ecr_repository` for the registry, `aws_caller_identity` for the parameter's ARN (built from the account and the name, never `data "aws_ssm_parameter"`, which reads the value).

- [x] **Step 2: The database**

`database.tf`, as the spec's "infra/demo: the database" and the Global Constraints give it; the security group with one ingress rule (5432 from `szop-demo-task`) as an `aws_vpc_security_group_ingress_rule`.

- [x] **Step 3: The service**

`service.tf`, as the spec's "infra/demo: the service" gives it. The task's security group: ingress 3000 from `szop-demo-alb`; egress 443 to `0.0.0.0/0` and 5432 to `szop-demo-db`. Container definitions with `jsonencode`; the image `"${data.aws_ecr_repository.app.repository_url}:${var.deployed_commit}"`; `secrets` with `valueFrom` = the parameter's ARN and, for `db-setup`'s master password, `"${aws_db_instance.main.master_user_secret[0].secret_arn}:password::"`; `logConfiguration` `awslogs` with group `/szop/app`, region, stream prefix. The service: `launch_type = "FARGATE"`, `network_configuration` with `assign_public_ip = true`, `load_balancer` block to the target group and container `app`/3000, `depends_on` the HTTPS listener (a service cannot attach to a target group no listener uses).

- [x] **Step 4: The listener and the load balancer's egress**

`load_balancer.tf`: the HTTPS listener's default action `forward` to the target group; the `deployed_commit` precondition stays, the length check goes; an `aws_vpc_security_group_egress_rule` on `szop-demo-alb` to `szop-demo-task` on 3000; the file's comments brought up to date.

- [x] **Step 5: Checks and the plan**

Run: `pnpm check:infra`. Expected: pass. The plan needs base's new roles to exist (the lookups fail otherwise), so it runs once the owner has applied Task 2's base; until then `pnpm check:infra` is the check, and this plan moves to Task 6, step 3. With `AWS_PROFILE=szop`: `terraform -chdir=infra/demo plan -lock=false -var deployed_commit=$(git rev-parse HEAD)`. Expected: the database, its subnet group, two security groups and their rules, the cluster, two task definitions, the target group and the service to add, everything of PH-12b too (no demo is up), and no secret value in the output. Check that RDS offers 18: `aws rds describe-db-engine-versions --engine postgres --engine-version 18 --region eu-central-1 --query 'DBEngineVersions[].EngineVersion'`; if empty, stop and ask the owner.

- [x] **Step 6: Commit and push**

```bash
git add infra/demo docs/superpowers/plans
git commit -m "feat(infra): run the app on ECS with its database on RDS"
git push
```

---

### Task 4: demo-up builds, pushes, sets up and starts

**Files:**
- Modify: `.github/workflows/demo-up.yml`, `.github/workflows/demo-down.yml` (comments only)

**Interfaces:**
- Consumes: Task 3's outputs; Task 2's deploy-role permissions; Task 1's `db-setup` exit codes.
- Produces: jobs `enable-teardown` (unchanged), `build`, `deploy`, as the spec's "demo-up.yml" describes.

- [x] **Step 1: The `build` job**

No environment; `permissions: { contents: read }`; `timeout-minutes: 20`; checkout as `deploy` does (`ref: ${{ inputs.ref }}`) and the same commit check, written to an output `sha`; `docker/setup-buildx-action` and `docker/build-push-action` with `load: true`, `push: false`, `tags: szop:<sha>` (through the step output, not a shell), no `cache-from`/`cache-to` (an image that is deployed restores no cache, as the release job of C10); `docker save szop:<sha> | gzip > "$RUNNER_TEMP/image.tar.gz"`; `actions/upload-artifact` named `image`, `retention-days: 1`, `if-no-files-found: error`. The header comment says why it is a job of its own (spec, decision 9; ADR 0012, decisions 16 and 18).

- [x] **Step 2: The `deploy` job**

`needs: [enable-teardown, build]`; it uses `needs.build.outputs.sha` and checks that its own checkout resolves to the same commit, failing otherwise. New steps after the credential and Terraform setup steps, each with an `id`:
- `push`: `actions/download-artifact` (`name: image`); `gunzip -c … | docker load`; `aws ecr get-login-password | docker login --username AWS --password-stdin <registry host>`; `aws ecr describe-images --repository-name szop --image-ids imageTag=$COMMIT` decides; tag and push only if missing; output `pushed=true|false`.
- `apply`: as today.
- `db-setup`: `aws ecs run-task --cluster … --task-definition … --launch-type FARGATE --propagate-tags TASK_DEFINITION --network-configuration "awsvpcConfiguration={subnets=[…],securityGroups=[…],assignPublicIp=ENABLED}"`, values from `terraform output -raw`; wait until the task is `STOPPED` (loop `describe-tasks` every 10 s up to 10 minutes if `aws ecs wait tasks-stopped`'s 10-minute limit is too short); fail unless `containers[0].exitCode` is `0`, printing `stoppedReason` and the log stream name `db-setup/<container>/<task id>`.
- `start`: `aws ecs update-service --cluster szop-demo --service szop-demo-app --desired-count 1`, then `aws ecs wait services-stable` (looped as above if needed).
- `wait`: `curl -fsS --max-time 10 https://szop.dzwoniec.com/api/health` every 10 s, 60 tries, success when the body has `"status":"ok"`.
- `Summary` (`if: always()`): URL, commit, image and whether it was pushed, and each step's outcome, with the nightly teardown line.
- `timeout-minutes`: 45 until Task 6 measures the real run.

The header comment updated (it no longer waits for a page with the commit).

- [x] **Step 3: `demo-down.yml`**

Comments only that still mention the placeholder or PH-12c.

- [x] **Step 4: Checks**

Run: `pnpm check:workflows`. Expected: actionlint and zizmor report nothing. Run: `pnpm format:check`. Expected: pass.

- [x] **Step 5: Commit and push**

```bash
git add .github/workflows docs/superpowers/plans
git commit -m "feat(ci): build the image and start the app in demo-up"
git push
```

---

### Task 5: The runbook and the living docs

**Files:**
- Modify: `docs/operations/demo-environment.md`, `docs/development/ci-cd.md`, `docs/architecture/threat-model.md`, `docs/architecture/architecture.md`, `docs/architecture/stack-overview.md`, `docs/glossary.md`; `docs/development/tools/drizzle.md` and `docs/development/testing.md` only if Task 1 changed what they describe

**Interfaces:**
- Consumes: Tasks 1–4 as built; the spec's "Documentation and records".
- Produces: the runbook sections Task 6 follows: "Spinning up" (the new steps), "Debugging", the state check, the costs.

- [x] **Step 1: The runbook**

As the spec lists. "Debugging" gives the exact commands: `aws logs tail /szop/app --follow --since 1h`; finding the task (`aws ecs list-tasks --cluster szop-demo --service-name szop-demo-app`); `aws ecs execute-command --cluster szop-demo --task <id> --container app --interactive --command "/bin/sh"`; the Node one-liner that queries with the app's settings from inside the task (spec, decision 13), shown with `SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()`; reading a failed `db-setup` (its log stream, its exit code); the migration check's message and switching branches (`demo-down`, then `demo-up`); a failed destroy (the commit from the summary, spec decision 8). The state check: `terraform state pull` for base and demo, searched (`grep -c`) for the two passwords read with the owner's credentials, expected `0`. Costs per hour and per forgotten day with the database and the task. `## Contents` in sync.

- [x] **Step 2: The other living docs**

As the spec lists: `ci-cd.md` (the `build` job and `deploy`'s steps, the artifact, why `build` needs no approval); `threat-model.md` (the task and the database; the master user and `szop_app`, who can reach each secret; the deploy role's new reach; `DenyDataReads`); `architecture.md` (the service, the database, `db-setup`); `stack-overview.md` (ECS: cluster, task definition, task, service, Fargate, `awsvpc`; execution role and task role; ECS `secrets`; RDS: instance, subnet group, managed master password; one-off tasks; ECS Exec; and correct any line that says the container runs read-only on ECS); `glossary.md` (new acronyms).

- [x] **Step 3: Checks**

Run: `pnpm format:check`. Expected: pass. Check every new link's anchor exists.

- [x] **Step 4: Commit and push**

```bash
git add docs
git commit -m "docs: document the app on ECS and RDS and debugging the demo"
git push
```

---

### Task 6: The owner's steps and the first real demo

The controller runs this task itself, with the owner; no subagent.

**Files:**
- Modify: whatever the real runs show to be wrong (most likely `infra/base/ci_roles.tf` or `app_roles.tf`); `docs/operations/demo-environment.md` (real timings); `.github/workflows/demo-up.yml` (the timeout); this plan.

- [x] **Step 1: Before the owner applies**

With the owner's credentials: `aws iam get-role --role-name AWSServiceRoleForECS` and `AWSServiceRoleForRDS`. If one is missing, add its creation (`aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com` or `rds.amazonaws.com`) to the runbook and to the owner's step.

- [x] **Step 2: Owner checkpoint 1: base**

Ask the owner to do owner step 1: create any missing service-linked role, apply `infra/base` from the branch, see a second plan with no changes. Wait for confirmation.

- [x] **Step 3: The draft PR and its plan comment**

Open the phase PR as a draft (`gh pr create --draft`, title `feat: run the app on ECS and RDS`, the template filled in as far as it goes, `Closes #221`). Check `infra-plan`'s comment: base with no changes, demo with Task 3's resources, Access Analyzer with no errors and no security warnings.

- [x] **Step 4: Owner checkpoint 2: the first demo**

Ask the owner to press `demo-up` on `feat/ph-12c-app-on-ecs-and-rds` and approve. Watch with `gh run watch`/`gh run view --log-failed`. On a missing permission: fix it under Task 2's rules, simulate again, commit (`fix(infra): …`), push, and ask the owner to apply base and re-run. Record each step's duration.

- [x] **Step 5: Check the demo**

From here: `curl -s https://szop.dzwoniec.com/api/health` (expected `"status":"ok"` and the schema version); `curl -s https://szop.dzwoniec.com` (the SPA's HTML); `curl -s -H 'X-Forwarded-For: 203.0.113.7' https://szop.dzwoniec.com/api/health`, then in the log (`aws logs tail /szop/app --since 10m`) that request's address is this machine's public address, not `203.0.113.7`. With the owner's credentials: `aws rds describe-db-parameters --db-parameter-group-name <the instance's group> --query "Parameters[?ParameterName=='rds.force_ssl' || ParameterName=='log_statement'].[ParameterName,ParameterValue]"` (expected `1` and `none`, Review Focus 2); whether the master secret carries the instance's tags (`aws secretsmanager describe-secret`), and if so narrow the execution role's secret statement by `aws:ResourceTag/group = demo`. Ask the owner to do the rest of owner step 2 in the browser: the status page, their IP in the log, the forged-header request from their machine, a Lighthouse run (scores into the PR), ECS Exec and the TLS query following the runbook (expected `t`).

- [x] **Step 6: A redeploy's plan (Review Focus 4)**

While the demo is up, with `AWS_PROFILE=szop`: `terraform -chdir=infra/demo plan -lock=false -var deployed_commit=<another full commit hash on the branch>`. Expected: the two task definitions replaced, the service updated in place to the new app revision, `db_setup_task_definition` changed, and nothing else.

- [x] **Step 7: The state check (Review Focus 2)**

Follow the runbook's state check. Expected: neither password appears in either state.

- [x] **Step 8: Owner checkpoint 3: demo-down (Review Focus 5)**

Ask the owner to press `demo-down` (from the branch's recorded commit, as the summary shows). Expected: `Destroy complete!` with every resource `demo-up` created. Then `aws resourcegroupstaggingapi get-resources --region eu-central-1 --tag-filters Key=group,Values=demo` lists only `task-definition/szop-demo-*` revisions (spec, decision 15), and `aws secretsmanager list-secrets --filters Key=name,Values=rds!db` lists nothing for the deleted instance. Record the destroy's duration; if it is close to `demo-down`'s timeout, raise it.

- [x] **Step 9: Commit and push**

Real timings into the runbook, `demo-up`'s timeout from the measured run (about twice the longest seen), the ticked boxes, every fix.

```bash
git add infra docs .github
git commit -m "docs(runbook): record the first app demo's timings"
git push
```

---

### Task 7: ADR 0038, the roadmap and GitHub

**Files:**
- Create: `docs/decisions/0038-app-on-ecs-and-rds-details.md`
- Modify: `docs/decisions/0008-hosting.md`, `0010-ci-cd.md`, `0012-security-baseline.md`, `0028-container-image-details.md`, `0036-scalability-and-isolation.md`, `0037-twelve-phases-a-diagram-row.md` (status lines and decision notes); `docs/roadmap.md`; `README.md`

- [x] **Step 1: ADR 0038 "App on ECS and RDS details"**

In the form of ADR 0034: context, the spec's sixteen decisions with options and reasoning, "Settled while building" with what Tasks 1–6 found (the statements `db-setup` needed on PostgreSQL 18, every permission added after a real run, the secret's tags, the real timings, the pull left to the plan role), and consequences for PH-12d (the defaults it tunes) and PH-18 (SES and the Better Auth secret in the task role and task definition). Header: `Completes:` ADR 0008, decisions 19, 22 and 23; `Refines:` ADR 0008, decision 20; ADR 0010, decisions 10 and 11; ADR 0012, decision 16; ADR 0028, decision 10; ADR 0036, decisions 3 to 5; ADR 0037, decision 1.

- [x] **Step 2: The notes**

In each ADR named: the status line, and the line at the bottom of the decision's cell (`🧩 **Completed by …**` or `✏️ **Refined by [ADR 0038](0038-app-on-ecs-and-rds-details.md), decision N:** …`), as CLAUDE.md "Documentation" describes.

- [x] **Step 3: Roadmap and README**

PH-12c's row: the plan and PR links, then ✅ Done before the merge; the README's diagram mirrors it (PH-12c `●`, the road `═` through it). PH-12c's entry: **Delivers** gains `db-setup` and `szop_app`, **Owner steps** the forged-header and ECS Exec checks.

- [ ] **Step 4: GitHub**

As the spec's "Roadmap and GitHub changes" lists: "settled by" comments on OP-016, OP-017, OP-018, OP-021, OP-074, OP-096, OP-099; OP-013 and OP-053 ticked and re-parented to PH-18 (#47), OP-019 and OP-020 to PH-13 (#42), OP-043 to PH-12d (#244), each with Status ⬜ Backlog; OP-033 (#116) gains its part; #221's body from the roadmap entry; #233's **Depends on** PH-12d (#244); #149's text. The PR: the template filled in; `Closes #221` and `Closes` for each settled open point and #223, #149; the list of every issue change made in the phase; marked ready for review.

- [ ] **Step 5: Commit and push**

```bash
git add docs README.md
git commit -m "docs: add ADR 0038 and finish PH-12c on the roadmap"
git push
```
