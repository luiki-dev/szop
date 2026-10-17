# PH-11 CI access to AWS and the teardown safety net — design

- **Phase:** [PH-11](../../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net) ([#40](https://github.com/luiki-dev/szop/issues/40))
- **Date:** 2026-10-17
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-019](https://github.com/luiki-dev/szop/issues/77) (PH-11 part, then on to PH-12); [OP-020](https://github.com/luiki-dev/szop/issues/78) (PH-11 part, then on to PH-12); [OP-018](https://github.com/luiki-dev/szop/issues/73) (PH-11 part, then on to PH-12); [OP-023](https://github.com/luiki-dev/szop/issues/74) (PH-11 half of its "PH-11 and PH-12" part); [OP-066](https://github.com/luiki-dev/szop/issues/79), [OP-070](https://github.com/luiki-dev/szop/issues/81) and [OP-094](https://github.com/luiki-dev/szop/issues/209) (settled); [OP-091](https://github.com/luiki-dev/szop/issues/201) (moved to the new PH-35); [OP-069](https://github.com/luiki-dev/szop/issues/80) (blocked, taken off the phase)

CI gets access to AWS for the first time. The direction was settled by [ADR 0010](../../decisions/0010-ci-cd.md), decisions 13 to 16, [ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decisions 2 and 7, and [ADR 0012](../../decisions/0012-security-baseline.md), decisions 16 to 18: OIDC instead of stored keys, a read-only plan role for pull requests, a deploy role for the `demo` and `demo-teardown` environments, a plan comment that never blocks, and a nightly `demo-down` merged and proven before any demo can exist. This spec holds the details those left to the phase, as agreed in the brainstorm. They are recorded in ADR 0032.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Files](#files)
  - [The OIDC provider](#the-oidc-provider)
  - [The plan role](#the-plan-role)
  - [The deploy role](#the-deploy-role)
  - [infra/demo](#infrademo)
  - [demo-down.yml](#demo-downyml)
  - [demo-up.yml, the placeholder](#demo-upyml-the-placeholder)
  - [infra-plan.yml](#infra-planyml)
  - [Local checks of workflow files](#local-checks-of-workflow-files)
  - [The workflows job in ci.yml](#the-workflows-job-in-ciyml)
- [Documentation and records](#documentation-and-records)
- [Roadmap and GitHub changes](#roadmap-and-github-changes)
- [Owner steps](#owner-steps)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: CI reaches AWS without stored keys. PRs touching `infra/` get a `terraform plan` comment, and `demo-down` destroys the demo by hand and every night, before any demo can exist.

The phase is done when:

- `infra/base` is applied from the owner's machine with the OIDC provider, `szop-ci-plan` and `szop-ci-deploy`, and a second `terraform plan` shows no changes;
- no AWS access key exists anywhere in GitHub; the two role ARNs are repository variables;
- IAM Access Analyzer's policy validation reports no errors and no security warnings for any policy of the two roles, as shown in the plan comment;
- this phase's own PR gets a plan comment from `infra-plan.yml`, with the counts for `infra/base` and `infra/demo` and the Access Analyzer findings, and a later push updates the same comment instead of adding one;
- on a throwaway proof PR, a job that tries to assume `szop-ci-deploy` from a pull request is refused by AWS, and a job on its branch that names `demo-teardown` is refused by the environment's `main`-only rule ([decision 9](#decisions-taken-in-the-brainstorm));
- after the merge, a `demo-down` run started by hand from `main` succeeds, assuming the deploy role and running a real `terraform destroy` on the empty `infra/demo`; the next nightly run succeeds too;
- actionlint and zizmor run on staged workflow files in the pre-commit hook, and `pnpm check:workflows` checks them all;
- in CI's `workflows` job, zizmor reports even when actionlint has failed;
- the docs and records listed under [Documentation and records](#documentation-and-records) are updated, and the roadmap and GitHub as in [Roadmap and GitHub changes](#roadmap-and-github-changes).

## Out of scope

- **The real `demo-up.yml`, the `demo` environment, ECR push and every permission the demo's resources need**: [PH-12](../../roadmap.md#ph-12-first-deploy). PH-12 widens `szop-ci-deploy` as it adds resources ([decision 3](#decisions-taken-in-the-brainstorm)), and adds `demo` to its trust together with the protected environment ([decision 10](#decisions-taken-in-the-brainstorm)).
- **The `deployed_commit` output's value**: PH-12's `demo-up` writes it. PH-11 defines how `demo-down` reads it.
- **`demo-up` re-enabling `demo-down` through the GitHub API** ([ADR 0010](../../decisions/0010-ci-cd.md), decision 13): PH-12, with the real `demo-up`.
- **The app's two roles and `szop-ci-release`**: PH-12 and [PH-13](../../roadmap.md#ph-13-releases) ([OP-020](https://github.com/luiki-dev/szop/issues/78)).
- **A security scanner for Terraform code and images**: the new [PH-35](../../roadmap.md#ph-35-security-scanners) ([decision 1](#decisions-taken-in-the-brainstorm)).
- **The `$/` syntax for the setup action** ([OP-069](https://github.com/luiki-dev/szop/issues/80)): blocked until actionlint accepts it.
- **Planning `infra/bootstrap` in CI**: ADR 0010, decision 14 plans base and demo only.

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | The phase's scope | Keep all nine open points; move the Terraform scanner to PH-12; move it to a new phase | **The scanner ([OP-091](https://github.com/luiki-dev/szop/issues/201)) moves to a new phase, PH-35 "Security scanners", after PH-12, together with the image scan ([OP-090](https://github.com/luiki-dev/szop/issues/194)).** A scanner is a second new concept next to OIDC and IAM; PH-12 brings the first real image and the security groups, load balancer and RDS worth scanning, and one tool (Trivy) may cover both open points. PH-12 is already the largest phase of the stage. **[OP-069](https://github.com/luiki-dev/szop/issues/80) is taken off the phase and marked blocked**: actionlint's issue #732 is still open and 1.7.12 still rejects `$/`. |
| 2 | actionlint and zizmor locally ([OP-066](https://github.com/luiki-dev/szop/issues/79)) | CI only, as [ADR 0018](../../decisions/0018-ci-details.md), decision 6 left it; a lint-staged entry with the tools installed through the setup guide | **Both run in the pre-commit hook on staged workflow files, and `pnpm check:workflows` checks them all**, with the tools installed through the setup guide, the way Terraform and tflint are: actionlint as its pinned, checksum-verified release binary, zizmor with `uv tool install` in the version CI runs, which makes uv a prerequisite. No slip caught only by CI was remembered from PH-02, but PH-11 writes the first workflows that hold AWS credentials. A missing tool fails the commit, as `terraform fmt` does. Each version now lives in two places, CI and the setup guide, as tflint's does. Refines ADR 0018, decision 6. |
| 3 | How much the deploy role may do now | The full set of [ADR 0010](../../decisions/0010-ci-cd.md), decision 16, now; grow it with the code | **It grows phase by phase.** In PH-11 `szop-ci-deploy` may only read and write the demo's state and its lock file; an empty destroy needs nothing more. Each phase that adds a resource to `infra/demo` adds the permissions it needs, in the same PR, where the plan comment and Access Analyzer show them next to the resource. Permissions written now for resources not yet designed would be guesses, and guesses end up broad. **Cost:** PH-12 changes `infra/base` too and the owner applies it again, which is already one of its steps. Refines ADR 0010, decision 16. |
| 4 | Where the Access Analyzer check runs | In `infra-plan.yml`, automatically; a local script before applying base; once by hand in this phase | **In `infra-plan.yml`.** After each plan, the job takes every IAM policy out of the plan's JSON and sends it to `aws accessanalyzer validate-policy`; the findings are part of the plan comment. Every later PR that changes a role, PH-12's first, is checked without anyone remembering to. A policy holding a value only known after apply is reported as not checked yet. A local script relies on memory and leaves no proof in the PR; a one-off check leaves PH-12 unchecked. Completes ADR 0010, decision 16. |
| 5 | Billing access ([OP-094](https://github.com/luiki-dev/szop/issues/209)) | — | **The runbook's one-time setup gains the root user's "Activate IAM Access" to billing, then the `project` and `group` cost allocation tags; `szop-ci-plan` is explicitly denied billing and cost reads** (Cost Explorer, Budgets, billing, cost and usage reports, invoices). `ReadOnlyAccess` includes some of them, and everything the plan job prints is public. **The plan role is also denied the account's contact details** (primary email, contact information, alternate contacts), which `ReadOnlyAccess` grants and a PR could print into a public log; added after Task 1's review. `szop-ci-deploy` has no billing or account permission to deny. Extends ADR 0010, decision 16, and [ADR 0012](../../decisions/0012-security-baseline.md), decision 17. |
| 6 | `demo-down` when no commit is recorded | Run a real destroy with `main`'s code; skip it | **It always runs a real destroy.** With no `deployed_commit` output in the demo's state (in PH-11, and later on every night with no demo up), it destroys with the code of `main`, which finds nothing and finishes within a minute. Every nightly run then exercises OIDC, the role, the backend and the lock, so a broken safety net shows on a quiet night and not on the night a demo is up. Skipping would make most nights prove only that the workflow starts. Completes [ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decision 7. |
| 7 | `demo-down`'s timeouts *(Claude's call)* | — | **Every Terraform command waits up to 15 minutes for the state lock (`-lock-timeout=15m`), and the job times out after 60 minutes**, since deleting RDS takes about ten. A `demo-up` that holds the lock longer than 15 minutes fails the nightly run, which GitHub emails to the owner. PH-12 may revisit both once real timings exist. Completes ADR 0011, decision 7. |
| 8 | Who posts the plan comment *(Claude's call)* | The plan job itself; a second job without AWS credentials | **A second job.** The `plan` job holds `id-token: write` and `contents: read` only, and passes the comment's text on as an artifact; the `comment` job holds `pull-requests: write` and no AWS credentials, and posts or updates the comment with `gh api`, without a third-party action. No job holds both a write token for the repository and AWS credentials. |
| 9 | Proving the deploy role refuses pull requests *(Claude's call)* | Trust the policy and Access Analyzer; a throwaway proof PR | **A throwaway proof PR**, like PH-02's gate proofs ([#15](https://github.com/luiki-dev/szop/pull/15)): a branch with two workflow jobs. One, triggered by `pull_request`, asks for an OIDC token and tries to assume `szop-ci-deploy`, which AWS refuses. The other names `environment: demo-teardown` on the branch, which GitHub refuses before it runs. No job names `demo`, which would create that environment unprotected. The PR is closed without merging. It needs the deploy role's ARN as a variable, so it follows the owner's apply. A trust policy is the boundary of the whole setup, and seeing it refuse is the clearest lesson of the phase. |
| 10 | Trusting the `demo` environment before it exists | Trust `demo` now, as [ADR 0012](../../decisions/0012-security-baseline.md), decision 16 lists; create the protected `demo` environment now; accept the gap as a risk; leave `demo` out until PH-12 | **`szop-ci-deploy` trusts only `demo-teardown` in PH-11; PH-12 adds `demo` in the same PR that has the owner create it with the required reviewer.** GitHub creates a missing environment, unprotected, the first time a job names it, so trusting `demo` before it exists would hand the deploy role to any job on any branch that names it, without the owner's approval: the hole decision 16 closed. Nothing in PH-11 needs `demo`, so nothing trusts it, the same reasoning as [decision 3](#decisions-taken-in-the-brainstorm). Creating it now adds an environment that is unused for a phase; a recorded risk leaves the trust boundary open. Refines ADR 0012, decision 16, for PH-11 only. Found by the spec's builder check. |
| 11 | Planning base without reading the secret | Plan base with `-refresh=false`; let the plan role read the one parameter; stop planning base in CI; move the secret out of base | **`infra-plan.yml` plans `infra/base` with `-refresh=false`; `infra/demo` keeps the full refresh.** Found while building: AWS provider 6.69.1 refreshes an `aws_ssm_parameter` with `GetParameter` and decryption even when its value is write-only, so the plan role's deny on secret values made base's plan fail. Without refresh, Terraform compares the code with the state and reads no live resource: the comment still shows exactly what the PR's code changes, including PH-12's role changes, which is its purpose. **Cost:** drift made outside Terraform does not show in the comment; only the owner changes base, and the owner's local plan before every apply still refreshes. Reading the parameter would let any same-repository PR print the Better Auth secret into a public log; not planning base would hide role changes from Access Analyzer; moving the secret reopens [ADR 0030](../../decisions/0030-domain-and-base-infrastructure-details.md) for a problem this solves. Refines [ADR 0010](../../decisions/0010-ci-cd.md), decision 14. |

## Design

### Files

```text
infra/base/
  github_oidc.tf            the OIDC provider
  ci_roles.tf               szop-ci-plan and szop-ci-deploy, their trust and permission policies
  outputs.tf                + ci_plan_role_arn, ci_deploy_role_arn
infra/demo/
  versions.tf               as base: Terraform ~> 1.16, aws ~> 6.68
  backend.tf                bucket szop-tfstate-ntrtcr, key demo/terraform.tfstate, S3 lock file
  providers.tf              eu-central-1, allowed_account_ids, default tags project=szop, group=demo
  variables.tf              account_id, validated as in base
  terraform.tfvars.example
  .terraform.lock.hcl       committed
.github/workflows/
  infra-plan.yml
  demo-down.yml
  demo-up.yml               placeholder
scripts/check-workflows.sh  actionlint and zizmor over every workflow
```

Base's new files follow its existing style: flat files by concern, policies written with `aws_iam_policy_document` data sources, every resource carrying base's default tags. `account_id` reaches `infra/demo` in CI as `TF_VAR_account_id`, read from the role's own credentials (`aws sts get-caller-identity`), so no account number is stored in GitHub; it is not a secret, but nothing needs it stored. `scripts/check-infra.sh` already validates every folder under `infra/`, and Dependabot's `terraform` entry already covers `/infra/*`.

### The OIDC provider

`aws_iam_openid_connect_provider` for `https://token.actions.githubusercontent.com`, with the audience `sts.amazonaws.com`. AWS no longer checks the thumbprint for GitHub's provider; the argument is left out if the provider version allows it.

### The plan role

`szop-ci-plan`, maximum session one hour.

- **Trust:** the OIDC provider, with `aud` equal to `sts.amazonaws.com` and `sub` equal to `repo:luiki-dev/szop:pull_request`. Fork PRs never get a token, so this means same-repository PRs only.
- **Permissions:** the AWS-managed `ReadOnlyAccess`; `access-analyzer:ValidatePolicy`, if `ReadOnlyAccess` does not already grant it ([decision 4](#decisions-taken-in-the-brainstorm)); and one inline policy of explicit denies:
  - secret values: `ssm:GetParameter`, `ssm:GetParameters`, `ssm:GetParametersByPath`, `ssm:GetParameterHistory`, `secretsmanager:GetSecretValue` ([ADR 0010](../../decisions/0010-ci-cd.md), decision 16);
  - S3 objects other than the state: `s3:GetObject` and its versions on everything except `szop-tfstate-ntrtcr/base/*` and `szop-tfstate-ntrtcr/demo/*`, so bootstrap's state is not readable either (ADR 0010, decision 16);
  - log contents: `logs:GetLogEvents`, `logs:FilterLogEvents`, `logs:StartQuery`, `logs:StartLiveTail` ([ADR 0012](../../decisions/0012-security-baseline.md), decision 17);
  - billing and cost: the read actions of Cost Explorer, Budgets, billing, cost and usage reports, invoicing, payments, Free Tier, consolidated billing, Billing Conductor, Cost Optimization Hub, Savings Plans, tax and purchase orders ([decision 5](#decisions-taken-in-the-brainstorm)), checked against what `ReadOnlyAccess` grants; `pricing:`, AWS's public price list, stays allowed;
  - the account's contact details: `account:GetPrimaryEmail`, `account:GetContactInformation`, `account:GetAlternateContact` ([decision 5](#decisions-taken-in-the-brainstorm)).

The plan runs with `-lock=false`, so the role never writes the lock file and needs no write permission anywhere.

### The deploy role

`szop-ci-deploy`, maximum session one hour.

- **Trust:** the OIDC provider, with `aud` equal to `sts.amazonaws.com` and `sub` equal to `repo:luiki-dev/szop:environment:demo-teardown` only. PH-12 adds `repo:luiki-dev/szop:environment:demo` ([ADR 0012](../../decisions/0012-security-baseline.md), decision 16; [decision 10](#decisions-taken-in-the-brainstorm)).
- **Permissions in PH-11** ([decision 3](#decisions-taken-in-the-brainstorm)), one inline policy:
  - `s3:ListBucket` on `szop-tfstate-ntrtcr`, limited by the `s3:prefix` condition to `demo/`;
  - `s3:GetObject` and `s3:PutObject` on `szop-tfstate-ntrtcr/demo/terraform.tfstate`;
  - `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on `szop-tfstate-ntrtcr/demo/terraform.tfstate.tflock`.

  Nothing in IAM, nothing on base's resources and nothing on billing, as [ADR 0010](../../decisions/0010-ci-cd.md), decision 16 requires; PH-12 adds the rest.

Both roles' session names are `gh-<run_id>` ([ADR 0010](../../decisions/0010-ci-cd.md), decision 15), set by the workflows.

### infra/demo

Only the backend, the provider and the variable, so a destroy has nothing to do ([ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decision 2). It declares no outputs yet. **The contract for PH-12:** `infra/demo` will have an output named `deployed_commit`, the full commit hash `demo-up` deployed; `demo-down` reads that name.

### demo-down.yml

- **Triggers:** `workflow_dispatch` with no inputs, and `schedule` with `17 1 * * *` ([ADR 0010](../../decisions/0010-ci-cd.md), decision 13).
- **Workflow level:** `permissions: {}`; `concurrency: { group: demo-down, cancel-in-progress: false }` ([ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decision 7).
- **One job, `destroy`:** `environment: demo-teardown`, `permissions: { contents: read, id-token: write }`, `timeout-minutes: 60` ([decision 7](#decisions-taken-in-the-brainstorm)). It runs Terraform, the AWS CLI, git and jq only: no setup action, no `pnpm install` ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18). Its steps:
  1. Check out `main` (the commit the run started from), with `persist-credentials: false`.
  2. Assume `szop-ci-deploy` with `aws-actions/configure-aws-credentials`, pinned by commit hash, from the variable `AWS_DEPLOY_ROLE_ARN`, session name `gh-${{ github.run_id }}`, region `eu-central-1`. Set `TF_VAR_account_id` from `aws sts get-caller-identity`.
  3. Install Terraform with `hashicorp/setup-terraform`, as `ci.yml`'s `infra` job does, in the version of `.terraform-version`.
  4. `terraform init` in `infra/demo`, then read `deployed_commit` from `terraform output -json` with jq, empty when missing.
  5. **If a commit is recorded** and differs from the checked-out one: fetch it by hash and check it out, then install that commit's `.terraform-version` and run `terraform init` again. **If none is recorded:** stay on `main` ([decision 6](#decisions-taken-in-the-brainstorm)).
  6. `terraform destroy -auto-approve -input=false -lock-timeout=15m`.
  7. Write a job summary: the trigger (by hand or nightly), which commit's code was used and why, and what Terraform destroyed (or "nothing to destroy").
- **The `demo-teardown` environment** has no reviewer and lets only `main` deploy. It must exist before the merge: a job naming an environment that does not exist creates it, unprotected.
- **Failure:** a failed scheduled run is emailed by GitHub to the user who last changed the `schedule`, the owner. The AWS Budgets alerts stay the second net.

### demo-up.yml, the placeholder

`workflow_dispatch` with one input, `ref` (a branch, tag or commit hash), so the button looks like the real one. One job with `permissions: {}`, **no `environment`** (naming `demo` would create it unprotected) and no AWS access; its one step writes "demo-up arrives in PH-12" to the summary and fails. It only registers the button on `main` ([ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decision 2).

### infra-plan.yml

- **Trigger:** `pull_request` to `main`, with `paths` on `infra/**`, `.terraform-version` and `.github/workflows/infra-plan.yml`. It is not a required check ([ADR 0010](../../decisions/0010-ci-cd.md), decision 14).
- **Workflow level:** `permissions: {}`; `concurrency` per PR with `cancel-in-progress: true`, safe because the plan takes no lock.
- **Skipped** for PRs from forks (head repository not this one), which get no token. Dependabot PRs: see [To verify](#to-verify-during-implementation).
- **The `plan` job:** `permissions: { contents: read, id-token: write }`; no setup action and no `pnpm install`. It assumes `szop-ci-plan` (variable `AWS_PLAN_ROLE_ARN`, session `gh-${{ github.run_id }}`), installs Terraform, and for `infra/base` and then `infra/demo`:
  1. `terraform init` and `terraform plan -lock=false -input=false -out=<file>`, with `-refresh=false` for `infra/base` only ([decision 11](#decisions-taken-in-the-brainstorm)); the full plan goes to the job log.
  2. `terraform show -json <file>`, from which jq takes the resource counts (add, change, destroy) and the changed resources' addresses, and every IAM policy document in the planned values: roles' trust policies, inline role policies and managed policies.
  3. Each document goes to `aws accessanalyzer validate-policy`, as an identity policy, or for trust policies as a resource policy with the resource type `AWS::IAM::AssumeRolePolicyDocument`. A document still unknown in the plan is listed as "not checked until applied".
  4. A failed `init` or `plan` of one module is reported in the comment and does not stop the other module.

  The job writes the comment's Markdown into a file and uploads it as an artifact. Its own result is green whenever the comment could be written, since the plan is informative.
- **The `comment` job:** `needs: plan`, `permissions: { pull-requests: write }`, no AWS access, no checkout. It downloads the artifact and, with `gh api`, updates the PR's comment that carries the hidden marker `<!-- infra-plan -->`, or creates it ([decision 8](#decisions-taken-in-the-brainstorm)). The comment's text is treated as data: it reaches `gh` as a file, never through `${{ }}` in a script.
- **The comment:** per module, "N to add, N to change, N to destroy" and the changed addresses; the Access Analyzer findings per policy (errors and security warnings first, then warnings and suggestions, or "no findings"); the commit it planned and a link to the run's log. Nothing secret enters it: secret values never enter Terraform state ([ADR 0008](../../decisions/0008-hosting.md), decision 22), and everything it prints is public.

### Local checks of workflow files

- **`scripts/check-workflows.sh`**, run as `pnpm check:workflows`: `actionlint` over every workflow, then `zizmor` over `.github/` with the repository's `.github/zizmor.yml`, both from the `PATH`, failing with a message naming the setup guide's section if either is missing. zizmor runs offline locally (no GitHub token); CI's run keeps the online audits.
- **lint-staged:** an entry for staged files under `.github/` ending in `.yml` or `.yaml`, running actionlint on the workflow files among them and zizmor on all of them.
- **The setup guide:** a section installing actionlint (the release binary of the version in `ci.yml`, checked with its SHA-256, into `~/.local/bin`), uv, and zizmor with `uv tool install zizmor==<version>`, the version CI's zizmor action runs. shellcheck too, if it is a one-line install, since actionlint checks `run:` scripts only when shellcheck is on the `PATH`.
- **The tool pages** for actionlint and zizmor: local use through the hook and the script, and their update steps naming both places a version lives.

### The workflows job in ci.yml

zizmor's step runs with `if: success() || failure()`, so it reports even when actionlint has failed, while a cancelled run still stops ([OP-070](https://github.com/luiki-dev/szop/issues/81)). The same for `pnpm format:check` after `pnpm lint` in the `lint` job *(Claude's call)*.

## Documentation and records

- **ADR 0032 "CI access to AWS and teardown details"**: the decisions above. ADR 0010's status line and the cells of decisions 13, 14 and 16, ADR 0011's decision 7, ADR 0012's decisions 16 and 17 and ADR 0018's decision 6 get their notes.
- **`docs/operations/demo-environment.md`**: "One-time account setup", step 3, gains the root user's billing switch and the cost allocation tags ([OP-094](https://github.com/luiki-dev/szop/issues/209)); "Applying base" gains the CI roles' checks and storing the ARNs as variables; a new "Tearing down" section with the `demo-down` button as the primary path, reading its summary, what a failed nightly run means and what to do, and the local `terraform destroy` as the fallback. "Coming later" shrinks to match.
- **`docs/architecture/threat-model.md`**: CI as an actor, with its two entry points: a same-repository PR (plan role, read-only, no secrets, logs or costs) and a job in `demo-teardown` (deploy role, state only for now; `demo` joins in PH-12); the OIDC trust as the guard, and `demo-teardown`'s `main`-only rule.
- **`docs/architecture/architecture.md`**: the deployment section gains the OIDC provider and the two roles in base, and `infra/demo`'s place.
- **`docs/architecture/stack-overview.md`**: OIDC federation from GitHub to AWS, IAM roles with trust and permission policies, explicit denies, Access Analyzer's policy validation, GitHub environments with branch rules, and scheduled workflows.
- **`docs/development/ci-cd.md`**: `infra-plan.yml`, `demo-down.yml`, the placeholder `demo-up.yml`, the repository variables, the local workflow checks and the zizmor change.
- **`docs/development/github-settings.md`**: the `demo-teardown` environment and the variables `AWS_PLAN_ROLE_ARN` and `AWS_DEPLOY_ROLE_ARN`.
- **`docs/development/setup.md`**, **`docs/development/scripts.md`** (`check:workflows`), and the tool pages for actionlint, zizmor, GitHub Actions and Terraform.
- **`docs/glossary.md`**: OIDC, ARN, STS and any other acronym the phase brings that is not there yet.

## Roadmap and GitHub changes

Already done in the brainstorm (the branch's second commit and on GitHub):

- PH-35 "Security scanners" ([#213](https://github.com/luiki-dev/szop/issues/213)) in Stage 3 after PH-12, with OP-091 and OP-090 as its sub-issues, in the roadmap, its table and the README's diagram.
- OP-069 taken off PH-11, ⏳ Blocked, with a History line.
- PH-11's entry: the local workflow checks in **Delivers**, the fifth owner step ([#214](https://github.com/luiki-dev/szop/issues/214)).

Before the PR, listed in it:

- The stage table's row: spec, plan and PR links; the phase issue's body from the roadmap entry.
- [OP-019](https://github.com/luiki-dev/szop/issues/77), [OP-020](https://github.com/luiki-dev/szop/issues/78), [OP-018](https://github.com/luiki-dev/szop/issues/73): PH-11 part ticked, re-parented to PH-12. [OP-023](https://github.com/luiki-dev/szop/issues/74): its "PH-11 and PH-12" part noted as half done, re-parented to PH-12.
- [OP-066](https://github.com/luiki-dev/szop/issues/79), [OP-070](https://github.com/luiki-dev/szop/issues/81), [OP-094](https://github.com/luiki-dev/szop/issues/209): closed by the PR, each with a "settled by" comment.
- PH-12 (#41): its entry gains "widens `szop-ci-deploy` for the resources it adds and adds `demo` to its trust", "writes the `deployed_commit` output" and "re-enables `demo-down`" in **Delivers**, if not already there.

## Owner steps

1. **Create the `demo-teardown` environment** (no reviewer, `main` only), before the merge.
2. **Apply `infra/base` from the branch**, check that a second plan shows no changes, then apply again from `main` after the merge.
3. **Store the ARNs** of `szop-ci-plan` and `szop-ci-deploy` (base's outputs) as the repository variables `AWS_PLAN_ROLE_ARN` and `AWS_DEPLOY_ROLE_ARN`.
4. **After the merge, run `demo-down` once** and see it succeed; then check the first nightly run.
5. **As the root user, activate IAM access to billing**, then the `project` and `group` cost allocation tags, following the runbook.

Steps 2 and 3 come before the PR's plan comment and the proof PR can work.

## Tasks

About seven, for the plan to detail:

1. The OIDC provider and `szop-ci-plan`, with its denies; base's outputs.
2. `szop-ci-deploy` with state-only access; `infra/demo`'s skeleton; `pnpm check:infra` passes.
3. `demo-down.yml` and the placeholder `demo-up.yml`.
4. `infra-plan.yml`: plan, Access Analyzer, the comment job.
5. Local workflow checks: `scripts/check-workflows.sh`, lint-staged, the setup guide, the tool pages; zizmor and `format:check` in `ci.yml` (OP-070).
6. The runbook (billing, the CI roles, tearing down), the threat model and the other living docs; the proof PR after the owner's apply.
7. ADR 0032, the notes in ADRs 0010, 0011, 0012 and 0018, the glossary, the roadmap and the GitHub changes.

## To verify during implementation

- ✅ **Whether the plan role can refresh `/szop/better-auth-secret`:** it cannot (provider 6.69.1 calls `GetParameter` with decryption); settled by [decision 11](#decisions-taken-in-the-brainstorm).
- Whether `ReadOnlyAccess` already grants `access-analyzer:ValidatePolicy`, and which billing and cost read actions it grants, for the deny list.
- Whether Dependabot PRs get an OIDC token with `id-token: write`. If not, skip the `plan` and `comment` jobs for PRs whose author (`github.event.pull_request.user.login`) is `dependabot[bot]`, not by `github.actor`, and plan provider bumps locally ([OP-019](https://github.com/luiki-dev/szop/issues/77), m12). Checked on the first Dependabot `terraform` PR after the merge if none comes during the phase; noted in `ci-cd.md` either way.
- The `sub` claim's exact format the repository's tokens carry (the default, not a customised template), read from a token's claims on the proof PR.
- That `aws_iam_openid_connect_provider` in the pinned provider version accepts no `thumbprint_list`.
- That a commit of a deleted, merged branch can still be fetched by hash in a fresh checkout, which `demo-down` relies on in PH-12.
- That zizmor reads `.github/zizmor.yml` when given files from lint-staged, or needs `--config`; and its offline flag.
- That lint-staged's glob reaches files under `.github/`, a dot folder.
- That `terraform init` and `destroy` work with the deploy role's `s3:ListBucket` limited to `demo/`; the S3 backend also lists workspaces under `env:/`. If it fails, allow that prefix too or set the backend's `workspace_key_prefix`, rather than widening the list.
