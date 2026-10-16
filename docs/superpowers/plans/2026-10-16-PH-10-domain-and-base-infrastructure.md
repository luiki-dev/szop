# PH-10 Domain and base infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `dzwoniec.com` resolves through a Route 53 zone managed by `infra/base`, only Amazon may issue its certificates, SES has verified it with DKIM, DMARC `p=reject` and SPF `-all`, and the image registry, the Better Auth secret and the log group are ready for the first deploy.

**Architecture:** A new Terraform root module `infra/base`, laid out like `infra/bootstrap` (flat files by concern, state in the bucket `szop-tfstate-ntrtcr` under `base/terraform.tfstate`). The zone the domain purchase creates is adopted with an `import` block; the secret is written through a write-only argument from an ephemeral password, so its value never enters state. The owner buys the domain and applies the module from their machine; the runbook carries every step and check.

**Tech Stack:** Terraform 1.16.5 (tenv), `hashicorp/aws` ~> 6.68, `hashicorp/random` ~> 3.7, tflint with the AWS ruleset, Route 53, SES v2, ECR, SSM Parameter Store, CloudWatch Logs.

**Spec:** [`docs/superpowers/specs/2026-10-15-PH-10-domain-and-base-infrastructure-design.md`](../specs/2026-10-15-PH-10-domain-and-base-infrastructure-design.md)

## Global Constraints

- Domain `dzwoniec.com`; the app's name `szop.dzwoniec.com`. Written as `locals`, never as variables.
- Region `eu-central-1`; `allowed_account_ids = [var.account_id]`; default tags `project = "szop"`, `group = "base"`.
- Backend: bucket `szop-tfstate-ntrtcr`, key `base/terraform.tfstate`, region `eu-central-1`, `use_lockfile = true`, `encrypt = true`.
- `required_version = "~> 1.16"`; `hashicorp/aws` `~> 6.68`; `hashicorp/random` `~> 3.7`; `.terraform.lock.hcl` committed with `linux_amd64` checksums.
- No certificate in `infra/base`: it is created per session by `infra/demo` (PH-12).
- Secret values never enter Terraform state, git, plan output or logs.
- The zone has `prevent_destroy`; the ECR repository has `force_delete = false`.
- Every commit follows Conventional Commits and ends with the two attribution lines (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Claude-Session: https://claude.ai/code/session_01DvLvCcCAmybetR57mVqHW6`). Never commit to `main`; never apply, never merge.
- Docs: niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon; requirements linked, never plain IDs; long docs keep their `## Contents` in sync.
- Nothing that identifies the owner's account goes into a commit: no account ID, no portal URL, no email address. The hosted zone ID is not secret and is committed.
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit, `git push` the phase branch, then stop and summarize the task for the owner; start the next task only when the owner says so (`docs/superpowers/plans/CLAUDE.md`).

## Review Focus

1. **The import shows a change on the zone.** The registrar creates the zone with the comment `HostedZone created by Route53 Registrar`; if the code's `comment` differs, the first plan shows `1 to import … 1 to change` instead of a clean import. Task 5 reads the real comment before writing the resource.
2. **DKIM records with `for_each` over the tokens.** The tokens are unknown until SES creates the identity, and `for_each` over unknown values fails at plan time. Task 6 uses `count = 3`, a literal.
3. **A second TXT record on the apex.** Route 53 holds one TXT record set per name; a second `aws_route53_record` of type TXT for `dzwoniec.com` fails with "already exists". Task 6's comment says a later TXT value joins the SPF record's `records` list.
4. **The ECR lifecycle's rule order.** A `tagStatus = "any"` rule must have the highest `rulePriority` number (lowest priority), or ECR rejects the policy; a `v*` rule with a lower priority would not shield releases. Task 3 writes the order and the reason in a comment.
5. **Rotating the secret by changing the password's settings.** Changing `length` alone does nothing: a write-only value is sent only when `value_wo_version` changes. Task 4's comment and the runbook say rotation is a version bump.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `docs/operations/demo-environment.md` | Runbook: "Buying the domain", then "Applying base" | 1, 7 |
| `infra/base/versions.tf` | Terraform and provider version constraints | 2 |
| `infra/base/backend.tf` | S3 backend, key `base/terraform.tfstate` | 2 |
| `infra/base/providers.tf` | AWS provider: region, account guard, default tags | 2 |
| `infra/base/variables.tf` | `account_id` | 2 |
| `infra/base/locals.tf` | `domain`, `app_hostname` | 2 |
| `infra/base/terraform.tfvars.example` | Shape of the gitignored `terraform.tfvars` | 2 |
| `infra/base/.terraform.lock.hcl` | Provider lock file | 2 |
| `infra/base/registry.tf` | ECR repository and lifecycle policy | 3 |
| `infra/base/logs.tf` | Log group `/szop/app` | 3 |
| `infra/base/secrets.tf` | Ephemeral password, SSM parameter | 4 |
| `infra/base/dns.tf` | Imported zone, CAA, null MX | 5 |
| `infra/base/email.tf` | SES identity, DKIM, DMARC, SPF | 6 |
| `infra/base/outputs.tf` | Outputs for PH-11, PH-12 and the runbook | 3–6 (one output per resource, added with it) |
| `docs/development/tools/terraform.md` | `base` in the modules table; importing; ephemeral values and write-only arguments; the `random` provider | 7 |
| `docs/decisions/0030-domain-and-base-infrastructure-details.md` | ADR 0030 | 8 |
| ADRs 0008 and 0010; `architecture.md`; `stack-overview.md`; `threat-model.md`; `phase-walkthrough.md`; `glossary.md` | Notes and living docs | 8 |
| `docs/roadmap.md`; `README.md` | PH-10, PH-12, Stage 3 exit, new PH-34, diagram | 8 |

---

### Task 1: The runbook's "Buying the domain"

The owner needs it first: the zone ID it produces unblocks Task 5.

**Files:**
- Modify: `docs/operations/demo-environment.md`

**Interfaces:**
- Produces: the heading `## Buying the domain` (anchor `#buying-the-domain`), which Task 7's "Applying base" and Task 8's roadmap entry link to; the zone ID, read by the owner, which Task 5 needs.

- [x] **Step 1: Update the module table's `infra/base` row (line 8)**

Replace the row with:

```markdown
| `infra/base` | Permanent resources: the DNS zone, the email identity, the image registry, the Better Auth secret, the log group | From the owner's machine, when it changes | [Buying the domain](#buying-the-domain), [Applying base](#applying-base) |
```

(The "Applying base" link resolves once Task 7 adds the chapter.)

- [x] **Step 2: Add the chapter after "Destroying bootstrap" and before "Coming later"**

```markdown
## Buying the domain

Szop's domain is `dzwoniec.com`, registered through Route 53, AWS's DNS service and domain registrar; the app lives at `szop.dzwoniec.com` ([ADR 0030](../decisions/0030-domain-and-base-infrastructure-details.md), decisions 1 and 2). Buying it is done once, by hand: Terraform can only manage what exists.

**Before you click:**

- **It is paid at once, by card, and not refundable.** A `.com` costs about $15 a year. AWS promotional credits do not cover domain registrations.
- **The budget alert fires this month.** `szop-monthly` alerts when the actual cost passes $10, and it ignores credits, so the registration triggers the email. That is expected, not a forgotten demo.
- Sign in to the console through the access portal, not as root.

**Register it:**

1. *Route 53 → Domains → Registered domains → Register domains.* Search for `dzwoniec.com`, *Select*, *Proceed to checkout*.
2. **Duration:** 1 year. **Auto-renew: on.** Without it, the domain lapses after a year and anyone can buy it.
3. **Contacts:** your real name, address, phone and email, the same for the registrant, administrative and technical contacts. ICANN (the body that runs domain names) requires them to be accurate.
4. **Privacy protection: on** for every contact (the default): WHOIS, the public lookup of domain owners, then shows the registrar's details instead of yours.
5. Review, accept the terms, *Submit*. *Route 53 → Domains → Requests* shows the progress; registration takes minutes, sometimes hours.

**Right after:**

1. **Confirm the registrant email.** ICANN's rules make the registrar send a verification link to the registrant address. **If it is not clicked within 15 days, the domain is suspended**: it stops resolving until it is.
2. **Transfer lock.** *Registered domains → `dzwoniec.com`*: *Transfer lock* is **On**. It stops the domain being moved to another registrar without you.
3. **The hosted zone.** Registration creates a **hosted zone** for `dzwoniec.com` on its own: the container of the domain's DNS records, served by four AWS name servers, which the registration points at. Read its ID:

   ```bash
   aws route53 list-hosted-zones-by-name --dns-name dzwoniec.com \
     --query 'HostedZones[0].[Id,Config.Comment]' --output text
   #   /hostedzone/Z0123456789ABCDEFGHIJ   HostedZone created by Route53 Registrar
   ```

   The part after `/hostedzone/` is the zone ID. It is not secret: `infra/base` commits it in its `import` block, which hands the zone to Terraform ([Applying base](#applying-base)).

**Check:**

```bash
aws route53domains get-domain-detail --region us-east-1 --domain-name dzwoniec.com \
  --query '[AutoRenew,StatusList,Nameservers[].Name]'
#   true, a status list with "clientTransferProhibited", and four ns-….awsdns-… names
dig +short NS dzwoniec.com
#   the same four names (empty for a while after registration; DNS takes time to catch up)
```

The domains API exists only in `us-east-1`, hence `--region`.

⚠️ **Don't:**

- delete or recreate the hosted zone: a new zone gets different name servers, and the whole domain stops resolving until the registration points at them and caches expire, up to two days;
- add records to the zone by hand: `infra/base` owns its records, and a hand-made one makes Terraform fail with "already exists";
- turn auto-renew off.
```

- [x] **Step 3: Update Contents and "Coming later"**

In `## Contents`, add `- [Buying the domain](#buying-the-domain)` after the "Destroying bootstrap" line. In "Coming later", replace the first bullet with:

```markdown
- **Applying `infra/base`**: the zone, the email identity, the registry, the secret and the log group ([PH-10](../roadmap.md#ph-10-domain-and-base-infrastructure)).
```

- [x] **Step 4: Check formatting**

Run: `pnpm exec prettier --check docs/operations/demo-environment.md`
Expected: `All matched files use Prettier code style!`

- [x] **Step 5: Commit, push and hand over**

```bash
git add docs/operations/demo-environment.md
git commit -m "docs: add buying the domain to the runbook"
git push
```

Tell the owner the chapter is ready (owner step 1), and that Task 5 needs the zone ID and the comment the command prints. Go on with Tasks 2 to 4 meanwhile.

---

### Task 2: The skeleton of `infra/base`

**Files:**
- Create: `infra/base/versions.tf`, `infra/base/backend.tf`, `infra/base/providers.tf`, `infra/base/variables.tf`, `infra/base/locals.tf`, `infra/base/terraform.tfvars.example`, `infra/base/.terraform.lock.hcl`

**Interfaces:**
- Produces: `local.domain` (`"dzwoniec.com"`), `local.app_hostname` (`"szop.dzwoniec.com"`), `var.account_id`, the `aws` and `random` providers. Later tasks use these names exactly.

- [x] **Step 1: `versions.tf`**

```hcl
terraform {
  # Any 1.x from 1.16; the exact version is in .terraform-version. Write-only
  # arguments (secrets.tf) need 1.11 or later.
  required_version = "~> 1.16"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.68"
    }
    # The ephemeral password of secrets.tf.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}
```

- [x] **Step 2: `backend.tf`**

```hcl
# Base's state, in the bucket bootstrap created (ADR 0008, decision 7). S3's
# native lock: a .tflock file next to the state, no DynamoDB table.
terraform {
  backend "s3" {
    bucket       = "szop-tfstate-ntrtcr"
    key          = "base/terraform.tfstate"
    region       = "eu-central-1"
    use_lockfile = true
    encrypt      = true
  }
}
```

- [x] **Step 3: `providers.tf`**

```hcl
provider "aws" {
  region = "eu-central-1"

  # Terraform stops if the credentials belong to any other account.
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      project = "szop"
      group   = "base"
    }
  }
}
```

- [x] **Step 4: `variables.tf`**

```hcl
variable "account_id" {
  description = "The ID of Szop's AWS account; Terraform refuses to run against any other."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "account_id must be the 12-digit AWS account ID, in quotes."
  }
}
```

- [x] **Step 5: `locals.tf`**

```hcl
# The domain is public and never varies, so it is written here rather than
# kept in terraform.tfvars (ADR 0030).
locals {
  domain       = "dzwoniec.com"
  app_hostname = "szop.${local.domain}"
}
```

- [x] **Step 6: `terraform.tfvars.example`**

```hcl
# Copy to terraform.tfvars (ignored by git) and fill in; see
# docs/operations/demo-environment.md, "Applying base".
account_id = "123456789012"
```

- [x] **Step 7: The lock file**

```bash
terraform -chdir=infra/base providers lock -platform=linux_amd64
```

Expected: `Success! Terraform has updated the lock file.`, and `infra/base/.terraform.lock.hcl` lists `hashicorp/aws` and `hashicorp/random`. `providers lock` reads only the configuration and the registry: no backend, no AWS credentials. If it asks for credentials, run `export TF_DATA_DIR=$(mktemp -d)` first and unset it afterwards.

- [x] **Step 8: Run the infra check**

Run: `pnpm check:infra`
Expected: `==> terraform validate infra/base/` followed by `Success! The configuration is valid.`, then tflint with no findings. tflint's `terraform_unused_declarations` may flag `local.app_hostname` as unused; if it does, add the `app_hostname` output now (Task 6's output block) instead of disabling the rule.

- [x] **Step 9: Commit**

```bash
git add infra/base
git status --short infra/base   # no terraform.tfvars, no .terraform/
git commit -m "feat(infra): add the skeleton of infra/base"
```

---

### Task 3: The image registry and the log group

**Files:**
- Create: `infra/base/registry.tf`, `infra/base/logs.tf`, `infra/base/outputs.tf`

**Interfaces:**
- Consumes: the providers of Task 2.
- Produces: `aws_ecr_repository.app`, `aws_cloudwatch_log_group.app`; outputs `ecr_repository_url`, `log_group_name`.

- [x] **Step 1: `registry.tf`**

```hcl
# The one image repository (ADR 0008, decisions 12 and 13; ADR 0030). Tags are
# immutable, so a published version can never be overwritten. Basic scanning
# on push is free; scanning in CI is OP-090. force_delete = false: Terraform
# refuses to destroy the repository while it holds images.
resource "aws_ecr_repository" "app" {
  name                 = "szop"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }
}

# ECR has no "keep" action, only "expire". An image matched by a rule can
# never be expired by a rule of lower priority (a higher rulePriority number),
# so rule 1 shields released images by matching them with a count that is
# never reached. Rule 2 must stay last: ECR requires the tagStatus "any" rule
# to have the highest rulePriority. A release image carries its commit hash
# and its v* version on the same digest, so rule 1 matches it. Commit hashes
# are hexadecimal and never start with "v".
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep released images: v* tags are never expired."
        selection = {
          tagStatus      = "tagged"
          tagPatternList = ["v*"]
          countType      = "imageCountMoreThan"
          countNumber    = 9999
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep the newest 10 of the rest."
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      },
    ]
  })
}
```

- [x] **Step 2: `logs.tf`**

```hcl
# The app's log lines (ADR 0008, decision 27). In base, so a session's logs
# survive its teardown; PH-12's task definition writes to it.
resource "aws_cloudwatch_log_group" "app" {
  name              = "/szop/app"
  retention_in_days = 7
}
```

- [x] **Step 3: `outputs.tf`**

```hcl
output "ecr_repository_url" {
  description = "Where images are pushed and pulled: <account>.dkr.ecr.eu-central-1.amazonaws.com/szop."
  value       = aws_ecr_repository.app.repository_url
}

output "log_group_name" {
  description = "The CloudWatch log group the app writes to."
  value       = aws_cloudwatch_log_group.app.name
}
```

- [x] **Step 4: Check the rule-priority claim**

Open AWS's ECR documentation, "Lifecycle policy properties" and "How lifecycle policies work". Confirm the two rules this file's comment relies on: an image matched by a higher-priority rule is not expired by a lower one, and the `tagStatus: any` rule must have the highest `rulePriority`. If either is worded differently, correct the comment and note it for ADR 0030's "Settled while building".

- [x] **Step 5: Run the infra check**

Run: `pnpm check:infra`
Expected: validate succeeds for `infra/base/`; tflint has no findings.

- [x] **Step 6: Commit**

```bash
git add infra/base
git commit -m "feat(infra): add the image registry and the log group to base"
```

---

### Task 4: The Better Auth secret

**Files:**
- Create: `infra/base/secrets.tf`
- Modify: `infra/base/outputs.tf`

**Interfaces:**
- Consumes: the `random` provider of Task 2.
- Produces: `aws_ssm_parameter.better_auth_secret`; output `better_auth_secret_arn` (PH-12's task execution role and task definition use it).

- [ ] **Step 1: `secrets.tf`**

```hcl
# The Better Auth signing secret (ADR 0008, decisions 21 and 22; ADR 0030).
# Secret values never enter Terraform state: the password is ephemeral (never
# stored in state or plan files) and reaches AWS through value_wo, a
# write-only argument, so state keeps only value_wo_version.
#
# Letters and digits only, so the value never needs quoting in an
# environment variable.
ephemeral "random_password" "better_auth_secret" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "better_auth_secret" {
  name     = "/szop/better-auth-secret"
  type     = "SecureString"
  value_wo = ephemeral.random_password.better_auth_secret.result

  # A write-only value is sent only when this number changes. To rotate the
  # secret, raise it by one and apply: a new password is generated and stored,
  # and the app reads it at its next start, which signs everyone out. Changing
  # the password's settings alone sends nothing.
  value_wo_version = 1
}
```

- [ ] **Step 2: Add the output to `outputs.tf`**

```hcl
output "better_auth_secret_arn" {
  description = "The ARN of the Better Auth secret, for the task definition's secrets and the task execution role."
  value       = aws_ssm_parameter.better_auth_secret.arn
}
```

- [ ] **Step 3: Run the infra check**

Run: `pnpm check:infra`
Expected: validate succeeds (this is the check that the provider supports `value_wo` and the ephemeral `random_password`; it passed in the brainstorm on aws 6.69.1 and random 3.9.1); tflint has no findings.

- [ ] **Step 4: Confirm nothing secret is in the configuration**

Run: `grep -rn "value " infra/base/secrets.tf`
Expected: no output. Only `value_wo` and `value_wo_version` are set; a plain `value` argument would put the secret in state.

- [ ] **Step 5: Commit**

```bash
git add infra/base
git commit -m "feat(infra): add the Better Auth secret, written write-only"
```

---

### Task 5: The zone, CAA and null MX

**Blocked until the owner has bought the domain and sent the zone ID and comment (Task 1's hand-over).**

**Files:**
- Create: `infra/base/dns.tf`
- Modify: `infra/base/outputs.tf`

**Interfaces:**
- Consumes: `local.domain`.
- Produces: `aws_route53_zone.main` (Task 6 writes records into `aws_route53_zone.main.zone_id`); outputs `zone_id`, `domain_name`.

- [ ] **Step 1: Get the zone ID and comment**

From the owner, or, with the owner's go-ahead and a current `aws sso login`, by running Task 1's command:

```bash
AWS_PROFILE=szop aws route53 list-hosted-zones-by-name --dns-name dzwoniec.com \
  --query 'HostedZones[0].[Id,Config.Comment]' --output text
```

Write down the ID without `/hostedzone/`, and the comment exactly.

- [ ] **Step 2: `dns.tf`**

Replace `<ZONE_ID>` with the ID from Step 1, and the `comment` with the exact comment if it differs from the one below.

```hcl
# The domain's hosted zone (ADR 0030, decisions 3 and 4). Registering the
# domain through Route 53 created it, and the registration points at its four
# name servers. This block hands it to Terraform: the first plan shows it
# imported, not created. The block does nothing once the zone is in state,
# and stays to record where the zone came from.
import {
  to = aws_route53_zone.main
  id = "<ZONE_ID>"
}

# Never destroyed: a new zone gets new name servers, and the whole domain
# stops resolving until the registration points at them. The zone's own NS
# and SOA records are AWS's and stay outside Terraform. The comment is the
# registrar's, kept so the import changes nothing.
resource "aws_route53_zone" "main" {
  name    = local.domain
  comment = "HostedZone created by Route53 Registrar"

  lifecycle {
    prevent_destroy = true
  }
}

# Only Amazon's certificate authority may issue certificates for the domain
# and its subdomains; every other authority must refuse, even if an attacker
# passes its validation. A page served through another authority (for
# example GitHub Pages, with Let's Encrypt) adds that authority here.
resource "aws_route53_record" "caa" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain
  type    = "CAA"
  ttl     = 3600
  records = ["0 issue \"amazon.com\""]
}

# Null MX (RFC 7505): the domain receives no mail, so senders fail at once
# instead of retrying for days. A mailbox on the domain replaces it.
resource "aws_route53_record" "null_mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain
  type    = "MX"
  ttl     = 3600
  records = ["0 ."]
}
```

- [ ] **Step 3: Check the CAA value**

Open AWS's ACM documentation, "(Optional) Configure a CAA record". Confirm that `amazon.com` alone lets ACM issue (AWS lists `amazon.com`, `amazontrust.com`, `awstrust.com` and `amazonaws.com` as equivalent). If the page requires more than one, add them to `records`, one string each.

- [ ] **Step 4: Add the outputs to `outputs.tf`**

```hcl
output "zone_id" {
  description = "The hosted zone of dzwoniec.com; infra/demo writes the szop record and the certificate's validation record into it."
  value       = aws_route53_zone.main.zone_id
}

output "domain_name" {
  description = "The domain."
  value       = local.domain
}
```

- [ ] **Step 5: Run the infra check**

Run: `pnpm check:infra`
Expected: validate succeeds; tflint has no findings.

- [ ] **Step 6: Commit**

```bash
git add infra/base
git commit -m "feat(infra): import the domain's zone into base, with CAA and null MX"
```

---

### Task 6: Email: the SES identity, DKIM, DMARC and SPF

**Files:**
- Create: `infra/base/email.tf`
- Modify: `infra/base/outputs.tf`

**Interfaces:**
- Consumes: `aws_route53_zone.main.zone_id`, `local.domain`, `local.app_hostname`.
- Produces: `aws_sesv2_email_identity.domain`; output `app_hostname`.

- [ ] **Step 1: `email.tf`**

```hcl
# SES's sender identity is the whole domain (ADR 0030, decision 7): Szop may
# send from the apex or any subdomain, and the address is chosen in PH-18.
# Easy DKIM: SES signs every message with keys it rotates itself, and the
# domain is verified once the three DKIM records below resolve.
resource "aws_sesv2_email_identity" "domain" {
  email_identity = local.domain

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

# One CNAME per DKIM token. count is a literal 3, not the tokens' length:
# the tokens are unknown until SES creates the identity, and count or
# for_each over unknown values fails at plan time. Easy DKIM always returns
# three.
resource "aws_route53_record" "dkim" {
  count = 3

  zone_id = aws_route53_zone.main.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${local.domain}"
  type    = "CNAME"
  ttl     = 3600
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# DMARC: receivers reject mail that claims to be from the domain but fails
# DKIM and SPF, which covers every subdomain too. Alignment stays relaxed
# (the default), so mail from an address on szop.dzwoniec.com aligns with
# DKIM's d=dzwoniec.com. No report address (rua): the domain has no mailbox.
resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.${local.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=reject"]
}

# SPF: no server may send with the domain as its envelope sender. SES uses
# its own amazonses.com envelope, so Szop's mail passes DMARC through DKIM.
# Route 53 keeps one TXT record set per name: a later TXT value on the apex
# joins this records list instead of becoming a second resource.
resource "aws_route53_record" "apex_txt" {
  zone_id = aws_route53_zone.main.zone_id
  name    = local.domain
  type    = "TXT"
  ttl     = 3600
  records = ["v=spf1 -all"]
}
```

- [ ] **Step 2: Add the output to `outputs.tf`**

```hcl
output "app_hostname" {
  description = "The app's name; infra/demo points it at the load balancer and issues its certificate."
  value       = local.app_hostname
}
```

(Skip if Task 2 already added it.)

- [ ] **Step 3: Check the DKIM attribute**

Run: `pnpm check:infra`
Expected: `validate` succeeds, which confirms `dkim_signing_attributes[0].tokens` exists in the provider's schema (a wrong attribute fails with "Unsupported attribute"). tflint has no findings.

- [ ] **Step 4: Commit**

```bash
git add infra/base
git commit -m "feat(infra): add the SES identity with DKIM, DMARC and SPF to base"
```

---

### Task 7: The runbook's "Applying base", and the Terraform page

**Files:**
- Modify: `docs/operations/demo-environment.md`, `docs/development/tools/terraform.md`

**Interfaces:**
- Consumes: the resource count of Tasks 3 to 6: 1 to import (the zone) and 12 to add (repository, lifecycle policy, log group, parameter, CAA, MX, identity, 3 DKIM records, DMARC, apex TXT).
- Produces: the heading `## Applying base` (anchor `#applying-base`).

- [ ] **Step 1: Add "Applying base" after "Buying the domain"**

```markdown
## Applying base

`infra/base` holds what outlives every demo: the domain's zone with its CAA, MX and mail records, SES's identity for `dzwoniec.com`, the image registry `szop`, the Better Auth secret and the log group `/szop/app` ([ADR 0030](../decisions/0030-domain-and-base-infrastructure-details.md)). It is applied from your machine after [Buying the domain](#buying-the-domain), and again whenever its code changes: first from the PR's branch, then from `main` after the merge.

### The first apply

```bash
export AWS_PROFILE=szop
aws sso login
cd ~/workspace/szop/infra/base
cp terraform.tfvars.example terraform.tfvars   # the first time only
```

Edit `terraform.tfvars`: your 12-digit account ID, in quotes. git ignores the file.

```bash
terraform init                  # "Terraform has been successfully initialized!"
terraform plan -input=false     # read it: "Plan: 1 to import, 12 to add, 0 to change, 0 to destroy."
terraform apply                 # the same plan; type yes
```

The zone is the one to **import**: Terraform adopts the zone the purchase created, and its name servers stay as they are. The twelve to add are the registry and its lifecycle policy, the log group, the secret, the CAA and MX records, the SES identity, its three DKIM records, and the DMARC and SPF records. The secret's value appears nowhere in the plan: it is generated during `apply`, sent to AWS and forgotten.

⚠️ **Stop** if the plan shows the zone as `+ create`, `-/+` or `~ update`: the import did not match. Compare the zone ID and comment in `dns.tf` with [Buying the domain](#buying-the-domain)'s command.

### Checks

```bash
terraform plan                  # "No changes. Your infrastructure matches the configuration."
terraform plan -destroy         # must end with an error: "Instance cannot be destroyed" (the zone)

dig +short NS dzwoniec.com      # the four ns-….awsdns-… names of the registration
dig +short CAA dzwoniec.com     # 0 issue "amazon.com"
dig +short MX dzwoniec.com      # 0 .
dig +short TXT dzwoniec.com     # "v=spf1 -all"
dig +short TXT _dmarc.dzwoniec.com   # "v=DMARC1; p=reject"

aws sesv2 get-email-identity --email-identity dzwoniec.com \
  --query '[VerifiedForSendingStatus,DkimAttributes.Status]'
#   [true, "SUCCESS"]; minutes to an hour after the apply, while the DKIM records spread

aws resourcegroupstaggingapi get-resources --tag-filters Key=group,Values=base \
  --query 'ResourceTagMappingList[].ResourceARN'
#   the zone, the repository, the log group, the parameter and the SES identity
```

**The secret is not in the state.** Once, after the first apply, and after every rotation:

```bash
secret=$(aws ssm get-parameter --name /szop/better-auth-secret --with-decryption \
  --query Parameter.Value --output text)
terraform state pull | grep -c -- "$secret"   # must print 0
unset secret
```

### Rotating the Better Auth secret

In `secrets.tf`, raise `value_wo_version` by one, commit it on a branch, and apply as above: the plan shows one change, `~ value_wo_version`. Terraform generates a new password and overwrites the parameter. A running demo keeps the old value until its task restarts; the new value signs everyone out, which a demo can afford. Then repeat the state check.

⚠️ **Don't:**

- set the parameter's value by hand: the next rotation overwrites it, and the code no longer says where it came from;
- add a `value` argument to the parameter "to see it": it would write the secret into the state;
- remove `prevent_destroy` from the zone, or run `terraform destroy` here, unless Szop is shut down for good, after `infra/demo` is destroyed.
```

- [ ] **Step 2: Update Contents and "Coming later"**

In `## Contents`, after `- [Buying the domain](#buying-the-domain)`:

```markdown
- [Applying base](#applying-base)
  - [The first apply](#the-first-apply)
  - [Checks](#checks)
  - [Rotating the Better Auth secret](#rotating-the-better-auth-secret)
```

In "Coming later", delete the "Applying `infra/base`" bullet. In the module table, the `infra/base` row already links both chapters (Task 1).

- [ ] **Step 3: The Terraform page**

In `docs/development/tools/terraform.md`:

- In the root modules table, replace the `infra/base` row with: `| \`infra/base\` | Permanent resources: the DNS zone, the email identity, the image registry, the Better Auth secret, the log group | The owner |`.
- Under "The provider and its lock file", after the first paragraph, add: "`infra/base` also uses **`hashicorp/random`** (`~> 3.7`), for the ephemeral password of its secret."
- Add a section `### Importing what already exists` after "Variables kept out of git":

  ```markdown
  ### Importing what already exists

  Some resources exist before Terraform knows them: buying the domain created its hosted zone. An **`import` block** names the resource in the code and the ID of the real object; the next plan shows it as *import* instead of *create*, and `apply` writes it into the state without touching AWS. The configuration must describe the object as it is, or the same plan also shows a change. `infra/base/dns.tf` imports the zone this way ([ADR 0030](../../decisions/0030-domain-and-base-infrastructure-details.md), decision 4). The block stays in the code: once the resource is in state it does nothing.
  ```

- Add a section `### Secrets: ephemeral values and write-only arguments` after it:

  ```markdown
  ### Secrets: ephemeral values and write-only arguments

  **Secret values never enter the state** ([ADR 0030](../../decisions/0030-domain-and-base-infrastructure-details.md), decision 10). Two features from Terraform 1.10 and 1.11 make that possible for a secret Terraform creates:

  - an **ephemeral resource** (`ephemeral "random_password" …`) produces a value during a run and is never written to the state or a plan file;
  - a **write-only argument** (`value_wo` on `aws_ssm_parameter`) sends a value to AWS but never stores it. Since Terraform cannot compare what it never kept, a version number beside it (`value_wo_version`) decides when the value is sent again: raising it rotates the secret.

  Where a resource has no write-only argument, the secret is created outside Terraform and the code refers only to its name. The runbook's [state check](../../operations/demo-environment.md#checks) confirms it after each apply.
  ```

- In `## Contents`, add the two new `###` headings under "Configuration".
- In "Updating", in the AWS provider's commands, add a line for base after bootstrap's: `terraform -chdir=infra/base init -upgrade` and `terraform -chdir=infra/base providers lock -platform=linux_amd64`, and change "The AWS provider" to "The providers (AWS, and random in base)".

- [ ] **Step 4: Check formatting**

Run: `pnpm exec prettier --check docs/operations/demo-environment.md docs/development/tools/terraform.md`
Expected: all files pass.

- [ ] **Step 5: Commit**

```bash
git add docs/operations/demo-environment.md docs/development/tools/terraform.md
git commit -m "docs: add applying base to the runbook and the Terraform page"
```

---

### Task 8: ADR 0030, the living docs, the roadmap and GitHub

**Files:**
- Create: `docs/decisions/0030-domain-and-base-infrastructure-details.md`
- Modify: `docs/decisions/0008-hosting.md`, `docs/decisions/0010-ci-cd.md`, `docs/architecture/architecture.md`, `docs/architecture/stack-overview.md`, `docs/architecture/threat-model.md`, `docs/development/phase-walkthrough.md`, `docs/glossary.md`, `docs/roadmap.md`, `README.md`

**Interfaces:**
- Consumes: the spec's decisions table; anything Tasks 3, 5 and 6 settled while building.
- Produces: ADR 0030 with decisions numbered as in the spec (1 to 13), which Tasks 1, 2, 4, 5, 6 and 7 already link by number.

- [ ] **Step 1: ADR 0030**

Write `docs/decisions/0030-domain-and-base-infrastructure-details.md` in ADR 0029's shape:

```markdown
# ADR 0030 — Domain and base infrastructure details

- **Status:** ✅ Accepted
- **Date:** <the commit's date>
- **Refines:** [ADR 0008](0008-hosting.md), decisions 6 (the certificate leaves base, see decision 5), 12 (the registry's lifecycle, see decision 9) and 17 (the domain, the app's name and the certificate, see decisions 1, 2 and 5); [ADR 0010](0010-ci-cd.md), decisions 11 and 16 (the app's name; the deploy role manages the session's certificate, see decision 5)
- **Completes:** [ADR 0008](0008-hosting.md), decisions 22 (secrets never in state, see decision 10), 24 (SES's identity, DMARC and SPF, see decisions 7 and 8) and 27 (the log group, see decision 11)
```

`## Context`: PH-10 builds the permanent part of `infra/base`; ADR 0008 set the direction (decisions 6, 12, 13, 17, 21, 22, 24, 27) and left the details to the phase, among them OP-013's lifecycle, OP-016's rule for secrets and OP-044's DMARC and SPF; the brainstorm also found that the domain may later hold other apps, and that ACM does not renew a certificate nobody uses. Two to three short paragraphs, in ADR 0029's style.

`## Decisions`: the spec's table, rows 1 to 13, with the columns `# | Topic | Options considered | Decision and reasoning`, the decisions' wording kept. Add `<br>**Settled while building:** …` to a row only for what Tasks 3, 5 and 6 changed (a corrected comment, a CAA value, the zone's comment).

`## Consequences`:

- PH-12 creates the certificate for `szop.dzwoniec.com` and its validation record in `infra/demo`, and its deploy role (PH-11) may request and delete ACM certificates and write that record, besides the `szop` record.
- PH-18 chooses the sender address on `dzwoniec.com` or a subdomain, and verifies the recipients the owner tests with, since SES stays in its sandbox.
- PH-34 serves a page on `dzwoniec.com` and redirects `szop.dzwoniec.com` to it while no demo runs; the CAA record then gains that page's authority if it is not Amazon's.
- A future app on `dzwoniec.com` adds its records to the zone from its own code, finding the zone by name, and sends mail only DKIM-signed for the domain, or DMARC rejects it.
- Costs: the zone $0.50 a month, the domain about $15 a year, a few cents for images and logs.

- [ ] **Step 2: Notes in ADRs 0008 and 0010**

ADR 0008's status line: append "; decisions 6, 12 and 17 refined and decisions 22, 24 and 27 completed by [ADR 0030](0030-domain-and-base-infrastructure-details.md) (the domain `dzwoniec.com` with the app at `szop.dzwoniec.com`, the certificate created per session in `infra/demo`, the registry's lifecycle, write-only secrets, SES at the apex with DMARC and SPF, the log group)". At the bottom of each decision's cell:

- 6: `<br>✏️ **Refined by [ADR 0030](0030-domain-and-base-infrastructure-details.md), decision 5:** the certificate is created per session in \`infra/demo\`, since ACM does not renew an unused one.`
- 12: `<br>✏️ **Refined by [ADR 0030](0030-domain-and-base-infrastructure-details.md), decision 9:** the lifecycle keeps every \`v*\` image and the newest 10 of the rest.`
- 17: `<br>✏️ **Refined by [ADR 0030](0030-domain-and-base-infrastructure-details.md), decisions 1, 2 and 5:** the domain is \`dzwoniec.com\` and the app \`szop.dzwoniec.com\`; the certificate is created per session in \`infra/demo\`.`
- 22: `<br>🧩 **Completed by [ADR 0030](0030-domain-and-base-infrastructure-details.md), decision 10:** a hard rule: a write-only argument, or a value created outside Terraform; the Better Auth secret from an ephemeral password through \`value_wo\`.`
- 24: `<br>🧩 **Completed by [ADR 0030](0030-domain-and-base-infrastructure-details.md), decisions 7 and 8:** the identity is \`dzwoniec.com\`; DMARC \`p=reject\`, SPF \`-all\`, no custom MAIL FROM.`
- 27: `<br>🧩 **Completed by [ADR 0030](0030-domain-and-base-infrastructure-details.md), decision 11:** the log group \`/szop/app\`.`

ADR 0010's status line: append "; decisions 11 and 16 refined by [ADR 0030](0030-domain-and-base-infrastructure-details.md) (the app at `szop.dzwoniec.com`; the certificate created per session)". Cells 11 and 16: `<br>✏️ **Refined by [ADR 0030](0030-domain-and-base-infrastructure-details.md), decisions 1 and 5:** the app's name is \`szop.dzwoniec.com\`; the certificate and its validation record are created per session in \`infra/demo\`, so the deploy role manages them.` (cell 11 with decision 1 only and its first clause only).

- [ ] **Step 3: The living docs**

- `architecture.md`, section 5: the diagram's line becomes `HTTPS  szop.dzwoniec.com  (Route 53 DNS, ACM certificate per session)`; the "Email" bullet: "through SES, with `dzwoniec.com` as its identity (DKIM-signed; DMARC `p=reject` and SPF `-all` refuse forgeries), in its sandbox, which delivers only to verified addresses"; the "Infrastructure as code" bullet's `base` list: "image registry, DNS zone (imported from the registration, never destroyed), email identity, the Better Auth secret, log group, …", and `demo`'s: "network, load balancer, the certificate, ECS, RDS".
- `stack-overview.md`, section 12: in "Infrastructure as code and Terraform", base's list without "certificate"; the Route 53 and ACM row: Szop's use "The domain `dzwoniec.com` and its zone; `szop.dzwoniec.com` pointing at the load balancer, with a certificate created for each session (ACM renews only certificates in use)"; the SES row: "Verification and password-reset emails, signed with DKIM for `dzwoniec.com`"; steps 2 and 4 of "A demo session" use `szop.dzwoniec.com`, and step 2 adds "requests its certificate". Add a `### Domains, DNS and email authentication` subsection before "The pieces, from the network inwards", explaining in plain words: registry, registrar and name servers; the hosted zone and why recreating it breaks the domain; record types A/alias, CNAME, TXT, MX, CAA; DKIM, SPF and DMARC and how they work together (SES's envelope sender, alignment, `p=reject`); null MX. Add it to Contents.
- `threat-model.md`: in "Entry points, checked against STRIDE", a row (or entries in the existing table's shape) for **mail in the domain's name** (spoofing; guarded by DKIM, DMARC `p=reject`, SPF `-all`, null MX) and **certificates for the domain** (spoofing; CAA allows only Amazon); in "What we protect", the Better Auth secret: in SSM only, never in state, git or logs, rotated by a version bump. Keep the document's existing table shapes.
- `phase-walkthrough.md`, lines 166 and 319: `demo.<domain>` → `szop.dzwoniec.com`.
- `glossary.md`, Acronyms: add **CAA** (Certification Authority Authorization: a DNS record naming the certificate authorities allowed to issue certificates for a domain; Szop's allows only Amazon), **ICANN** (Internet Corporation for Assigned Names and Numbers: the body that runs the domain name system's registries and accredits registrars), **MX** (Mail Exchanger: the DNS record naming the servers that receive a domain's mail; Szop's is a null MX, `0 .`, saying it receives none). Change DNS's example from `demo.example.com` to `szop.dzwoniec.com`. In the terms section (or Acronyms, whichever holds non-acronyms), add **hosted zone** and **WHOIS** if the glossary lists terms; check the file's sections first and follow them.

- [ ] **Step 4: The roadmap and the README**

In `docs/roadmap.md`:

- Stage 3's **Exit:** "one button creates a demo of any commit at `szop.dzwoniec.com`, a nightly run destroys it, `dzwoniec.com` shows whether it is up, and `v0.1.0` is released."
- Stage 3's table: after PH-13's row, `| [PH-34 Landing page and demo status](#ph-34-landing-page-and-demo-status) | ⬜ Not started | — | — | — | [#<new issue>](https://github.com/luiki-dev/szop/issues/<new issue>) |` (the issue number from Step 5). PH-10's row: the Plan link `[Plan](superpowers/plans/2026-10-16-PH-10-domain-and-base-infrastructure.md)`.
- PH-10's entry:

  ```markdown
  - **Goal:** Szop's domain `dzwoniec.com` resolves through Route 53, only Amazon may issue certificates for it, and Amazon Simple Email Service (SES) has verified it and tells receivers to reject mail forged in its name. The image registry, the Better Auth secret and the log group are ready for the first deploy.
  - **Delivers:** the permanent part of `infra/base` ([ADR 0008](decisions/0008-hosting.md); [ADR 0030](decisions/0030-domain-and-base-infrastructure-details.md)): the DNS zone, imported from the registration, with a Certification Authority Authorization (CAA) record and a null MX; the SES identity with the records that let receiving servers check its mail and refuse forgeries (DKIM, DMARC and SPF); the Elastic Container Registry (ECR) with lifecycle rules that keep released images; the Better Auth secret, written through a write-only argument so its value never enters Terraform state; the log group; the runbook's chapters on buying the domain and applying base.
  - **Depends on:** —
  - **Owner steps:** buy `dzwoniec.com` in Route 53 and confirm its registrant email, following the runbook; apply `infra/base` from the branch and run its checks, and again from `main` after the merge.
  - **Expected path:** full.
  - **Open points:** the sub-issues of [#39](https://github.com/luiki-dev/szop/issues/39).
  ```

- PH-12's entry: **Goal** `demo.<domain>` → `szop.dzwoniec.com`; **Delivers** "the network, the load balancer, the service on Elastic Container Service (ECS), RDS, the certificate for `szop.dzwoniec.com` with its validation record ([ADR 0030](decisions/0030-domain-and-base-infrastructure-details.md), decision 5) and the `szop` DNS record".
- PH-34's entry after PH-13's:

  ```markdown
  ### PH-34 Landing page and demo status

  - **Goal:** `dzwoniec.com` always serves a static page that shows whether Szop's demo is up, with a link to it when it is. While no demo runs, `szop.dzwoniec.com` redirects to the page instead of failing.
  - **Delivers:** the static page and its hosting; `szop.dzwoniec.com` redirecting to it while the demo is down, which changes how `demo-down` treats the `szop` record; the status check on the page ([ADR 0030](decisions/0030-domain-and-base-infrastructure-details.md), decision 13).
  - **Depends on:** PH-12.
  - **Owner steps:** apply `infra/base` from the branch, and again from `main` after the merge, if the phase changes it.
  - **Expected path:** full.
  - **Open points:** the sub-issues of [#<new issue>](https://github.com/luiki-dev/szop/issues/<new issue>).
  ```

- `## Contents`: add PH-34's link after PH-13's.

In `README.md`'s diagram, Stage 3's two lines become (the road keeps its width, so the `╮` stays in its column):

```text
  ║  PH-09   PH-10   PH-11   PH-12   PH-13   PH-34
  ╚════●───────◐───────○───────○───────○───────○───────────────────────────╮
```

Check with `awk '{ print length }'` that both road lines of Stage 3 and Stage 4's are the same length as before.

- [ ] **Step 5: GitHub**

```bash
R=luiki-dev/szop
# PH-34
gh issue create --repo $R --title "PH-34 Landing page and demo status" --label phase \
  --milestone "Stage 3: Walking skeleton, deployed and released" --body-file <(…)   # body: roadmap link + the entry, as in project-tracking.md's "Phase issues"
gh project item-add 3 --owner luiki-dev --url <new issue URL>   # Status ⬜ Backlog, Path Full
```

Then:

- OP-092 (#202): re-parent under PH-34 (`gh api` sub-issue endpoints: remove from #39, add to the new issue); body: the decision (page always on; `szop.` redirects while down; status shown) and a History line "Moved from PH-10 (#39) to PH-34 by the PH-10 brainstorm".
- OP-013 (#66), OP-016 (#75): tick the PH-10 part with "✅ Done (this PR)", re-parent to PH-12 (#41), Status ⬜ Backlog. OP-044 (#76): the same, re-parented to PH-18.
- #142: close as not planned, comment "Dropped by the PH-10 brainstorm: Terraform writes the secret through a write-only argument (ADR 0030, decision 10)." #143: retitle `PH-10 owner step 2: Apply \`infra/base\` from the branch, run its checks, and again from \`main\` after the merge`, body updated. #141: body updated with the runbook link.
- PH-10 (#39) and PH-12 (#41): bodies updated from their roadmap entries (the owner-step list of #39 without #142). Stage 3's milestone description: the new exit line.
- PH-10's Plan field: `https://github.com/luiki-dev/szop/blob/main/docs/superpowers/plans/2026-10-16-PH-10-domain-and-base-infrastructure.md`.

Record every change made here; the PR description lists them.

- [ ] **Step 6: Check links, formatting and the infra check**

Run: `pnpm exec prettier --check docs README.md && pnpm check:infra && grep -rn "demo\.<domain>" docs README.md | grep -v -e superpowers -e archive -e audits -e "0008-hosting\|0010-ci-cd"`
Expected: Prettier passes, the infra check passes, and the grep prints nothing (accepted ADRs keep their wording; their notes carry the change).

- [ ] **Step 7: Commit**

```bash
git add docs README.md
git commit -m "docs: record ADR 0030 and base in the living docs and the roadmap"
```

After this task: the owner applies `infra/base` from the branch (owner step 2), then the phase goes through the definition of done and the PR, with the stage table's PR link and the ✅ before the merge, as in [`project-tracking.md`](../../development/project-tracking.md).
