# PH-35 Security scanners — design

- **Phase:** [PH-35](../../roadmap.md#ph-35-security-scanners) ([#213](https://github.com/luiki-dev/szop/issues/213))
- **Date:** 2026-10-22
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-091](https://github.com/luiki-dev/szop/issues/201) and [OP-090](https://github.com/luiki-dev/szop/issues/194), settled (Trivy for both; no Dockerfile linter); [OP-104](https://github.com/luiki-dev/szop/issues/253), settled (the `Deny`)

[ADR 0010](../../decisions/0010-ci-cd.md), decision 19 chose "the baseline plus scanners" for the pipeline and the code. CodeQL and zizmor cover the code and the workflows; nothing scans the Terraform code for misconfigurations or the container image for known vulnerabilities. This phase adds both, with one tool, Trivy, and makes the scanners and IAM Access Analyzer block a PR above a set severity. To give all of them one gate and one PR comment, `infra-plan.yml` is folded into `ci.yml`. The phase also closes OP-104's `Deny` on the deploy role, since it touches the same IAM code the scanners now read. The decisions are recorded in ADR 0041.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Files](#files)
  - [Installing Trivy](#installing-trivy)
  - [The config scan](#the-config-scan)
  - [The image scan](#the-image-scan)
  - [The plan and Access Analyzer in ci.yml](#the-plan-and-access-analyzer-in-ciyml)
  - [The comment](#the-comment)
  - [The gate](#the-gate)
  - [Running the scans locally](#running-the-scans-locally)
  - [OP-104: the Deny](#op-104-the-deny)
- [The baseline today](#the-baseline-today)
- [Documentation and records](#documentation-and-records)
- [Roadmap and GitHub changes](#roadmap-and-github-changes)
- [Owner steps](#owner-steps)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: CI scans the Terraform code for security misconfigurations and the container image for known vulnerabilities. The Dockerfile lint in the goal is dropped *(the owner's choice)*: Trivy's config scan covers the Dockerfile's security checks, and a style linter is not worth a second tool.

The phase is done when:

- on a PR that changes `infra/`, CI runs Trivy's config scan, `terraform plan` and Access Analyzer, and on a PR that changes anything that goes into the image, it runs Trivy's image scan; each blocks `ci-ok` at the thresholds of [decision 2](#decisions-taken-in-the-brainstorm), and nothing below them blocks;
- **one PR comment** shows the plan and every scanner's findings, blocking ones first, and a later push updates it;
- the phase's own PR is green with the three accepted exceptions in place, and its comment shows them as accepted, the image's unfixed vulnerabilities in their own section with the [standing note](#the-comment), and no fixed vulnerability;
- **a deliberate failure is seen once:** a throwaway commit on the branch (a security group open to `0.0.0.0/0` on port 22, say) turns `ci-ok` red with the finding in the comment, and is reverted;
- `infra-plan.yml` is gone, and `ci.yml`'s `plan` job assumes `szop-ci-plan` exactly as `infra-plan.yml` did;
- the `Deny` of [OP-104](#op-104-the-deny) is in `infra/base`, checked with the IAM policy simulator, and applied from the branch;
- **on the demo:** `demo-up` on the phase branch finishes green with the image without npm, `/api/health` answers `200`, and `demo-down` reports `Destroy complete!`;
- `pnpm check`, `pnpm check:image`, `pnpm check:infra` and `pnpm check:workflows` pass;
- the docs and records under [Documentation and records](#documentation-and-records) are updated, and the roadmap and GitHub as in [Roadmap and GitHub changes](#roadmap-and-github-changes).

## Out of scope

- **A Dockerfile style linter** (hadolint) *(the owner's choice)*.
- **A distroless or other smaller base image** to bring the unfixed vulnerabilities down. No open point is added *(the owner's choice)*; the comment explains why the unfixed ones are accepted.
- **GitHub code scanning (SARIF uploads)** for Trivy: findings go to the comment, not to *Security → Code scanning*, and the ruleset's code scanning rule stays CodeQL's alone.
- **A scheduled scan of `main`** for vulnerabilities published after a merge: the next PR that rebuilds the image finds them.
- **Supply-chain provenance** (SBOM, signed attestations): [ADR 0010](../../decisions/0010-ci-cd.md), decision 19 left it for later.
- **Fixing the medium and low findings** of [the baseline](#the-baseline-today). They are shown in the comment; AWS-0342 is only assessed ([OP-104](#op-104-the-deny)).
- **The public-address half of OP-104**: no condition key exists for it; the threat model names it as a residual risk.

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | What a finding does | Every finding blocks; nothing blocks, the PR lists them; block above a severity, list the rest | **Block above a severity, list the rest** *(the owner's choice)*. The owner first asked for listing only, then for a threshold that blocks, and asked for the industry's practice; the thresholds of decision 2 are that practice. |
| 2 | The thresholds | — | *(The owner's choice, from Claude's proposal.)* **Image:** `CRITICAL` and `HIGH` with a fixed version block; vulnerabilities without a fix and lower severities are listed. **Terraform and Dockerfile (Trivy config):** `CRITICAL` and `HIGH` block; `MEDIUM` and `LOW` are listed. **Access Analyzer:** `ERROR` and `SECURITY_WARNING` block; `WARNING` and `SUGGESTION` are listed; a policy whose validation failed blocks, since it was not checked. Blocking only fixable vulnerabilities is what keeps a PR from turning red because a CVE was published overnight against a package nobody can update; AWS's own [tf-policy-validator](https://github.com/awslabs/terraform-iam-policy-validator) fails on `ERROR` and `SECURITY_WARNING` by default. |
| 3 | The tool | Trivy, Grype or Docker Scout for the image; Trivy, Checkov or KICS for Terraform; Trivy, hadolint or Checkov for the Dockerfile | **Trivy for all three; no Dockerfile linter** *(the owner's choice)*. One tool gives one severity scale, one way to record exceptions and one output to read into the comment. Checkov has more Terraform rules but is a second tool on Python; Grype covers only the image; Scout needs a Docker account; hadolint adds style, not security. |
| 4 | Where the scanners run, and `infra-plan.yml` | Keep `infra-plan.yml` and make it a required check that always reports (a `changes` job, an `infra-ok` job, the ruleset changed); keep it and post a second comment; fold it into `ci.yml` | **Fold `infra-plan.yml` into `ci.yml`** *(the owner's choice)*. One workflow gives one comment and one gate, `ci-ok`, with no new required check and no ruleset change. A workflow filtered by `paths:` reports nothing on a PR that does not match, so it cannot be a required check without a stand-in job that always reports; two workflows writing one comment would race. The jobs keep their permissions: `plan` holds `contents: read` and `id-token: write`, `comment` holds `pull-requests: write`, and no job holds both. AWS sees no change: the OIDC token names the repository and the event, not the workflow file. **Supersedes [ADR 0010](../../decisions/0010-ci-cd.md), decision 5 in part** (the PR checks may now assume a role, in the one `plan` job) **and decision 14 in part** (the plan is no longer only informative: Access Analyzer's findings and a failed plan block a PR that changes `infra/`). |
| 5 | When AWS is down | — | **A PR that changes `infra/` is blocked** while the plan or Access Analyzer cannot run *(the owner accepted it)*. A gate that could not check does not let the change through. PRs that do not change `infra/` do not plan and are not affected. |
| 6 | The comment | One comment for everything; the plan's comment plus one for the image | **One comment for every scan and the plan** *(the owner's choice)*. |
| 7 | Unfixed vulnerabilities in the comment | — | **Listed in their own folded section, with a standing note** that says why they do not block today *(the owner's choice)*: no fix exists yet; they are in the base image's operating-system packages, which the app does not use; the container runs as `node`, not root, and exposes only the app's port behind the load balancer; when a fix appears, Dependabot proposes the new base image and the scan starts blocking until it is merged. One note for the section, not one per CVE. |
| 8 | npm in the image | List its findings as exceptions; remove it from the final stage | **Remove npm, npx and Corepack from the final stage** *(the owner's choice)*. All seven fixable `HIGH` findings of the baseline are in npm's own dependencies (`/usr/local/lib/node_modules/npm`), which the image never runs: the app and `db-setup` start with `node`. Removing it fixes them and shrinks what an attacker in the container could use; exceptions would hide a problem one line removes. |
| 9 | The three blocking config findings | Fix them; accept them with an exception | **Accepted, each with an inline exception and its reason** *(the owner's choice)*: `AWS-0104` (the task's egress on 443 to `0.0.0.0/0`, for ECR, Secrets Manager and CloudWatch without VPC endpoints), `AWS-0053` (the demo's load balancer is public, as it must be), `AWS-0132` (the state bucket uses SSE-S3, not a customer-managed KMS key, which costs about $1 a month and more IAM). The comment lists accepted exceptions, so they stay visible. |
| 10 | Running Trivy safely | The `aquasecurity/trivy-action` or `setup-trivy` action; Trivy's Docker image; the release binary, pinned and checked | **The release binary from GitHub Releases, at a pinned version, checked against a SHA-256 kept in the workflow**, as tflint and actionlint are installed. On 19–20 March 2026 a stolen credential was used to publish a malicious Trivy v0.69.4 and to point almost every tag of both actions at a credential stealer, for about 12 hours; malicious images 0.69.5 and 0.69.6 were pushed to Docker Hub ([CVE-2026-33634](https://cve.circl.lu/cve/CVE-2026-33634)). A pinned checksum stops a swapped download; a version at least two weeks old, outside the attack's range, makes pinning a bad release unlikely. **The version: v0.75.0** (1 October 2026); v0.76.x were under two weeks old on 2026-10-22. *(Claude's proposal, accepted.)* |
| 11 | Which jobs run Trivy *(Claude's call)* | A step in `plan`, `infra` and `docker`; jobs of their own | **Two jobs of their own, `scan-config` and `scan-image`, with `contents: read` only.** Trivy never runs in a job that holds AWS credentials (`plan`), a write token (`comment`) or the Actions cache token (`docker`, which writes the image's layers to GitHub's cache with `cache-to: type=gha`). A compromised Trivy in `docker` could poison `main`'s build cache. `docker` saves the image it built as an artifact, and `scan-image` scans the archive with `trivy image --input`, with no Docker daemon. **The scan jobs run on pull requests only**, not on pushes to `main` *(found by the spec's builder check)*: the artifact and cache steps in a scan job give it the Actions runtime token, and a process Trivy left behind could read it from a later step. On a PR that token is scoped to the PR's merge ref and harmless; on a push to `main` it could write `main`'s cache. Every commit on `main` came through a PR that was scanned, and a red `main` would tell nobody anything, since there is no scheduled scan. |
| 12 | Trivy's rules *(Claude's call)* | Download the newest checks bundle on every run; use the checks built into the pinned binary | **The built-in checks** (`--skip-check-update`), so the config rules change only when Trivy's version is bumped, in a PR that shows what changed. The vulnerability database is downloaded on every run, as it must be. |
| 13 | Exceptions *(Claude's call)* | A `.trivyignore` file for everything; inline comments for Terraform and a file for image vulnerabilities | **Inline `trivy:ignore` comments next to the Terraform resource**, each with its reason on the line above, so the reason sits next to the code. **Image vulnerabilities:** a `.trivyignore.yaml` with a statement and an expiry date for each entry, created only when the first one is needed; none is needed today. |
| 14 | PRs that cannot comment *(Claude's call)* | Fail them; skip the comment and write the same text to the job summary | **The comment's text is always written to the run's job summary as well; the `comment` job is skipped on PRs from forks**, whose `GITHUB_TOKEN` is read-only. The gate does not depend on the comment. A fork PR also gets no plan (no OIDC token); its config and image scans still block, and the summary says that the plan and Access Analyzer did not run. **Dependabot's PRs keep the comment:** run 39680421083 on PR #256, triggered by `dependabot[bot]`, assumed `szop-ci-plan` and posted its comment with `pull-requests: write` *(found by the spec's builder check)*, which also answers [OP-019](https://github.com/luiki-dev/szop/issues/77)'s question. |
| 15 | Running locally *(Claude's call)* | CI only; a script that CI and the developer both run | **`scripts/scan.sh`, run by CI's two scan jobs and by the developer as `pnpm check:scan`**, as `check-infra.sh` is. Trivy is installed on the developer's machine at the same version (setup guide). |
| 16 | OP-104 | — | **As the issue describes**: a `Deny` on `rds:ModifyDBInstance` when `rds:ManageMasterUserPassword` is `false`, checked with the policy simulator; the public-address half named as a residual risk in the threat model; the misleading comment above `StopDbSetup` fixed. Trivy's `AWS-0342` (`iam:PassRole` filtering) on the same role is assessed and changed only if it is a real gap *(Claude's proposal, accepted)*. |

## Design

### Files

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | New jobs `scan-config`, `scan-image`, `plan` and `comment`; `docker` uploads the image archive; `ci-ok` needs the new gating jobs |
| `.github/workflows/infra-plan.yml` | Deleted |
| `scripts/scan.sh` (new), `package.json` | `scan.sh config` and `scan.sh image <archive or image>`, writing Trivy's JSON and failing at the thresholds; `"check:scan"` |
| `scripts/` (the comment's writer) | The comment step's shell and `jq` move from `infra-plan.yml`; whether into a script or a step is the builder's call |
| `Dockerfile` | The final stage removes npm, npx and Corepack |
| `infra/demo/service.tf`, `infra/demo/load_balancer.tf`, `infra/bootstrap/state_bucket.tf` | The three inline exceptions, each with its reason |
| `infra/base/ci_roles.tf` | OP-104's `Deny`; the `StopDbSetup` comment fixed; AWS-0342 as assessed |
| `infra/base/outputs.tf` | Its mention of `infra-plan` updated |
| Docs | As listed under [Documentation and records](#documentation-and-records) |

### Installing Trivy

A step in each scan job, written like the tflint step: `TRIVY_VERSION` and `TRIVY_SHA256` in the job's `env`, with the comment that Dependabot cannot see them and they are bumped by hand; `curl` the `trivy_<version>_Linux-64bit.tar.gz` asset, `sha256sum --check`, extract `trivy` only. The checksum is the one from the release's `trivy_<version>_checksums.txt`, copied into the workflow when the version is bumped; v0.75.0's archive verified locally on 2026-10-22. The tool page records the rule: a version at least two weeks old, and the release notes and Aqua's advisories read before a bump.

The vulnerability database is cached with `actions/cache` (in `scan-image` only, which holds no other token), keyed by the day, so a run downloads it at most once a day. Whether the cache is worth it is the builder's call.

### The config scan

`scan-config` runs when `changes` says `code` is true (any change that is not Markdown, which includes `infra/` and the `Dockerfile`); it takes seconds, so no output of its own is added to `changes`. `scripts/scan.sh config` runs `trivy config --skip-check-update --format json` over `infra/` (all three modules, bootstrap included, though CI never plans it) and the `Dockerfile`, then reads the JSON with `jq`: every `FAIL` with its severity, rule ID, file and line, title and link; and the ones an inline exception suppressed, with their reason, if Trivy reports them (see [To verify](#to-verify-during-implementation)). The job uploads the result as an artifact and fails if any `CRITICAL` or `HIGH` finding is left. Whether to scan the repository root instead, so a new kind of file is picked up by default, is the builder's call, as long as `node_modules` and generated files stay out.

### The image scan

`docker` builds the image as today, then `docker save`s `szop:local` to an archive and uploads it (retention 1 day; the image is about 90 MB). `scan-image` downloads it and runs `scripts/scan.sh image`, which runs `trivy image --input <archive> --scanners vuln --format json` and splits the findings in three: **blocking** (`CRITICAL` or `HIGH` with a `FixedVersion`), **unfixed** (no `FixedVersion`, any severity), **other** (fixed, `MEDIUM` and lower). It uploads the result and fails on any blocking finding. It runs whenever `docker` runs.

The Dockerfile's final stage removes `/usr/local/lib/node_modules/npm`, `/usr/local/lib/node_modules/corepack` and their links in `/usr/local/bin` (`npm`, `npx`, `corepack`, and the `pnpm` and `pnpx` shims that `corepack enable` added in `base`), as root before `USER node`, with a comment saying why. `check-image.sh`, `check-scale.sh` and the demo prove the app still starts.

### The plan and Access Analyzer in ci.yml

`infra-plan.yml`'s `plan` job moves into `ci.yml` unchanged in what it does, with three differences:

- it runs on `pull_request` only, when `changes` says `infra` is true and the PR comes from this repository (the role trusts nothing else);
- the trigger list of `changes`' `infra` output gains nothing new: it already covers `infra/`, `.terraform-version`, `scripts/check-infra.sh` and `ci.yml` itself;
- instead of always ending green, a last step **fails the job** when a module's plan failed, when Access Analyzer gave an `ERROR` or `SECURITY_WARNING`, or when a policy's validation failed. A policy still unknown in the plan ("not checked until applied") does not block: it is checked by the next PR after the apply, as today.

The step that writes the plan's part of the comment stays in `plan` (it runs on `!cancelled()`), and so does the artifact. The header comment of the workflow and the job carries over `infra-plan.yml`'s explanation of the job split.

### The comment

The `comment` job, moved from `infra-plan.yml`, needs `plan`, `scan-config` and `scan-image`, runs on `!cancelled()` when any of them ran, and downloads their artifacts. It keeps today's rules: no checkout, `pull-requests: write` only, text that came from the PR filtered as today and passed only as a file, the comment found by its hidden marker and updated, never added twice. The marker changes (say `<!-- ci-scans -->`); the builder decides whether an old `<!-- infra-plan -->` comment on an open PR is updated or left.

Its order, each part present only when its job ran:

1. **A verdict line:** "❌ N blocking finding(s)" or "✅ nothing blocking", with the planned commit and a link to the run.
2. **Blocking findings**, from every scanner, most serious first.
3. **Terraform plan**, per module, as today (counts, changed resources folded).
4. **IAM Access Analyzer**, as today, with the blocking types marked.
5. **Trivy config**: the listed findings (`MEDIUM`, `LOW`) folded, and the accepted exceptions with their reasons.
6. **Trivy image**: the listed findings folded; then **unfixed vulnerabilities**, folded, with their count by severity and the standing note of [decision 7](#decisions-taken-in-the-brainstorm).

The same text goes to the job summary of the run (decision 14). A finding's text that came from Trivy's database (titles) is filtered like Access Analyzer's messages.

### The gate

`ci-ok` needs `scan-config`, `scan-image` and `plan` as well as today's jobs, and passes when each succeeded or was skipped, as now. `comment` is not in `ci-ok`'s needs: a failed comment hides the findings from the PR's conversation but not from the summary, and does not let anything through. The ruleset is unchanged.

### Running the scans locally

`pnpm check:scan` runs `scripts/scan.sh config`, then builds the image (or takes `--no-build` and the `szop:local` image) and runs `scan.sh image`, printing the findings as a table and exiting non-zero at the thresholds. The setup guide installs Trivy at the workflow's version, with the checksum.

### OP-104: the Deny

In `infra/base/ci_roles.tf`, the deploy role's database policy gains a statement:

- `Effect: Deny`, `Action: rds:ModifyDBInstance`, the demo's instance as resource, condition `Bool rds:ManageMasterUserPassword = false`. A modify that does not name the key (Terraform's ordinary changes) does not match and still passes.

It is checked with `aws iam simulate-custom-policy` on the policy documents from the branch's plan, before the apply, for three cases: a modify with the key `false` (denied), with `true` (allowed), without the key (allowed); the commands and results go in ADR 0041. Claude runs it with the owner's SSO session on this machine, a read-only call, so it needs no owner step *(Claude's call, found by the spec's builder check)*. Access Analyzer validates the policy in the PR's own comment. The comment above `StopDbSetup` is corrected: the app's tasks carry no `Name` tag (the service has no `propagate_tags`), so the condition holds because `db-setup`'s tag is required, not because the app's tag differs; the builder checks the statement's conditions say what the comment will say.

**AWS-0342** (`iam:PassRole` without filtering) points at the deploy role's service policy. Its `PassAppRoles` statement already names the two app roles and conditions on `iam:PassedToService` = `ecs-tasks.amazonaws.com` *(found by the spec's builder check)*, so the finding is explained in the ADR and left; the builder confirms the condition Trivy looks for is the one present, and records why it still reports it.

## The baseline today

Run locally on 2026-10-22 with Trivy v0.75.0 against `main` at `ddd2c9c` and an image built from it.

**Config:** 14 findings. Blocking: `AWS-0104` (CRITICAL, `infra/demo/service.tf:34`), `AWS-0053` (HIGH, `infra/demo/load_balancer.tf:47`), `AWS-0132` (HIGH, `infra/bootstrap/state_bucket.tf:43`), all three accepted ([decision 9](#decisions-taken-in-the-brainstorm)). Listed: `AWS-0077`, `AWS-0176`, `AWS-0177`, `AWS-0178`, `AWS-0342` (MEDIUM); `AWS-0017`, `AWS-0033`, `AWS-0034`, `AWS-0089`, `AWS-0133`, `DS-0026` (LOW).

**Image** (Debian 13.7): 43 `HIGH`, 58 `MEDIUM`, 60 `LOW` and 3 `UNKNOWN` in the operating system, none with a fix; in Node.js, 8 `HIGH` (7 with a fix), 12 `MEDIUM`, 1 `LOW`, all in npm's bundled dependencies (`brace-expansion`, `tar`, `undici`, `ip-address`, `http-cache-semantics`). After npm is removed, no fixable `HIGH` or `CRITICAL` is expected; the builder confirms it.

## Documentation and records

- **ADR 0041 "Security scanners details"**: the decisions above and what building settles, with the simulator results. Notes: [ADR 0010](../../decisions/0010-ci-cd.md), decision 5 and decision 14 (superseded in part, decision 4), decision 19 (completed); [ADR 0032](../../decisions/0032-ci-access-and-teardown-details.md), decision 4 (refined: Access Analyzer runs in `ci.yml` and blocks) and decision 8 (refined: the comment job lives in `ci.yml` and posts every scan); their status lines.
- **`docs/development/ci-cd.md`**: `infra-plan.yml`'s rows and *The plan comment* rewritten for `ci.yml`'s jobs; the scan jobs; the comment's parts; the thresholds; reading a blocked PR and adding an exception; the rules list (the one job with `id-token: write`).
- **`docs/development/tools/trivy.md`** (new): what Trivy is, why it was chosen, the two scans and their thresholds, exceptions, the install and the bump rule, the March 2026 incident. `tools/github-actions.md` and `tools/terraform.md`: `infra-plan` mentions updated.
- **`docs/development/setup.md`**: installing Trivy. **`docs/development/scripts.md`**: `check:scan`.
- **`docs/architecture/threat-model.md`**: the scanners as a guard; Trivy as a supply-chain risk and how it is run; OP-104's residual (the deploy role can make the database publicly accessible with `ModifyDBInstance`; the security group and the private subnet group guard it); `infra-plan` mentions.
- **`docs/architecture/architecture.md`**, **`stack-overview.md`**: `infra-plan` mentions; the stack overview gains a short section on vulnerability and misconfiguration scanning (CVEs, fixed and unfixed, severities, exceptions).
- **`docs/development/github-settings.md`**, **`phase-walkthrough.md`**: `infra-plan` mentions brought in line.
- **`docs/glossary.md`**: CVE, SSE-S3, KMS, customer-managed key, misconfiguration scanner, and any other new term.
- **`docs/architecture/aws-resources.md`**: no resource added; updated only if it names the deploy role's statements.

## Roadmap and GitHub changes

- **`roadmap.md`**, PH-35's entry: **Delivers** rewritten (Trivy for both scans, no linter, the thresholds, `infra-plan` folded into `ci.yml`, npm removed, OP-104's `Deny`); **Owner steps** as below; spec and plan links in the stage table as they land.
- **GitHub:** the owner-step issues created as sub-issues of #213; the phase issue's Spec and Plan fields; #213's body updated when the PR opens; OP-090, OP-091 and OP-104 closed by the PR with a "settled by" comment.

## Owner steps

1. Apply `infra/base` from the branch (OP-104's `Deny`), before the demo check.
2. Press `demo-up` on the branch, check `/api/health` answers `200`, then press `demo-down`.
3. After the merge, apply `infra/base` again from `main`.

## Tasks

About six, in this order:

1. **Trivy and the config scan:** `scripts/scan.sh config`, `check:scan`'s config half, `scan-config` in `ci.yml`, the three inline exceptions, the tool page and the setup guide.
2. **The image scan:** npm removed from the Dockerfile, the image archive from `docker`, `scan.sh image`, `scan-image`.
3. **The plan in `ci.yml`:** `plan` moved with its failing last step, `infra-plan.yml` deleted, `ci-ok`'s needs.
4. **The comment:** the `comment` job for every scan, the job summary, the deliberate failure seen once and reverted.
5. **OP-104:** the `Deny`, the simulation, the `StopDbSetup` comment, AWS-0342 assessed.
6. **Docs and records:** ADR 0041 and its notes, the docs above, the roadmap entry.

## To verify during implementation

- **Trivy's inline exception syntax and IDs** in v0.75.0: the rule IDs print as `AWS-0104`, older docs say `AVD-AWS-0104`; which one `trivy:ignore:` takes, and whether a reason can follow on the same line.
- **Whether Trivy's JSON reports suppressed findings** (and their reason), so the comment can list accepted exceptions; if it does not, the comment lists them from the inline comments with a `grep`, or `--show-suppressed` if it exists.
- **`trivy image --input`** on a `docker save` archive needs no daemon, and finds the same vulnerabilities as scanning the loaded image.
- **The `trivy:ignore` comment on `state_bucket.tf`** does not change bootstrap's plan (comments never do).
- **The vulnerability database download** works from GitHub's runners without a token (Trivy's default mirror), and how long it takes.
