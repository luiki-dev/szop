# Terraform

Terraform is an infrastructure as code (IaC) tool. Files ending in `.tf` describe the resources Szop needs on AWS, written in HashiCorp Configuration Language (HCL). `terraform plan` compares that description with what exists and lists the changes, and `terraform apply` makes them. Szop's Terraform code lives in `infra/`. **tenv**, a version manager, installs Terraform in the exact version the repository asks for.

## Contents

- [Why Szop uses it](#why-szop-uses-it)
- [Configuration](#configuration)
  - [The root modules](#the-root-modules)
  - [The version: tenv and .terraform-version](#the-version-tenv-and-terraform-version)
  - [The provider and its lock file](#the-provider-and-its-lock-file)
  - [State, the backend and the state lock](#state-the-backend-and-the-state-lock)
  - [Variables kept out of git](#variables-kept-out-of-git)
- [Everyday use](#everyday-use)
- [Updating](#updating)

## Why Szop uses it

- **Infrastructure as code, with every resource written out:** [ADR 0008](../../decisions/0008-hosting.md), decision 4. The demo is created and destroyed on demand, which only works when the whole environment is described in files; writing each resource out teaches what it is for.
- **Terraform, not OpenTofu:** ADR 0008, decision 5. The two are nearly identical; Terraform is the name in job ads and most documentation.
- **The version from tenv and `.terraform-version`:** [ADR 0029](../../decisions/0029-aws-account-and-terraform-bootstrap-details.md), decision 9. The same pattern as nvm and `.nvmrc`: one file holds the version, the owner's machine and CI both read it.
- **Checked on every change:** [ADR 0010](../../decisions/0010-ci-cd.md), decision 7. `pnpm check:infra` runs `terraform fmt`, `terraform validate` and [tflint](tflint.md), locally and in CI's `infra` job.

## Configuration

### The root modules

A **root module** is a folder of `.tf` files that Terraform runs as one unit, with its own state. Szop has three, applied separately, created in this order and destroyed in the reverse one (ADR 0008, decision 6):

| Folder | Holds | Applied by |
|---|---|---|
| `infra/bootstrap` | The S3 bucket for every module's state, and the budget alerts | The owner, once |
| `infra/base` (PH-10) | Permanent resources: DNS zone, certificate, image registry, secrets, log group | The owner |
| `infra/demo` (PH-12) | One demo session: network, load balancer, containers, database | CI's buttons, and the nightly teardown |

Each module splits its files by concern: `versions.tf` (the Terraform and provider versions), `providers.tf` (the AWS provider's settings), `variables.tf`, `outputs.tf`, `backend.tf` (where the state lives) and one file per group of resources.

### The version: tenv and .terraform-version

- **`.terraform-version`**, at the repository root, holds one exact version, such as `1.16.5`. tenv looks for it in the current folder and its parents, so it covers every module. CI reads the same file.
- **`required_version = "~> 1.16"`** in each module's `versions.tf` is a range: any 1.x from 1.16. It makes Terraform refuse to run with an older version, for example one installed some other way.
- `tenv tf install` installs the version of `.terraform-version`; `terraform` is then tenv's small wrapper, which runs that version.

### The provider and its lock file

A **provider** is the plugin that talks to one platform's API; Szop uses `hashicorp/aws`. `versions.tf` constrains it with `version = "~> 6.68"` (any 6.x from 6.68), and `providers.tf` configures it:

- `region = "eu-central-1"`, Frankfurt (ADR 0008, decision 8);
- `allowed_account_ids`, so Terraform stops if the credentials belong to any account but Szop's;
- `default_tags`, which every resource the module creates inherits: `project = "szop"` and the module's `group`, so Cost Explorer can show what each part costs (ADR 0008, decision 26).

**`.terraform.lock.hcl`** is the provider's lock file, committed next to the code, like `pnpm-lock.yaml`. It pins the exact provider version and the checksums of its downloads, so every machine and CI use the same build. Szop records the checksums for `linux_amd64`, the platform of WSL and of CI's runners.

### State, the backend and the state lock

Terraform's **state** is a JSON file mapping each resource in the code to the real object it created on AWS, with its attributes. Every `plan` reads it to know which objects belong to Terraform, asks AWS what they look like now, and compares both with the code. Without the state, Terraform would try to create everything again. Secret values never enter it (ADR 0008, decision 22).

The **backend** says where the state lives. Every module's `backend.tf` points at the S3 bucket `szop-tfstate-ntrtcr`, each under its own key (`bootstrap/terraform.tfstate`, later `base/…` and `demo/…`). The bucket is versioned, private and reachable only over TLS, so the state is shared by the owner's machine and CI, survives a lost laptop, and can be restored to an earlier version. A `backend` block cannot use variables, since Terraform reads it before anything else, so the bucket's name is written out.

Bootstrap creates that bucket, so its own first apply runs with a local `terraform.tfstate`, and its state then moves into the bucket ([the runbook](../../operations/demo-environment.md#applying-bootstrap)).

**`use_lockfile = true`** turns on the **state lock**: before a run changes anything, Terraform creates `<key>.tflock` next to the state with S3's conditional write ("only if it does not exist yet"), and deletes it at the end. A second run on the same module meanwhile stops with `Error acquiring the state lock`, instead of both writing the state and leaving it out of step with AWS. Older setups needed a DynamoDB table for this.

The **two lock files are unrelated**: `.terraform.lock.hcl` pins provider versions and is committed; `.tflock` guards the state during a run and exists only in the bucket, only while a run lasts.

### Variables kept out of git

Values that should not be public, such as the account ID and the alert address, are variables without defaults, set in a **`terraform.tfvars`** next to the module, which Terraform reads on its own. `.gitignore` ignores `*.tfvars`; a committed `terraform.tfvars.example` shows the shape. Each variable has a `validation` block, so a malformed value stops the run with a clear message before anything reaches AWS. A missing `terraform.tfvars` makes Terraform ask for each value at the prompt, unless the command has `-input=false`, as the runbook's first `plan` does: then it stops with `No value for required variable`.

## Everyday use

```bash
pnpm infra:fmt      # rewrite every .tf file in Terraform's style
pnpm check:infra    # fmt -check, validate every module, tflint; no AWS access
```

The pre-commit hook runs `terraform fmt` on staged `.tf` files ([husky and lint-staged](husky-and-lint-staged.md)).

Commands that reach AWS need short-lived credentials from IAM Identity Center ([AWS CLI](aws-cli.md)). In each new terminal:

```bash
export AWS_PROFILE=szop
aws sso login
cd infra/bootstrap
terraform init      # once per module and machine, or after the backend or providers change
terraform plan      # what would change; changes nothing
```

`terraform apply` and `terraform destroy` are the owner's steps, from the [runbook](../../operations/demo-environment.md). Read the plan before typing `yes`: it lists every resource to add, change or destroy, and a `-/+` (replace) on something permanent is a reason to stop.

`terraform init -backend=false`, as `check:infra` runs it, only downloads the providers: it needs no credentials and does not touch the state. The check gives each module its own data directory in `~/.cache/szop/terraform-check/`, separate from the module's `.terraform/`: once a module is initialized with its S3 backend, `init` in that `.terraform/` reloads the backend and asks for AWS credentials, even with `-backend=false`.

## Updating

**Terraform** (Dependabot does not update it):

1. On the [releases page](https://github.com/hashicorp/terraform/releases), pick the newest patch at least 7 days old, the cooldown Dependabot keeps.
2. Put it in `.terraform-version`; if the minor changes, raise `required_version` in every module's `versions.tf` too.
3. `tenv tf install`, then `pnpm check:infra` and `terraform plan` in each applied module: the plan must show no changes.
4. Commit as `build(infra): update Terraform to <version>`.

**The AWS provider:** Dependabot proposes it weekly, updating the constraint and `.terraform.lock.hcl` together (ADR 0029, decision 13). By hand:

```bash
export AWS_PROFILE=szop   # init reads the module's S3 backend, which needs credentials
terraform -chdir=infra/bootstrap init -upgrade
terraform -chdir=infra/bootstrap providers lock -platform=linux_amd64
```

A new major version comes as its own PR; read its upgrade guide before merging.
