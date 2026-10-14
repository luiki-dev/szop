# PH-09 AWS account and Terraform bootstrap — design

- **Phase:** [PH-09](../../roadmap.md#ph-09-aws-account-and-terraform-bootstrap) ([#38](https://github.com/luiki-dev/szop/issues/38))
- **Date:** 2026-10-14
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-013](https://github.com/luiki-dev/szop/issues/66) (PH-09 part, then on to PH-10); [OP-018](https://github.com/luiki-dev/szop/issues/73) (PH-09 part, then on to PH-11); [OP-023](https://github.com/luiki-dev/szop/issues/74) (the tflint page, then on to PH-11); [OP-068](https://github.com/luiki-dev/szop/issues/70) (its last part); new [OP-091](https://github.com/luiki-dev/szop/issues/201) (under PH-11) and [OP-092](https://github.com/luiki-dev/szop/issues/202) (under PH-10)

Szop gets its own AWS account, managed with Terraform. The direction was settled by [ADR 0008](../../decisions/0008-hosting.md), decisions 4 to 8, 25, 26, 30 and 31 (Terraform in three root modules, the state in an S3 bucket created by `infra/bootstrap` with S3's native locking, Frankfurt, IAM Identity Center with no long-lived keys, budget alerts and default tags, the tools and the runbook) and [ADR 0010](../../decisions/0010-ci-cd.md), decisions 7 and 18 (the `infra` job with no AWS credentials, Dependabot's `terraform` ecosystem). This spec holds the details those left to the phase, as agreed in the brainstorm. They are recorded in ADR 0029.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [The account and access](#the-account-and-access)
  - [The infra folder](#the-infra-folder)
  - [The state bucket](#the-state-bucket)
  - [The budget](#the-budget)
  - [Moving bootstrap's state into the bucket](#moving-bootstraps-state-into-the-bucket)
  - [Tools on the owner's machine](#tools-on-the-owners-machine)
  - [Scripts and the git hook](#scripts-and-the-git-hook)
  - [The infra job in CI](#the-infra-job-in-ci)
  - [Dependabot](#dependabot)
- [Documentation and records](#documentation-and-records)
- [Owner steps](#owner-steps)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: Szop has its own AWS account, managed with Terraform. The state lives in a locked-down S3 bucket, budget alerts watch the costs, and CI checks every Terraform change.

The phase is done when:

- the owner's existing AWS account is cleaned up and is Szop's account: no IAM users or access keys left from earlier use, the root user with MFA and no access keys, IAM Identity Center with one administrator user with MFA, and the CLI signing in with `aws sso login --profile szop`;
- `infra/bootstrap` is applied from the owner's machine: the state bucket exists with every protection of [The state bucket](#the-state-bucket), the budget exists with its two alerts, and every resource carries the tags `project=szop` and `group=bootstrap`;
- bootstrap's own state lives in the bucket under `bootstrap/terraform.tfstate`, the local state file is deleted, and `terraform plan` shows no changes;
- `pnpm check:infra` passes on the owner's machine, and fails on a badly formatted `.tf` file and on a tflint finding (both shown once, locally, not committed);
- the `infra` job runs the same check on every PR touching `infra/`, with no AWS credentials, and `ci-ok` needs it;
- Dependabot has a `terraform` entry covering every module under `infra/`;
- the docs and records listed under [Documentation and records](#documentation-and-records) are updated.

## Out of scope

- **`infra/base` and `infra/demo`**, the DNS zone, the certificate, the registry and everything a demo runs on: [PH-10](../../roadmap.md#ph-10-domain-and-base-infrastructure) and [PH-12](../../roadmap.md#ph-12-first-deploy).
- **CI's access to AWS**: the OIDC provider, the CI roles, `infra-plan.yml`, `demo-up` and `demo-down`: [PH-11](../../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net) and [PH-12](../../roadmap.md#ph-12-first-deploy).
- **A security scanner for the Terraform code** (Trivy, Checkov): [OP-091](https://github.com/luiki-dev/szop/issues/201), under PH-11 ([decision 10](#decisions-taken-in-the-brainstorm)).
- **What `<domain>` and `demo.<domain>` serve while no demo runs**: [OP-092](https://github.com/luiki-dev/szop/issues/202), under PH-10. Bootstrap has no DNS.
- **The runbook's spin-up, teardown and debugging chapters**: PH-11 and PH-12 ([OP-018](https://github.com/luiki-dev/szop/issues/73)).

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | Which account | A brand-new account; a member account in an AWS Organization; the owner's existing account | **The owner's existing account, which becomes Szop's own.** It was used only for learning and runs nothing, so Szop is the only thing in it, as ADR 0008 asks. The runbook starts with a **clean-up audit**: old IAM users, their access keys and roles, resources left in any region, access keys on the root user. A member account adds an organization structure one person does not need. |
| 2 | Free or Paid plan | Stay on the Free plan; upgrade to the Paid plan | **Paid.** The Free plan closes the account after six months or when the credits run out, which does not fit permanent `infra/base` resources or a domain registered for a year. IAM Identity Center's organization instance, the one that gives people access to AWS accounts, needs AWS Organizations, and creating an organization upgrades a Free plan to Paid on its own; the runbook says so before the click. The Paid plan has no fixed fee; the remaining credits keep applying for up to 12 months from sign-up, and the budget alerts take over from the Free plan's hard cap. |
| 3 | People's access to AWS | IAM Identity Center (ADR 0008, decision 25); an IAM user with a console password, MFA, no access keys and `aws login` | **IAM Identity Center, as decided.** One user with MFA, one permission set `AdministratorAccess` with an 8-hour session, and an SSO profile `szop` for the CLI and Terraform. `aws login` (AWS CLI v2, late 2025) gives an IAM user short-lived credentials too, without an organization, but Identity Center is the pattern workplaces use, and the Paid plan is needed anyway. Every command uses `AWS_PROFILE=szop`; the profile is not written into the Terraform code, because CI authenticates without profiles (PH-11). |
| 4 | Bootstrap's own state | Kept local for good; moved into the bucket after the first apply | **Moved into the bucket** under `bootstrap/terraform.tfstate`, after a first apply with local state ([ADR 0008](../../decisions/0008-hosting.md), decision 7 left this open). Bootstrap's state is then versioned and kept off the owner's machine. Destroying bootstrap means moving it back first: a documented, one-off step in the runbook. |
| 5 | The bucket's name | A fixed name with a random suffix; a name with the account ID; a name kept out of git (partial backend configuration) | **`szop-tfstate-ntrtcr`**, written in every `backend` block. A `backend` block cannot use variables, so the name must be a literal somewhere; committed, `terraform init` works unchanged on the owner's machine and in CI. The suffix keeps the global name free and reveals nothing; the bucket's policy and IAM protect it, not its name. A partial configuration would add `-backend-config` to every `init`, in the docs and the workflows. |
| 6 | The alert address and the account ID | Committed in the code; a gitignored `terraform.tfvars` | **A gitignored `terraform.tfvars`**, with a committed `terraform.tfvars.example`. Bootstrap is applied only from the owner's machine, so CI never needs the values, and the address may differ from the one in the commits. The account ID feeds **`allowed_account_ids`**, so Terraform refuses to run against any other account the profile might point at. |
| 7 | The bucket's protections | — | **Versioning; the public access block; `BucketOwnerEnforced` ownership; SSE-S3 encryption; a policy that denies requests without TLS; a lifecycle rule; `prevent_destroy`; `force_destroy = false`.** The ownership and encryption settings are AWS's defaults since 2023, written out so the code explains them and they cannot drift. A customer-managed KMS key would cost $1 a month and protect nothing more here. The lifecycle rule expires old versions after 90 days, since every run's `.tflock` file leaves one behind, and aborts unfinished uploads after 7 days. `prevent_destroy` stops a stray `terraform destroy` from deleting the bucket every state lives in. |
| 8 | The budget | — | **One monthly cost budget, `szop-monthly`, limit $10, with two email alerts: forecast above $5 and actual above $10**, the thresholds of ADR 0008, decision 26. **Credits are excluded** (`include_credit = false`): by default AWS Budgets counts costs after credits, so it would see $0 and stay silent while a forgotten demo used up the credits. |
| 9 | Installing Terraform and pinning its version | tenv with `.terraform-version`; HashiCorp's apt repository, pinned | **tenv, with `.terraform-version` at the repository root.** It is the pattern of `nvm` and `.nvmrc`: tenv reads the file and installs the version, CI reads the same file, and an upgrade is one line. tenv is the maintained successor of tfenv. `required_version` in the code keeps a compatible range. The apt package would leave the version in the setup guide and in `ci.yml`, kept in step by hand. |
| 10 | A security scanner | Add one now (Trivy, Checkov); defer it; none | **Deferred**, as [OP-091](https://github.com/luiki-dev/szop/issues/201) under PH-11. Bootstrap holds one bucket and one budget, whose protections are written out and reviewed in this phase; a scanner earns its keep once IAM policies (PH-11), security groups, the load balancer and RDS (PH-12) arrive. The phase keeps to one concept. |
| 11 | How tflint is installed and configured | — | **A checksum-verified release binary, on the owner's machine and in CI**, as actionlint is in CI. `infra/.tflint.hcl` enables the bundled `terraform` ruleset with its `recommended` preset and the `aws` ruleset (`tflint-ruleset-aws`), pinned to a version; `tflint --init` downloads the plugin and checks its signature. |
| 12 | Where the checks run | Separate commands in `ci.yml` and the docs; one script | **One script, `scripts/check-infra.sh`**, run as `pnpm check:infra` and by the `infra` job, as `check:image` is for the image. `pnpm infra:fmt` rewrites formatting, and the pre-commit hook runs `terraform fmt` on staged `.tf` files. |
| 13 | Dependabot's `terraform` entry | One directory per module; a glob | **`directories: ["/infra/*"]`**, so `base` and `demo` are covered when they arrive. Weekly on Monday, the 7-day cooldown, minor and patch updates grouped, `build(deps): …`. **AWS provider majors are not ignored:** they come as separate PRs, and unlike Node's or PostgreSQL's they change nothing else with them. |

## Design

### The account and access

The runbook's "One-time account setup", in order:

1. **Clean-up audit.** IAM → Users: delete every user and its access keys. IAM → Roles: delete the roles left from earlier use (not the service-linked ones AWS manages). Look for resources in every region: the Billing console's charges by service for recent months, and Resource Explorer or Tag Editor across regions. Check that the root user has no access keys.
2. **The root user.** MFA on, a passkey or an authenticator app; root is not used after this.
3. **Region and billing.** `eu-central-1` as the console's default region; *Billing preferences*: Free Tier usage alerts and billing alerts on. Note the date the Free plan ends.
4. **IAM Identity Center.** Enable the organization instance in `eu-central-1`. The runbook states first that this creates an organization and **upgrades the account to the Paid plan**. Then: one user, the owner, with MFA required; one permission set, `AdministratorAccess`, session length 8 hours, assigned to the user on the account.
5. **The CLI.** `aws configure sso` writes the profile `szop` (start URL, region, account, permission set) to `~/.aws/config`; no keys anywhere. `aws sso login --profile szop`, then `aws sts get-caller-identity --profile szop` shows the assumed role.

Every later command runs with `export AWS_PROFILE=szop` in the shell.

### The infra folder

```
.terraform-version         the one exact Terraform version (tenv and CI)
infra/
├── .tflint.hcl            tflint's configuration for every module
└── bootstrap/
    ├── versions.tf        required_version, the AWS provider's constraint
    ├── providers.tf       region, default_tags, allowed_account_ids
    ├── state_bucket.tf    the bucket and its protections
    ├── budgets.tf         the budget and its alerts
    ├── variables.tf       alert_email, account_id (no defaults)
    ├── outputs.tf         state_bucket_name
    ├── backend.tf         added after the first apply
    ├── terraform.tfvars.example
    └── .terraform.lock.hcl
```

- **`versions.tf`:** `required_version = "~> 1.16"` (any 1.x from 1.16), and `hashicorp/aws` with `~> 6.<minor>`, the minor of the version locked. `.terraform-version` holds the exact patch.
- **`providers.tf`:** `region = "eu-central-1"`; `default_tags { tags = { project = "szop", group = "bootstrap" } }`; `allowed_account_ids = [var.account_id]`.
- **`variables.tf`:** `alert_email` (validated as containing an `@`) and `account_id` (validated as 12 digits), both without defaults, so a missing `terraform.tfvars` stops the run with a clear message.
- **`.gitignore`** gains `*.tfvars`; `terraform.tfvars.example` does not match it. The existing `*.tfstate*` and `.terraform/` entries cover the local state and the provider cache.
- **`.terraform.lock.hcl`** is committed, with checksums for `linux_amd64`, the platform of the owner's WSL and of CI (`terraform providers lock -platform=linux_amd64`).

### The state bucket

In `state_bucket.tf`:

| Resource | Setting |
|---|---|
| `aws_s3_bucket.state` | `bucket = "szop-tfstate-ntrtcr"`, `force_destroy = false`, `lifecycle { prevent_destroy = true }` |
| `aws_s3_bucket_versioning` | `Enabled` |
| `aws_s3_bucket_public_access_block` | all four settings `true` |
| `aws_s3_bucket_ownership_controls` | `BucketOwnerEnforced` (ACLs off) |
| `aws_s3_bucket_server_side_encryption_configuration` | `AES256` (SSE-S3) |
| `aws_s3_bucket_policy` | deny `s3:*` on the bucket and its objects when `aws:SecureTransport` is `false` |
| `aws_s3_bucket_lifecycle_configuration` | noncurrent versions expire after 90 days; incomplete multipart uploads abort after 7 days |

The output `state_bucket_name` gives the name to the runbook and, later, to whoever reads it.

### The budget

In `budgets.tf`, one `aws_budgets_budget`:

- `name = "szop-monthly"`, `budget_type = "COST"`, `time_unit = "MONTHLY"`, `limit_amount = "10"`, `limit_unit = "USD"`;
- `cost_types { include_credit = false }`, so credits do not hide the spending; the other cost types keep AWS's defaults;
- a notification `FORECASTED`, `GREATER_THAN`, `5`, `ABSOLUTE_VALUE`, to `var.alert_email`;
- a notification `ACTUAL`, `GREATER_THAN`, `10`, `ABSOLUTE_VALUE`, to `var.alert_email`.

Budget emails need no confirmation. The forecast needs some usage history before it can fire, so a quiet inbox in the first weeks is expected; the runbook says how to see the budget and its alerts in the console.

### Moving bootstrap's state into the bucket

A `backend "s3"` block naming a bucket that does not exist yet makes `terraform init` fail, so the move happens in two steps on the phase's branch:

1. A task commits bootstrap **without** `backend.tf`. The owner runs `terraform init` and `terraform apply`; the state is a local `terraform.tfstate`, ignored by git.
2. The next task adds `backend.tf`:

   ```hcl
   terraform {
     backend "s3" {
       bucket       = "szop-tfstate-ntrtcr"
       key          = "bootstrap/terraform.tfstate"
       region       = "eu-central-1"
       use_lockfile = true
       encrypt      = true
     }
   }
   ```

   The owner runs `terraform init -migrate-state`, answers yes, checks that `terraform plan` shows no changes, and deletes the local `terraform.tfstate` and its backup.

`use_lockfile = true` is S3's native lock: Terraform creates `bootstrap/terraform.tfstate.tflock` with a conditional write before a run and deletes it after, so a second run stops with "Error acquiring the state lock". No DynamoDB table is needed.

**Destroying bootstrap**, in the runbook: remove `backend.tf` and run `terraform init -migrate-state` to bring the state back, delete the `prevent_destroy` line, empty the bucket of every version, then `terraform destroy`. Only after `infra/base` and `infra/demo` are destroyed.

### Tools on the owner's machine

| Tool | Installed with | Version |
|---|---|---|
| tenv, then Terraform | tenv's `.deb` from its GitHub releases; `tenv tf install` reads `.terraform-version` | `.terraform-version` |
| tflint | the release zip, checked against its SHA-256 checksum, into `~/.local/bin` | the setup guide and `ci.yml` |
| tflint's AWS ruleset | `tflint --init`, which checks the plugin's signature | `infra/.tflint.hcl` |
| AWS CLI v2 | AWS's official zip installer | latest; AWS publishes no pinned channel, and it runs only on the owner's machine |
| Session Manager plugin | AWS's `.deb` | latest; needed for ECS Exec from PH-12 |

### Scripts and the git hook

- **`scripts/check-infra.sh`**, run as **`pnpm check:infra`**: `terraform fmt -check -recursive infra`; then for each folder under `infra/` holding `.tf` files, `terraform init -backend=false -input=false` and `terraform validate`; then `tflint --init` and `tflint --recursive --config "$PWD/infra/.tflint.hcl"`, run from `infra/`. It prints which step failed and exits non-zero. `init -backend=false` downloads the providers only: no AWS access, no state.
- **`pnpm infra:fmt`:** `terraform fmt -recursive infra`.
- **`lint-staged.config.js`:** a `*.tf` entry running `terraform fmt` on the staged files. The negated pattern for Prettier already skips `.tf` files through `--ignore-unknown`.

### The infra job in CI

- **`changes`** gets an `infra` output: `true` on a push to `main`, and on a PR when a changed file matches `^infra/`, `^\.terraform-version$` or `^scripts/check-infra\.sh$`.
- **`infra`** (`needs: changes`, `if: needs.changes.outputs.infra == 'true'`, `permissions: contents: read`, no `id-token`):
  1. checkout, `persist-credentials: false`;
  2. read `.terraform-version` into an output;
  3. `hashicorp/setup-terraform`, pinned to a commit SHA, with that version and `terraform_wrapper: false`;
  4. tflint: download, `sha256sum --check` against `TFLINT_SHA256`, unzip into `$RUNNER_TEMP`, add to `PATH`, as the `workflows` job does for actionlint;
  5. `scripts/check-infra.sh`, with `GITHUB_TOKEN` in its environment only so `tflint --init` is not rate-limited by GitHub's API.
- **`ci-ok`** adds `infra` to its `needs`.

### Dependabot

```yaml
  - package-ecosystem: terraform
    # The AWS provider in every root module under infra/ (ADR 0029).
    directories:
      - /infra/*
    schedule:
      interval: weekly
      day: monday
    cooldown:
      default-days: 7
    groups:
      terraform:
        update-types: [minor, patch]
    # build(deps): …
    commit-message:
      prefix: build
      include: scope
```

The header comment's "A later phase adds the terraform ecosystem (OP-068)" goes. Dependabot updates the provider's constraint and `.terraform.lock.hcl`. Terraform itself, tflint and its AWS ruleset are bumped by hand, as `.nvmrc` and actionlint are; their tool pages say how.

## Documentation and records

- **ADR 0029 "AWS account and Terraform bootstrap details"**, with the decisions above. It **completes** [ADR 0008](../../decisions/0008-hosting.md), decisions 7 (bootstrap's state moves into the bucket), 25 (the existing account, the Paid plan, the Identity Center setup), 26 (the budget's details) and 30 (tenv, tflint's installation), and [ADR 0010](../../decisions/0010-ci-cd.md), decisions 7 (the `infra` job's steps) and 18 (the `terraform` entry). The notes go in all three places: the new ADR's header, the earlier ADRs' status lines, and a line at the bottom of each decision's cell.
- **`docs/operations/demo-environment.md`** (new), the runbook: introduction, contents, "One-time account setup" ([The account and access](#the-account-and-access)), "Applying bootstrap" (the first apply, checking the budget, moving the state), "Destroying bootstrap", and a "Coming later" list for spin-up, teardown and debugging (PH-11, PH-12).
- **Tool pages** in `docs/development/tools/` (new): **`terraform.md`** (tenv, `.terraform-version`, `required_version`, the provider lock file, the scripts, upgrading Terraform); **`aws-cli.md`** (the installer, the `szop` SSO profile, `aws sso login`, the Session Manager plugin); **`tflint.md`** (`.tflint.hcl`, the two rulesets, upgrading tflint and the ruleset). `dependabot.md` gains the `terraform` entry; `husky-and-lint-staged.md` the `*.tf` entry.
- **`docs/development/setup.md`:** a step after Docker for tenv and Terraform, tflint, the AWS CLI and the Session Manager plugin, ending with `pnpm check:infra`; "Coming later" loses its Terraform line.
- **`docs/development/scripts.md`:** `check:infra` and `infra:fmt`.
- **`docs/development/ci-cd.md`:** the `infra` job, the `infra` change output, Dependabot's `terraform` entry.
- **`docs/architecture/stack-overview.md`,** section 12: a subsection on the AWS account (organizations, IAM Identity Center and short-lived credentials, regions, Budgets), and the Terraform subsection gains state, backends, the state lock and the provider lock file.
- **`docs/architecture/architecture.md`:** the `infra/` line of the monorepo layout says bootstrap exists.
- **`docs/architecture/threat-model.md`:** the state bucket among the assets; the owner's AWS access row points to the runbook and its clean-up audit.
- **`docs/glossary.md`:** acronyms new to the docs (SSO, SSE, KMS and others the text uses).
- **`CLAUDE.md` and `README.md`:** pointers to `docs/operations/` ([OP-018](https://github.com/luiki-dev/szop/issues/73)'s PH-09 part).
- **`docs/roadmap.md`:** PH-09's **Delivers** adds the tflint page and `check:infra`; its **Owner steps** take the wording of [Owner steps](#owner-steps).
- **GitHub first, then the docs** ([ADR 0027](../../decisions/0027-open-points-on-github.md)):
  - [#38](https://github.com/luiki-dev/szop/issues/38) is 🚧 In progress; its Started, Spec and Plan fields set as they are committed. The roadmap's PH-09 row follows, with the README's diagram.
  - The owner-step issues [#138](https://github.com/luiki-dev/szop/issues/138), [#139](https://github.com/luiki-dev/szop/issues/139) and [#140](https://github.com/luiki-dev/szop/issues/140) get the new wording, in their titles and bodies; the phase issue's body follows when the PR opens.
  - Closed by the PR: [OP-068](https://github.com/luiki-dev/szop/issues/70).
  - The PH-09 part ticked with the PR, then re-parented, still open: [OP-013](https://github.com/luiki-dev/szop/issues/66) to PH-10, [OP-018](https://github.com/luiki-dev/szop/issues/73) to PH-11, [OP-023](https://github.com/luiki-dev/szop/issues/74) to PH-11.
  - New open points, created in the brainstorm: [OP-091](https://github.com/luiki-dev/szop/issues/201) under PH-11, [OP-092](https://github.com/luiki-dev/szop/issues/202) under PH-10.

## Owner steps

1. Clean up the existing AWS account, secure its root user with MFA and set up IAM Identity Center, which upgrades the account to the Paid plan, following the runbook.
2. Install tenv (and through it Terraform), tflint, the AWS CLI and the Session Manager plugin, following the setup guide.
3. Apply `infra/bootstrap` from the branch, then move its state into the bucket, following the runbook.

Step 2 comes first in time: Claude runs `pnpm check:infra` on the same machine before committing the Terraform code.

## Tasks

1. **The tools.** `.terraform-version`, `infra/.tflint.hcl`, `scripts/check-infra.sh`, the `check:infra` and `infra:fmt` scripts, the lint-staged entry; the setup guide's step and the pages `terraform.md`, `tflint.md` and `aws-cli.md`; `scripts.md` and `husky-and-lint-staged.md`. **Then the owner does step 2.**
2. **`infra/bootstrap` without its backend.** The files of [The infra folder](#the-infra-folder) except `backend.tf`, the lock file and the `.gitignore` entry. `pnpm check:infra` passes, and fails on a misformatted file and on a tflint finding.
3. **The `infra` job in CI and Dependabot's `terraform` entry**, with `ci-ok`'s `needs`, `ci-cd.md` and `dependabot.md`.
4. **The runbook.** `docs/operations/demo-environment.md` with the account setup, applying and destroying bootstrap; the pointers in `CLAUDE.md` and the README. **Then the owner does step 1 and the first apply of step 3.**
5. **Bootstrap's backend.** `backend.tf`. **Then the owner moves the state** and checks that the plan shows no changes.
6. **The records.** ADR 0029 and the notes in ADR 0008 and ADR 0010; `stack-overview.md`, `architecture.md`, `threat-model.md` and the glossary; GitHub, then the roadmap and the README's diagram.

## To verify during implementation

- The latest Terraform 1.x patch a week old or more, like Dependabot's cooldown, for `.terraform-version` (1.16.5 on 2026-10-14), and the latest `hashicorp/aws` 6.x a week old or more, for the lock file.
- tenv's current `.deb` and that `tenv tf install` with no argument reads `.terraform-version` from the current folder or a parent.
- tflint's latest release and its checksum file; `tflint-ruleset-aws`'s latest release; that `tflint --recursive` with `--config` finds the config for each module, and that the plugin's signature check needs no extra key setup.
- `hashicorp/setup-terraform`'s latest release a week old or more, its commit SHA, and that `terraform_wrapper: false` is still the input's name.
- `aws_budgets_budget`'s `cost_types` block in provider 6.x: the attribute names and that the other cost types keep AWS's defaults when left out.
- Whether `allowed_account_ids` needs the account ID as a string (it does in 5.x).
- That the bucket name `szop-tfstate-ntrtcr` is free (`aws s3api head-bucket` answers 404 when it is), at the first apply.
- The failure paths of `pnpm check:infra`: a `.tf` file with wrong indentation, and an unused variable for tflint. Shown locally, not committed.
- Dependabot's `directories` accepting the glob `/infra/*` for the `terraform` ecosystem.
- After the move: `aws s3 ls s3://szop-tfstate-ntrtcr/bootstrap/` shows the state, and no `.tflock` is left after a run.
