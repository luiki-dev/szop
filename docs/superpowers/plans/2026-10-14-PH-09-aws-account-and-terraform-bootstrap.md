# PH-09 AWS account and Terraform bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Szop's existing AWS account is cleaned up and run through IAM Identity Center, `infra/bootstrap` creates the state bucket and the budget and keeps its own state in that bucket, and CI checks every Terraform change.

**Architecture:** One Terraform root module, `infra/bootstrap`, applied from the owner's machine with short-lived SSO credentials. It is applied first with local state, then its state moves into the bucket it created. One script, `scripts/check-infra.sh`, runs `terraform fmt`, `terraform validate` and tflint with no AWS access, on the owner's machine and in CI's new `infra` job.

**Tech Stack:** Terraform 1.16 (through tenv), the AWS provider 6.x, tflint 0.64 with `tflint-ruleset-aws`, AWS CLI v2 with IAM Identity Center, GitHub Actions, Dependabot.

**Spec:** [`docs/superpowers/specs/2026-10-14-PH-09-aws-account-and-terraform-bootstrap-design.md`](../specs/2026-10-14-PH-09-aws-account-and-terraform-bootstrap-design.md)

## Global Constraints

- Region `eu-central-1`, everywhere.
- Default tags on every resource: `project = "szop"`, `group = "bootstrap"`.
- State bucket: `szop-tfstate-ntrtcr`; bootstrap's state key `bootstrap/terraform.tfstate`; `use_lockfile = true`.
- Versions: Terraform `1.16.5` (`.terraform-version`), `required_version = "~> 1.16"`; `hashicorp/aws` `~> 6.68`; tflint `0.64.0`; `tflint-ruleset-aws` `0.49.0`; tenv `4.15.1`; `hashicorp/setup-terraform` v4.0.1 at `dfe3c3f87815947d99a8997f908cb6525fc44e9e`.
- **No AWS credentials in CI** in this phase; the `infra` job has `permissions: contents: read` only.
- **No secret, account ID or email address in git.** `terraform.tfvars` is gitignored; only `terraform.tfvars.example` is committed.
- **Claude never runs `terraform apply`, `terraform destroy`, `terraform init -migrate-state` or any AWS command that changes something.** Claude may run `terraform plan`, `terraform validate`, `pnpm check:infra` and read-only AWS commands once the owner is signed in.
- Every workflow rule of ADR 0010, decision 20: actions pinned to a full SHA with the version in a comment, `persist-credentials: false`, no `${{ … }}` inside `run:`.
- **After each task:** commit it, tick its step boxes in this plan in the same commit, `git push` the phase branch, then stop and summarize the task for the owner. Start the next task only when the owner says so ([`plans/CLAUDE.md`](CLAUDE.md)).
- **Never merge.** The PR opens after the last task, or when the owner asks.
- Docs follow `CLAUDE.md`'s writing style: niche acronyms spelled out on first use and added to the glossary, a `## Contents` section in long documents, status icons before their word.

## Review Focus

- **A command run without `AWS_PROFILE=szop`** must stop, not fall back to another identity: `allowed_account_ids` guards the account, and after owner step B no stored key exists. Task 4's runbook has the check (`aws sts get-caller-identity` with no profile fails).
- **A missing or wrong `terraform.tfvars`** must stop the run with a clear message: Task 2 checks both validations.
- **`pnpm check:infra` on a module that already has its S3 backend** (bootstrap after Task 5) must not touch the backend or need AWS: Task 5 runs it after the move.
- **The bucket name already taken by someone else** (S3 names are global): owner step C checks `head-bucket` before the first apply.
- **A stray `terraform destroy` on bootstrap** must not delete the bucket: `prevent_destroy` makes it fail; Task 2 shows the plan error with `terraform plan -destroy`.

---

## The owner's steps, at a glance

Four moments in this plan need you. Claude stops before each one and says so. Each box says **what you do**, **where the instructions are**, and **what not to do**.

| When | Step | Roadmap owner step | Issue |
|---|---|---|---|
| After Task 1 | [A. Install the tools](#owner-step-a-install-the-tools) | 2 | [#139](https://github.com/luiki-dev/szop/issues/139) |
| After Task 4 | [B. Set up the account](#owner-step-b-set-up-the-account) | 1 | [#138](https://github.com/luiki-dev/szop/issues/138) |
| After step B | [C. First apply of bootstrap](#owner-step-c-first-apply-of-bootstrap) | 3 (first half) | [#140](https://github.com/luiki-dev/szop/issues/140) |
| After Task 5 | [D. Move bootstrap's state into the bucket](#owner-step-d-move-the-state-into-the-bucket) | 3 (second half) | [#140](https://github.com/luiki-dev/szop/issues/140) |

### Owner step A: install the tools

- **What you do:** install tenv (and through it Terraform 1.16.5), tflint 0.64.0 and the Session Manager plugin; check that the AWS CLI you already have works (`aws --version`); then run `pnpm check:infra` from the repository root and see it pass.
- **Where:** [`docs/development/setup.md`](../../development/setup.md), section "8. Terraform, tflint and the AWS CLI" (written in Task 1), with details in [`tools/terraform.md`](../../development/tools/terraform.md), [`tools/tflint.md`](../../development/tools/tflint.md) and [`tools/aws-cli.md`](../../development/tools/aws-cli.md).
- **Don't:**
  - install Terraform with `apt`, `snap` or HashiCorp's zip: tenv owns it, so `.terraform-version` decides the version;
  - run `aws configure` or create access keys;
  - change anything in `~/.aws` yet: your current sign-in stays until step B has the SSO profile working.
- **Tell Claude:** "tools installed", so Task 2 can run the checks on this machine.

### Owner step B: set up the account

- **What you do:** follow the runbook's "One-time account setup", steps 1 to 6, in order: take stock and clean up roles and leftovers; MFA on the root user; region and billing preferences; IAM Identity Center (this **upgrades the account to the Paid plan**); the `szop` SSO profile; then remove every IAM user, access key and stored key.
- **Where:** [`docs/operations/demo-environment.md`](../../operations/demo-environment.md), "One-time account setup" (written in Task 4).
- **Don't:**
  - delete your IAM user or its access key **before** `aws sts get-caller-identity --profile szop` works (step 5): you would lock yourself out of the CLI;
  - enable Identity Center in any region other than `eu-central-1`: its region cannot be changed without deleting it;
  - create access keys for anyone, root included;
  - use the root user for anything after its MFA is on;
  - paste the account ID, the SSO start URL or your email address into a commit, an issue or a PR.
- **Tell Claude:** "account set up", and whether `aws sts get-caller-identity` without a profile now fails, as the runbook's last check expects.

### Owner step C: first apply of bootstrap

- **What you do:** in `infra/bootstrap`, copy `terraform.tfvars.example` to `terraform.tfvars` and fill in the account ID and the alert address; check the bucket name is free; `terraform init`, `terraform plan`, read the plan, `terraform apply`.
- **Where:** the runbook's "Applying bootstrap", part 1 (written in Task 4).
- **Don't:**
  - commit `terraform.tfvars` or `terraform.tfstate` (git ignores them; don't force-add them);
  - add a `backend` block yourself: Task 5 does, after the bucket exists;
  - delete the local `terraform.tfstate`: it is the only record of what was created until step D;
  - run `terraform destroy`.
- **Tell Claude:** "bootstrap applied", with the `Apply complete! Resources: N added` line.

### Owner step D: move the state into the bucket

- **What you do:** `terraform init -migrate-state`, answer `yes`; `terraform plan` must say "No changes"; then delete the local `terraform.tfstate` and `terraform.tfstate.backup`.
- **Where:** the runbook's "Applying bootstrap", part 2 (written in Task 4, used after Task 5).
- **Don't:**
  - delete the local state files before the plan says "No changes";
  - answer `no` to the copy prompt and continue anyway: that leaves an empty state in the bucket;
  - run `terraform apply` again "to be sure": the plan is the check.
- **Tell Claude:** "state moved", with the plan's last line.

---

## File structure

| File | Task | Responsibility |
|---|---|---|
| `.terraform-version` | 1 | The one exact Terraform version, read by tenv and CI |
| `infra/.tflint.hcl` | 1 | tflint's configuration for every module |
| `scripts/check-infra.sh` | 1 | fmt, validate and tflint, with no AWS access |
| `package.json` | 1 | `check:infra`, `infra:fmt` |
| `lint-staged.config.js` | 1 | `terraform fmt` on staged `.tf` files |
| `docs/development/setup.md`, `scripts.md`, `tools/terraform.md`, `tools/tflint.md`, `tools/aws-cli.md`, `tools/husky-and-lint-staged.md` | 1 | How to install and run the tools |
| `infra/bootstrap/versions.tf`, `providers.tf`, `variables.tf`, `state_bucket.tf`, `budgets.tf`, `outputs.tf`, `terraform.tfvars.example`, `.terraform.lock.hcl` | 2 | The bootstrap module |
| `.gitignore` | 2 | `*.tfvars` |
| `.github/workflows/ci.yml` | 3 | The `infra` job and its change detection |
| `.github/dependabot.yml` | 3 | The `terraform` entry |
| `docs/development/ci-cd.md`, `tools/dependabot.md` | 3 | The job and the entry explained |
| `docs/operations/demo-environment.md` | 4 | The runbook |
| `CLAUDE.md`, `README.md` | 4 | Pointers to `docs/operations/` |
| `infra/bootstrap/backend.tf` | 5 | The S3 backend |
| `docs/decisions/0029-aws-account-and-terraform-bootstrap-details.md`, `0008-hosting.md`, `0010-ci-cd.md` | 6 | The decisions |
| `docs/architecture/stack-overview.md`, `architecture.md`, `threat-model.md`, `docs/glossary.md`, `docs/roadmap.md`, `README.md` | 6 | Living docs and status |

---

### Task 1: The tools

**Files:**
- Create: `.terraform-version`, `infra/.tflint.hcl`, `scripts/check-infra.sh`, `docs/development/tools/terraform.md`, `docs/development/tools/tflint.md`, `docs/development/tools/aws-cli.md`
- Modify: `package.json` (scripts), `lint-staged.config.js`, `docs/development/setup.md`, `docs/development/scripts.md`, `docs/development/tools/husky-and-lint-staged.md`

**Interfaces:**
- Produces: `pnpm check:infra` → `scripts/check-infra.sh` (exit 0 when every check passes, non-zero with `FAIL: …` otherwise); `pnpm infra:fmt`; `infra/.tflint.hcl` used with `--config "$PWD/infra/.tflint.hcl"`; `.terraform-version` read by CI in Task 3.

- [x] **Step 1: Pin the Terraform version**

`.terraform-version`:

```
1.16.5
```

- [x] **Step 2: Configure tflint**

`infra/.tflint.hcl`:

```hcl
# tflint's configuration for every root module under infra/ (ADR 0029).
# Run through scripts/check-infra.sh; see docs/development/tools/tflint.md.

# The bundled Terraform rules: unused declarations, missing version
# constraints, deprecated syntax, untyped variables, naming.
plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

# AWS-specific mistakes: invalid instance types, regions, names. Updated by
# hand: Dependabot does not see tflint plugins.
plugin "aws" {
  enabled = true
  version = "0.49.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}
```

- [x] **Step 3: Write the check script**

`scripts/check-infra.sh`:

```bash
#!/usr/bin/env bash
# Checks the Terraform code under infra/ with no AWS access (ADR 0029):
# formatting, every root module validated, then tflint. Locally:
# pnpm check:infra. CI's infra job runs it too.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> terraform fmt"
if ! terraform fmt -check -recursive -diff infra; then
  echo "FAIL: formatting; run pnpm infra:fmt" >&2
  exit 1
fi

# -backend=false downloads the providers only: no state, no AWS access.
for dir in infra/*/; do
  compgen -G "${dir}*.tf" > /dev/null || continue
  echo "==> terraform validate ${dir}"
  terraform -chdir="$dir" init -backend=false -input=false > /dev/null \
    || { echo "FAIL: terraform init in ${dir}" >&2; exit 1; }
  terraform -chdir="$dir" validate \
    || { echo "FAIL: terraform validate in ${dir}" >&2; exit 1; }
done

echo "==> tflint"
config="$PWD/infra/.tflint.hcl"
tflint --init --config "$config"
(cd infra && tflint --recursive --config "$config") \
  || { echo "FAIL: tflint" >&2; exit 1; }
```

Then: `chmod +x scripts/check-infra.sh` and `bash -n scripts/check-infra.sh` (no output means the syntax is valid).

- [x] **Step 4: Add the scripts and the hook**

In the root `package.json` `scripts`, after `"check:image"`:

```json
    "check:infra": "scripts/check-infra.sh",
    "infra:fmt": "terraform fmt -recursive infra",
```

In `lint-staged.config.js`, after the ESLint entry:

```js
  // Terraform files: the formatter Terraform ships with. Prettier skips
  // them below through --ignore-unknown.
  "*.tf": "terraform fmt",
```

- [x] **Step 5: Write the tool pages**

Each follows the layout of `docs/development/tools/actionlint.md`: what it is, `## Why Szop uses it` (with the ADR decisions: ADR 0008 decisions 4, 5, 7 and 30; ADR 0029), `## Configuration`, `## Everyday use`, and an "Updating" part.

- `terraform.md`: Terraform and tenv; `.terraform-version` and `required_version`; the provider lock file `.terraform.lock.hcl` versus the state lock `.tflock` (both explained); the three root modules; `pnpm infra:fmt` and `pnpm check:infra`; why commands need `AWS_PROFILE=szop`; **updating Terraform**: pick a patch at least 7 days old, change `.terraform-version`, `tenv tf install`, `pnpm check:infra`, commit; **updating the provider**: Dependabot does it; by hand, `terraform init -upgrade` then `terraform providers lock -platform=linux_amd64`.
- `tflint.md`: what tflint checks that `validate` does not; `infra/.tflint.hcl` line by line; installing the binary checked against its checksum; reading a finding (`rule name`, file and line, the rule's doc link); **updating tflint** (the version and `TFLINT_SHA256` in `ci.yml` and the setup guide, from `checksums.txt`) and **updating the AWS ruleset** (`version` in `.tflint.hcl`, `tflint --init`).
- `aws-cli.md`: AWS CLI v2 and why the Session Manager plugin is needed (ECS Exec, from PH-12); profiles in `~/.aws/config`; the `szop` SSO profile and `aws sso login --profile szop`; `export AWS_PROFILE=szop`; why there are no access keys (ADR 0008, decision 25); on this machine `~/.aws` links to the Windows user's `.aws`; updating: rerun AWS's installer with `--update`.

- [x] **Step 6: Add the setup guide's section**

In `docs/development/setup.md`, a new `## 8. Terraform, tflint and the AWS CLI` after "7. Docker Desktop and the database"; the sections after it become 9 to 12, and `## Contents` follows. Before renumbering, find links to the old anchors and fix them:

```bash
grep -rn "setup.md#\(8\|9\|10\|11\)-" docs README.md CLAUDE.md
```

The section, with these commands (WSL, from any folder unless stated):

```bash
# tenv, which installs Terraform from .terraform-version
S=/tmp/szop-tools; mkdir -p "$S"; cd "$S"
curl -fsSLO https://github.com/tofuutils/tenv/releases/download/v4.15.1/tenv_v4.15.1_amd64.deb
echo "3d1b8afa3b4f1fdc6ac127a349c2547f447e42e36d5be116ee1602bb04a0a5b1  tenv_v4.15.1_amd64.deb" | sha256sum --check
sudo apt install ./tenv_v4.15.1_amd64.deb
cd ~/workspace/szop && tenv tf install && terraform version     # Terraform v1.16.5

# tflint
cd "$S"
curl -fsSLO https://github.com/terraform-linters/tflint/releases/download/v0.64.0/tflint_linux_amd64.zip
echo "cca9d13e2e1d7a2c627af60ff899a3c9b74212899416aeb96ec764d2ef954537  tflint_linux_amd64.zip" | sha256sum --check
mkdir -p ~/.local/bin && unzip -o tflint_linux_amd64.zip -d ~/.local/bin && tflint --version

# AWS CLI v2: skip if `aws --version` already prints aws-cli/2.x
curl -fsSL -o awscliv2.zip https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip
unzip -q awscliv2.zip && sudo ./aws/install --update && aws --version

# Session Manager plugin
curl -fsSLO https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb
sudo apt install ./session-manager-plugin.deb && session-manager-plugin --version

# Back in the repository
cd ~/workspace/szop && pnpm check:infra
```

The text says: `~/.local/bin` is on Ubuntu's `PATH` after the next login if it did not exist before; signing in to AWS is the runbook's job, not the setup guide's ([`docs/operations/demo-environment.md`](../../operations/demo-environment.md)). "Coming later" loses its Terraform line.

- [x] **Step 7: Document the scripts and the hook**

`docs/development/scripts.md`: a row for `pnpm infra:fmt` under "Formatting", a row for `pnpm check:infra` under "Checks" (CI job: `infra`), in the table's style. `docs/development/tools/husky-and-lint-staged.md`: the `*.tf` entry.

- [x] **Step 8: Check and commit**

Run: `pnpm format:check && bash -n scripts/check-infra.sh`
Expected: both pass. (`pnpm check:infra` runs after owner step A.)

```bash
git add .terraform-version infra/.tflint.hcl scripts/check-infra.sh package.json lint-staged.config.js docs/development
git commit -m "build(infra): add Terraform, tflint and the infra check script"
```

**⏸️ Stop here. Owner step A: [install the tools](#owner-step-a-install-the-tools).**

---

### Task 2: `infra/bootstrap` without its backend

**Files:**
- Create: `infra/bootstrap/versions.tf`, `providers.tf`, `variables.tf`, `state_bucket.tf`, `budgets.tf`, `outputs.tf`, `terraform.tfvars.example`, `.terraform.lock.hcl`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `pnpm check:infra` (Task 1).
- Produces: the module's inputs `account_id` (12 digits, string) and `alert_email`; its output `state_bucket_name`; resource address `aws_s3_bucket.state` (Task 6's docs and the runbook name it).

- [x] **Step 1: Show the check fails on a misformatted file**

```bash
mkdir -p infra/bootstrap
printf 'terraform {\nrequired_version = "~> 1.16"\n}\n' > infra/bootstrap/versions.tf
pnpm check:infra
```

Expected: FAIL at `terraform fmt`, with the diff and "FAIL: formatting; run pnpm infra:fmt".

- [x] **Step 2: Write the module**

`infra/bootstrap/versions.tf`:

```hcl
terraform {
  # Any 1.x from 1.16; the exact version is in .terraform-version.
  required_version = "~> 1.16"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.68"
    }
  }
}
```

`infra/bootstrap/providers.tf`:

```hcl
provider "aws" {
  region = "eu-central-1"

  # Terraform stops if the credentials belong to any other account.
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      project = "szop"
      group   = "bootstrap"
    }
  }
}
```

`infra/bootstrap/variables.tf`:

```hcl
variable "account_id" {
  description = "The ID of Szop's AWS account; Terraform refuses to run against any other."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "account_id must be the 12-digit AWS account ID, in quotes."
  }
}

variable "alert_email" {
  description = "Where AWS Budgets sends its alerts."
  type        = string

  validation {
    condition     = can(regex("^[^@[:space:]]+@[^@[:space:]]+$", var.alert_email))
    error_message = "alert_email must be an email address."
  }
}
```

`infra/bootstrap/state_bucket.tf`:

```hcl
# The bucket that holds the state of every root module (ADR 0008, decision 7;
# ADR 0029). Its name is written in every backend block, which cannot use
# variables.
resource "aws_s3_bucket" "state" {
  bucket        = "szop-tfstate-ntrtcr"
  force_destroy = false

  # Destroying bootstrap is a deliberate, documented step: the runbook's
  # "Destroying bootstrap" removes this line first.
  lifecycle {
    prevent_destroy = true
  }
}

# Every earlier state stays restorable.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# AWS's defaults since 2023, written out so they cannot drift: ACLs off,
# objects encrypted with S3-managed keys.
resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Only TLS (audit C6).
data "aws_iam_policy_document" "state" {
  statement {
    sid       = "DenyWithoutTLS"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state.json
}

# Every run creates and deletes a .tflock file, and with versioning each
# deletion leaves an old version and a delete marker behind.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    expiration {
      expired_object_delete_marker = true
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}
```

`infra/bootstrap/budgets.tf`:

```hcl
# Alerts by email (ADR 0008, decision 26; ADR 0029). Credits are left out:
# with them, the budget would see $0 while a forgotten demo used them up.
resource "aws_budgets_budget" "monthly" {
  name         = "szop-monthly"
  budget_type  = "COST"
  limit_amount = "10"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_types {
    include_credit = false
  }

  notification {
    notification_type          = "FORECASTED"
    comparison_operator        = "GREATER_THAN"
    threshold                  = 5
    threshold_type             = "ABSOLUTE_VALUE"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    notification_type          = "ACTUAL"
    comparison_operator        = "GREATER_THAN"
    threshold                  = 10
    threshold_type             = "ABSOLUTE_VALUE"
    subscriber_email_addresses = [var.alert_email]
  }
}
```

`infra/bootstrap/outputs.tf`:

```hcl
output "state_bucket_name" {
  description = "The bucket every root module keeps its state in."
  value       = aws_s3_bucket.state.bucket
}
```

`infra/bootstrap/terraform.tfvars.example`:

```hcl
# Copy to terraform.tfvars (ignored by git) and fill in; see
# docs/operations/demo-environment.md, "Applying bootstrap".
account_id  = "123456789012"
alert_email = "you@example.com"
```

`.gitignore`: under the Terraform comment, add `*.tfvars` and change the comment to "Terraform: local state (bootstrap starts with it, ADR 0008 decision 7), provider caches and variable files (ADR 0029)".

- [x] **Step 3: Lock the provider and run the checks**

```bash
pnpm infra:fmt
terraform -chdir=infra/bootstrap init -backend=false
terraform -chdir=infra/bootstrap providers lock -platform=linux_amd64
pnpm check:infra
```

Expected: `pnpm check:infra` passes: fmt silent, "Success! The configuration is valid.", tflint with no findings. If `cost_types` or a lifecycle argument fails validation, fix it against the provider's docs for the locked version and note it for the PR description.

- [x] **Step 4: Show tflint fails on an unused variable**

```bash
printf 'variable "unused" {\n  type = string\n}\n' > infra/bootstrap/unused.tf
pnpm check:infra   # Expected: FAIL: tflint, with terraform_unused_declarations
rm infra/bootstrap/unused.tf
```

- [x] **Step 5: Show the variable checks and `prevent_destroy`**

```bash
cd infra/bootstrap
terraform validate                                   # passes: validation needs values
terraform plan -input=false -var account_id=12345 -var alert_email=x 2>&1 | grep -E "account_id must|alert_email must"
```

Expected: both error messages, before any AWS call (the plan stops at variable validation). The `prevent_destroy` check needs a state, so it is shown in owner step C's runbook text (`terraform plan -destroy` ends with "Instance cannot be destroyed").

- [x] **Step 6: Commit**

```bash
cd ~/workspace/szop
git status --short    # no terraform.tfvars, no .terraform/, no *.tfstate
git add .gitignore infra/bootstrap
git commit -m "feat(infra): add the bootstrap module with the state bucket and the budget"
```

---

### Task 3: The `infra` job in CI and Dependabot's `terraform` entry

**Files:**
- Modify: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `docs/development/ci-cd.md`, `docs/development/tools/dependabot.md`

**Interfaces:**
- Consumes: `scripts/check-infra.sh`, `.terraform-version` (Task 1); `infra/bootstrap` (Task 2).
- Produces: job `infra`, change output `infra`.

- [ ] **Step 1: Detect infra changes**

In `ci.yml`'s `changes` job: add `infra: ${{ steps.detect.outputs.infra }}` to `outputs`; in the `detect` script, `infra=true` in the push branch, and in the PR branch, after the `workflows` line:

```bash
            if grep -qE '^(infra/|\.terraform-version$|scripts/check-infra\.sh$)' <<<"$files"; then infra=true; else infra=false; fi
```

and add `echo "infra=$infra" >> "$GITHUB_OUTPUT"` and `infra=$infra` to the summary line.

- [ ] **Step 2: Add the job**

After the `docker` job:

```yaml
  infra:
    name: infra
    needs: changes
    if: needs.changes.outputs.infra == 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    permissions:
      contents: read
    env:
      # Updated by hand: Dependabot cannot see versions inside run steps
      # (docs/development/tools/tflint.md).
      TFLINT_VERSION: 0.64.0
      TFLINT_SHA256: cca9d13e2e1d7a2c627af60ff899a3c9b74212899416aeb96ec764d2ef954537
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      # The one exact version, shared with tenv on the owner's machine.
      - id: version
        run: echo "terraform=$(cat .terraform-version)" >> "$GITHUB_OUTPUT"

      - uses: hashicorp/setup-terraform@dfe3c3f87815947d99a8997f908cb6525fc44e9e # v4.0.1
        with:
          terraform_version: ${{ steps.version.outputs.terraform }}
          terraform_wrapper: false

      - name: tflint
        run: |
          curl -fsSL -o "$RUNNER_TEMP/tflint.zip" \
            "https://github.com/terraform-linters/tflint/releases/download/v${TFLINT_VERSION}/tflint_linux_amd64.zip"
          echo "${TFLINT_SHA256}  $RUNNER_TEMP/tflint.zip" | sha256sum --check
          unzip -q "$RUNNER_TEMP/tflint.zip" -d "$RUNNER_TEMP/bin"
          echo "$RUNNER_TEMP/bin" >> "$GITHUB_PATH"

      # GITHUB_TOKEN only keeps tflint --init from being rate-limited by
      # GitHub's API when it downloads the AWS ruleset. No AWS credentials.
      - run: scripts/check-infra.sh
        env:
          GITHUB_TOKEN: ${{ github.token }}
```

In `ci-ok`, `needs` becomes `[changes, lint, typecheck, test, build, e2e, docker, infra, commits, workflows]` (Prettier may wrap it).

- [ ] **Step 3: Add the Dependabot entry**

In `.github/dependabot.yml`, remove the header line "A later phase adds the terraform ecosystem (OP-068)." and append:

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

- [ ] **Step 4: Lint the workflow locally**

Run actionlint as `docs/development/tools/actionlint.md`, "Everyday use", shows (scratch folder, version and checksum from `ci.yml`).
Expected: no output. Then `pnpm format:check`.

- [ ] **Step 5: Document**

`docs/development/ci-cd.md`: the `infra` job in the jobs table and its own short section (what it runs, no AWS credentials, the token, reading a failure: the `FAIL:` line names the step); the `infra` output in "Change detection"; the `terraform` entry in the Dependabot section. `docs/development/tools/dependabot.md`: the entry and what Dependabot does not update (Terraform, tflint, the ruleset).

- [ ] **Step 6: Commit**

```bash
git add .github docs/development
git commit -m "ci: check the Terraform code in an infra job, and let Dependabot update the AWS provider"
```

The job is proven by the PR's first CI run (the PR's `changes` output shows `infra=true`, the `infra` job passes, `ci-ok` passes).

---

### Task 4: The runbook

**Files:**
- Create: `docs/operations/demo-environment.md`
- Modify: `CLAUDE.md` (the Documentation list), `README.md`

**Interfaces:**
- Consumes: the bucket name, variables and output of Task 2; the tools of Task 1.
- Produces: the sections owner steps B, C and D point to: "One-time account setup", "Applying bootstrap" (parts 1 and 2), "Destroying bootstrap".

- [ ] **Step 1: Write the runbook**

`docs/operations/demo-environment.md`. Introduction (what the demo environment is, the three modules, that every command assumes `export AWS_PROFILE=szop`), `## Contents`, then:

**`## One-time account setup`**: the spec's six steps ([The account and access](../specs/2026-10-14-PH-09-aws-account-and-terraform-bootstrap-design.md#the-account-and-access)), each as numbered console clicks or commands, each ending with how to check it worked. Each step that has a "don't" from [owner step B](#owner-step-b-set-up-the-account) carries it as a **⚠️ Don't** line in the step. Step 4 opens with: "Enabling Identity Center creates an organization, which upgrades the account from the Free plan to the Paid plan. The Paid plan has no fixed fee; your credits keep applying." Step 5's commands:

```bash
aws configure sso
#   SSO session name: szop
#   SSO start URL: the AWS access portal URL from Identity Center's dashboard
#   SSO region: eu-central-1
#   SSO registration scopes: (Enter for the default)
#   then pick the account and AdministratorAccess
#   Default client region: eu-central-1
#   CLI default output format: json
#   Profile name: szop
aws sso login --profile szop
aws sts get-caller-identity --profile szop   # an assumed-role ARN with AWSReservedSSO_AdministratorAccess
```

Step 6's final check:

```bash
aws sts get-caller-identity    # with no profile: must fail with "Unable to locate credentials"
```

**`## Applying bootstrap`**, part 1 (owner step C):

```bash
export AWS_PROFILE=szop
aws sso login
cd infra/bootstrap
cp terraform.tfvars.example terraform.tfvars    # then edit: account ID, alert address
aws s3api head-bucket --bucket szop-tfstate-ntrtcr
#   "Not Found" (404): the name is free, go on.
#   "Forbidden" (403): someone else owns it; stop and tell Claude.
terraform init
terraform plan          # expect: 8 to add, 0 to change, 0 to destroy
terraform apply         # type yes after reading the plan
terraform plan -destroy # expect the error "Instance cannot be destroyed": prevent_destroy works
```

Then: where to see the budget (Billing → Budgets → `szop-monthly`, two alerts) and the bucket's settings (S3 → the bucket → Properties and Permissions).

Part 2 (owner step D, after `backend.tf` exists):

```bash
terraform init -migrate-state   # answer yes to copy the existing state
terraform plan                  # expect: No changes.
aws s3 ls s3://szop-tfstate-ntrtcr/bootstrap/   # terraform.tfstate, no .tflock left
rm terraform.tfstate terraform.tfstate.backup
```

**`## Destroying bootstrap`**: only after `infra/demo` and `infra/base` are destroyed; delete `backend.tf` and run `terraform init -migrate-state` (state back to local); remove the `prevent_destroy` block; empty the bucket of every version and delete marker (console: *Empty*); `terraform destroy`.

**`## Coming later`**: spin-up and teardown with the buttons (PH-11, PH-12), debugging with ECS Exec and logs (PH-12), costs (PH-12).

- [ ] **Step 2: Point to it**

`CLAUDE.md`, in the Documentation list after `ci-cd.md`'s entry or in the order of the list: `` - `docs/operations/demo-environment.md` — the runbook for the AWS demo environment: the one-time account setup, applying and destroying bootstrap, and later spinning the demo up and down. Keep it updated when an infrastructure step changes. `` `README.md`: a line where the docs are listed, or after the roadmap section if there is no such list, linking the runbook.

- [ ] **Step 3: Check and commit**

Run: `pnpm format:check`, and read the runbook's Contents against its headings.

```bash
git add docs/operations CLAUDE.md README.md
git commit -m "docs: add the runbook's account setup and bootstrap chapters"
```

**⏸️ Stop here. Owner steps B and C: [set up the account](#owner-step-b-set-up-the-account), then [apply bootstrap](#owner-step-c-first-apply-of-bootstrap).** After C, Claude runs the read-only checks: `terraform -chdir=infra/bootstrap plan` (No changes), `aws s3api get-bucket-versioning`, `get-public-access-block`, `get-bucket-policy`, `get-bucket-lifecycle-configuration --bucket szop-tfstate-ntrtcr`, `aws budgets describe-budget --account-id … --budget-name szop-monthly`, and `aws resourcegroupstaggingapi get-resources --tag-filters Key=project,Values=szop` (both resources tagged).

---

### Task 5: Bootstrap's backend

**Files:**
- Create: `infra/bootstrap/backend.tf`

**Interfaces:**
- Consumes: the bucket created in owner step C.
- Produces: the backend pattern `infra/base` and `infra/demo` copy with their own `key`.

- [ ] **Step 1: Add the backend**

`infra/bootstrap/backend.tf`:

```hcl
# Bootstrap's own state, moved into the bucket it created after the first
# apply (ADR 0029). S3's native lock: a .tflock file next to the state, no
# DynamoDB table.
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

- [ ] **Step 2: Check without AWS**

Run: `pnpm check:infra`
Expected: passes. `init -backend=false` leaves the backend alone, so the check needs no credentials.

- [ ] **Step 3: Commit**

```bash
git add infra/bootstrap/backend.tf
git commit -m "feat(infra): keep bootstrap's state in the state bucket"
```

**⏸️ Stop here. Owner step D: [move the state into the bucket](#owner-step-d-move-the-state-into-the-bucket).** After it, Claude runs `terraform -chdir=infra/bootstrap plan` (No changes, reading the state from S3) and `pnpm check:infra` again.

---

### Task 6: The records

**Files:**
- Create: `docs/decisions/0029-aws-account-and-terraform-bootstrap-details.md`
- Modify: `docs/decisions/0008-hosting.md`, `docs/decisions/0010-ci-cd.md`, `docs/architecture/stack-overview.md`, `docs/architecture/architecture.md`, `docs/architecture/threat-model.md`, `docs/glossary.md`, `docs/roadmap.md`, `README.md`

- [ ] **Step 1: Write ADR 0029**

In the format of `docs/decisions/0028-container-image-details.md`: status `✅ Accepted`; header `Completes: ADR 0008, decisions 7, 25, 26 and 30; ADR 0010, decisions 7 and 18`; context; the spec's 13 decisions as the table (topic, options considered, decision with its reasoning); consequences (the owner steps; manual bumps of Terraform, tflint and the ruleset; OP-091 and OP-092).

- [ ] **Step 2: Add the notes to ADR 0008 and ADR 0010**

The status lines name ADR 0029. At the bottom of each decision's cell: ADR 0008, decisions 7, 25, 26 and 30, and ADR 0010, decisions 7 and 18, get `<br>🧩 **Completed by [ADR 0029](0029-aws-account-and-terraform-bootstrap-details.md), decision N:** …` (one sentence each), after any existing notes.

- [ ] **Step 3: Update the living docs**

- `stack-overview.md`, section 12: a subsection "The AWS account" (an account, regions, AWS Organizations, IAM Identity Center and short-lived credentials versus access keys, AWS Budgets and why credits are excluded); the Terraform subsection gains state, backends, the state lock and the provider lock file. `## Contents` gains the new heading.
- `architecture.md`: the `infra/` line says `bootstrap` exists, with the bucket and budget.
- `threat-model.md`: the state bucket among the assets (it reveals the infrastructure; guarded by IAM, TLS only, public access blocked, versioning); the owner's AWS access row links the runbook and the clean-up audit.
- `glossary.md`: SSO, SSE, KMS and any other acronym new to the docs (check MFA, IAM, S3 are already there).

- [ ] **Step 4: GitHub, then the roadmap**

- The PH-09 part of [OP-013](https://github.com/luiki-dev/szop/issues/66), [OP-018](https://github.com/luiki-dev/szop/issues/73) and [OP-023](https://github.com/luiki-dev/szop/issues/74) is ticked with the PR when it opens; the issues are re-parented (OP-013 to PH-10 #39; OP-018 and OP-023 to PH-11 #40) and set to ⬜ Backlog. [OP-068](https://github.com/luiki-dev/szop/issues/70) is closed by the PR.
- The PH-09 issue's body takes the roadmap entry's new **Delivers** and **Owner steps** when the PR opens.
- `roadmap.md`'s PH-09 row gets the PR link, with the README's diagram unchanged (◐ until the merge).

- [ ] **Step 5: Check and commit**

Run: `pnpm format:check`; `grep -rn "0029" docs/decisions/0008-hosting.md docs/decisions/0010-ci-cd.md` shows the status lines and six cell notes.

```bash
git add docs README.md
git commit -m "docs: record ADR 0029 and the AWS account in the living docs"
```

Then the PR: push, `gh pr create` with the template; the description lists the issue changes, `Closes #38` and `Closes #70`, and the owner steps done.
