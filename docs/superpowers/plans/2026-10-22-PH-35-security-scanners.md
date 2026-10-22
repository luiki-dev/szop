# PH-35 Security scanners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CI scans the Terraform code and the Dockerfile for misconfigurations and the container image for known vulnerabilities with Trivy, blocks a PR above set severities together with IAM Access Analyzer, and shows every result in one PR comment.

**Architecture:** `scripts/scan.sh` runs Trivy and sorts its findings into blocking and listed ones, for CI and for `pnpm check:scan`. In `ci.yml`, two jobs of their own, `scan-config` and `scan-image`, run it with `contents: read` only; `infra-plan.yml`'s `plan` and `comment` jobs move into `ci.yml`, `plan` fails on blocking Access Analyzer findings, and `comment` writes one comment from every job's artifact. `ci-ok` needs the scan jobs and `plan`. The image loses npm; the deploy role gains OP-104's `Deny`.

**Tech Stack:** Trivy v0.75.0 (release binary), bash and `jq`, GitHub Actions, Docker (`docker save`), Terraform and the AWS CLI (`iam simulate-custom-policy`).

**Spec:** [`docs/superpowers/specs/2026-10-22-PH-35-security-scanners-design.md`](../specs/2026-10-22-PH-35-security-scanners-design.md)

## Global Constraints

- Trivy **v0.75.0**, archive `trivy_0.75.0_Linux-64bit.tar.gz`, SHA-256 `c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f`, from `https://github.com/aquasecurity/trivy/releases/download/v0.75.0/`. Never `aquasecurity/trivy-action`, `setup-trivy` or a Trivy Docker image. A version bump: at least two weeks old, release notes and Aqua's advisories read.
- Trivy config always with `--skip-check-update` (the built-in checks).
- Thresholds: **config** `CRITICAL` and `HIGH` block, `MEDIUM` and `LOW` listed. **Image** `CRITICAL` and `HIGH` with a `FixedVersion` in a result of `Class` `lang-pkgs` block; fixed in `os-pkgs` (any severity) are "waiting for the base image"; no `FixedVersion` are "unfixed"; the rest are listed. **Access Analyzer** `ERROR` and `SECURITY_WARNING` block, and so does a policy whose validation failed or a module whose plan failed; `WARNING`, `SUGGESTION` and "not checked until applied" do not.
- Trivy never runs in a job that holds `id-token: write`, `pull-requests: write` or the build cache (`docker`). `scan-config` and `scan-image` run on `pull_request` only and hold `contents: read` only.
- Inline exceptions: `# trivy:ignore:<ID> -- <reason>` on the line above the resource (verified locally: the text after the ID does not stop the match; a wrong ID does not suppress). Trivy's JSON does not report suppressed findings, so the comment lists exceptions by reading these lines.
- The comment's marker: `<!-- ci-scans -->`. The comment is skipped for PRs from forks only; its text always goes to the job summary too.
- `pnpm check` passes after every code task; `pnpm check:workflows` after every workflow change; `pnpm check:infra` after every `infra/` change.
- Never run `terraform apply` or `destroy` against AWS, never `gh workflow run`, never trigger `demo-up` or `demo-down`, never merge, never delete a remote branch. Read-only AWS calls with the owner's SSO profile `szop` are allowed (`AWS_PROFILE=szop`).
- Nothing that identifies the owner's account goes into a commit: no account ID, no ARN with the account number, no email address.
- Commits follow Conventional Commits and end with `Co-Authored-By: <the model that wrote the commit> <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_012E8Txf21ssFQSNaHLMGaj8`. The branch is `feat/ph-35-security-scanners`; never commit to `main`.
- Docs: niche acronyms spelled out on first use and in `docs/glossary.md`; every status with its icon; requirements linked, never plain IDs; long docs keep their `## Contents` in sync; ADR notes in three places (CLAUDE.md, "Documentation").
- **After each task:** tick its step boxes (`- [ ]` → `- [x]`) in this plan within the task's own commit, `git push` the phase branch, then stop and summarize the task for the owner; start the next task only when the owner says so (`docs/superpowers/plans/CLAUDE.md`).

## Review Focus

1. **A scan that fails to run read as "no findings".** A Trivy crash, a failed DB download or JSON that does not parse must fail the job, never pass it. Task 1 and Task 2 check `scan.sh` exits non-zero when Trivy exits non-zero or its output is not JSON.
2. **A blocking finding lost between the scan and the gate.** The job must fail on the scan's own exit code, not on the comment. Task 4's deliberate failure checks `ci-ok` is red and the comment names the finding.
3. **Text from Trivy's database or a PR in the comment.** Titles and package names pass the same `code`/`text` filters as Access Analyzer's messages. Task 4 runs the writer on a fixture title holding `` ` ``, `<`, `[`, `@` and a line break and checks none survives as Markdown.
4. **A PR that touches no infra and no code** (Markdown only), and a push to `main`. No scan, no plan, no comment, `ci-ok` green. Task 4, Step 3 walks every new job's `if` with `code=false, infra=false` on `pull_request`, and with `push`, and states which jobs run.
5. **The image without npm failing at start.** Task 2 runs `pnpm check:image` and `pnpm check:scale`; Task 7's demo check proves it on ECS.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/scan.sh` (new) | `scan.sh config [--json FILE]` and `scan.sh image [--no-build \| --input ARCHIVE] [--json FILE]`: run Trivy, sort the findings, print a table, write the sorted JSON, exit 1 on blocking findings or a failed scan |
| `scripts/write-ci-comment.sh` (new) | Reads a directory of the jobs' artifacts and prints the comment's Markdown; the `jq` and filters moved out of `infra-plan.yml` |
| `.github/workflows/ci.yml` | Jobs `scan-config`, `scan-image`, `plan`, `comment`; `docker` uploads the image archive; `ci-ok`'s needs |
| `.github/workflows/infra-plan.yml` | Deleted |
| `package.json` | `"check:scan": "scripts/scan.sh all"` |
| `Dockerfile` | The final stage removes npm, Corepack and their links |
| `infra/demo/service.tf`, `infra/demo/load_balancer.tf`, `infra/bootstrap/state_bucket.tf` | One exception each |
| `infra/base/ci_roles.tf` | `DenyUnmanagedMasterPassword`; the `StopDbSetup` comment |
| Docs | Task 6 |

**The sorted JSON** (`scan.sh --json`), which Task 4 reads. Every finding is `{severity, id, title, url, target, line}` for config and `{severity, id, title, url, target, pkg, installed, fixed}` for the image:

- config: `{"kind":"config","blocking":[…],"listed":[…],"exceptions":[{"id","reason","file","line"}]}`
- image: `{"kind":"image","blocking":[…],"waiting":[…],"unfixed":[…],"listed":[…]}`

Each list is sorted by severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`), then ID.

---

### Task 1: Trivy and the config scan

**Files:**
- Create: `scripts/scan.sh`, `docs/development/tools/trivy.md`
- Modify: `.github/workflows/ci.yml` (job `scan-config`, `ci-ok`'s needs), `package.json`, `infra/demo/service.tf:28`, `infra/demo/load_balancer.tf:44`, `infra/bootstrap/state_bucket.tf` (the encryption resource, line 43's block), `docs/development/setup.md` (section 8 or a new one), `docs/development/scripts.md`

**Interfaces:**
- Produces: `scripts/scan.sh config [--json FILE]`, exit 0 (nothing blocking) or 1; the config JSON above; the `scan-config` job, which uploads `scan-config.json` as artifact `scan-config`.

- [x] **Step 1: Write `scan.sh config`**

Bash with `set -euo pipefail`, `cd` to the repository root, header comment in the style of `check-infra.sh`. Runs `trivy config --quiet --skip-check-update --format json --output "$tmp" infra` and the same for `Dockerfile` (two runs, results concatenated, or one run over a list; builder's choice), fails with `FAIL: trivy config` if Trivy exits non-zero or `jq -e .Results` fails. Sorts `Status == "FAIL"` findings by the thresholds; `target` is the path from the repository root, `line` is `CauseMetadata.StartLine`, `url` is `PrimaryURL`. Exceptions: every `# trivy:ignore:<ID> -- <reason>` line under `infra/` and in `Dockerfile` (`grep -rn`), as `{id, reason, file, line}`. Prints a table (severity, ID, file:line, title) with `BLOCKING` and `LISTED` headings and the exceptions, writes `--json` if given, exits 1 if `blocking` is not empty with `FAIL: N blocking finding(s)`.

- [x] **Step 2: Run it on `main`'s code and see it fail**

Run: `scripts/scan.sh config`
Expected: exit 1, BLOCKING lists `AWS-0104`, `AWS-0053`, `AWS-0132`; LISTED the 11 others of the spec's baseline.

- [x] **Step 3: The three exceptions**

Above each resource, one comment line with the reason in the file's comment style, then the ignore line:
- `aws_vpc_security_group_egress_rule.task_https`: `# trivy:ignore:AWS-0104 -- HTTPS to ECR, Secrets Manager and CloudWatch, which the task reaches without VPC endpoints (ADR 0041)`
- `aws_lb.main`: `# trivy:ignore:AWS-0053 -- the demo is reached from the internet through this load balancer (ADR 0041)`
- the state bucket's server-side encryption resource: `# trivy:ignore:AWS-0132 -- SSE-S3 is enough for the state, which holds no secret values; a customer-managed KMS key costs about $1 a month and more IAM (ADR 0041)`

- [x] **Step 4: Run it again**

Run: `scripts/scan.sh config; echo "exit $?"` and `pnpm check:infra`
Expected: `exit 0`, nothing BLOCKING, the three exceptions listed with their reasons; `check:infra` passes.

- [x] **Step 5: A failed scan is a failure**

`scan.sh` runs Trivy as `${TRIVY:-trivy}`, so a Trivy that fails can be stood in.
Run: `TRIVY=false scripts/scan.sh config; echo "exit $?"` and `TRIVY=true scripts/scan.sh config; echo "exit $?"` (exits 0 and writes no JSON)
Expected: both `FAIL: trivy config`, exit 1. Task 2 repeats both for `scan.sh image`.

- [x] **Step 6: `check:scan` and the job**

`package.json`: `"check:scan": "scripts/scan.sh all"` (Task 2 adds `all`; until then `config` alone, changed in Task 2). `ci.yml`: job `scan-config`, `needs: changes`, `if: github.event_name == 'pull_request' && needs.changes.outputs.code == 'true'`, `contents: read`, `timeout-minutes: 10`, `env: TRIVY_VERSION`, `TRIVY_SHA256` with the comment "Updated by hand: Dependabot cannot see versions inside run steps (docs/development/tools/trivy.md)"; steps: checkout (`persist-credentials: false`), install Trivy as the tflint step does (`curl`, `sha256sum --check`, `tar -xzf … trivy`, `$RUNNER_TEMP/bin` on `GITHUB_PATH`), `scripts/scan.sh config --json "$RUNNER_TEMP/scan-config.json"`, then on `!cancelled()` upload it as `scan-config` (retention 1 day). A comment above the job gives the reason it is a job of its own (spec, decision 11). `ci-ok` needs `scan-config`.
Run: `pnpm check:workflows`. Expected: no findings.

- [x] **Step 7: Docs**

`docs/development/tools/trivy.md`: what it is; why (spec decisions 3 and 10, the March 2026 incident with [CVE-2026-33634](https://cve.circl.lu/cve/CVE-2026-33634)); the two scans and the thresholds; exceptions and how to add one; install, version and the bump rule; running it locally. `setup.md`: install Trivy at v0.75.0 with the checksum, as tflint's block does, and what `pnpm check:scan` shows. `scripts.md`: `check:scan`.

- [x] **Step 8: Commit and push**

```bash
git add scripts/scan.sh package.json .github/workflows/ci.yml infra docs docs/superpowers/plans
git commit -m "ci: scan the Terraform code and the Dockerfile with Trivy"
git push
```

---

### Task 2: The image scan

**Files:**
- Modify: `Dockerfile` (final stage), `scripts/scan.sh` (`image`, `all`), `.github/workflows/ci.yml` (`docker` uploads the archive; job `scan-image`; `ci-ok`), `package.json`, `docs/development/tools/trivy.md`

**Interfaces:**
- Consumes: Task 1's `scan.sh` and install step.
- Produces: `scan.sh image [--no-build | --input ARCHIVE] [--json FILE]`, `scan.sh all`; the image JSON above; artifact `image` (`szop.tar`) from `docker`; the `scan-image` job, which uploads `scan-image.json` as artifact `scan-image`.

- [x] **Step 1: Write `scan.sh image` and see it fail on today's image**

Without options it builds `szop:local` as `check-image.sh` does; `--no-build` scans the existing `szop:local`; `--input` scans an archive (`trivy image --input`). Runs `trivy image --quiet --scanners vuln --format json`, fails with `FAIL: trivy image` on a non-zero exit or no `.Results`. Sorts by the thresholds using each result's `Class`. Table headings `BLOCKING`, `WAITING FOR THE BASE IMAGE` (count by severity only), `UNFIXED` (count by severity only), `LISTED`. `all` runs `config`, then `image`, and exits 1 if either did.
Run: `scripts/scan.sh image; echo "exit $?"`
Expected: exit 1; BLOCKING holds the seven npm findings of the spec's baseline (`brace-expansion`, `tar`, `undici`, `ip-address`); UNFIXED counts 43 `HIGH` in the OS (numbers may have moved since 2026-10-22).

- [x] **Step 2: Remove npm from the final stage**

After `FROM base` and before `USER node`: one `RUN rm -rf` of `/usr/local/lib/node_modules/npm`, `/usr/local/lib/node_modules/corepack` and `/usr/local/bin/{npm,npx,corepack,pnpm,pnpx,yarn,yarnpkg}`, with a comment: nothing in the image runs them (the app and `db-setup` start with `node`), and npm's own dependencies carried the image's fixable vulnerabilities (PH-35 spec, decision 8).

- [x] **Step 3: Run the scan and the image checks**

Run: `scripts/scan.sh image; echo "exit $?"`, then `pnpm check:image` and `pnpm check:scale`
Expected: `exit 0`, BLOCKING empty; both checks pass. If a fixable `lang-pkgs` finding remains in the app's own dependencies, stop and report it to the owner.

- [x] **Step 4: `--input` finds the same**

Run: `docker save szop:local -o /tmp/…/szop.tar` (scratchpad), `scripts/scan.sh image --input <that file> --json a.json`, `scripts/scan.sh image --no-build --json b.json`, `diff <(jq -S . a.json) <(jq -S . b.json)` ignoring `target` if it differs.
Expected: the same findings.

- [x] **Step 5: The jobs**

`docker`: after `check-scale.sh`, `docker save szop:local -o "$RUNNER_TEMP/szop.tar"` and upload it as `image` (retention 1 day), on `pull_request` only. Job `scan-image`: `needs: [changes, docker]`, `if: github.event_name == 'pull_request' && needs.docker.result == 'success'`, `contents: read`, the same Trivy install, download `image`, `scripts/scan.sh image --input szop.tar --json "$RUNNER_TEMP/scan-image.json"`, upload `scan-image` on `!cancelled()`. Whether to cache Trivy's database with `actions/cache` keyed by the date is the builder's call (spec, *Installing Trivy*). `ci-ok` needs `scan-image`. `package.json`: `check:scan` → `scripts/scan.sh all`.
Run: `pnpm check:workflows`. Expected: no findings.

- [x] **Step 6: Commit and push**

```bash
git add Dockerfile scripts/scan.sh package.json .github/workflows/ci.yml docs docs/superpowers/plans
git commit -m "ci: scan the image with Trivy and drop npm from it"
git push
```

Then check the PR's run: `scan-config` and `scan-image` green, their artifacts present.

---

### Task 3: The plan and Access Analyzer in ci.yml

**Files:**
- Modify: `.github/workflows/ci.yml` (job `plan`, header comment, `ci-ok`)
- Delete: `.github/workflows/infra-plan.yml`
- Modify: `infra/base/outputs.tf` (its `infra-plan` mention), `infra/base/ci_roles.tf` (comments naming `infra-plan.yml`, if any)

**Interfaces:**
- Consumes: `changes`' `infra` output.
- Produces: job `plan`, artifact `plan` holding `base/` and `demo/` (each `result`, `counts.json`, `changes.json`, `findings.jsonl`, `unchecked.txt`, `aa-errors.txt`, `checked`) and nothing else; the comment's Markdown is no longer written here.

- [x] **Step 1: Move the job**

`plan` from `infra-plan.yml` into `ci.yml`, steps unchanged except: `needs: changes`; `if: github.event_name == 'pull_request' && needs.changes.outputs.infra == 'true' && github.event.pull_request.head.repo.full_name == github.repository`; the *Write the comment* step is replaced by uploading `$RUNNER_TEMP/base` and `$RUNNER_TEMP/demo` as artifact `plan` on `!cancelled()` (Task 4 writes the comment); the `concurrency` and `-lock=false` comments carried over where they still apply. `ci.yml`'s header says one job assumes an AWS role and why (spec, decision 4), with the job-split explanation from `infra-plan.yml`'s header.

- [x] **Step 2: The gate step**

Last step of `plan`, on `!cancelled()`: fails with an `::error::` line per cause when a module's `result` is not `ok`, when `findings.jsonl` holds a `findingType` of `ERROR` or `SECURITY_WARNING`, or when `aa-errors.txt` is not empty. The plan step keeps ending green itself, so the artifact is always written.

- [x] **Step 3: Delete `infra-plan.yml`, update `ci-ok` and the mentions**

`ci-ok` needs `plan`. Every `infra-plan` mention under `infra/` and in workflow comments now names `ci.yml`'s `plan` job.
Run: `pnpm check:workflows` and `grep -rn "infra-plan" .github infra scripts`
Expected: no findings; no match.

- [x] **Step 4: Commit, push and check the run**

```bash
git add -A .github/workflows infra docs/superpowers/plans
git commit -m "ci: plan and validate IAM policies in ci.yml and block on serious findings"
git push
```

The PR's run: `plan` runs (the branch changes `infra/`), assumes `szop-ci-plan`, is green with today's three accepted Access Analyzer findings (two `SUGGESTION`, one `WARNING`), uploads `plan`. No `infra-plan` run appears.

---

### Task 4: One comment

**Files:**
- Create: `scripts/write-ci-comment.sh`
- Modify: `.github/workflows/ci.yml` (job `comment`)

**Interfaces:**
- Consumes: artifacts `plan` (Task 3), `scan-config` (Task 1), `scan-image` (Task 2), each possibly missing.
- Produces: `scripts/write-ci-comment.sh DIR` → Markdown on stdout, `DIR` holding `plan/{base,demo}/…`, `scan-config.json`, `scan-image.json`; env `PLANNED_SHA`, `RUN_URL`.

- [x] **Step 1: Write the writer**

Moves `infra-plan.yml`'s `defs` (`code`, `text`) and its plan and Access Analyzer `jq` unchanged in meaning. Prints, in the spec's order (*The comment*): the marker `<!-- ci-scans -->`; the verdict line (`❌ N blocking finding(s)` or `✅ nothing blocking`) counting blocking scan findings, blocking Access Analyzer findings, failed validations and failed plans; planned commit and run link; **Blocking** (every scanner, by severity); **Terraform plan** per module; **IAM Access Analyzer** with `ERROR` and `SECURITY_WARNING` marked blocking; **Trivy config** (listed folded in `<details>`, then *Accepted exceptions* with their reasons); **Trivy image** (listed folded; *Fixed in Debian, waiting for the base image* folded with counts and its note; *Unfixed* folded with counts and its note). A part is printed only when its artifact is present; when `plan` is missing on a PR that changed `infra/` from a fork, a line says the plan and Access Analyzer did not run. Every title, package name, path and reason passes `text` or `code`.

The two notes, as text:
- **Fixed in Debian, waiting for the base image:** "Debian has published a fix, but the official `node:24-trixie-slim` image does not include it yet. These do not block: no change in this repository can install the fix. Dependabot proposes the new base image once it is published (PH-35 spec, decision 17)."
- **Unfixed:** "No fix exists yet. These do not block: they are in the base image's operating-system packages, which the app does not use; the container runs as `node`, not root, and exposes only the app's port behind the load balancer. When a fix appears, the finding moves to the section above (PH-35 spec, decision 7)."

- [x] **Step 2: Try it on fixtures**

In the scratchpad, a `DIR` with the real artifacts of the PR's last run (`gh run download`) and a copy of `scan-image.json` whose first title is ``a`b<c>[d](e)@f\ng``.
Run: `scripts/write-ci-comment.sh DIR`
Expected: every part present in order; the fixture title prints with no backtick, angle or square bracket and `@` followed by a zero-width space; with `scan-image.json` removed, the image part is gone and the rest unchanged.

- [x] **Step 3: The `comment` job**

Moved from `infra-plan.yml`: `needs: [changes, plan, scan-config, scan-image]`, `if: ${{ !cancelled() && github.event_name == 'pull_request' && (needs.plan.result != 'skipped' || needs.scan-config.result != 'skipped' || needs.scan-image.result != 'skipped') }}`. It needs the script, so it checks out with `persist-credentials: false` and `sparse-checkout: scripts/write-ci-comment.sh` (or the builder's equivalent that fetches nothing else) — the comment's text still travels only as a file. Downloads the three artifacts (missing ones tolerated), runs the writer to `comment.md`, appends it to `$GITHUB_STEP_SUMMARY`, then, unless the PR comes from a fork, posts or updates the comment found by `<!-- ci-scans -->` as `infra-plan.yml` did. `pull-requests: write` and `contents: read` only. Not in `ci-ok`'s needs.
Then walk every job's `if` for a Markdown-only PR (`code=false`, `infra=false`) and for a push to `main`, and write the result in the commit message's body.
Run: `pnpm check:workflows`. Expected: no findings; for both cases `scan-config`, `scan-image`, `plan` and `comment` skip, and `ci-ok` would pass.

- [x] **Step 4: Commit, push, read the comment**

```bash
git add scripts/write-ci-comment.sh .github/workflows/ci.yml docs/superpowers/plans
git commit -m "ci: post every scan and the plan in one PR comment"
git push
```

The PR gets one `<!-- ci-scans -->` comment with ✅, the plan, Access Analyzer's three findings, the three exceptions, the waiting and unfixed sections; a second push updates it.

- [x] **Step 5: The deliberate failure, once**

Commit `test: open SSH to the world to see the scanners block` adding to `infra/demo/service.tf` an `aws_vpc_security_group_ingress_rule` on the task's group, port 22, `0.0.0.0/0`; push. Expected: `scan-config` red, `ci-ok` red, the comment ❌ with the finding under *Blocking*. Then `git revert` it (`revert: …`), push, and see `ci-ok` green. Note the run URL for the ADR.

---

### Task 5: OP-104's Deny

**Files:**
- Modify: `infra/base/ci_roles.tf` (`ci_deploy_demo_database`, the `StopDbSetup` comment)

**Interfaces:**
- Produces: statement `DenyUnmanagedMasterPassword`; the simulator commands and results for Task 6's ADR.

- [ ] **Step 1: The statement**

In `data.aws_iam_policy_document.ci_deploy_demo_database`: `effect = "Deny"`, `actions = ["rds:ModifyDBInstance"]`, `resources` the demo instance's ARN pattern as `DemoDatabases` scopes it, `condition { test = "Bool", variable = "rds:ManageMasterUserPassword", values = ["false"] }`, with a comment: a modify that leaves the key out (Terraform's ordinary changes) does not match; the public-address half has no condition key and stays a residual risk (threat model; OP-104).

- [ ] **Step 2: Simulate it**

`terraform -chdir=infra/base plan -refresh=false -out=…` with `AWS_PROFILE=szop` (read-only), take the rendered policy document from `terraform show -json` (scratchpad, never committed), then `aws iam simulate-custom-policy --policy-input-list file://… --action-names rds:ModifyDBInstance --resource-arns <the demo instance's ARN with the account replaced by the real one only on the command line> --context-entries` three times: `rds:ManageMasterUserPassword=false` (expected `explicitDeny`), `=true` (`allowed`), none (`allowed`; the allow statement's own conditions passed as context entries too: region, tags).
Expected: the three results as listed. Record the commands with the account ID replaced by `<account>`.

- [ ] **Step 3: The `StopDbSetup` comment and AWS-0342**

The comment above `StopDbSetup` says what holds: the app's tasks carry no `Name` tag (the service has no `propagate_tags`), so the condition on `db-setup`'s tag is what keeps the role from stopping them; read the statement's conditions to word it exactly. Read `PassAppRoles` and note for the ADR that it names the two roles and conditions on `iam:PassedToService`, and why Trivy's `AWS-0342` still reports it (its check's logic, from `PrimaryURL`).
Run: `pnpm check:infra`, `scripts/scan.sh config`. Expected: pass; no new finding.

- [ ] **Step 4: Commit and push**

```bash
git add infra/base/ci_roles.tf docs/superpowers/plans
git commit -m "feat(infra): deny turning off the demo database's managed master password"
git push
```

The PR's comment shows the plan's change to `szop-ci-deploy-demo-database` and no new Access Analyzer finding.

---

### Task 6: The docs and ADR 0041

**Files:**
- Create: `docs/decisions/0041-security-scanners-details.md`
- Modify: `docs/decisions/0010-ci-cd.md`, `docs/decisions/0032-ci-access-and-teardown-details.md`, `docs/development/ci-cd.md`, `docs/development/tools/github-actions.md`, `docs/development/tools/terraform.md`, `docs/architecture/threat-model.md`, `docs/architecture/architecture.md`, `docs/architecture/stack-overview.md`, `docs/development/github-settings.md`, `docs/development/phase-walkthrough.md`, `docs/glossary.md`, `docs/roadmap.md` (PH-35's entry), `docs/architecture/aws-resources.md` only if it names the role's statements

- [ ] **Step 1: ADR 0041**

The spec's decisions 1–17 with options and reasons, and *Settled while building*: the exception syntax, Trivy's JSON not reporting suppressed findings, the `--input` check, the simulator commands and results (Task 5), AWS-0342's explanation, the deliberate failure's run (Task 4), OP-019's answer (Dependabot gets OIDC and a write token). Header: `Supersedes in part: ADR 0010, decisions 5 and 14`, `Completes: ADR 0010, decision 19`, `Refines: ADR 0032, decisions 4 and 8`.

- [ ] **Step 2: The notes on the earlier ADRs**

Status lines of ADR 0010 and ADR 0032; the cell notes (`🔁 **Superseded in part by [ADR 0041](0041-security-scanners-details.md), decision 4:** …` on decisions 5 and 14; `🧩 **Completed by …**` on 19; `✏️ **Refined by …**` on 0032's 4 and 8), oldest first.

- [ ] **Step 3: The living docs**

As the spec's *Documentation and records* lists them. `ci-cd.md`: the trigger table, the `infra-plan.yml` row and *The plan comment* rewritten as `ci.yml`'s `plan`, `scan-config`, `scan-image` and `comment` jobs; the comment's parts; the thresholds; reading a blocked PR and adding an exception; the rules list (the one job with `id-token: write`); the Dependabot/OIDC paragraph settled. Threat model: the scanners as a guard, Trivy as a supply-chain risk and how it runs, OP-104's residual. Stack overview: a short section on vulnerability and misconfiguration scanning. Glossary: CVE, SSE-S3, KMS, customer-managed key, misconfiguration scanner. Roadmap: PH-35's **Delivers** and **Owner steps** as the spec's *Roadmap and GitHub changes* and *Owner steps*. Every `## Contents` in sync.
Run: `pnpm format:check`, `grep -rn "infra-plan" docs --include=*.md | grep -v "docs/decisions\|docs/superpowers\|docs/archive\|docs/audits"`
Expected: pass; only intended historical mentions remain.

- [ ] **Step 4: Commit and push**

```bash
git add docs
git commit -m "docs: record PH-35's decisions and describe the security scans"
git push
```

---

### Task 7: The owner's run and the tracking

**Files:**
- Modify: this plan (ticks), `docs/roadmap.md`, `README.md`, `docs/decisions/0041-security-scanners-details.md` (the demo run)

- [ ] **Step 1: The owner's steps** *(the owner)*

Apply `infra/base` from the branch; `demo-up` on the branch's head, `/api/health` `200`, `demo-down` `Destroy complete!`. Claude records the `demo-up` run and its commit for the PR.

- [ ] **Step 2: GitHub**

OP-090 (#194), OP-091 (#201) and OP-104 (#253) get a "settled by" comment naming the PR (closed by it); OP-019 (#77) gets a comment with the finding, and is closed or re-parented as its parts say; #213's body copied from the roadmap entry; the owner-step issues closed when the owner says.

- [ ] **Step 3: The PR**

Stage table row and README diagram in line, with the PR link. PR titled `feat: scan the infrastructure and the image with Trivy`, the template filled in, `Closes #213`, `Closes #194`, `Closes #201`, `Closes #253`, and the list of issue changes.

- [ ] **Step 4: Commit and push**

```bash
git add docs README.md
git commit -m "docs: record PH-35's demo run and open its PR"
git push
```
