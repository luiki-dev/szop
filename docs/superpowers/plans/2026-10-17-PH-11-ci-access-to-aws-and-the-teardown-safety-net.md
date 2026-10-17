# PH-11 CI access to AWS and the teardown safety net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CI reaches AWS through OIDC with no stored keys; PRs touching `infra/` get a self-updating `terraform plan` comment with IAM Access Analyzer findings; `demo-down` runs a real `terraform destroy` on `infra/demo` by hand and every night; actionlint and zizmor run in the pre-commit hook.

**Architecture:** `infra/base` gains the GitHub OIDC provider and two roles: `szop-ci-plan` (same-repository PRs, `ReadOnlyAccess` with explicit denies) and `szop-ci-deploy` (only the `demo-teardown` environment, only the demo's state). A new root module `infra/demo` holds just its backend and provider. Three workflows use them: `infra-plan.yml` (a plan job with AWS, a comment job without), `demo-down.yml` (one destroy job in `demo-teardown`) and a placeholder `demo-up.yml`. The owner applies base from their machine; a throwaway proof PR shows the trust policies refusing.

**Tech Stack:** Terraform 1.16.5 (tenv), `hashicorp/aws` ~> 6.68, GitHub Actions, `aws-actions/configure-aws-credentials`, `hashicorp/setup-terraform`, IAM Access Analyzer `validate-policy`, jq, `gh api`, actionlint 1.7.12, zizmor 1.30.1, uv, lint-staged.

**Spec:** [`docs/superpowers/specs/2026-10-17-PH-11-ci-access-to-aws-and-the-teardown-safety-net-design.md`](../specs/2026-10-17-PH-11-ci-access-to-aws-and-the-teardown-safety-net-design.md)

## Global Constraints

- Region `eu-central-1`; state bucket `szop-tfstate-ntrtcr`; base's key `base/terraform.tfstate`, demo's key `demo/terraform.tfstate`, both with `use_lockfile = true`, `encrypt = true`.
- `infra/demo`: `required_version = "~> 1.16"`, `hashicorp/aws` `~> 6.68`, `allowed_account_ids = [var.account_id]`, default tags `project = "szop"`, `group = "demo"`; `.terraform.lock.hcl` committed with `linux_amd64` checksums.
- OIDC provider URL `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
- `szop-ci-plan` trusts `sub` = `repo:luiki-dev/szop:pull_request` only. `szop-ci-deploy` trusts `sub` = `repo:luiki-dev/szop:environment:demo-teardown` only; **never `environment:demo` in PH-11** (spec, decision 10). Both: `aud` = `sts.amazonaws.com`, maximum session 3600 seconds.
- `szop-ci-deploy` in PH-11 may only list the state bucket (whole bucket, no prefix condition: spec decision 12) and read/write `demo/terraform.tfstate` and its `.tflock`. Nothing in IAM, nothing on base's resources, nothing on billing.
- Repository variables: `AWS_PLAN_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN`. Role session names `gh-${{ github.run_id }}`. No AWS key, and no account ID, stored in GitHub.
- `demo-down`: cron `17 1 * * *`; concurrency group `demo-down`, `cancel-in-progress: false`; `-lock-timeout=15m`; job `timeout-minutes: 60`; output name read: `deployed_commit`.
- Every workflow follows `docs/development/ci-cd.md` "Rules for every workflow": `permissions: {}` at the top, per-job grants, `runs-on: ubuntu-24.04`, `timeout-minutes`, actions pinned to full commit SHAs with a version comment, `persist-credentials: false`, nothing a PR author controls inside `${{ }}` in `run:`, no `pull_request_target`, no `workflow_run`.
- Jobs holding AWS credentials: `id-token: write` on the job only; no setup action, no `pnpm install`, no project scripts; Terraform, the AWS CLI, git, jq and `gh` only.
- No job names `environment: demo` anywhere in this phase (it would create the environment unprotected).
- Never run `terraform apply` or `destroy` against AWS, never run `gh workflow run`, never merge. `terraform plan` with the owner's SSO session is allowed when the owner has signed in.
- Every commit follows Conventional Commits and ends with the two attribution lines (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Claude-Session: https://claude.ai/code/session_01KiUW15Q5aFXyHJBSaQ6zhB`). Never commit to `main`.
- Docs: niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon; requirements linked, never plain IDs; long docs keep their `## Contents` in sync; ADRs get their notes in three places (CLAUDE.md, "Documentation").
- Nothing that identifies the owner's account goes into a commit: no account ID, no role ARN with the account number, no portal URL, no email address.
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit, `git push` the phase branch, then stop and summarize the task for the owner; start the next task only when the owner says so (`docs/superpowers/plans/CLAUDE.md`).

## Review Focus

1. **Base's plan fails on the secret.** *(Settled: it does; base is planned with `-refresh=false`, ADR 0032 decision 11.)* If the AWS provider refreshes `aws_ssm_parameter.better_auth_secret` with `GetParameter` and decryption, `szop-ci-plan`'s deny breaks base's plan. Task 1, step 4 checks this with a local plan under the plan role's policy before anything else is built; if it breaks, stop and ask the owner (the spec forbids loosening the deny).
2. **`terraform init` refused by a too-narrow `ListBucket`.** *(Settled: the deploy role lists the whole bucket, spec decision 12.)* The S3 backend may list `env:/` for workspaces; `s3:prefix` limited to `demo/` could make init fail for the deploy role. Task 2, step 4 tests init and destroy under the deploy role's exact policy with the policy simulator.
3. **A PR's text reaching a shell.** The comment's Markdown includes resource addresses and Access Analyzer messages; in the comment job it must reach `gh` as a file (`--input`/`-F body=@file`), never through `${{ }}`. Task 4's zizmor run and step 6's review check it.
4. **`demo-down` on a recorded commit that is gone.** If `deployed_commit` names a commit `git fetch` cannot find, the job must fail loudly (the nightly failure email), never fall back to `main`'s code silently. Task 3, step 2 pins this.
5. **A comment flood.** Every push must update the one comment carrying `<!-- infra-plan -->`, not add another; and a module whose `init` or `plan` fails must still appear in the comment as failed. Task 4, step 5 checks both on the phase PR.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `infra/base/github_oidc.tf` | The GitHub OIDC provider | 1 |
| `infra/base/ci_roles.tf` | `szop-ci-plan` and `szop-ci-deploy`: trust and permission policies | 1, 2 |
| `infra/base/outputs.tf` | + `ci_plan_role_arn`, `ci_deploy_role_arn` | 1, 2 |
| `infra/demo/{versions,backend,providers,variables}.tf`, `terraform.tfvars.example`, `.terraform.lock.hcl` | The empty demo module | 2 |
| `.github/workflows/demo-down.yml` | Manual and nightly destroy | 3 |
| `.github/workflows/demo-up.yml` | Placeholder button | 3 |
| `.github/workflows/infra-plan.yml` | Plan, Access Analyzer, comment | 4 |
| `scripts/check-workflows.sh`, `package.json`, `lint-staged.config.js` | Local workflow checks | 5 |
| `.github/workflows/ci.yml` | zizmor and `format:check` run after a failure (OP-070) | 5 |
| `docs/development/setup.md`, `docs/development/scripts.md`, `docs/development/tools/{actionlint,zizmor}.md` | Installing and using the local checks | 5 |
| `docs/operations/demo-environment.md` | Billing switch, CI roles in "Applying base", "Tearing down" | 6 |
| `docs/architecture/{threat-model,architecture,stack-overview}.md`, `docs/development/{ci-cd,github-settings}.md`, `docs/development/tools/{github-actions,terraform}.md`, `docs/glossary.md` | Living docs | 6 |
| `docs/decisions/0032-ci-access-and-teardown-details.md`; ADRs 0010, 0011, 0012, 0018 | ADR 0032 and its notes | 6 |
| `docs/roadmap.md`, `README.md` | PH-11 row, PH-12 entry | 7 |

---

### Task 1: The OIDC provider and the plan role

**Files:**
- Create: `infra/base/github_oidc.tf`, `infra/base/ci_roles.tf`
- Modify: `infra/base/outputs.tf`

**Interfaces:**
- Produces: `aws_iam_openid_connect_provider.github`; `aws_iam_role.ci_plan` (name `szop-ci-plan`); output `ci_plan_role_arn`. Task 2 adds to `ci_roles.tf`; Task 4 reads the role's ARN from the variable `AWS_PLAN_ROLE_ARN`.

- [x] **Step 1: `github_oidc.tf`**

`aws_iam_openid_connect_provider.github` with `url = "https://token.actions.githubusercontent.com"` and `client_id_list = ["sts.amazonaws.com"]`. Leave `thumbprint_list` out if the pinned provider allows it (`terraform validate` tells); otherwise use GitHub's documented thumbprint with a comment that AWS no longer checks it. A header comment citing ADR 0010, decision 15.

- [x] **Step 2: `ci_roles.tf`, the plan role**

Policies as `aws_iam_policy_document` data sources, matching base's style. A file header comment naming ADR 0010, decisions 15–16, ADR 0012, decision 17, and ADR 0032.

- `data.aws_iam_policy_document.ci_plan_trust`: `sts:AssumeRoleWithWebIdentity`, principal the provider's ARN, `StringEquals` on `token.actions.githubusercontent.com:aud` = `sts.amazonaws.com` and `token.actions.githubusercontent.com:sub` = `repo:luiki-dev/szop:pull_request`.
- `aws_iam_role.ci_plan`: name `szop-ci-plan`, `max_session_duration = 3600`.
- `aws_iam_role_policy_attachment.ci_plan_read_only`: `arn:aws:iam::aws:policy/ReadOnlyAccess`.
- `data.aws_iam_policy_document.ci_plan_denies` → `aws_iam_role_policy.ci_plan_denies`, five `Deny` statements with these `sid`s:
  - `DenySecretValues`: `ssm:GetParameter`, `ssm:GetParameters`, `ssm:GetParametersByPath`, `ssm:GetParameterHistory`, `secretsmanager:GetSecretValue` on `*`.
  - `DenyObjectsOutsideState`: `s3:GetObject`, `s3:GetObjectVersion` with `not_resources` = `arn:aws:s3:::szop-tfstate-ntrtcr/base/*`, `arn:aws:s3:::szop-tfstate-ntrtcr/demo/*`.
  - `DenyLogContents`: `logs:GetLogEvents`, `logs:FilterLogEvents`, `logs:StartQuery`, `logs:StartLiveTail` on `*`.
  - `DenyBillingAndCost`: the read actions `ReadOnlyAccess` grants for Cost Explorer (`ce:`), Budgets (`budgets:`), billing (`billing:`, `aws-portal:`), cost and usage reports (`cur:`, `bcm-data-exports:`), invoicing (`invoicing:`), `payments:`, `freetier:`, `consolidatedbilling:`, `billingconductor:`, `cost-optimization-hub:`, `savingsplans:`, `tax:` and `purchase-orders:`, listed with wildcards per service (`ce:*` and so on), on `*`; `pricing:` (the public price list) stays allowed.
  - `DenyAccountContacts`: `account:GetPrimaryEmail`, `account:GetContactInformation`, `account:GetAlternateContact` on `*` (added after the task review, spec decision 5).
- `access-analyzer:ValidatePolicy`: open the current `ReadOnlyAccess` version in AWS's managed policy reference. If it does not include `access-analyzer:ValidatePolicy` (or `access-analyzer:*`/`access-analyzer:Validate*`), add an `Allow` statement `AllowPolicyValidation` for it in a separate `aws_iam_role_policy.ci_plan_validate`. Note what was found for ADR 0032's "Settled while building".

- [x] **Step 3: Output and the check**

Add `ci_plan_role_arn` to `outputs.tf` ("The role infra-plan.yml assumes; stored as the GitHub variable AWS_PLAN_ROLE_ARN."). Run `pnpm check:infra`. Expected: validate succeeds for `infra/base/`, tflint has no findings.

- [x] **Step 4: Prove base's plan survives the denies (Review Focus 1)**

Ask the owner to sign in (`aws sso login --profile szop`). Then, from `infra/base` with `AWS_PROFILE=szop`, run `terraform plan`. Expected: the OIDC provider, the role, its attachment and policies to add; nothing else changes. Then simulate the refresh under the plan role's policies: `aws iam simulate-custom-policy` with the deny document from `terraform show -json` / the rendered JSON and the actions `ssm:GetParameter` and `ssm:DescribeParameters` on the secret's ARN, and read the AWS provider's source or docs for `aws_ssm_parameter`'s read to see which of them it calls when `value_wo` is set. If the read calls `GetParameter` (with or without decryption): **stop and bring it to the owner**, with the evidence; do not loosen the deny.

- [x] **Step 5: Validate the policies locally**

For each rendered document (`data.aws_iam_policy_document.*.json`, read with `terraform console` or the plan's JSON), run `aws accessanalyzer validate-policy --policy-type IDENTITY_POLICY` for the permission policies and `--policy-type RESOURCE_POLICY --validate-policy-resource-type AWS::IAM::AssumeRolePolicyDocument` for the trust policy. Expected: no `ERROR` and no `SECURITY_WARNING` findings. Fix any, or record a justified one for the owner.

- [x] **Step 6: Commit**

```bash
git add infra/base docs/superpowers/plans
git commit -m "feat(infra): add the GitHub OIDC provider and the plan role"
```

---

### Task 2: The deploy role and the empty demo module

**Files:**
- Modify: `infra/base/ci_roles.tf`, `infra/base/outputs.tf`
- Create: `infra/demo/versions.tf`, `backend.tf`, `providers.tf`, `variables.tf`, `terraform.tfvars.example`, `.terraform.lock.hcl`
- Modify: `.gitignore` only if `infra/*/terraform.tfvars` is not already covered

**Interfaces:**
- Consumes: `aws_iam_openid_connect_provider.github` (Task 1).
- Produces: `aws_iam_role.ci_deploy` (name `szop-ci-deploy`); output `ci_deploy_role_arn`; the root module `infra/demo` with variable `account_id` (string, validated as base's). Task 3 assumes the role from `AWS_DEPLOY_ROLE_ARN` and sets `TF_VAR_account_id`.

- [x] **Step 1: The deploy role in `ci_roles.tf`**

- `data.aws_iam_policy_document.ci_deploy_trust`: as the plan role's, but `sub` = `repo:luiki-dev/szop:environment:demo-teardown` only, with a comment: `demo` is added in PH-12 with the protected environment (ADR 0032, decision 10).
- `aws_iam_role.ci_deploy`: name `szop-ci-deploy`, `max_session_duration = 3600`.
- `data.aws_iam_policy_document.ci_deploy_state` → `aws_iam_role_policy.ci_deploy_state`:
  - `ListStateBucket`: `s3:ListBucket` on `arn:aws:s3:::szop-tfstate-ntrtcr`, no condition (spec decision 12: S3 answers a missing state with 403 instead of 404 without bucket-wide list, and Terraform fails on 403).
  - `ReadWriteDemoState`: `s3:GetObject`, `s3:PutObject` on `arn:aws:s3:::szop-tfstate-ntrtcr/demo/terraform.tfstate`.
  - `ManageDemoLock`: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::szop-tfstate-ntrtcr/demo/terraform.tfstate.tflock`.

  A comment: the role grows with `infra/demo`, phase by phase (ADR 0032, decision 3).
- Output `ci_deploy_role_arn` ("The role demo-down.yml assumes; stored as the GitHub variable AWS_DEPLOY_ROLE_ARN.").

- [x] **Step 2: `infra/demo`**

Copy base's `versions.tf` (without `random`), `variables.tf` and `terraform.tfvars.example`; `backend.tf` with key `demo/terraform.tfstate`; `providers.tf` with `group = "demo"`. A header comment in `backend.tf`: only backend and provider until PH-12, so a destroy has nothing to do (ADR 0011, decision 2). Create the lock file with `terraform -chdir=infra/demo providers lock -platform=linux_amd64`.

- [x] **Step 3: The check**

Run: `pnpm check:infra`. Expected: validate succeeds for `infra/base/`, `infra/bootstrap/` and `infra/demo/`; tflint has no findings.

- [x] **Step 4: Prove the deploy role's policy is enough (Review Focus 2)**

With the owner signed in, run `aws iam simulate-custom-policy` with the rendered `ci_deploy_state` document for `s3:ListBucket` (with `s3:prefix` context values `demo/` and `env:/`), `s3:GetObject`/`s3:PutObject` on the state key, and `s3:GetObject`/`s3:PutObject`/`s3:DeleteObject` on the lock key. Expected: allowed for the demo paths, `implicitDeny` for `base/terraform.tfstate`. Then check in the Terraform S3 backend's documentation which `ListBucket` prefixes `init` uses with the default workspace; widen to `env:/demo/*` only if it lists there. Run `validate-policy` on both new documents as in Task 1, step 5. Expected: no `ERROR`, no `SECURITY_WARNING`.

- [x] **Step 5: Commit**

```bash
git add infra/base infra/demo docs/superpowers/plans
git commit -m "feat(infra): add the deploy role and the empty demo module"
```

---

### Task 3: demo-down and the placeholder demo-up

**Files:**
- Create: `.github/workflows/demo-down.yml`, `.github/workflows/demo-up.yml`

**Interfaces:**
- Consumes: `AWS_DEPLOY_ROLE_ARN`; `infra/demo` (Task 2); the `deployed_commit` output, which PH-12 adds.
- Produces: the `demo-down` workflow (name `demo-down`, job `destroy`) and the `demo-up` workflow (name `demo-up`, input `ref`).

- [x] **Step 1: `demo-down.yml`, per the spec's "demo-down.yml" section**

Triggers `workflow_dispatch` (no inputs) and `schedule: - cron: "17 1 * * *"`; `permissions: {}`; `concurrency: { group: demo-down, cancel-in-progress: false }`; `defaults.run.shell: bash`. Job `destroy`: `environment: demo-teardown`, `permissions: { contents: read, id-token: write }`, `timeout-minutes: 60`. Steps, in order:
  1. `actions/checkout` (the same SHA as `ci.yml`), `fetch-depth: 0`, `persist-credentials: false`.
  2. `aws-actions/configure-aws-credentials`, pinned to the full SHA of its latest release that is at least 7 days old: `role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}`, `role-session-name: gh-${{ github.run_id }}`, `aws-region: eu-central-1`. Then a step writing `TF_VAR_account_id=$(aws sts get-caller-identity --query Account --output text)` to `$GITHUB_ENV`.
  3. Read `.terraform-version`, `hashicorp/setup-terraform` as in `ci.yml` (`terraform_wrapper: false`).
  4. `terraform -chdir=infra/demo init -input=false -lock-timeout=15m`; `commit=$(terraform -chdir=infra/demo output -json | jq -r '.deployed_commit.value // empty')`, written to a step output.
  5. If `commit` is set and differs from `HEAD`: `git fetch --no-tags origin "$commit"` then `git checkout --detach "$commit"`, re-read `.terraform-version` and run `setup-terraform` again (a second, conditional step), and `init` again. If the fetch fails, the step fails with `::error::` naming the commit (Review Focus 4). If `commit` is empty: a `::notice::` "No deployed commit recorded; destroying with main's code".
  6. `terraform -chdir=infra/demo destroy -auto-approve -input=false -lock-timeout=15m -no-color | tee "$RUNNER_TEMP/destroy.log"`.
  7. Summary to `$GITHUB_STEP_SUMMARY`, `if: always()`: trigger (`$GITHUB_EVENT_NAME` via `env:`), the commit used and why, and Terraform's final `Destroy complete! Resources: N destroyed.` line (or the failure).

  Comments at the top: what the workflow is, ADR 0010 decision 13, ADR 0011 decision 7, ADR 0012 decision 16, ADR 0032 decisions 6–7; and that `demo-teardown` must exist (no reviewer, `main` only) before this file reaches `main`.

- [x] **Step 2: Check the commit-reading logic offline**

With `jq`, check the expression on the three shapes: `{}` → empty; `{"deployed_commit":{"value":"abc…"}}` → the hash; `{"deployed_commit":{"value":null}}` → empty. Run each with `echo '<json>' | jq -r '.deployed_commit.value // empty'`. Expected: as listed.

- [x] **Step 3: `demo-up.yml`, the placeholder**

`name: demo-up`; `on: workflow_dispatch` with input `ref` (description "Branch, tag or commit to deploy", required, type string); `permissions: {}`. One job `placeholder`, `runs-on: ubuntu-24.04`, `timeout-minutes: 5`, `permissions: {}`, **no `environment`**, one step that writes "`demo-up` arrives in PH-12 (#41). This placeholder only registers the button (ADR 0011, decision 2)." to `$GITHUB_STEP_SUMMARY`, prints it as `::error::`, and exits 1. The `ref` input is not used in a `run:` script.

- [x] **Step 4: Lint**

Run actionlint and zizmor as their tool pages describe (`pnpm check:workflows` does not exist until Task 5). Expected: no findings.

- [x] **Step 5: Commit**

```bash
git add .github/workflows/demo-down.yml .github/workflows/demo-up.yml docs/superpowers/plans
git commit -m "ci: add demo-down and a placeholder demo-up"
```

---

### Task 4: infra-plan

**Files:**
- Create: `.github/workflows/infra-plan.yml`

**Interfaces:**
- Consumes: `AWS_PLAN_ROLE_ARN`; `infra/base`, `infra/demo`.
- Produces: the `infra-plan` workflow with jobs `plan` and `comment`; the artifact `infra-plan-comment` holding `comment.md`; the comment marker `<!-- infra-plan -->`.

- [x] **Step 1: Triggers and the `plan` job's frame**

`on: pull_request` to `main` with `paths: ["infra/**", ".terraform-version", ".github/workflows/infra-plan.yml"]`; `permissions: {}`; `concurrency: { group: infra-plan-${{ github.event.pull_request.number }}, cancel-in-progress: true }`. Job `plan`: `if: github.event.pull_request.head.repo.full_name == github.repository`, `permissions: { contents: read, id-token: write }`, `timeout-minutes: 20`. Checkout, credentials (`vars.AWS_PLAN_ROLE_ARN`, session `gh-${{ github.run_id }}`), `TF_VAR_account_id` as in Task 3, Terraform as in `ci.yml`.

- [x] **Step 2: Plan each module**

One `run` step looping over `base demo`, each iteration independent (`set +e` around the module's commands, the result recorded per module, Review Focus 5):
- `terraform -chdir=infra/$m init -input=false` then `plan -lock=false -input=false -no-color -out="$RUNNER_TEMP/$m.tfplan"`, adding `-refresh=false` for `base` only, with a comment citing ADR 0032, decision 11 (the provider decrypts the Better Auth secret on refresh, which the plan role is denied); the full plan printed to the log inside a `::group::`.
- `terraform show -json` into `$RUNNER_TEMP/$m.json`.
- Counts: `jq '[.resource_changes[] | .change.actions] …'` → add, change, destroy (a replace counts as one add and one destroy, as Terraform's own summary does), and the changed addresses with their action.
- Policies: every `aws_iam_role` (`assume_role_policy`), `aws_iam_role_policy` and `aws_iam_policy` (`policy`) in `.planned_values` (root module and child modules), each with its address. A value that is not a string in `planned_values` (unknown) is listed as "not checked until applied".
- For each policy: `aws accessanalyzer validate-policy` with the policy type of Task 1, step 5; its findings kept as `findingType`, `issueCode`, `findingDetails`.

- [x] **Step 3: The comment's Markdown**

Written to `$RUNNER_TEMP/comment.md`, starting with `<!-- infra-plan -->`, then `### Terraform plan`, the planned commit (`github.event.pull_request.head.sha` via `env:`) and a link to the run. Per module: `infra/<m>: N to add, N to change, N to destroy` (or "❌ plan failed, see the log"), the changed addresses in a `<details>` block, and "IAM Access Analyzer": findings ordered `ERROR`, `SECURITY_WARNING`, `WARNING`, `SUGGESTION`, each with the policy's address, or "no findings". Upload with `actions/upload-artifact` (pinned) as `infra-plan-comment`, `retention-days: 1`, `if: always()`. The job's result is success when the comment was written.

- [x] **Step 4: The `comment` job**

`needs: plan`, `if: always() && needs.plan.result != 'skipped'`, `permissions: { pull-requests: write }`, `timeout-minutes: 5`, no checkout, no AWS. `actions/download-artifact` (pinned). Then with `GH_TOKEN: ${{ github.token }}`, `PR: ${{ github.event.pull_request.number }}` and `REPO: ${{ github.repository }}` in `env:`: find the comment id with `gh api "repos/$REPO/issues/$PR/comments" --paginate --jq '.[] | select(.body | startswith("<!-- infra-plan -->")) | .id' | head -n1`; `PATCH repos/$REPO/issues/comments/$id` if found, else `POST repos/$REPO/issues/$PR/comments`, both with `-F body=@comment.md`.

- [x] **Step 5: Lint and see it work (Review Focus 3 and 5)**

Run actionlint and zizmor. Expected: no findings. After the owner's apply and variables (Task 7, step 1), the phase PR's run is checked in Task 7: one comment, updated by a second push; both modules listed.

- [x] **Step 6: Commit**

```bash
git add .github/workflows/infra-plan.yml docs/superpowers/plans
git commit -m "ci: add the infra-plan workflow with Access Analyzer"
```

---

### Task 5: Local checks of workflow files, and OP-070

**Files:**
- Create: `scripts/check-workflows.sh`
- Modify: `package.json` (script `check:workflows`), `lint-staged.config.js`, `.github/workflows/ci.yml`, `docs/development/setup.md`, `docs/development/scripts.md`, `docs/development/tools/actionlint.md`, `docs/development/tools/zizmor.md`, `docs/development/ci-cd.md` ("Rules for every workflow", last bullet)

**Interfaces:**
- Produces: `pnpm check:workflows`; the lint-staged entry for `.github/**/*.{yml,yaml}`.

- [x] **Step 1: `scripts/check-workflows.sh`**

Styled like `check-infra.sh` (header comment, `set -euo pipefail`, `cd` to the root, `==>` headings, `FAIL:` messages). For each of `actionlint` and `zizmor`: if `command -v` fails, print `FAIL: <tool> not found; see docs/development/setup.md#<anchor>` and exit 1. Then `actionlint` (no arguments: every workflow) and `zizmor --offline .github`. `"check:workflows": "scripts/check-workflows.sh"` in `package.json`, next to `check:infra`.

- [x] **Step 2: lint-staged**

An entry `".github/**/*.{yml,yaml}"` as a function of the staged files: `actionlint` on those under `.github/workflows/`, and `zizmor --offline` on all of them; with a comment like the others. Check whether lint-staged's glob matches the dot folder and whether zizmor finds `.github/zizmor.yml` when given single files (add `--config .github/zizmor.yml` if not).

- [x] **Step 3: See the hook catch something**

Stage a scratch copy of a workflow with `run: echo "${{ github.event.pull_request.title }}"` under `.github/workflows/`, run `pnpm exec lint-staged`. Expected: actionlint or zizmor reports it and the run fails. Unstage and delete the scratch file. Then run `pnpm check:workflows` on the clean tree. Expected: both pass.

- [x] **Step 4: OP-070 in `ci.yml`**

Add `if: success() || failure()` to the zizmor step of the `workflows` job and to `- run: pnpm format:check` of the `lint` job, each with a one-line comment (both tools report in one run; a cancelled run still stops).

- [x] **Step 5: Docs**

- `setup.md` section 8 renamed to cover the workflow tools too (or a new section 9 "actionlint, zizmor and uv", renumbering after it; keep `## Contents` in sync): install uv from its pinned release with a checksum, as the guide does for tenv; actionlint 1.7.12's tarball with the SHA-256 from `ci.yml` into `~/.local/bin`; `uv tool install zizmor==1.30.1`; shellcheck through `apt` if it is a one-line install; then `pnpm check:workflows` in "Check that everything works". Section 11 ("What the git hooks do") mentions the new entry.
- `scripts.md`: `check:workflows`, what it runs, that lint-staged runs the same tools on staged files, no CI job runs the script (CI's `workflows` job runs the tools directly).
- The two tool pages: "In CI only, for now" becomes local and CI, with ADR 0032, decision 2; "Everyday use" uses the installed tools; the update steps name both places a version lives (`ci.yml` and the setup guide). If CI's zizmor action does not pin `version: 1.30.1`, pin it there too, so local and CI run the same version.
- `ci-cd.md`'s last rule: the hook runs both tools.

- [x] **Step 6: Commit**

```bash
git add scripts/check-workflows.sh package.json lint-staged.config.js .github/workflows/ci.yml docs docs/superpowers/plans
git commit -m "build: run actionlint and zizmor in the pre-commit hook"
```

---

### Task 6: The runbook, the living docs and ADR 0032

**Files:**
- Create: `docs/decisions/0032-ci-access-and-teardown-details.md`
- Modify: `docs/operations/demo-environment.md`, `docs/architecture/threat-model.md`, `docs/architecture/architecture.md`, `docs/architecture/stack-overview.md`, `docs/development/ci-cd.md`, `docs/development/github-settings.md`, `docs/development/tools/github-actions.md`, `docs/development/tools/terraform.md`, `docs/glossary.md`, ADRs 0010, 0011, 0012, 0018

- [ ] **Step 1: The runbook**

- "One-time account setup", step 3: as root, *Account → IAM user and role access to Billing information → Edit → Activate IAM Access*, why (OP-094's text), then *Billing and Cost Management → Cost allocation tags*: activate `project` and `group`, noting data starts from activation.
- "Applying base": the CI roles' checks (a second plan shows no changes; `aws iam get-role --role-name szop-ci-deploy --query Role.AssumeRolePolicyDocument` shows only `environment:demo-teardown`), and storing the two outputs as repository variables (*Settings → Secrets and variables → Actions → Variables*, or `gh variable set`).
- A new "Tearing down" section: the `demo-down` button as the primary path (*Actions → demo-down → Run workflow* on `main`), reading its summary, the nightly schedule, what a failure email means and what to do (open the run, re-run, or destroy locally), and the local fallback (`AWS_PROFILE=szop terraform -chdir=infra/demo destroy` after checking out the commit `terraform output deployed_commit` names). "Coming later" keeps only spinning up and debugging.
- `## Contents` in sync.

- [ ] **Step 2: Threat model, architecture, stack overview**

- `threat-model.md`: a row **CI workflow** with paths "a same-repository PR (OIDC → `szop-ci-plan`)" and "a job in `demo-teardown` on `main` (OIDC → `szop-ci-deploy`)", what each reaches, and guards (trust policies by `sub`; explicit denies; `main`-only environment; no installs next to credentials). The Owner and Compromised dependency rows mention the new pieces where they change. An entry point in the STRIDE section for the OIDC trust. "Risks accepted on purpose": public plan output (ADR 0010, decision 14), `terraform plan` able to run programs with the read-only role (ADR 0012, decision 17).
- `architecture.md`: the deployment section gains base's OIDC provider and two CI roles, and `infra/demo`.
- `stack-overview.md`: OIDC federation, IAM roles with trust and permission policies, explicit denies, Access Analyzer's validation, GitHub environments with branch rules, scheduled workflows.

- [ ] **Step 3: CI docs and settings**

- `ci-cd.md`: "What runs when" and "The jobs" gain `infra-plan`, `demo-down`, `demo-up` (placeholder); a short section on the plan comment and its findings; the variables. Contents in sync.
- `github-settings.md`: the `demo-teardown` environment (no reviewer, deployment branches: `main` only) and the two variables, with why; "Order of applying" and "Checking the settings" updated.
- `tools/github-actions.md`: environments, OIDC (`id-token: write`), `vars`, `schedule`. `tools/terraform.md`: `demo` in the modules table, CI planning base and demo.
- `glossary.md`: OIDC (OpenID Connect), STS (Security Token Service), and any other new acronym.

- [ ] **Step 4: ADR 0032**

`docs/decisions/0032-ci-access-and-teardown-details.md`, in ADR 0030's format: header with `Refines:`/`Extends:`/`Completes:` for ADR 0010 (decisions 13, 14, 16), ADR 0011 (decision 7), ADR 0012 (decisions 16, 17) and ADR 0018 (decision 6); context; the decisions table copied from the spec's ten decisions (Claude's calls marked); "Settled while building" with what Tasks 1–5 found (the thumbprint, `ValidatePolicy` in `ReadOnlyAccess`, the backend's `ListBucket` prefix, the secret refresh, zizmor's config lookup); consequences. Then the notes: each earlier ADR's status line, and a `<br>✏️ **Refined by [ADR 0032](0032-ci-access-and-teardown-details.md), decision N:** …` line (or ➕/🧩) at the bottom of each affected decision's cell.

- [ ] **Step 5: Check and commit**

Run: `pnpm format:check`. Expected: pass. Check every new link resolves (`grep` the anchors).

```bash
git add docs
git commit -m "docs: add ADR 0032 and document CI's access to AWS and the teardown"
```

---

### Task 7: The owner's apply, the proofs, the roadmap and GitHub

**Files:**
- Modify: `docs/roadmap.md`, `README.md` (only if the diagram changes), ADR 0032 ("Settled while building"), `docs/development/ci-cd.md` (Dependabot note)

- [ ] **Step 1: Owner checkpoint**

Ask the owner to do owner steps 1–3 (create `demo-teardown`; apply `infra/base` from the branch and see a second plan with no changes; store the two variables) and to run the runbook's new checks. Wait for confirmation.

- [ ] **Step 2: The phase PR's plan comment**

`infra-plan` runs only on a PR, so ask the owner whether to open the phase PR now as a draft (`gh pr create --draft`, the template filled in as far as it goes). Once it exists, check `infra-plan`'s run: one comment with `infra/base` (no changes) and `infra/demo` (no changes), and Access Analyzer "no findings" for both roles. Push the next commit and check that the same comment updated (`gh api …/comments` shows one with the marker).

- [ ] **Step 3: The proof PR (spec, decision 9)**

A branch `test/ph-11-oidc-proofs` from the phase branch with one workflow `.github/workflows/oidc-proof.yml` on `pull_request`, `permissions: {}`, two jobs, `timeout-minutes: 5`, no `environment: demo` anywhere:
- `pr-to-deploy-role`: `permissions: { id-token: write }`; prints the token's `sub` claim (decoded from the token's payload, the token itself never printed); then `configure-aws-credentials` with `vars.AWS_DEPLOY_ROLE_ARN`. Expected: fails with `Not authorized to perform sts:AssumeRoleWithWebIdentity`.
- `branch-to-teardown-env`: `environment: demo-teardown`, one `echo`. Expected: the job is refused because the branch is not allowed to deploy to the environment.

Open it as a draft titled `test: prove the OIDC trust refuses PRs and branches (do not merge)`, record both results and the `sub` claim's format, then close it without merging and delete the branch (ask the owner to delete it if the push hook blocks deletion).

- [ ] **Step 4: Dependabot and m12**

If a Dependabot PR touching `infra/` runs during the phase, read whether `plan` got a token. If it did not, add `github.event.pull_request.user.login != 'dependabot[bot]'` to the `plan` job's `if`. Either way, write the result (or "checked on the first Dependabot terraform PR after the merge") in `ci-cd.md`'s Dependabot section and ADR 0032's "Settled while building".

- [ ] **Step 5: Roadmap and GitHub**

- `roadmap.md`: PH-11's row with the plan and PR links, and ✅ before the merge; PH-12's entry gains, in **Delivers**, "widens `szop-ci-deploy` for the resources it adds and adds `demo` to its trust", "writes the `deployed_commit` output" and "re-enables `demo-down`", where not already there. The README's diagram mirrors the row.
- GitHub: OP-019, OP-020, OP-018 — PH-11 part ticked with the PR, re-parented to PH-12 (#41), Status ⬜ Backlog; OP-023 — its "PH-11 and PH-12" part noted as half done, re-parented to PH-12; OP-066, OP-070, OP-094 — a "settled by" comment each; PH-12's issue body and PH-11's from their roadmap entries; the Plan field on #40.
- The PR description: the template filled in, `Closes #40`, `Closes #79`, `Closes #81`, `Closes #209`, and the list of every issue change made in the phase (the brainstorm's included: #213 created, #214 created, OP-091 and OP-090 re-parented, OP-069 blocked).

- [ ] **Step 6: Commit**

```bash
git add docs README.md
git commit -m "docs: finish PH-11 on the roadmap"
```
