# PH-12b Network and the demo-up button — design

- **Phase:** [PH-12b](../../roadmap.md#ph-12b-network-and-the-demo-up-button) ([#220](https://github.com/luiki-dev/szop/issues/220))
- **Date:** 2026-10-18
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-014](https://github.com/luiki-dev/szop/issues/82) and [OP-093](https://github.com/luiki-dev/szop/issues/208) (settled); [OP-013](https://github.com/luiki-dev/szop/issues/66), [OP-018](https://github.com/luiki-dev/szop/issues/73) and [OP-019](https://github.com/luiki-dev/szop/issues/77) (PH-12b part, then on to PH-12c); [OP-023](https://github.com/luiki-dev/szop/issues/74) (PH-12b part, then on to PH-13)

The first demo is created. Pressing `demo-up` builds the demo's network, its load balancer and its certificate, and `https://szop.dzwoniec.com` answers with a fixed placeholder page; the app itself comes in [PH-12c](../../roadmap.md#ph-12c-app-on-ecs-and-rds). The direction was settled before: the network of [ADR 0008](../../decisions/0008-hosting.md), decision 16, the certificate created per session ([ADR 0030](../../decisions/0030-domain-and-base-infrastructure-details.md), decision 5), the `demo-up` workflow of [ADR 0010](../../decisions/0010-ci-cd.md), decisions 11 and 13, and [ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decision 7, and the deploy role that grows with `infra/demo` and trusts `demo` only from this phase on ([ADR 0032](../../decisions/0032-ci-access-and-teardown-details.md), decisions 3, 10 and 14). This spec holds the details those left to the phase, as agreed in the brainstorm. They are recorded in ADR 0034.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Files](#files)
  - [How demo finds base's resources](#how-demo-finds-bases-resources)
  - [The network](#the-network)
  - [The load balancer and the placeholder page](#the-load-balancer-and-the-placeholder-page)
  - [The certificate and the DNS records](#the-certificate-and-the-dns-records)
  - [The deployed commit](#the-deployed-commit)
  - [The deploy role](#the-deploy-role)
  - [demo-up.yml](#demo-upyml)
  - [infra-plan.yml](#infra-planyml)
- [Documentation and records](#documentation-and-records)
- [Roadmap and GitHub changes](#roadmap-and-github-changes)
- [Owner steps](#owner-steps)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: pressing `demo-up` on a branch creates the demo's network, load balancer and certificate, and `https://szop.dzwoniec.com` answers with a placeholder page. `demo-down` removes everything again.

The phase is done when:

- `infra/base` is applied from the owner's machine with the widened `szop-ci-deploy`, and a second `terraform plan` shows no changes;
- IAM Access Analyzer's policy validation reports no errors and no security warnings for the deploy role's new policies, as shown in the phase PR's plan comment (the known trust-policy findings of ADR 0032, decision 4, stay accepted);
- the phase PR's plan comment shows `infra/demo` creating the network, the load balancer, the certificate and the two DNS records;
- `demo-up`, pressed on the phase branch and approved by the owner, finishes green: the `deploy` job applies `infra/demo`, finds the placeholder page at `https://szop.dzwoniec.com` showing the deployed commit, and writes a summary with the URL, the commit and the next nightly teardown;
- in a browser, `http://szop.dzwoniec.com` redirects to `https://szop.dzwoniec.com`, which shows the placeholder page with a valid certificate;
- `demo-down`, run by hand from `main`, reads the recorded commit, destroys with that commit's code, and reports `Destroy complete!` with every resource `demo-up` created; the Tag Editor finds nothing tagged `group` = `demo` afterwards;
- a `demo-up` run re-enables `demo-down` through the GitHub API, in a job without AWS credentials;
- `pnpm check:infra` and `pnpm check:workflows` pass;
- the docs and records listed under [Documentation and records](#documentation-and-records) are updated, and the roadmap and GitHub as in [Roadmap and GitHub changes](#roadmap-and-github-changes).

## Out of scope

- **The service on ECS, RDS, the app's roles, the image job and the security groups of the task and the database**: [PH-12c](../../roadmap.md#ph-12c-app-on-ecs-and-rds). The private subnets are created now and stay empty until then.
- **Waiting for `/api/health`**: PH-12c, when there is an app to answer it. PH-12b waits for the placeholder page.
- **Locking down the VPC's default security group, VPC flow logs and load balancer access logs** *(Claude's call)*: nothing uses the default security group, since every resource names its own; flow logs and access logs need a log destination and cost money for a demo watched live ([ADR 0008](../../decisions/0008-hosting.md), decision 27). [PH-35](../../roadmap.md#ph-35-security-scanners)'s scanner may raise them again, with the reasons recorded here.
- **IPv6** *(Claude's call)*: the load balancer and the network stay IPv4 only; a dual-stack network adds addresses, routes and rules for no audience that needs it.
- **Security headers on the placeholder page**: a fixed response carries no custom headers. The app sets its own in PH-12c ([ADR 0012](../../decisions/0012-security-baseline.md), decision 8).

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | How `infra/demo` finds base's resources ([OP-014](https://github.com/luiki-dev/szop/issues/82)) | Base's outputs through `terraform_remote_state`; lookups by name through data sources | **Lookups by name.** `infra/demo` asks AWS for base's resources by their fixed names (in this phase the hosted zone `dzwoniec.com`; in PH-12c the registry, the log group, the app's roles, and the secret's ARN, built from the account ID and the parameter's name, since `data "aws_ssm_parameter"` would read its value). The names live in one `locals` block in `infra/demo`. Reading base's outputs would give `szop-ci-deploy` `s3:GetObject` on base's whole state, a description of every IAM policy and the OIDC setup that any approved `demo-up` run could print, against [ADR 0010](../../decisions/0010-ci-cd.md), decision 16's rule that the deploy role cannot reach base. With lookups, the role reads only what it looks up, which it mostly needs anyway to use it; separately owned stacks commonly meet this way. **Cost:** each name is written in both modules, and a rename in base breaks demo's next plan, loudly. Answers [ADR 0008](../../decisions/0008-hosting.md), decision 6. |
| 2 | The network's layout *(Claude's call)* | — | **`10.0.0.0/16`, with public subnets `10.0.0.0/24` and `10.0.1.0/24` and private subnets `10.0.10.0/24` and `10.0.11.0/24`, in `eu-central-1a` and `eu-central-1b`.** The private subnets are created now, though RDS arrives in PH-12c: the network is this phase's concept, and subnets cost nothing. Public subnets do not give instances public addresses by default; PH-12c's service asks for one itself. |
| 3 | The placeholder page *(Claude's call)* | A plain "OK"; a page naming the deployed commit | **A short HTML page that says the demo is up, that the app arrives in PH-12c, and which commit it was deployed from.** `demo-up` waits until the page shows its own commit, and the owner's check sees the same, so both prove that this run's code is what answers, not an older demo or a cached page. |
| 4 | The load balancer's TLS policy *(Claude's call)* | — | **`ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09`:** TLS 1.3 and 1.2 with only strong ciphers, and post-quantum key exchange where the browser offers it. It is the newest restricted policy in `eu-central-1`; the older `ELBSecurityPolicy-TLS13-1-2-2021-06`, the console's default, still accepts weaker TLS 1.2 ciphers that no supported browser needs ([NFR](../../requirements/functional-requirements.md#3-non-functional-requirements)). |
| 5 | Who re-enables `demo-down` *(Claude's call)* | A step in the deploy job; a job of its own | **A job of its own, `enable-teardown`, with `actions: write` and no AWS credentials**, the split of [ADR 0032](../../decisions/0032-ci-access-and-teardown-details.md), decision 8: no job holds a write token for the repository and AWS credentials together. It runs first and needs no approval, so the safety net is back on even if the deploy is rejected or fails halfway. |
| 6 | The `ref` input *(Claude's call)* | Required; optional | **Optional.** Left empty, `demo-up` deploys the commit of the branch chosen in *Use workflow from*, which is the usual case: the button is pressed on the branch being checked. A branch, a tag or a full 40-digit commit hash in the input deploys that instead ([ADR 0010](../../decisions/0010-ci-cd.md), decision 11). A short hash is not accepted: `actions/checkout` looks it up as a branch name and fails, and supporting it would mean fetching the whole history first; the input's description says so. Found by the spec's builder check. |
| 7 | Making sure every apply records its commit *(Claude's call)* | A required variable; an optional variable checked by a precondition | **`deployed_commit` is optional (null by default), and a precondition refuses to create or change the demo without it.** A destroy never asks for it, so `demo-down` and the runbook's local destroy keep working unchanged; an apply without it, from CI or a laptop, fails before it creates anything, so no demo can exist that `demo-down` would destroy with the wrong code ([ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decision 7). A required variable would make every destroy pass a value it does not use, and `demo-down`'s fallback to `main`'s code would need a made-up one. |
| 8 | Which tag the deploy role's conditions check *(Claude's call)* | `project` = `szop`; `group` = `demo` as well | **Both: `project` = `szop` and `group` = `demo`**, in the request when creating and on the resource when changing or deleting. Base and bootstrap carry `project` = `szop` too, so that tag alone would not keep the role away from base's resources; `group` = `demo`, which only `infra/demo`'s provider sets, enforces [ADR 0010](../../decisions/0010-ci-cd.md), decision 16's "the deploy role cannot change base" in IAM. Harmless today, since base has no EC2, load balancer or ACM resource, but PH-12c copies the pattern to ECR and CloudWatch Logs, where base's registry and log group live. Found by the spec's builder check. |
| 9 | Where the deploy role's permissions live *(Claude's call)* | More inline policies on the role; customer managed policies attached to it | **Customer managed policies, `szop-ci-deploy-demo-network` and the like, one per area, attached to `szop-ci-deploy`**; the existing inline `state` policy stays. All inline policies of a role share 10,240 characters, which PH-12c's ECS, RDS, ECR, logs and `iam:PassRole` statements would likely exceed; a managed policy holds up to 6,144 characters each, and a role takes up to 10 of them. Splitting by area keeps each one readable in the plan comment. Found by the spec's builder check. |

## Design

### Files

| File | Change |
|---|---|
| `infra/demo/locals.tf` | new: the names of base's resources (`dzwoniec.com`, `szop.dzwoniec.com`), the availability zones and the address ranges |
| `infra/demo/data.tf` | new: the hosted zone by name |
| `infra/demo/network.tf` | new: the VPC, the four subnets, the internet gateway, the public route table and its associations |
| `infra/demo/load_balancer.tf` | new: the load balancer's security group and rules, the load balancer, the HTTP and HTTPS listeners |
| `infra/demo/certificate.tf` | new: the certificate, its validation record and the wait for it |
| `infra/demo/dns.tf` | new: the `szop` alias record |
| `infra/demo/variables.tf` | `deployed_commit` |
| `infra/demo/outputs.tf` | new: `deployed_commit`, `url` |
| `infra/demo/terraform.tfvars.example`, `providers.tf` | comments brought up to date |
| `infra/base/ci_roles.tf` | the `demo` trust statement; the deploy role's new managed policies and their attachments |
| `infra/base/outputs.tf` | `ci_deploy_role_arn`'s description names `demo-up.yml` too |
| `.github/workflows/demo-up.yml` | the real workflow, replacing the placeholder |
| `.github/workflows/demo-down.yml` | comments that still say "PH-12" brought up to date |
| `.github/workflows/infra-plan.yml` | plans `infra/demo` with the PR's head commit as `deployed_commit` |

### How demo finds base's resources

A `data "aws_route53_zone"` finds the public zone named `dzwoniec.com` ([decision 1](#decisions-taken-in-the-brainstorm)). The names sit in `locals.tf`, with a comment that they are base's and must change together with `infra/base/locals.tf`.

### The network

- **VPC** `10.0.0.0/16` with DNS support and DNS hostnames on (RDS and the ECS task need both in PH-12c), named `szop-demo`.
- **Public subnets** `szop-demo-public-a` (`10.0.0.0/24`, `eu-central-1a`) and `szop-demo-public-b` (`10.0.1.0/24`, `eu-central-1b`), `map_public_ip_on_launch = false`.
- **Private subnets** `szop-demo-private-a` (`10.0.10.0/24`) and `szop-demo-private-b` (`10.0.11.0/24`), no route beyond the VPC: the VPC's main route table, which only knows the local route, serves them.
- **Internet gateway** attached to the VPC, and a **public route table** with `0.0.0.0/0` through it, associated with the two public subnets.
- No NAT gateway and no VPC endpoints ([ADR 0008](../../decisions/0008-hosting.md), decision 16).

Every resource carries a `Name` tag next to the provider's default `project` and `group` tags, so the console and the Tag Editor show what it is.

### The load balancer and the placeholder page

- **Security group** `szop-demo-alb`: ingress on 443 and 80 from `0.0.0.0/0`, as separate `aws_vpc_security_group_ingress_rule` resources; no egress rule yet, since a fixed response sends nothing onward. PH-12c adds egress to the task's security group.
- **Application load balancer** `szop-demo`: internet-facing, IPv4, in the two public subnets, with `drop_invalid_header_fields = true` and deletion protection off (the demo is destroyed every session). It has `depends_on` the internet gateway: nothing else ties the two together, and an internet-facing load balancer created before its VPC has a gateway fails with `InvalidSubnet`, which the provider does not retry; on destroy the same edge makes the load balancer go before the gateway is detached.
- **Listener on 80:** redirects to HTTPS with a 301, keeping host, path and query.
- **Listener on 443:** the certificate, the TLS policy of [decision 4](#decisions-taken-in-the-brainstorm), and a default `fixed-response` action: status 200, `text/html`, the placeholder page. A fixed response's body is limited to 1024 bytes, so the page is a few lines of plain HTML with no styles or scripts:

  ```html
  <!doctype html><html lang="en"><meta charset="utf-8"><title>Szop demo</title>
  <h1>The Szop demo is up</h1>
  <p>The app arrives in PH-12c. Deployed from commit <code>…40 hex digits…</code>.</p></html>
  ```

### The certificate and the DNS records

- **`aws_acm_certificate`** for `szop.dzwoniec.com`, DNS validation, `create_before_destroy` so a redeploy that changes it never leaves the listener without one.
- **The validation record**, a CNAME `_<token>.szop.dzwoniec.com` written into the zone from the certificate's `domain_validation_options`, with `allow_overwrite = true`: ACM gives the same name and value for the same account and domain every session, so a record left behind by an interrupted destroy is taken over instead of failing the apply.
- **`aws_acm_certificate_validation`** waits until ACM has issued the certificate; the HTTPS listener uses its `certificate_arn`, so it is created only after issuance.
- **The `szop` record**: an `A` alias to the load balancer, `evaluate_target_health = false` (there is only one target).

The zone's CAA record already lets Amazon issue it ([ADR 0030](../../decisions/0030-domain-and-base-infrastructure-details.md), decision 6).

### The deployed commit

- `variable "deployed_commit"`: a string, default `null`, validated as 40 lowercase hex digits when set.
- A `lifecycle { precondition }` on the HTTPS listener, which every demo has, fails a plan that creates or changes it while `deployed_commit` is null ([decision 7](#decisions-taken-in-the-brainstorm)), with a message that says to pass `-var deployed_commit=$(git rev-parse HEAD)`.
- `output "deployed_commit"`, the value `demo-down` already reads ([ADR 0032](../../decisions/0032-ci-access-and-teardown-details.md), decision 6), and `output "url"`, `https://szop.dzwoniec.com`.

### The deploy role

`infra/base/ci_roles.tf` changes in two ways.

**Trust.** A second statement, `GitHubDemo`, matches `aud` and the immutable subject `repo:luiki-dev@290870182/szop@1380292421:environment:demo`, with no `ref` condition: `demo-up` runs from any branch ([ADR 0032](../../decisions/0032-ci-access-and-teardown-details.md), decisions 10 and 14). The `demo-teardown` statement keeps its `main` pin.

**Permissions.** New customer managed policies, attached to the role beside its inline `state` policy ([decision 9](#decisions-taken-in-the-brainstorm)), allow what the resources above need, scoped as tightly as each service supports ([ADR 0010](../../decisions/0010-ci-cd.md), decision 16):

- **Reading:** the `Describe*` and `List*`-style reads of EC2, Elastic Load Balancing and ACM that Terraform's refresh needs, on `*` (these actions support no resource scoping); in Route 53, `ListHostedZones` and `ListHostedZonesByName` (the zone lookup pages through the zones), `GetHostedZone`, `ListTagsForResource` (the lookup reads the zone's tags), `ListResourceRecordSets` (the record refresh) and `GetChange`.
- **Creating** VPCs, subnets, internet gateways, route tables, security groups, load balancers, listeners and certificates only with the tags `project` = `szop` and `group` = `demo` in the request (`aws:RequestTag/…`, [decision 8](#decisions-taken-in-the-brainstorm)), and tagging them on creation only: `ec2:CreateTags` only when `ec2:CreateAction` is one of those creates, `elasticloadbalancing:AddTags` only when `elasticloadbalancing:CreateAction` is. ACM has no such key, so `acm:AddTagsToCertificate` with the request tags could also tag an existing certificate and so bring it within the role's reach; this gap is accepted and recorded, since the account holds no certificate outside the demo (base keeps none, [ADR 0030](../../decisions/0030-domain-and-base-infrastructure-details.md), decision 5).
- **Changing and deleting** them only when they already carry `project` = `szop` and `group` = `demo` (`aws:ResourceTag/…`). Where an action also touches a resource that carries no tag of its own (a subnet created in the VPC, a route in a route table, a listener on a load balancer), the policy scopes it by the parent resource's tag or, where AWS offers neither, allows it in `eu-central-1` only (`aws:RequestedRegion`); the plan lists the exact actions per resource.
- **Route 53 records:** `ChangeResourceRecordSets` on the zone `dzwoniec.com` only, and only for the names `szop.dzwoniec.com` and `_*.szop.dzwoniec.com` (`route53:ChangeResourceRecordSetsNormalizedRecordNames`) and the types `A` and `CNAME` (`route53:ChangeResourceRecordSetsRecordTypes`). The apex's CAA, MX, DKIM, SPF and DMARC records stay out of reach.
- **Nothing in IAM.** The load balancer's service-linked role `AWSServiceRoleForElasticLoadBalancing` already exists in the account (created 2026-08-13), so the role needs no `iam:CreateServiceLinkedRole`.

Access Analyzer's findings on the new policy appear in the plan comment; any security warning is fixed, not accepted.

### demo-up.yml

Replaces the placeholder. `workflow_dispatch` with the optional `ref` input ([decision 6](#decisions-taken-in-the-brainstorm)); `permissions: {}` at the top; `concurrency: { group: demo-up, cancel-in-progress: false }` ([ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decision 7); bash with `-e -o pipefail` as in `demo-down`.

**Job `enable-teardown`** ([decision 5](#decisions-taken-in-the-brainstorm)): no environment, `permissions: { actions: write }`, `timeout-minutes: 5`; one step, `gh workflow enable demo-down.yml` with the job's token. It enables an already enabled workflow without error.

**Job `deploy`:** `environment: { name: demo, url: https://szop.dzwoniec.com }`, so it waits for the owner's approval and the repository page shows the demo; `permissions: { contents: read, id-token: write }`; `timeout-minutes: 30`. Steps:

1. **Check out** the input's ref, or the dispatching commit when it is empty, with `persist-credentials: false`; the ref goes through `with:`, never into a shell script.
2. **Resolve the commit:** `git rev-parse HEAD`, checked as 40 hex digits, into a step output.
3. **AWS credentials** with `szop-ci-deploy` (`vars.AWS_DEPLOY_ROLE_ARN`, session `gh-<run_id>`), the masked account ID and Terraform from `.terraform-version`, the steps `demo-down` already uses.
4. **`terraform init`** and **`terraform apply -auto-approve -input=false -lock-timeout=15m -no-color -var deployed_commit=<commit>`** on `infra/demo`.
5. **Wait for the page:** `curl` `https://szop.dzwoniec.com` every 10 seconds, for up to 10 minutes, until the body contains the commit; a new DNS name or a fresh load balancer can take a few minutes to answer.
6. **Summary** (always): the URL, the commit, the result of the apply and of the wait, and that `demo-down` destroys the demo at 01:17 UTC tonight unless pressed sooner.

No step runs `pnpm` or project scripts ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18): Terraform, the AWS CLI, git, curl and the shell only.

### infra-plan.yml

Planning `infra/demo` now creates resources, which the precondition refuses without a commit. The plan step passes `-var deployed_commit=<the PR's head commit>` for `infra/demo` (from `github.event.pull_request.head.sha`, through an environment variable), so the comment shows what `demo-up` on that branch would do. Base's plan is unchanged.

## Documentation and records

- **ADR 0034 "Network and demo-up details"**: the decisions above, and what building settles. Notes in [ADR 0008](../../decisions/0008-hosting.md), decision 6 (completed: lookups by name) and decision 16 (completed: the address ranges), [ADR 0010](../../decisions/0010-ci-cd.md), decisions 11 (completed: the optional input, the page check) and 13 (completed: the separate re-enabling job), and [ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decision 7 (completed: the precondition), plus their status lines.
- **`docs/operations/demo-environment.md`**: a new "Spinning up" section with the `demo-up` button as the primary path (choosing the branch, approving the run, reading the summary, checking the page, what a failed run means) and a local `terraform apply` as the fallback; "Tearing down" updated now that a demo exists (what gets destroyed, how long it takes, the Tag Editor check); a new "Destroying base" chapter ([OP-093](https://github.com/luiki-dev/szop/issues/208)): after `infra/demo`, lifting the zone's `prevent_destroy`, emptying the registry, and what deleting the zone does to the still-registered `dzwoniec.com`; "CI's roles and variables" gains the `demo` trust statement's checks; "Coming later" shrinks to PH-12c's debugging and costs.
- **`docs/development/ci-cd.md`**: the real `demo-up.yml`, its two jobs, the approval, and `infra-plan`'s `deployed_commit`.
- **`docs/development/github-settings.md`**: the `demo` environment (the owner as required reviewer, "prevent self-review" off, any branch).
- **`docs/architecture/threat-model.md`**: the load balancer as an entry point (HTTPS only, the redirect, the TLS policy, Shield Standard); the CI actor's `demo` path (any branch, after the owner's approval) and what the deploy role can now reach, including the two record names it may change.
- **`docs/architecture/architecture.md`**: the deployment section gains the demo's network and load balancer.
- **`docs/architecture/stack-overview.md`**: the AWS networking concepts: VPC, subnets and availability zones, the internet gateway and route tables, public and private subnets, security groups, the application load balancer with listeners and actions, ACM with DNS validation, alias records; tag-based conditions in IAM policies.
- **`docs/glossary.md`**: VPC, CIDR, AZ, ALB, ACM, IGW and any other acronym the phase brings that is not there yet.
- **The Terraform tool page**, if a command or a pattern it explains changes (data sources).

## Roadmap and GitHub changes

Done at the start (the branch's first commit and on GitHub): the stage table's row and the README's diagram on 🚧; #220 🚧 In progress, Started 2026-10-18; PH-12a's Finished 2026-10-18.

When the spec and the plan are committed: their links in the stage table and in #220's Spec and Plan fields.

Before the PR, listed in it:

- The stage table's row and the README's diagram with the PR link, set to ✅ before the merge; #220's body from the roadmap entry if the entry changed.
- [OP-014](https://github.com/luiki-dev/szop/issues/82) and [OP-093](https://github.com/luiki-dev/szop/issues/208): closed by the PR, each with a "settled by" comment.
- [OP-013](https://github.com/luiki-dev/szop/issues/66), [OP-018](https://github.com/luiki-dev/szop/issues/73), [OP-019](https://github.com/luiki-dev/szop/issues/77): the PH-12b part ticked with the PR, re-parented to PH-12c (#221). [OP-023](https://github.com/luiki-dev/szop/issues/74): the PH-12b part ticked, re-parented to PH-13 (#42).
- The three owner-step issues (#148, #217, #222): closed by the PR.

## Owner steps

1. **Create the `demo` environment** with the owner as required reviewer, "prevent self-review" off and no branch restriction, before base is applied with its trust ([ADR 0032](../../decisions/0032-ci-access-and-teardown-details.md), decision 10). (#148)
2. **Apply `infra/base` from the branch**, check that a second plan shows no changes; again from `main` after the merge. (#217)
3. **Press `demo-up` on the branch** (*Use workflow from*: the phase branch, `ref` empty), approve the run, open `https://szop.dzwoniec.com` and `http://szop.dzwoniec.com`, then **press `demo-down`** on `main` and check its summary. (#222)

Step 1 comes before step 2, and step 2 before the PR's plan comment can show clean Access Analyzer results and before step 3 can work.

## Tasks

About six, for the plan to detail:

1. `infra/demo`: the lookups, the network, the load balancer, the certificate, the DNS record, `deployed_commit`; `pnpm check:infra` passes and a local `terraform plan` with the owner's credentials shows the expected resources.
2. `infra/base`: the `demo` trust statement and the deploy role's permissions; `pnpm check:infra` passes.
3. `demo-up.yml`, `infra-plan.yml`'s `deployed_commit`, the comments in `demo-down.yml`; `pnpm check:workflows` passes.
4. The owner's steps 1 and 2, then the push, the plan comment and Access Analyzer's findings; the owner's step 3, and any permission the real run shows missing.
5. The runbook, `ci-cd.md`, `github-settings.md`, the threat model, the architecture, the stack overview and the glossary.
6. ADR 0034 and its notes in ADRs 0008, 0010 and 0011; the roadmap and GitHub changes.

## To verify during implementation

- That a precondition on a resource is skipped when that resource is destroyed, so `demo-down` and a local destroy work with `deployed_commit` null.
- The exact actions each resource needs from the deploy role, from the provider's calls and from the first real `demo-up` and `demo-down` runs, and which of them honour `aws:RequestTag` and `aws:ResourceTag`.
- That `ec2:CreateTags` is called within the create (tag on create) for every EC2 resource here with provider 6.69.1, so the `ec2:CreateAction` condition matches.
- That the `route53:ChangeResourceRecordSetsNormalizedRecordNames` condition matches the validation record's name as ACM gives it (lowercase, with or without the trailing dot).
- That `gh workflow enable` succeeds on a workflow that is already enabled, with `actions: write`.
- How long the first `demo-up` and `demo-down` take, for the runbook and for whether the 30-minute and 60-minute timeouts still fit.
