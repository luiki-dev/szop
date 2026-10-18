# PH-12b Network and the demo-up button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pressing `demo-up` on a branch creates the demo's network, load balancer and certificate, and `https://szop.dzwoniec.com` answers with a placeholder page naming the deployed commit; `demo-down` removes everything again.

**Architecture:** `infra/demo` gains a VPC with public and private subnets, an internet-facing application load balancer whose HTTPS listener answers with a fixed page, a per-session ACM certificate validated through DNS, and the `szop` alias record, finding base's hosted zone by name. `infra/base` widens `szop-ci-deploy` with a `demo` trust statement and three customer managed policies scoped by the `project`/`group` tags. The real `demo-up.yml` applies `infra/demo` from the chosen commit in the `demo` environment and re-enables `demo-down` in a job without AWS credentials.

**Tech Stack:** Terraform 1.16.5 (tenv), `hashicorp/aws` 6.69.1 (`~> 6.68`), tflint 0.49.0 AWS ruleset, GitHub Actions, `aws-actions/configure-aws-credentials` v6.3.0, `hashicorp/setup-terraform` v4.0.1, `actions/checkout` v7.0.1, `gh`, curl, IAM Access Analyzer, the IAM policy simulator.

**Spec:** [`docs/superpowers/specs/2026-10-18-PH-12b-network-and-the-demo-up-button-design.md`](../specs/2026-10-18-PH-12b-network-and-the-demo-up-button-design.md)

## Global Constraints

- Region `eu-central-1`; state bucket `szop-tfstate-ntrtcr`; demo's key `demo/terraform.tfstate`. Provider default tags in `infra/demo`: `project = "szop"`, `group = "demo"`; every resource also gets a `Name` tag.
- Names: VPC `szop-demo`; subnets `szop-demo-public-a` `10.0.0.0/24` `eu-central-1a`, `szop-demo-public-b` `10.0.1.0/24` `eu-central-1b`, `szop-demo-private-a` `10.0.10.0/24` `eu-central-1a`, `szop-demo-private-b` `10.0.11.0/24` `eu-central-1b`; VPC `10.0.0.0/16`; security group `szop-demo-alb`; load balancer `szop-demo`.
- Domain `dzwoniec.com`, app host `szop.dzwoniec.com`, URL `https://szop.dzwoniec.com`. TLS policy `ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09`.
- `deployed_commit`: string, default `null`, 40 lowercase hex digits when set; an apply that creates or changes the HTTPS listener without it fails.
- Deploy role trust for `demo`: `sub` = `repo:luiki-dev@290870182/szop@1380292421:environment:demo`, `aud` = `sts.amazonaws.com`, **no `ref` condition**; the existing `demo-teardown` statement is unchanged. Deploy role conditions check both `project = szop` and `group = demo`. **Nothing in IAM** for the deploy role.
- `demo-up`: concurrency group `demo-up`, `cancel-in-progress: false`; `-lock-timeout=15m`; `deploy` job `timeout-minutes: 30`; page wait every 10 s for up to 10 minutes; `enable-teardown` job `actions: write`, no AWS, `timeout-minutes: 5`.
- Every workflow follows `docs/development/ci-cd.md` "Rules for every workflow": `permissions: {}` at the top, per-job grants, `runs-on: ubuntu-24.04`, `timeout-minutes`, actions pinned to full commit SHAs with a version comment (reuse the pins already in `demo-down.yml`), `persist-credentials: false`, nothing a user controls inside `${{ }}` in `run:` (pass it through `env:` or `with:`).
- Jobs holding AWS credentials: `id-token: write` on the job only; no setup action, no `pnpm install`, no project scripts; Terraform, the AWS CLI, git, jq, curl and the shell only.
- Never run `terraform apply` or `destroy` against AWS, never `gh workflow run`, never trigger `demo-up` or `demo-down`, never merge. `terraform plan` and read-only AWS calls (`aws iam simulate-*`, `aws accessanalyzer validate-policy`, `describe-*`) with the owner's SSO profile `szop` are allowed.
- Nothing that identifies the owner's account goes into a commit: no account ID, no role ARN with the account number, no portal URL, no email address. `infra/demo/terraform.tfvars` is git-ignored.
- Every commit follows Conventional Commits and ends with the two attribution lines: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01L2h5LTxJe93QgahR4JhLqf`. Never commit to `main`; the branch is `feat/ph-12b-network-and-demo-up`.
- Docs: niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon; requirements linked, never plain IDs; long docs keep their `## Contents` in sync; ADR notes in three places (CLAUDE.md, "Documentation").
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit and `git push` the phase branch. **For PH-12b only, the owner asked not to stop between tasks:** go straight on to the next task, and stop only where a step needs the owner (Task 5's checkpoints).

## Review Focus

1. **A missing deploy-role permission on the first real run.** Each gap costs the owner another apply of base and another approved run. Task 2, step 4 simulates every action the resources need under the role's exact policies, with the tags the provider sends, before the owner applies.
2. **A destroy blocked by the precondition.** `demo-down` and a local destroy run with `deployed_commit` null; if Terraform evaluated the precondition on destroy, the safety net would break. Task 1, step 1 proves the behaviour on a throwaway configuration.
3. **The placeholder page over 1024 bytes**, which `CreateListener` rejects only at apply time. Task 1 adds a precondition on the page's length, checked by the local plan.
4. **The `ref` input reaching a shell.** A value typed into the button must reach `actions/checkout` through `with:` and the shell only through `env:`; zizmor in Task 3 checks it.
5. **A redeploy over a running demo.** Pressing `demo-up` again with another commit must change only the listener's fixed response, in place. Task 5, step 5 checks it with a local plan while the demo is up.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `infra/demo/locals.tf` | base's names, zones, address ranges, the placeholder page | 1 |
| `infra/demo/data.tf` | the hosted zone by name | 1 |
| `infra/demo/network.tf` | VPC, subnets, internet gateway, public route table | 1 |
| `infra/demo/load_balancer.tf` | security group and rules, load balancer, listeners | 1 |
| `infra/demo/certificate.tf` | certificate, validation record, validation wait | 1 |
| `infra/demo/dns.tf` | the `szop` alias record | 1 |
| `infra/demo/variables.tf`, `outputs.tf`, `providers.tf`, `backend.tf`, `terraform.tfvars.example` | `deployed_commit`, outputs, comments | 1 |
| `infra/base/ci_roles.tf`, `infra/base/outputs.tf` | `demo` trust, managed policies | 2 |
| `.github/workflows/demo-up.yml`, `infra-plan.yml`, `demo-down.yml` | the button, the plan's commit, comments | 3 |
| `docs/operations/demo-environment.md`, `docs/development/{ci-cd,github-settings}.md`, `docs/architecture/{threat-model,architecture,stack-overview}.md`, `docs/glossary.md`, `docs/development/tools/terraform.md` | living docs | 4, 5 |
| `docs/decisions/0034-network-and-demo-up-details.md`; ADRs 0008, 0010, 0011 | ADR 0034 and its notes | 6 |
| `docs/roadmap.md`, `README.md` | PH-12b row | 6 |

---

### Task 1: The demo's network, load balancer, certificate and DNS record

**Files:**
- Create: `infra/demo/locals.tf`, `data.tf`, `network.tf`, `load_balancer.tf`, `certificate.tf`, `dns.tf`, `outputs.tf`
- Modify: `infra/demo/variables.tf`, `providers.tf`, `backend.tf`, `terraform.tfvars.example` (comments that say "until PH-12" brought up to date)

**Interfaces:**
- Consumes: the zone `dzwoniec.com` in base (by name).
- Produces: `variable "deployed_commit"`; outputs `deployed_commit` and `url`; resource names and tags of the Global Constraints, which Task 2's policies must allow. Task 3 runs `terraform apply -var deployed_commit=<sha>`.

- [ ] **Step 1: Prove a precondition is skipped on destroy (Review Focus 2)**

In `$CLAUDE_JOB_DIR/tmp/precondition-check/` (outside the repository), a configuration with local state: `variable "commit" { type = string, default = null }` and a `terraform_data` resource whose `lifecycle { precondition { condition = var.commit != null } }`. Run `terraform init`, `terraform apply -auto-approve -var commit=abc`, then `terraform destroy -auto-approve` with no `-var`. Expected: the destroy succeeds. If it fails, stop and report: decision 7 of the spec needs another mechanism.

- [ ] **Step 2: Write the module**

As the spec's Design sections describe (The network; The load balancer and the placeholder page; The certificate and the DNS records; The deployed commit). Pinned details:
- `locals.tf`: `domain = "dzwoniec.com"`, `app_hostname = "szop.${local.domain}"`, with a comment that both are base's and change with `infra/base/locals.tf` (spec, decision 1); the two zones; the four ranges; `placeholder_page` built with `var.deployed_commit` in the HTML of the spec.
- `aws_lb.main` has `depends_on = [aws_internet_gateway.main]` with a comment saying why (spec, The load balancer).
- The security group has no `egress` block and its ingress rules are `aws_vpc_security_group_ingress_rule` resources (80 and 443, `cidr_ipv4 = "0.0.0.0/0"`).
- HTTP listener: `redirect` to `HTTPS`, port `443`, `HTTP_301`. HTTPS listener: `certificate_arn = aws_acm_certificate_validation.main.certificate_arn`, default action `fixed-response`, `content_type = "text/html"`, `status_code = "200"`, `message_body = local.placeholder_page`; `lifecycle` with two preconditions: `var.deployed_commit != null` (message: pass `-var deployed_commit=$(git rev-parse HEAD)`) and `length(local.placeholder_page) <= 1024` (Review Focus 3).
- Validation record: `for_each` over `domain_validation_options`, `allow_overwrite = true`, `ttl = 60`.
- `szop` record: type `A`, alias to `aws_lb.main`, `evaluate_target_health = false`.
- `variable "deployed_commit"` with `validation { condition = var.deployed_commit == null || can(regex("^[0-9a-f]{40}$", var.deployed_commit)) }`.

- [ ] **Step 3: Static checks**

Run: `pnpm check:infra`. Expected: `terraform fmt`, `validate` for the three modules and tflint pass with no findings.

- [ ] **Step 4: A real plan with the owner's credentials**

`infra/demo/terraform.tfvars` from the example with base's `account_id` (copy it from `infra/base/terraform.tfvars`; never commit it). With `AWS_PROFILE=szop`: `terraform -chdir=infra/demo init` and `terraform -chdir=infra/demo plan -lock=false -var deployed_commit=$(git rev-parse HEAD)`. Expected: the zone lookup succeeds; `Plan: N to add, 0 to change, 0 to destroy` listing the VPC, 4 subnets, the gateway, the route table with its route and 2 associations, the security group with 2 rules, the load balancer, 2 listeners, the certificate, its validation record and validation, and the `szop` record. Then `terraform -chdir=infra/demo plan -lock=false` without the variable. Expected: fails on the precondition with its message. If the SSO session has expired, ask the owner to run `! aws sso login --profile szop`.

- [ ] **Step 5: Commit and push**

```bash
git add infra/demo docs/superpowers/plans
git commit -m "feat(infra): add the demo's network, load balancer, certificate and DNS record"
git push -u origin feat/ph-12b-network-and-demo-up
```

---

### Task 2: The deploy role's `demo` trust and permissions

**Files:**
- Modify: `infra/base/ci_roles.tf`, `infra/base/outputs.tf`

**Interfaces:**
- Consumes: Task 1's resources, names and tags.
- Produces: `szop-ci-deploy` assumable from `environment:demo` on any ref; customer managed policies `szop-ci-deploy-demo-network` (EC2), `szop-ci-deploy-demo-load-balancer` (Elastic Load Balancing and ACM) and `szop-ci-deploy-demo-dns` (Route 53), each attached with `aws_iam_role_policy_attachment`. The output `ci_deploy_role_arn`'s description names `demo-up.yml` and `demo-down.yml`.

- [ ] **Step 1: The trust statement**

A second statement `GitHubDemo` in `data.aws_iam_policy_document.ci_deploy_trust` as the Global Constraints give it, with a comment: `demo` runs from any branch, so no `ref` pin; the owner's required review on the environment is the gate (ADR 0012, decision 16; ADR 0032, decisions 10 and 14). Update the role's header comment, which still says `demo` comes in PH-12.

- [ ] **Step 2: The three policies**

As the spec's "The deploy role" describes. Work out, from the AWS Service Authorization Reference and the provider's calls for each resource of Task 1, the exact actions and which resource types and condition keys each supports, and write them so that:
- reads (`ec2:Describe*`, `elasticloadbalancing:Describe*`, `acm:DescribeCertificate`, `acm:ListCertificates`, `acm:ListTagsForCertificate`, the Route 53 reads of the spec) are on `*` or the zone, as the action allows;
- creates require `aws:RequestTag/project = szop` and `aws:RequestTag/group = demo`, and `aws:TagKeys` does not allow dropping either;
- `ec2:CreateTags` is allowed only with `ec2:CreateAction` in the creates used (including `AuthorizeSecurityGroupIngress`, since the rules carry tags), plus on resources already tagged `group = demo`; `elasticloadbalancing:AddTags` only with `elasticloadbalancing:CreateAction` in `CreateLoadBalancer`, `CreateListener`, plus on resources already tagged; `acm:AddTagsToCertificate` with the request tags (the accepted gap, commented);
- changes and deletes require `aws:ResourceTag/project = szop` and `aws:ResourceTag/group = demo`; an action that also names an untaggable or parent resource (the VPC for `CreateSubnet`, `CreateRouteTable`, `CreateSecurityGroup`; the load balancer for `CreateListener`) is allowed on that parent only when the parent carries the tags;
- EC2, Elastic Load Balancing and ACM statements also require `aws:RequestedRegion = eu-central-1`;
- `route53:ChangeResourceRecordSets` is on base's zone only (`aws_route53_zone.main.arn`), with `ForAllValues:StringLike` `route53:ChangeResourceRecordSetsNormalizedRecordNames` `["szop.dzwoniec.com", "_*.szop.dzwoniec.com"]` and `ForAllValues:StringEquals` `route53:ChangeResourceRecordSetsRecordTypes` `["A", "CNAME"]`.

Each statement has a `sid` and a short comment; each policy stays under 6,144 characters (check with `jq -c` on the rendered JSON from `terraform console` or the plan).

- [ ] **Step 3: Static checks**

Run: `pnpm check:infra`. Expected: pass. With `AWS_PROFILE=szop`: `terraform -chdir=infra/base plan -lock=false`. Expected: 3 policies and 3 attachments to add, the trust policy of `szop-ci-deploy` updated in place, nothing destroyed, and the output's description changed.

- [ ] **Step 4: Validate and simulate (Review Focus 1)**

For each rendered policy: `aws accessanalyzer validate-policy --policy-type IDENTITY_POLICY`. Expected: no `ERROR` and no `SECURITY_WARNING`. For the trust policy: `--policy-type RESOURCE_POLICY`; only the findings ADR 0032, decision 4 accepted. Then `aws iam simulate-custom-policy` with the three documents together, once for each create action with context `aws:RequestTag/project=szop`, `aws:RequestTag/group=demo`, `aws:RequestedRegion=eu-central-1` (and `ec2:CreateAction`/`elasticloadbalancing:CreateAction` for the tagging actions), and for each change and delete action with `aws:ResourceTag/project=szop`, `aws:ResourceTag/group=demo`. Expected: `allowed`. Negative cases: a delete with `aws:ResourceTag/group=base`, a create without the request tags, `route53:ChangeResourceRecordSets` with name `dzwoniec.com` or type `MX`, `ec2:CreateTags` with no `ec2:CreateAction` on an untagged resource. Expected: `implicitDeny`. Fix the policies until both sets hold, and keep the commands in the task's report.

- [ ] **Step 5: Commit and push**

```bash
git add infra/base docs/superpowers/plans
git commit -m "feat(infra): let the deploy role build the demo's network and load balancer"
git push
```

---

### Task 3: The real demo-up, and the plan's deployed commit

**Files:**
- Modify: `.github/workflows/demo-up.yml` (replace the placeholder), `.github/workflows/infra-plan.yml`, `.github/workflows/demo-down.yml` (comments only)

**Interfaces:**
- Consumes: `vars.AWS_DEPLOY_ROLE_ARN`; Task 1's `deployed_commit` variable and `url` output.
- Produces: the button as the spec's "demo-up.yml" describes: jobs `enable-teardown` and `deploy`.

- [ ] **Step 1: `demo-up.yml`**

As the spec describes, with these details:
- Input `ref`: `required: false`, `type: string`, description "Branch, tag or full 40-digit commit hash; empty: the branch chosen in Use workflow from".
- `enable-teardown`: `env: GH_TOKEN: ${{ github.token }}`, `GH_REPO: ${{ github.repository }}`; `run: gh workflow enable demo-down.yml`.
- `deploy`: `actions/checkout` with `ref: ${{ inputs.ref }}` (an empty string checks out the dispatching commit), `fetch-depth: 1`, `persist-credentials: false`; a step with `id: commit` writing `sha=$(git rev-parse HEAD)` after checking it against `^[0-9a-f]{40}$`; the credentials, masked account ID, `.terraform-version` and `setup-terraform` steps copied from `demo-down.yml`; `terraform -chdir=infra/demo init -input=false -lock-timeout=15m`; `terraform -chdir=infra/demo apply -auto-approve -input=false -lock-timeout=15m -no-color -var "deployed_commit=$COMMIT"` with `COMMIT` from `env:`; the wait loop (`curl -fsS --max-time 10 https://szop.dzwoniec.com` every 10 s, 60 tries, success when the body contains `$COMMIT`); a `Summary` step with `if: always()` writing URL, commit, the apply's and the wait's outcomes, and "`demo-down` destroys it at 01:17 UTC tonight unless pressed sooner" to `$GITHUB_STEP_SUMMARY`.
- A header comment in the style of `demo-down.yml`: what it does, the ADRs (0010 decisions 11 and 13, 0011 decision 7, 0012 decisions 16 and 18, 0032 decision 8, 0034), and that the `demo` environment with the owner as required reviewer must exist before this file is used.

- [ ] **Step 2: `infra-plan.yml`**

In the plan step, for `infra/demo` only, add `-var "deployed_commit=$HEAD_SHA"` with `HEAD_SHA: ${{ github.event.pull_request.head.sha }}` in the step's `env:`, and a comment: the demo refuses a plan without a commit (spec, decision 7), and the PR's head commit shows what `demo-up` on that branch would do.

- [ ] **Step 3: `demo-down.yml`**

Comments only: "demo-up records (PH-12)" and similar become present tense; no behaviour change.

- [ ] **Step 4: Checks**

Run: `pnpm check:workflows`. Expected: actionlint and zizmor report nothing. Run: `pnpm format:check`. Expected: pass.

- [ ] **Step 5: Commit and push**

```bash
git add .github/workflows docs/superpowers/plans
git commit -m "feat(ci): replace the placeholder demo-up with the real deploy"
git push
```

---

### Task 4: The runbook and the living docs

**Files:**
- Modify: `docs/operations/demo-environment.md`, `docs/development/ci-cd.md`, `docs/development/github-settings.md`, `docs/architecture/threat-model.md`, `docs/architecture/architecture.md`, `docs/architecture/stack-overview.md`, `docs/glossary.md`, `docs/development/tools/terraform.md` (only if data sources are not explained there yet)

**Interfaces:**
- Consumes: Tasks 1–3 as built; the spec's "Documentation and records".
- Produces: the runbook sections Task 5 follows: "Spinning up" (with the button; from your machine), the updated "Tearing down", "Destroying base", and the `demo` checks in "CI's roles and variables".

- [ ] **Step 1: The runbook**

As the spec's "Documentation and records" lists, including:
- "Spinning up": *Actions → demo-up → Run workflow*, *Use workflow from* the branch, `ref` empty or a branch, tag or full hash; approve the `deploy` job (*Review deployments*); read the summary; open both URLs; what each failing step means (`enable-teardown`, credentials, the lock, the precondition, a permission error naming an action, the page wait timing out); the local fallback with `terraform apply -var deployed_commit=$(git rev-parse HEAD)` from the commit to deploy, and that `demo-down` then destroys with that commit.
- "Tearing down": what a real destroy removes and the check that nothing is left (the Tag Editor with *Regions* = eu-central-1 and `group` = `demo`; the zone has no `szop` or `_….szop` record); every Tag Editor mention in the runbook names its region, and notes that IAM roles never appear there.
- "Destroying base" (OP-093): after `infra/demo` is destroyed; lifting `prevent_destroy` on the zone in a local, uncommitted edit; emptying the registry (`aws ecr batch-delete-image`, or `force_delete` in a local edit); what deleting the zone does to `dzwoniec.com` (it stops resolving; a new zone gets new name servers, so the registration must be updated or the domain let lapse); then "Destroying bootstrap".
- "CI's roles and variables": the `GitHubDemo` statement's expected `sub` and the absence of a `ref` condition; the three managed policies attached.
- "Coming later" keeps only PH-12c's debugging and costs. `## Contents` in sync.

- [ ] **Step 2: The other living docs**

As the spec lists: `ci-cd.md` (the real `demo-up`, its two jobs, the approval, `infra-plan`'s `deployed_commit`); `github-settings.md` (the `demo` environment); `threat-model.md` (the load balancer as an entry point with its STRIDE row; the CI actor's `demo` path and what the deploy role now reaches, including the two record names); `architecture.md` (the demo's network and load balancer); `stack-overview.md` (VPC, subnets and availability zones, internet gateway and route tables, security groups, the application load balancer with listeners and actions, ACM DNS validation, alias records, tag-based IAM conditions, data sources); `glossary.md` (VPC, CIDR, AZ, ALB, ACM, IGW and any other new acronym).

- [ ] **Step 3: Checks**

Run: `pnpm format:check`. Expected: pass. Check every new link's anchor exists (`grep` the headings).

- [ ] **Step 4: Commit and push**

```bash
git add docs
git commit -m "docs: document spinning up the demo and destroying base"
git push
```

---

### Task 5: The owner's steps and the first real demo

The controller runs this task itself, with the owner; no subagent.

**Files:**
- Modify: whatever the real runs show to be wrong (most likely `infra/base/ci_roles.tf`); `docs/operations/demo-environment.md` (real timings); this plan.

- [ ] **Step 1: Owner checkpoint 1**

Ask the owner to do owner steps 1 and 2: create the `demo` environment (required reviewer: the owner; "prevent self-review" off; deployment branches: no restriction) following `github-settings.md`, then apply `infra/base` from the branch and see a second plan with no changes, and run the runbook's "CI's roles and variables" checks. Wait for confirmation.

- [ ] **Step 2: The draft PR and its plan comment**

Open the phase PR as a draft (`gh pr create --draft`, title `feat: add the demo's network and the demo-up button`, the template filled in as far as it goes, `Closes #220`). Check `infra-plan`'s comment: `infra/base` with no changes, `infra/demo` with Task 1's resources to add, and Access Analyzer with no errors and no security warnings for the three new policies.

- [ ] **Step 3: Owner checkpoint 2: the first demo**

Ask the owner to do owner step 3's first half: *Actions → demo-up → Run workflow*, *Use workflow from* `feat/ph-12b-network-and-demo-up`, `ref` empty; approve; open `https://szop.dzwoniec.com` and `http://szop.dzwoniec.com`. Watch the run with `gh run watch`/`gh run view --log-failed`. If a step fails on a missing permission, fix the policy (Task 2's rules), re-run its simulation, commit (`fix(infra): …`), push, and ask the owner to apply base and re-run. Record the run's duration and each phase's time from the log.

- [ ] **Step 4: Check the demo from here**

`curl -sI http://szop.dzwoniec.com` (expected `301` to `https://szop.dzwoniec.com:443/`), `curl -s https://szop.dzwoniec.com` (expected the page with the deployed commit), and `openssl s_client -connect szop.dzwoniec.com:443 -servername szop.dzwoniec.com </dev/null 2>/dev/null | openssl x509 -noout -issuer -dates` (expected an Amazon issuer). `gh workflow view demo-down.yml` shows it enabled.

- [ ] **Step 5: A redeploy's plan (Review Focus 5)**

While the demo is up, with `AWS_PROFILE=szop`: `terraform -chdir=infra/demo plan -lock=false -var deployed_commit=<any other full commit hash on the branch>`. Expected: `0 to add, 1 to change, 0 to destroy`, the HTTPS listener's fixed response changed in place.

- [ ] **Step 6: Owner checkpoint 3: demo-down**

Ask the owner to press `demo-down` on `main`. Expected: the summary's *Code used* is the recorded commit, *Result* `Destroy complete! Resources: N destroyed.` with N equal to the apply's count. Then check with the owner's credentials: `aws resourcegroupstaggingapi get-resources --region eu-central-1 --tag-filters Key=group,Values=demo` returns nothing, and the zone has no `szop` or `_….szop` record. Record the destroy's duration.

- [ ] **Step 7: Commit and push**

Real timings into the runbook's "Spinning up" and "Tearing down", the ticked boxes, and every fix found.

```bash
git add infra docs
git commit -m "docs(runbook): record the first demo's timings"
git push
```

---

### Task 6: ADR 0034, the roadmap and GitHub

**Files:**
- Create: `docs/decisions/0034-network-and-demo-up-details.md`
- Modify: `docs/decisions/0008-hosting.md`, `0010-ci-cd.md`, `0011-design-sanity-check-follow-ups.md` (status lines and decision notes); `docs/roadmap.md`; `README.md`

- [ ] **Step 1: ADR 0034**

In the form of ADR 0032 and 0033: context, the spec's nine decisions with options and reasoning, "Settled while building" with what Tasks 1–5 found (the precondition on destroy, the actions each resource needed, the real timings, every permission added after a real run), and consequences for PH-12c (it adds ECS, RDS and the app's roles with the same tag scoping and managed policies; the private subnets wait for RDS; waiting for `/api/health` replaces the page wait). Header: `Completes:` ADR 0008, decisions 6 and 16; ADR 0010, decisions 11 and 13; ADR 0011, decision 7.

- [ ] **Step 2: The notes**

In ADRs 0008, 0010 and 0011: the status line and a `🧩 **Completed by [ADR 0034](0034-network-and-demo-up-details.md), decision N:** …` line at the bottom of each decision's cell, as CLAUDE.md "Documentation" describes.

- [ ] **Step 3: Roadmap and README**

PH-12b's row: the plan and PR links, then ✅ Done before the merge; the README's diagram mirrors it (PH-12b `●`, the road `═` through it). PH-12c's entry: anything the phase moved to it.

- [ ] **Step 4: GitHub**

- OP-014 (#82), OP-093 (#208): a "settled by" comment each (closed by the PR).
- OP-013 (#66), OP-018 (#73), OP-019 (#77): PH-12b part ticked with the PR, re-parented to PH-12c (#221), Status ⬜ Backlog. OP-023 (#74): PH-12b part ticked, re-parented to PH-13 (#42), Status ⬜ Backlog.
- #220's body from the roadmap entry if the entry changed.
- The PR: the template filled in; `Closes #220`, `Closes #82`, `Closes #208`, `Closes #148`, `Closes #217`, `Closes #222`; the list of every issue change made in the phase; marked ready for review.

- [ ] **Step 5: Commit and push**

```bash
git add docs README.md
git commit -m "docs: add ADR 0034 and finish PH-12b on the roadmap"
git push
```
