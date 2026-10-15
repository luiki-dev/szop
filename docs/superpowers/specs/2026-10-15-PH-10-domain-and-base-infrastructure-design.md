# PH-10 Domain and base infrastructure — design

- **Phase:** [PH-10](../../roadmap.md#ph-10-domain-and-base-infrastructure) ([#39](https://github.com/luiki-dev/szop/issues/39))
- **Date:** 2026-10-15
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-013](https://github.com/luiki-dev/szop/issues/66) (PH-10 part, then on to PH-12); [OP-016](https://github.com/luiki-dev/szop/issues/75) (PH-10 part, then on to PH-12); [OP-044](https://github.com/luiki-dev/szop/issues/76) (PH-10 part, then on to PH-18); [OP-092](https://github.com/luiki-dev/szop/issues/202) (moved to the new PH-34)

Szop gets its domain and the permanent part of `infra/base`. The direction was settled by [ADR 0008](../../decisions/0008-hosting.md), decisions 6, 12, 13, 17, 21, 22, 24 and 27 (the base group, the registry and its tags, the domain and the certificate, how secrets are kept and reach the app, SES, the log group). This spec holds the details those left to the phase, as agreed in the brainstorm, and two changes to them: the app's name is `szop.dzwoniec.com` instead of `demo.<domain>`, and the certificate moves from base to the demo. They are recorded in ADR 0030.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [The base folder](#the-base-folder)
  - [The domain and the zone](#the-domain-and-the-zone)
  - [Email: SES, DKIM, DMARC and SPF](#email-ses-dkim-dmarc-and-spf)
  - [The image registry](#the-image-registry)
  - [The Better Auth secret](#the-better-auth-secret)
  - [The log group](#the-log-group)
  - [Outputs](#outputs)
  - [Checks](#checks)
- [Documentation and records](#documentation-and-records)
- [Roadmap and GitHub changes](#roadmap-and-github-changes)
- [Owner steps](#owner-steps)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal, as changed by this brainstorm: Szop's domain `dzwoniec.com` resolves through Route 53, only Amazon may issue certificates for it, and Amazon Simple Email Service (SES) has verified it and tells receivers to reject mail forged in its name. The image registry, the Better Auth secret and the log group are ready for the first deploy.

The phase is done when:

- `dzwoniec.com` is registered through Route 53 with auto-renew, the transfer lock and privacy protection on, and its registrant email is confirmed;
- `infra/base` is applied from the owner's machine, with its state in the state bucket under `base/terraform.tfstate`, and a second `terraform plan` shows no changes;
- the hosted zone that the purchase created is managed by `infra/base` (imported, not replaced): `dig NS dzwoniec.com` returns the same four name servers as the registration;
- `dig` shows the CAA record, the null MX, `v=spf1 -all` on `dzwoniec.com` and `v=DMARC1; p=reject` on `_dmarc.dzwoniec.com`;
- SES shows `dzwoniec.com` as verified, with DKIM signing successful;
- the ECR repository `szop` exists with immutable tags, scanning on push and the lifecycle policy of [The image registry](#the-image-registry);
- the SSM parameter `/szop/better-auth-secret` exists, and its value is not found in `terraform state pull`;
- the log group `/szop/app` exists with 7-day retention;
- every resource carries the tags `project=szop` and `group=base`;
- `pnpm check:infra` passes, and the `infra` job checks `infra/base` in CI;
- the docs and records listed under [Documentation and records](#documentation-and-records) are updated, and the roadmap and GitHub as in [Roadmap and GitHub changes](#roadmap-and-github-changes).

## Out of scope

- **The certificate for `szop.dzwoniec.com`**: created per session by `infra/demo` in [PH-12](../../roadmap.md#ph-12-first-deploy) ([decision 5](#decisions-taken-in-the-brainstorm)).
- **The `szop` record pointing at the load balancer**: `infra/demo`, PH-12.
- **The app's IAM roles, the CI roles and the GitHub OIDC provider**, which ADR 0010 also puts in `infra/base`: [PH-11](../../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net) and PH-12.
- **How `infra/demo` finds base's resources** (`terraform_remote_state` or data sources): PH-12, as [ADR 0008](../../decisions/0008-hosting.md), decision 6 left it. Base's outputs serve either way.
- **The SES `EmailSender`, the sender address and verifying the recipients the owner tests with**: [PH-18](../../roadmap.md#ph-18-registration-and-login), with what a failed send does ([OP-044](https://github.com/luiki-dev/szop/issues/76)).
- **What `dzwoniec.com` and `szop.dzwoniec.com` serve while no demo runs**: the new phase PH-34 ([decision 13](#decisions-taken-in-the-brainstorm)).
- **A custom MAIL FROM subdomain and SES production access** ([decision 8](#decisions-taken-in-the-brainstorm); [ADR 0008](../../decisions/0008-hosting.md), decision 24).

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | The domain and the app's name | `demo.<domain>` on a domain bought for Szop ([ADR 0008](../../decisions/0008-hosting.md), decision 17); `szop.<domain>` on a domain that may later hold other apps | **`dzwoniec.com`, with Szop at `szop.dzwoniec.com`.** The domain is Szop's only for now, but another app may get its own subdomain later, so Szop's name is its own name rather than "demo". Refines ADR 0008, decision 17. |
| 2 | Registrar and DNS | Route 53 for both; Cloudflare as registrar, which requires Cloudflare's DNS; any registrar with the domain or `szop.` delegated to Route 53 | **Route 53 for both**, as ADR 0008, decision 17 planned. Everything stays in one account and one Terraform provider, with no extra credentials, and `szop` can be an alias record to the load balancer. Cloudflare sells .com about $4.50 a year cheaper, but its DNS would need the Cloudflare provider and an API token stored on the owner's machine and in CI, against the "no stored keys" rule of [ADR 0010](../../decisions/0010-ci-cd.md). Delegating `szop.` to its own zone would separate future apps best, but adds a manual step and a second zone for a need that does not exist yet. |
| 3 | Which module owns the hosted zone | `infra/base`; `infra/bootstrap`; a new `infra/domain` | **`infra/base`**, as ADR 0008, decision 6 planned, **with `prevent_destroy`**, the pattern of the state bucket. A new zone would get new name servers and take the whole domain offline until the registration is updated. A future app finds the zone by name and adds its own records from its own code. Bootstrap would blur its "state and budget" purpose; `infra/domain` would be a module for one resource. |
| 4 | Adopting the zone the purchase creates | An `import` block; a new zone plus the registration managed by Terraform (`aws_route53domains_registered_domain`) pointing at it; a data source only | **An `import` block** with the zone's ID, which the owner reads after buying the domain. The first plan shows the zone imported, not created, and the name servers never change. Importing existing resources is a common task worth learning. Replacing the zone needs a second provider region (`us-east-1`) and a name-server change; a data source would leave the zone and its protection outside the code. The block stays after the first apply, with a comment: it does nothing once the zone is in state and records where it came from. **The registration's settings** (auto-renew, transfer lock, privacy protection) are set by the owner at purchase and stay outside Terraform. |
| 5 | Where the certificate lives | `infra/base`, as ADR 0008, decision 17 planned, with a runbook check of its expiry; `infra/base`, re-issued by `demo-up` when it nears expiry; `infra/demo`, created per session | **`infra/demo`, created and destroyed with each session (PH-12).** ACM renews a certificate only while it is associated with a service, such as a load balancer, or has been exported. Since February 2026 public certificates last 198 days and renewal starts 45 days before expiry. A certificate in base would be in use only during demos, so it would usually expire unrenewed, and the next `demo-up` would fail. Issuing one per session takes a few minutes, while RDS takes about ten. A runbook check relies on memory; a `demo-up` that re-issues base's certificate needs CI to change base. Refines ADR 0008, decision 17. |
| 6 | Hardening records | CAA; null MX; neither | **Both.** A **CAA** record (Certification Authority Authorization) lets only Amazon's certificate authority issue certificates for the domain, so no other authority will issue one even if an attacker passes its validation. A **null MX** (`0 .`, RFC 7505) declares that the domain receives no mail, so senders fail at once instead of retrying. A future page served through another authority, such as GitHub Pages with Let's Encrypt, adds that authority to the CAA record; a mailbox on the domain replaces the null MX. |
| 7 | SES's sender identity | `dzwoniec.com`; `szop.dzwoniec.com` | **`dzwoniec.com`.** One identity lets Szop send from the apex or any subdomain (the address is PH-18's choice), with Easy DKIM's three CNAME records. DMARC and SPF at the apex then protect every subdomain, including future apps' names. An identity on `szop.` would need its own records and leave the apex to be protected separately. |
| 8 | DMARC and SPF | — | **DMARC `v=DMARC1; p=reject` on `_dmarc.dzwoniec.com`, with relaxed alignment** (the default), so mail from an address on `szop.dzwoniec.com` still aligns with DKIM's `d=dzwoniec.com`; strict alignment would reject it. **No report address (`rua`)**, since the domain has no mailbox. **SPF `v=spf1 -all` on the apex**: nothing sends with the domain as its envelope sender, because SES uses its own `amazonses.com`, so Szop's mail passes DMARC through DKIM. **No custom MAIL FROM subdomain**, optional per [OP-044](https://github.com/luiki-dev/szop/issues/76). Settles OP-044's PH-10 part. |
| 9 | The image registry | — | **One repository, `szop`, with immutable tags** ([ADR 0008](../../decisions/0008-hosting.md), decision 13), **basic scanning on push** (free; scanning in CI stays with [OP-090](https://github.com/luiki-dev/szop/issues/194)), ECR's default encryption and `force_delete = false`, so Terraform will not destroy a registry that holds images. **The lifecycle policy** ([OP-013](https://github.com/luiki-dev/szop/issues/66)): rule 1 selects images with a tag starting with `v` and expires only beyond 9999 of them, which never happens; rule 2 selects any image and expires all but the newest 10. ECR has no "keep" action, and an image matched by a higher-priority rule cannot be expired by a lower one, so rule 1 shields released images. A release image carries its commit hash and its version on the same digest, so it matches rule 1. |
| 10 | The Better Auth secret | The owner creates it with one AWS CLI command and Terraform knows only its name (the roadmap's plan); Terraform writes it through a write-only argument | **Terraform writes it, and the value never enters state.** An `ephemeral "random_password"` (64 letters and digits, so it never needs quoting) feeds the write-only `value_wo` of an `aws_ssm_parameter` `SecureString` named `/szop/better-auth-secret`, encrypted with the AWS-managed key. Ephemeral values are never stored in state or plan files; state keeps only `value_wo_version`. **Rotation** bumps `value_wo_version` and applies; the next app start reads the new value, which signs everyone out. The hard rule of [OP-016](https://github.com/luiki-dev/szop/issues/75): **secret values never enter Terraform state; a resource takes its secret through a write-only argument, or the value is created outside Terraform**. The **check**: after the first apply, the value read with `aws ssm get-parameter --with-decryption` is not found in `terraform state pull`. Terraform 1.16 meets the 1.11 minimum write-only arguments need. Completes ADR 0008, decision 22; settles OP-016's PH-10 part. The owner's CLI step is dropped. |
| 11 | The log group | — | **`/szop/app`, 7-day retention** ([ADR 0008](../../decisions/0008-hosting.md), decision 27), default encryption. PH-12's task definition writes to it. |
| 12 | Layout of the code | Flat files by concern in one root module, as in `infra/bootstrap`; local child modules; community registry modules (`terraform-aws-modules`) | **Flat files by concern.** Every resource is written out and readable top to bottom, as ADR 0008, decision 4 asks. Child modules would each have one caller; registry modules hide what the phase is meant to teach, the reason ADR 0008 rejected ECS Express Mode. **The domain is a constant in `locals`**, like bootstrap's bucket name: it is public and never varies. |
| 13 | What the domain serves while no demo runs ([OP-092](https://github.com/luiki-dev/szop/issues/202)) | Nothing, explained in the README; a candidate phase; a page built in PH-10; a scheduled phase | **A scheduled phase, PH-34 "Landing page and demo status", after PH-13 in Stage 3, depending on PH-12.** `dzwoniec.com` always serves a static page; while the demo is down, `szop.dzwoniec.com` redirects to it, and the page shows whether Szop is up, with a link when it is. The owner wants it, and it depends on PH-12, which a scheduled phase records and a candidate does not. It brings its own concepts (static hosting, probably a CDN and a cross-origin status check) and changes how `demo-down` treats the `szop` record, so it does not grow PH-10. Candidates in general stay as they are. |

## Design

### The base folder

```text
infra/base/
  versions.tf               Terraform ~> 1.16; aws ~> 6.68; random ~> 3.7
  backend.tf                bucket szop-tfstate-ntrtcr, key base/terraform.tfstate, S3 lock file
  providers.tf              eu-central-1, allowed_account_ids, default tags project=szop, group=base
  variables.tf              account_id, validated as in bootstrap
  locals.tf                 domain = "dzwoniec.com", app_hostname = "szop.${domain}"
  dns.tf                    the zone (imported), CAA, null MX
  email.tf                  SES identity, DKIM records, DMARC, SPF
  registry.tf               ECR repository and lifecycle policy
  secrets.tf                ephemeral password, SSM parameter
  logs.tf                   log group
  outputs.tf
  terraform.tfvars.example
  .terraform.lock.hcl       committed
```

Base is applied from the owner's machine with `AWS_PROFILE=szop`, as bootstrap is; CI reaches AWS only in PH-11. `terraform.tfvars` holds only `account_id` and stays gitignored. `scripts/check-infra.sh` already validates every folder under `infra/`, and Dependabot's `terraform` entry already covers `/infra/*`, so the `random` provider is watched with no change.

### The domain and the zone

- **The zone:** `aws_route53_zone` for `dzwoniec.com`, adopted with an `import` block holding the zone's ID, which the owner reads after the purchase (`aws route53 list-hosted-zones-by-name --dns-name dzwoniec.com`). `prevent_destroy`; the comment says why: a new zone means new name servers. The zone's own NS and SOA records are AWS's and stay outside Terraform.
- **CAA** on `dzwoniec.com`: `0 issue "amazon.com"`, and the other names AWS documents for ACM, confirmed during implementation. No `issuewild`, so the `issue` values cover wildcards too.
- **Null MX** on `dzwoniec.com`: `0 .`.

### Email: SES, DKIM, DMARC and SPF

- `aws_sesv2_email_identity` for `dzwoniec.com`, Easy DKIM with 2048-bit keys, which AWS rotates.
- Three CNAME records, `<token>._domainkey.dzwoniec.com` → `<token>.dkim.amazonses.com`, one per token the identity returns. SES verifies the domain once it sees them.
- TXT `_dmarc.dzwoniec.com`: `v=DMARC1; p=reject`.
- TXT `dzwoniec.com`: `v=spf1 -all`. It is the only TXT value on the apex today; a later one joins the same record set.

### The image registry

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep released images: v* tags are never expired.",
      "selection": { "tagStatus": "tagged", "tagPatternList": ["v*"], "countType": "imageCountMoreThan", "countNumber": 9999 },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 2,
      "description": "Keep the newest 10 of the rest.",
      "selection": { "tagStatus": "any", "countType": "imageCountMoreThan", "countNumber": 10 },
      "action": { "type": "expire" }
    }
  ]
}
```

Written in Terraform with `jsonencode`, on an `aws_ecr_repository` `szop` with `image_tag_mutability = "IMMUTABLE"`, `scan_on_push = true` and `force_delete = false`.

### The Better Auth secret

```hcl
ephemeral "random_password" "better_auth_secret" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "better_auth_secret" {
  name             = "/szop/better-auth-secret"
  type             = "SecureString"
  value_wo         = ephemeral.random_password.better_auth_secret.result
  value_wo_version = 1
}
```

Validated in the brainstorm against Terraform 1.16.5, aws 6.69.1 and random 3.9.1. The comment on `value_wo_version` says how to rotate. The runbook carries the check and the rotation.

### The log group

`aws_cloudwatch_log_group` `/szop/app`, `retention_in_days = 7`.

### Outputs

`zone_id`, `domain_name`, `app_hostname`, `ecr_repository_url`, `better_auth_secret_arn`, `log_group_name`: what PH-11 and PH-12 need, and what the runbook's checks print.

### Checks

- **Without AWS:** `pnpm check:infra` (formatting, `validate` for every module, tflint), locally and in the `infra` job.
- **After the apply, in the runbook's "Applying base":** a second `terraform plan` shows no changes; `dig NS`, `dig CAA`, `dig MX` and `dig TXT` on `dzwoniec.com` and `dig TXT _dmarc.dzwoniec.com` show the records; `aws sesv2 get-email-identity --email-identity dzwoniec.com` shows it verified and DKIM successful; the secret's value is not found in `terraform state pull`; Tag Editor or `aws resourcegroupstaggingapi get-resources --tag-filters Key=group,Values=base` lists every resource.

## Documentation and records

- **ADR 0030 "Domain and base infrastructure details"**: the decisions above. ADR 0008's status line and the cells of decisions 6, 12, 17, 22, 24 and 27 get their notes; ADR 0010's mention of `demo.<domain>` gets a note too.
- **`docs/operations/demo-environment.md`**: "Buying the domain" (the purchase, its settings, the registrant email, reading the zone ID) and "Applying base" (init, plan with the import, apply, the checks, rotating the secret).
- **`docs/architecture/architecture.md`**: the deployment section with `szop.dzwoniec.com`, the certificate in the demo, SES at the apex and base's contents.
- **`docs/architecture/stack-overview.md`**: DNS (registrar, registry, hosted zone, record types), CAA, DKIM, DMARC and SPF, ECR's lifecycle, SSM Parameter Store, and Terraform's `import` blocks, ephemeral values and write-only arguments.
- **`docs/architecture/threat-model.md`**: mail forged in the domain's name, certificates issued by another authority, and where the Better Auth secret lives.
- **`docs/development/tools/terraform.md`**: the `random` provider, importing and write-only arguments, as they apply to Szop.
- **`docs/glossary.md`**: CAA, DKIM, DMARC, MX, SPF, ACM, ECR, SES, SSM, and any other acronym the phase brings.
- **`docs/development/phase-walkthrough.md`** and any other living doc naming `demo.<domain>`: `szop.dzwoniec.com`.

## Roadmap and GitHub changes

In `docs/roadmap.md` and the README's diagram:

- **PH-10's entry** follows this spec: the goal of [Goal and success criteria](#goal-and-success-criteria), the certificate removed from **Delivers**, CAA and null MX added, the secret written by Terraform, the owner steps of [Owner steps](#owner-steps).
- **PH-12's entry**: the certificate and its validation record join **Delivers**; `demo.<domain>` becomes `szop.dzwoniec.com`.
- **Stage 3's exit**: "one button creates a demo of any commit at `szop.dzwoniec.com`, a nightly run destroys it, `dzwoniec.com` shows whether it is up, and `v0.1.0` is released."
- **New PH-34 "Landing page and demo status"** after PH-13, in Stage 3's table and the diagram: goal, delivers (the static page, `szop.dzwoniec.com` redirecting to it while the demo is down, the status shown on the page), depends on PH-12, expected path full.

On GitHub, listed in the PR:

- PH-10 (#39): body updated from the roadmap entry.
- #141 (owner step 1): text updated. #142 (owner step 2, the CLI secret): closed as not planned, since Terraform writes the secret. #143 (applying base): renumbered to step 2, with the checks.
- A PH-34 issue in `Stage 3`, label `phase`; [OP-092](https://github.com/luiki-dev/szop/issues/202) re-parented to it, with the decision and a History line.
- [OP-013](https://github.com/luiki-dev/szop/issues/66): PH-10 part ticked, re-parented to PH-12. [OP-016](https://github.com/luiki-dev/szop/issues/75): PH-10 part ticked, re-parented to PH-12. [OP-044](https://github.com/luiki-dev/szop/issues/76): PH-10 part ticked, re-parented to PH-18.
- PH-12 (#41) and Stage 3's milestone description: updated from the roadmap.

## Owner steps

1. **Buy `dzwoniec.com` in Route 53**, following the runbook: auto-renew, transfer lock and privacy protection on; confirm the registrant email within 15 days; read the zone's ID and pass it on for the `import` block.
2. **Apply `infra/base` from the branch** and run the runbook's checks, then apply again from `main` after the merge.

## Tasks

About seven, for the plan to detail:

1. `infra/base`'s skeleton: versions, backend, providers, variables, locals, the example variables file and the lock file; `pnpm check:infra` passes with it.
2. The zone with its `import` block, CAA and null MX.
3. The SES identity with DKIM, DMARC and SPF.
4. The registry with its lifecycle policy, and the log group.
5. The Better Auth secret, and the outputs.
6. The runbook: buying the domain, applying base, its checks and rotating the secret.
7. ADR 0030, the notes in ADRs 0008 and 0010, the living docs, the glossary, the roadmap, the README's diagram and the GitHub changes.

## To verify during implementation

- The CAA values AWS documents for ACM.
- The attribute of `aws_sesv2_email_identity` that returns the DKIM tokens.
- That an `import` block with a literal zone ID passes `validate` before the domain exists, and how the branch carries the ID until the owner provides it.
- ECR's rule that an image matched by a higher-priority rule is never expired by a lower one, in AWS's documentation.
- That Route 53 still creates the hosted zone on purchase, and the price of `.com`.
