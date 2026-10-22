# CI/CD

How Szop's continuous integration (CI) works: which checks run on which event, how to read a failed run, and the rules every workflow follows. Every pull request is checked in GitHub Actions, and a failing check blocks the merge; CodeQL scans the code and the workflows, and Dependabot proposes updates every week. *Why* it works this way is in [ADR 0010](../decisions/0010-ci-cd.md) (the direction) and [ADR 0018](../decisions/0018-ci-details.md) (the details). [PH-11](../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net) gave CI its access to AWS (the plan of `infra/`, then a workflow of its own, and `demo-down`, with a placeholder `demo-up`), [PH-12b](../roadmap.md#ph-12b-network-and-the-demo-up-button) made `demo-up` real and [PH-12c](../roadmap.md#ph-12c-app-on-ecs-and-rds) made it build and deploy the app, and [PH-35](../roadmap.md#ph-35-security-scanners) moved the plan into `ci.yml` and added the security scans ([ADR 0041](../decisions/0041-security-scanners-details.md)); later phases add to this guide, such as releases ([PH-13](../roadmap.md#ph-13-releases)).

The checks run the PR's own code and configuration: its workflows, its `package.json` scripts, its `commitlint.config.js`. A PR could therefore weaken a check along with the change it checks; the owner's review of every changed file is what catches that.

## Contents

- [What runs when](#what-runs-when)
- [The jobs](#the-jobs)
  - [The merge ref](#the-merge-ref)
  - [The workflows that reach AWS](#the-workflows-that-reach-aws)
  - [demo-up, job by job](#demo-up-job-by-job)
- [ci-ok and the required checks](#ci-ok-and-the-required-checks)
- [Change detection](#change-detection)
- [Reading a failed run](#reading-a-failed-run)
  - [Reading a failed E2E run](#reading-a-failed-e2e-run)
- [Dependabot](#dependabot)
- [CI's access to AWS](#cis-access-to-aws)
- [The security scans and the PR comment](#the-security-scans-and-the-pr-comment)
  - [The thresholds](#the-thresholds)
  - [The PR comment](#the-pr-comment)
  - [Reading a blocked PR](#reading-a-blocked-pr)
  - [Adding an exception](#adding-an-exception)
- [Rules for every workflow](#rules-for-every-workflow)
- [CodeQL](#codeql)

## What runs when

| Event | What runs |
|---|---|
| A push to a branch without a PR | Nothing. Open a PR to get the checks. |
| A PR to `main` opened, reopened or pushed to | `ci.yml`, `pr-title.yml` and CodeQL. When the PR changes code, `ci.yml` also scans the Terraform code, the `Dockerfile` and the image with Trivy, and posts what it found as one PR comment ([The security scans and the PR comment](#the-security-scans-and-the-pr-comment)) |
| The same PR, when it changes `infra/`, `.terraform-version`, `scripts/check-infra.sh` or `ci.yml` itself, and comes from this repository | also `ci.yml`'s `plan` job: it plans `infra/base` and `infra/demo`, has IAM Access Analyzer validate every IAM policy in the plan, and adds both to the same comment. A failed plan or a serious finding blocks the PR through `ci-ok` |
| A PR's title edited | `pr-title.yml` only (it also reruns when the description is edited, which is harmless) |
| A push to `main` (every merge) | `ci.yml`, without the jobs that run on PRs only (`commits`, the scans, `plan` and `comment`), and CodeQL |
| Every Monday | Dependabot looks for updates and opens PRs, which then run like any PR |
| Every night at 01:17 UTC, and when started by hand (*Actions → demo-down → Run workflow*) | `demo-down.yml` destroys `infra/demo` ([runbook](../operations/demo-environment.md#tearing-down)) |
| When started by hand (*Actions → demo-up → Run workflow*) | `demo-up.yml` builds the image, then pushes it and applies `infra/demo` after the owner's approval, and starts the app ([runbook](../operations/demo-environment.md#spinning-up)) |

`ci.yml` keeps one run per PR: a new push to the PR cancels the run still going for the previous push. On `main`, a running run is never cancelled, but a run still waiting to start can be replaced by a newer push: GitHub keeps at most one run waiting, so when several merges land in quick succession, not every merge necessarily gets its own run.

CodeQL's default setup also scans `main` once a week on its own schedule.

## The jobs

`ci.yml` holds the quality checks, as parallel jobs. Each job starts on a fresh runner; each job that needs the repository checks it out and, if it needs Node, runs the shared setup action (`.github/actions/setup`: pnpm, Node from `.nvmrc`, `pnpm install --frozen-lockfile`, with the pnpm store cached).

| Job | Runs when | What it runs | Locally |
|---|---|---|---|
| `changes` | always | Lists the files the PR changes and decides which jobs are needed ([Change detection](#change-detection)) | — |
| `lint` | code changed | ESLint, then Prettier in check mode | `pnpm lint` and `pnpm format:check` |
| `typecheck` | code changed | TypeScript, without emitting files | `pnpm typecheck` |
| `test` | code changed | Starts PostgreSQL from `compose.yaml` (`docker compose up -d --wait`, after copying `apps/api/.env.example` to `apps/api/.env`), then the tests: every Vitest project (`pnpm test:coverage`), with Vitest's test report and a coverage table in the job summary | `pnpm test` (or `pnpm test:coverage`) with PostgreSQL running |
| `build` | code changed | `pnpm build`: the web app's production build, with its precompressed copies. It fails when the first screen's JavaScript exceeds 200 KB of Brotli ([NFR-3](../requirements/functional-requirements.md#nfr-3), [ADR 0023](../decisions/0023-production-build-and-serving-details.md)) and prints the size in its log. It needs no database | `pnpm build` |
| `e2e` | code changed | Starts PostgreSQL as `test` does, installs Playwright's browsers, then `pnpm test:e2e`: builds the web app and runs the end-to-end (E2E) journeys on desktop Chromium, desktop Firefox and an emulated phone. When it fails, it uploads the HTML report as the `playwright-report` artifact | `pnpm test:e2e` with PostgreSQL running and the browsers installed ([setup guide](setup.md#the-end-to-end-journeys)) |
| `docker` | code changed | Builds the container image with BuildKit, its layers cached in GitHub's cache, with the build argument `GIT_COMMIT` set to the commit, and loads it as `szop:local` without pushing it anywhere; then `scripts/check-image.sh --no-build` starts it next to PostgreSQL from `compose.yaml` and checks that it becomes healthy, reports that commit in `/api/health`, runs as `node` and serves the SPA at `/` ([ADR 0028](../decisions/0028-container-image-details.md)); then `scripts/check-scale.sh --no-build` starts two instances of it behind nginx on a fresh database and checks that both migrate, one after the other, and both answer through nginx ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decision 14); on a PR, it then saves the image with `docker save` and uploads it as the `image` artifact, kept one day, for `scan-image`. It runs no `pnpm install` on the runner: the dependencies are installed only inside the build | `pnpm check:image` and `pnpm check:scale` with Docker running ([Docker](tools/docker.md)) |
| `infra` | a file under `infra/`, `.terraform-version`, `scripts/check-infra.sh` or `.github/workflows/ci.yml` changed | Installs Terraform in the version of `.terraform-version` (`hashicorp/setup-terraform`) and tflint as a release binary checked against `TFLINT_SHA256`, then `scripts/check-infra.sh`: `terraform fmt -check`, `terraform init -backend=false` and `terraform validate` for every module, tflint with the AWS ruleset ([ADR 0029](../decisions/0029-aws-account-and-terraform-bootstrap-details.md)). It has **no AWS credentials**: nothing reads the state or reaches AWS. `GITHUB_TOKEN` is passed only so tflint's plugin download is not rate-limited | `pnpm check:infra` ([Terraform](tools/terraform.md), [tflint](tools/tflint.md)) |
| `scan-config` | code changed, on a PR only | Installs Trivy as a release binary checked against `TRIVY_SHA256`, then `scripts/scan.sh config`: Trivy's misconfiguration rules over the Terraform code under `infra/` and over the `Dockerfile`. Fails on a `CRITICAL` or `HIGH` finding, and whenever the scan itself did not run; keeps the sorted findings as the `scan-config` artifact for one day. It holds `contents: read` and nothing else ([ADR 0041](../decisions/0041-security-scanners-details.md), decision 11) | `pnpm check:scan` ([Trivy](tools/trivy.md)) |
| `scan-image` | `docker` succeeded, on a PR only | Installs Trivy the same way, downloads the `image` artifact and runs `scripts/scan.sh image --input`: Trivy's vulnerability scan of the image archive, with no Docker daemon. Fails on a `CRITICAL` or `HIGH` vulnerability that has a fix in a Node package, and whenever the scan itself did not run; keeps the findings as the `scan-image` artifact for one day. It holds `contents: read` and nothing else | `pnpm check:scan` |
| `plan` | infra changed (as for `infra`), on a PR from this repository only | Assumes `szop-ci-plan`, then for `infra/base` and `infra/demo`: `terraform init` and `terraform plan -lock=false` (`infra/demo` with `-var deployed_commit=` the PR's head commit, since its precondition refuses a plan without one, so the comment shows what `demo-up` on that branch would do; `infra/base` with `-refresh=false`, [ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 11), the counts and changed addresses, and IAM Access Analyzer's validation of every IAM policy in the plan. A module whose `init` or `plan` fails does not stop the other. Keeps the results as the `plan` artifact for one day, then fails when a module's plan failed, Access Analyzer gave an `ERROR` or `SECURITY_WARNING`, or a policy could not be validated, one `::error::` line per cause. It holds `contents: read` and `id-token: write`, and runs nothing but Terraform, the AWS CLI, git and jq | `terraform plan` in the module, with your SSO sign-in |
| `comment` | on a PR, after `plan`, `scan-config` and `scan-image`, when any of them ran, unless the run was cancelled | Downloads their artifacts and runs `scripts/write-ci-comment.sh`, which writes the [PR comment](#the-pr-comment); writes it to the job summary, then posts it, or updates the comment that already carries the hidden marker `<!-- ci-scans -->`. The post is skipped on a fork's PR. It holds `contents: read` and `pull-requests: write`, and no AWS credentials; it checks out only the writer script, from the PR's merge commit. Not part of `ci-ok`: the gate is the jobs themselves | `scripts/write-ci-comment.sh <folder of artifacts>` |
| `commits` | every PR, never on `main` | commitlint on every commit of the branch that is not on `main`, from `HEAD^1` to `HEAD^2` (see [The merge ref](#the-merge-ref)) | `pnpm exec commitlint --from origin/main --to HEAD` |
| `workflows` | a file under `.github/workflows/` or `.github/actions/`, or `.github/dependabot.yml` or `.github/zizmor.yml`, changed | [actionlint](tools/actionlint.md), then [zizmor](tools/zizmor.md), which runs even when actionlint failed (a cancelled run still stops), so one run reports both. The `lint` job does the same for `pnpm format:check` after `pnpm lint` | `pnpm check:workflows` (offline); see their tool pages |
| `ci-ok` | always, after all the others | Sums up the results ([below](#ci-ok-and-the-required-checks)) | — |

`pr-title.yml` has one job, **`pr-title`**: it pipes the PR title into commitlint, with the same rules as every commit, because the title becomes the merge commit's message. Check a title locally with `echo "feat(api): add health check" | pnpm exec commitlint`. It is a workflow of its own so that editing the title reruns only this check, not the whole of `ci.yml`.

**Why the `e2e` job does not cache the browsers.** It installs them on every run (`playwright install --with-deps chromium firefox`). Restoring a cache takes about as long as the download, and the system libraries come from `apt`, which cannot be cached; Playwright's own CI documentation advises the same ([ADR 0026](../decisions/0026-first-e2e-journey-details.md), decision 5, refining [ADR 0010](../decisions/0010-ci-cd.md), decision 9). The job retries a failed test once and fails the run for a test that passes only on its retry ([Reading a failed E2E run](#reading-a-failed-e2e-run)). If the install ever dominates the job's time, the cache or Playwright's container image comes back. The tests themselves are explained in the [testing guide](testing.md#writing-an-e2e-journey).

`commits` does not wait for `changes`, since it runs on every PR whatever it changes. Merge commits that bring `main` into the branch (GitHub's *Update branch* writes `Merge branch 'main' into …`, a local `git merge origin/main` writes `Merge remote-tracking branch 'origin/main' into …`) are skipped by commitlint's default ignore rules. Those rules match the standard messages git and GitHub write, not hand-edited ones. Commits on `main` are not checked again: every one came through a checked PR.

### The merge ref

For a PR, GitHub keeps a hidden branch, `refs/pull/<N>/merge`, holding a test merge of the PR's branch into the current `main`. CI checks that merge commit, not the branch's last commit, so it tests what `main` would look like after merging. In that commit, `HEAD^1` (the first parent) is `main` and `HEAD^2` (the second parent) is the branch's last commit. That is why `changes` can diff `HEAD^1` against `HEAD` to see exactly what the PR changes on `main`, and why `commits` checks `HEAD^1..HEAD^2`.

A PR with merge conflicts has no test merge, so GitHub runs nothing for it until the conflicts are resolved.

### The workflows that reach AWS

Two more workflows live next to `ci.yml`. Their jobs hold or may get AWS credentials, so they follow the stricter rules [below](#rules-for-every-workflow) and are not part of `ci-ok`. `ci.yml`'s own `plan` job assumes a role too; it is in the [jobs table](#the-jobs).

| Workflow | Job | Runs when | What it does | Locally |
|---|---|---|---|---|
| `demo-down.yml` | `destroy` | Every night at 01:17 UTC, and by hand | In the environment `demo-teardown`, assumes `szop-ci-deploy`, reads the `deployed_commit` output of `infra/demo`, checks out that commit when one is recorded (otherwise it stays on `main`), and runs `terraform destroy -auto-approve -lock-timeout=15m`; its summary says which code it used. One run at a time, never cancelled; the job times out after 60 minutes | The runbook's [From your machine](../operations/demo-environment.md#from-your-machine) |
| `demo-up.yml` | `enable-teardown` | By hand, at once | Enables `demo-down.yml` with `gh workflow enable` (an enabled workflow is no error), so the nightly destroy is back on even if the deploy is rejected or fails. It holds `actions: write`, no environment and no AWS credentials, and needs no approval | — |
| `demo-up.yml` | `build` | By hand, at once, beside `enable-teardown` | Checks out the `ref` input (or the branch the button was pressed on), resolves the full commit hash, builds the container image with `docker build` into the runner's Docker (one platform, no attestation, no build cache) as `szop:<hash>` with the build argument `GIT_COMMIT=<hash>`, which the image keeps as an environment variable and `/api/health` reports, and saves it as the workflow artifact `image`, kept one day. It holds `contents: read`, no environment and **no AWS credentials**, and needs no approval. Times out after 20 minutes | `pnpm check:image` builds and checks the same image |
| `demo-up.yml` | `deploy` | By hand, after `enable-teardown` and `build` succeed and the owner approves the environment `demo` (*Review deployments*) | Checks out the same ref and refuses to go on if its commit is not the one `build` built; downloads the artifact and loads the image into Docker, before any credentials exist; assumes `szop-ci-deploy`; `terraform init`; **pushes the image** to the registry `szop` unless the tag is already there; **applies** `infra/demo` with `-var deployed_commit=<hash>`; **runs `db-setup`** as a one-off ECS task and fails unless it exits 0 within 10 minutes, stopping the task at the deadline; **starts the app**: at a count of 0 it sets the count to 1 with `--force-new-deployment`, and after a `FAILED` deployment that this run's apply did not replace (the same commit pressed again) it forces a new deployment; then, to a deadline of 15 minutes, reads the rollout state of the primary deployment it expects, succeeds on `COMPLETED` with one deployment left and at least one task running as wanted, and fails at once on `FAILED`; **waits**, to a deadline of 10 minutes, until `https://szop.dzwoniec.com/api/health` answers `"status":"ok"` with the commit just deployed; and writes a summary with the URL, the commit, the image, the outcome of each step and the time of the next nightly destroy. One run at a time, never cancelled; the job times out after 45 minutes (a fresh demo takes about 10 from the approval, a redeploy about 4). Runs nothing but Terraform, the AWS CLI, Docker's `load`, `tag`, `login` and `push`, git, jq, curl and the shell | The runbook's [Spinning up from your machine](../operations/demo-environment.md#spinning-up-from-your-machine) |

### demo-up, job by job

`demo-up.yml` has three jobs, and the split between them is the security design ([ADR 0012](../decisions/0012-security-baseline.md), decisions 16 and 18; [ADR 0038](../decisions/0038-app-on-ecs-and-rds-details.md)):

- **`enable-teardown`** switches the nightly `demo-down` back on and holds a write token, never AWS credentials.
- **`build`** runs the Dockerfile, whose `pnpm install` and build execute the branch's code and its dependencies' install scripts. That code must never run beside the deploy role's token, so `build` holds no AWS credentials and names no environment. It hands the image to `deploy` as the artifact `image`. **Why `build` needs no approval:** the owner's approval guards the deploy role's token, and `build` has none to guard. It runs while the owner is still deciding, so the image is ready when `deploy` starts. An unapproved run costs a few minutes of runner time and nothing in AWS. This refines ADR 0012, decision 16, whose image and deploy jobs waited together behind one approval.
- **`deploy`** declares `environment: demo`, so it starts only after the approval, and holds the credentials. It runs no project code: it only loads, tags and pushes the image it was handed, and runs Terraform, the AWS CLI, git, jq, curl and the shell. It downloads and loads the image before it takes any credentials, so the artifact is in hand before the role exists ([ADR 0012](../decisions/0012-security-baseline.md), decision 18). Pushing happens before the apply: on a redeploy Terraform swaps the task definition at once, and the new task would try to pull an image not yet there.

**The artifact** is `image`, one gzip file of `docker save`, kept **one day**: the approval must come within a day of pressing the button, or `deploy` fails at *Download the image* and the button is pressed again. The artifact is a handover between two jobs, not a record; the image that matters is the one in the registry, where tags are immutable, so `deploy` pushes `szop:<hash>` only when ECR lacks that tag and otherwise keeps the one already there. `deploy` also checks that its checkout is the commit `build` used: a branch can move while the owner approves, and the infrastructure must come from the commit the image was built from.

**The waits** are bounded one by one, not by the job's limit alone, and each is a loop to a deadline in seconds (bash's `SECONDS`), not a count of tries, so a slow request cannot stretch it: `db-setup` up to 10 minutes (at the deadline the step stops the task, since the deploy role may `ecs:StopTask` on `db-setup`'s tasks only), the start up to 15 minutes (a redeploy can take that long, which ECS's `services-stable` waiter, giving up after 10, would not allow), and `/api/health` up to 10 minutes. Together they are 35 minutes, which is why the job's limit is 45. The start does not wait out its deadline when the deployment fails: the deployment circuit breaker marks it `FAILED` after three tasks in a row fail, and the step reads that state ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decision 3).

## ci-ok and the required checks

The `main` ruleset requires two status checks: **`ci-ok`** and **`pr-title`**. It also has the *Require code scanning results* rule: CodeQL must have run, and a PR that adds a security alert of *high* or *critical* severity cannot be merged. The settings are listed in [GitHub settings](github-settings.md#ruleset-for-main).

Why one aggregating job instead of requiring every job:

- Requiring every job would not work well. Each new job would need the ruleset edited too, and a required job that is skipped passes anyway: a job skipped by its `if:` reports, and GitHub counts it as passed. (Skipping with a `paths:` filter instead is worse: a workflow skipped that way never starts and never reports, and a required check on it leaves the PR waiting forever. That is why `ci.yml` always runs and skips jobs with `if:`.) One job that sees every result is the single place to decide. It always runs (`if: always()`), always reports, and fails when `changes` fails: otherwise a broken detection, which leaves every other job skipped, would let the PR through.
- Adding a job later means adding it to `ci-ok`'s `needs:` list, without touching the ruleset. `build`, `e2e` and `docker`, and since PH-35 `scan-config`, `scan-image` and `plan`, are among the jobs `ci-ok` waits for; the required check is still only `ci-ok`, so adding them changed no GitHub setting. `comment` is not among them: a failed comment hides the findings from the PR's conversation, not from the run's summary, and lets nothing through.

**`ci-ok`'s rule:** it passes only when `changes` succeeded and every other job either succeeded or was skipped. A job that failed or was cancelled fails it. The first condition matters: when `changes` fails, every job that needs it is skipped, and "everything skipped" alone would look green.

**Never rename `ci-ok` or `pr-title` without updating the ruleset in the same change.** GitHub matches required checks by job name; a renamed job is a new check, and the PR waits forever for the old one.

**Branches must be up to date with `main` before merging.** The checks ran on a merge with the `main` of that moment; once `main` moves, the result no longer proves anything. After every merge to `main`, an open PR shows *Update branch*: click it (or merge `main` locally and push), and CI runs again.

## Change detection

The `changes` job decides which jobs a PR needs, from the list of files it changes:

- **Code** is any file that is not Markdown (`*.md`). A PR that changes only Markdown skips `lint`, `typecheck`, `test`, `build`, `e2e`, `docker`, `scan-config` and `scan-image`, and so `comment`; `ci-ok` stays green. Counting everything else as code is the safe way round: a new file type or configuration file is checked without anyone remembering to add it.
- **Workflows:** a change under `.github/workflows/` or `.github/actions/`, or to `.github/dependabot.yml` or `.github/zizmor.yml`, runs the `workflows` job. zizmor audits the Dependabot configuration too, and its own configuration file changes what it reports, so a change to either can turn the check red.
- **Infra:** a change under `infra/`, to `.terraform-version`, to `scripts/check-infra.sh` or to `.github/workflows/ci.yml` runs the `infra` job and, on a PR from this repository, `plan`. `ci.yml` is on the list because tflint's version and checksum live in it, so a tflint update is checked in its own PR, and because it holds the `plan` job itself. A `.tf` file is not Markdown, so it counts as code too, and the code jobs run as well.
- `commits` runs on every PR, whatever it changes.
- **A push to `main` runs every job**, whatever it changes, except those that run on PRs only: `commits`, `scan-config`, `scan-image`, `plan` and `comment`. Every commit on `main` came through a PR that ran them.

The job prints the changed files and its three answers (`code=…, workflows=…, infra=…`) in its log.

## Reading a failed run

1. In the PR's checks box, click *Details* next to the red job. This opens the run with that job selected.
2. Open the failing step (the one with the red cross) and read its log from the bottom up: the error is usually in the last lines.
3. zizmor's findings also appear as annotations: in the run's summary, and next to the changed workflow lines in the PR's *Files changed* tab.
4. Reproduce the failure locally with the command in the [jobs table](#the-jobs), fix it, commit and push. Don't rewrite the history of an open PR; a fix is a new commit.
5. **A red `ci-ok`** never fails on its own account: another job failed or was cancelled. Its log lists every job and its result. When `changes` failed, the jobs that need it show as skipped, not red, so look at `changes` first.
6. **A job that failed for no reason of yours** (a network error while downloading, a GitHub outage): rerun it with *Re-run jobs → Re-run failed jobs* on the run's page.
7. **The job summary** (the run's *Summary* page) lists the failed tests of the `test` job and, on a green run, its coverage table (the coverage step is skipped when tests fail).
8. **`docker compose up --wait` failure in the `test` job:** the container never turned healthy; its logs are in the step's output. **`Cannot reach PostgreSQL` in the test step:** the database step was skipped or failed.
9. **A failed `build` with `over budget (NFR-3)`:** the first screen needs more than 200 KB of Brotli-compressed JavaScript, and the log line names the size. Run `pnpm build` locally and find what grew: a new dependency, or an import that should be loaded lazily. Then either shrink it or, with a reason, change the budget through an ADR ([ADR 0013](../decisions/0013-visual-design.md), decision 4: "adjusted with a reason when real measurements exist").

10. **A failed `docker` job:** if the build step failed, its log shows the Dockerfile step and the command's error, as `docker build -t szop:local .` would locally. If the check step failed, its log ends with a `FAIL:` line followed by the app's logs: `the app did not become healthy` (the API did not start or never answered `/api/health`; the logs say why), `GET / answered …` (the SPA is not where `WEB_ROOT` points) or `the image's user is …` (the Dockerfile's `USER` changed). Reproduce with `pnpm check:image`; the [testing guide](testing.md#running-the-tests) explains each message. If the scale step failed, its `FAIL:` line is followed by the logs of `app-a`, `app-b` and nginx; reproduce with `pnpm check:scale`.

11. **A failed `infra` job:** the log ends with a `FAIL:` line naming the step: `formatting` (the diff above it shows what `pnpm infra:fmt` would change), `terraform init` or `terraform validate in infra/<module>/` (the error above it names the file and line), `tflint` (each finding names its rule and links its documentation) or `tflint --init could not download the AWS ruleset` (GitHub's API failed; rerun the job). Reproduce with `pnpm check:infra`.

12. **A red `scan-config`, `scan-image` or `plan` job with a finding:** read the PR comment's *Blocking* part; [Reading a blocked PR](#reading-a-blocked-pr) says what to do with each kind.

13. **A comment that says `plan failed`, or a red `plan` job with no finding:** open the run's log. `Could not assume role` or `Not authorized to perform sts:AssumeRoleWithWebIdentity` means the variable `AWS_PLAN_ROLE_ARN` is missing or the trust policy does not match the PR (a fork's PR gets no token at all, and its `plan` is skipped). An error from `terraform init` or `plan` names the file and line, as it would locally. While AWS cannot be reached, a PR that changes `infra/` stays blocked; rerun the job once it can ([ADR 0041](../decisions/0041-security-scanners-details.md), decision 5).

14. **A failed `demo-down` run:** see the runbook's [The nightly run](../operations/demo-environment.md#the-nightly-run).

15. **A failed `demo-up` run:** see the runbook's [When a run fails](../operations/demo-environment.md#when-a-run-fails), which lists each step of `build` and `deploy`.

From the terminal, `gh pr checks` shows the PR's checks and `gh run view --log-failed` prints the logs of the failed steps; see the [GitHub Actions page](tools/github-actions.md#everyday-use).

### Reading a failed E2E run

The `e2e` job's log shows Playwright's output, and the `github` reporter turns it into annotations on the run's summary page and next to the failing line in the PR: one error per attempt of each test that failed or was flaky, the retry marked in its header, and a *Playwright Run Summary* notice counting what passed, failed and was flaky. For the evidence behind them:

1. On the run's summary page, under *Artifacts*, download `playwright-report`. It exists only when the job failed, and is kept for 14 days.
2. Unzip it and open it: `pnpm test:e2e:report <folder>`, where the folder is the unzipped one, given as an absolute or `~` path (`pnpm test:e2e:report ~/Downloads/playwright-report`): the script runs in `e2e/`, so a relative path is resolved from there. It serves the report on a local port and prints the address; under Windows Subsystem for Linux (WSL), open it in Windows' browser. The report lists every test per project; a failed test holds its error, screenshot and trace, one trace for each attempt.
3. Or drop a trace's zip file on <https://trace.playwright.dev>, which opens the trace viewer in the browser without uploading the file. How to read a trace: [the testing guide](testing.md#reading-a-failed-run).

**Flaky versus failed.** CI retries a failed test once. A test that fails again is counted *failed*. A test that fails and then passes on its retry is counted *flaky*, and the run still fails, because `failOnFlakyTests` is on: a flaky test is a bug, and a green check would hide it. The report holds the trace of the failed first attempt, which is the one to read. Do not just re-run the job; find the cause ([testing guide](testing.md#rules)).

## Dependabot

Dependabot ([tool page](tools/dependabot.md)) opens update PRs every Monday:

- **Groups:** one PR for all minor and patch updates of the npm packages, one for those of the GitHub Actions, one for those of the images in `compose.yaml`, one for the Node base image in the `Dockerfile`, one for the AWS provider in the modules under `infra/`, and a separate PR for each major version.
- **Cooldown:** a version is proposed only once it is at least 7 days old; security updates skip the wait.
- **Commit messages:** `build(deps): …` for a dependency, `build(deps-dev): …` for a devDependency, `ci(deps): …` for an action. They pass commitlint like any commit.
- **`@types/node`'s major updates are ignored**, since its major version follows Node's, which changes on purpose together with `.nvmrc`.
- **PostgreSQL's major updates are ignored** the same way: the major version changes on purpose, together with RDS and `compose.yaml`.
- **Node's major updates in the `Dockerfile` are ignored** too: the major changes on purpose, together with `.nvmrc` and `engines`.
- **The AWS provider's major updates are not ignored:** each comes as its own PR, to be read against the provider's upgrade guide. Terraform itself, tflint and its AWS ruleset are not something Dependabot sees; their tool pages say how to update them.

A Dependabot PR is reviewed and merged by the owner like any other PR; nothing merges by itself. Merging one makes the others out of date, so each needs *Update branch* and a new CI run before it can be merged.

## CI's access to AWS

No AWS access key exists anywhere in GitHub. A job that needs AWS asks GitHub for an OpenID Connect (OIDC) token (`permissions: id-token: write`, on that job only), and `aws-actions/configure-aws-credentials` exchanges it for credentials of one of two roles, with the session name `gh-<run id>`. The concepts are in the [stack overview](../architecture/stack-overview.md#how-ci-gets-into-aws); the decisions in [ADR 0010](../decisions/0010-ci-cd.md) and [ADR 0032](../decisions/0032-ci-access-and-teardown-details.md).

| Role | Assumed by | Trusts | May |
|---|---|---|---|
| `szop-ci-plan` | `ci.yml`, job `plan` | tokens of pull requests of this repository (`sub` `repo:luiki-dev@290870182/szop@1380292421:pull_request`); a fork's PR gets no token | read the infrastructure (`ReadOnlyAccess`), except secret values, log contents, data-plane reads such as the database's log files, S3 objects outside base's and demo's state, billing and cost and the account's contact details |
| `szop-ci-deploy` | `demo-down.yml`, job `destroy`; `demo-up.yml`, job `deploy` | tokens of jobs in the environment `demo-teardown` (`sub` `repo:luiki-dev@290870182/szop@1380292421:environment:demo-teardown`), run from `main` (`ref` `refs/heads/main`); and tokens of jobs in the environment `demo` (`sub` `…:environment:demo`) from any branch, since `demo-up` is pressed on the branch being checked: the owner's approval of that environment is the gate | list the state bucket and read and write the demo's state and lock file; and, through six managed policies, create, change and delete the demo's network, load balancer, certificate, database, ECS cluster, task definitions, service and target group only on resources tagged `project` = `szop` and `group` = `demo`; change only records in the zone whose names are `szop.dzwoniec.com` and `_*.szop.dzwoniec.com`, of type A or CNAME; run, and stop, the one-off task `szop-demo-db-setup` in the cluster `szop-demo`; pass the app's two roles to ECS tasks; and push images to the registry `szop`; it grows with `infra/demo` |

Both roles also require `aud` `sts.amazonaws.com`. The repository uses GitHub's **immutable subject**, so the `sub` names the owner and the repository with their numeric IDs as well as their names; a repository deleted and recreated as `luiki-dev/szop` gets a new ID and is not trusted ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 13). The two **repository variables** `AWS_PLAN_ROLE_ARN` and `AWS_DEPLOY_ROLE_ARN` hold their Amazon Resource Names (ARNs), the roles' unique IDs; the workflows read them as `${{ vars.… }}`. They are set once, from base's outputs ([runbook](../operations/demo-environment.md#cis-roles-and-variables), [GitHub settings](github-settings.md#variables)). The account ID is not stored: each job reads it from its credentials (`aws sts get-caller-identity`), passes it to Terraform as `TF_VAR_account_id` and masks it in the logs from then on. The credentials step runs before the mask exists and echoes the role ARN, so the ARN, and the account ID in it, shows in that step's public log; this is accepted ([threat model](../architecture/threat-model.md#risks-accepted-on-purpose)).

**Dependabot's PRs get the plan and the comment.** A Dependabot PR is a pull request of this repository, so its token matches the plan role's trust, and its `GITHUB_TOKEN` may post the comment: run 39680421083 on PR #256, started by `dependabot[bot]`, assumed `szop-ci-plan` and posted its comment with `pull-requests: write` ([OP-019](https://github.com/luiki-dev/szop/issues/77); [ADR 0041](../decisions/0041-security-scanners-details.md), decision 14). A provider bump is planned in its own PR like any other change.

## The security scans and the PR comment

Every PR that changes code is scanned with [Trivy](tools/trivy.md), and every PR that changes `infra/` is planned and its IAM policies validated; a finding above a set severity blocks the PR through `ci-ok`, and one comment shows everything ([ADR 0041](../decisions/0041-security-scanners-details.md)). Three jobs check, each in its own powers, and a fourth reports:

- **`scan-config`** runs `scripts/scan.sh config`: Trivy's misconfiguration rules over the Terraform code under `infra/` (all three modules) and the `Dockerfile`, with the rules built into the pinned binary (`--skip-check-update`).
- **`scan-image`** runs `scripts/scan.sh image --input` on the archive `docker` saved: Trivy's vulnerability scan of the image, with no Docker daemon.
- **`plan`** plans `infra/base` and `infra/demo` and has IAM Access Analyzer validate every IAM policy in the plan.
- **`comment`** reads the three jobs' artifacts and writes the comment.

Trivy runs only in the two scan jobs, which hold `contents: read` and nothing else: never next to AWS credentials (`plan`), a write token (`comment`) or the build cache token (`docker`). The scans run on PRs only; a push to `main` is not scanned again (ADR 0041, decision 11).

### The thresholds

| Scanner | Blocks the PR | Listed only |
|---|---|---|
| Trivy config (Terraform, `Dockerfile`) | `CRITICAL`, `HIGH` | `MEDIUM`, `LOW` |
| Trivy image | `CRITICAL` and `HIGH` with a fixed version, in a Node package (class `lang-pkgs`) | fixed in an operating-system package, waiting for the base image (any severity); no fix yet (any severity); fixed in a Node package, `MEDIUM` or lower |
| IAM Access Analyzer | `ERROR`, `SECURITY_WARNING`; a policy it could not validate; a module whose plan failed | `WARNING`, `SUGGESTION`; a policy unknown until applied |

A scan that did not run blocks as well, rather than reading as "no findings": Trivy exiting non-zero, writing no JSON, or a database download that failed. Only fixable vulnerabilities block, so a vulnerability (a Common Vulnerabilities and Exposures, CVE, entry) published overnight against a package nobody can update does not turn a PR red; a fix in Debian waits for the official `node` image to be rebuilt, which Dependabot then proposes (ADR 0041, decisions 2 and 17).

### The PR comment

One comment, found by its hidden marker `<!-- ci-scans -->` and updated by every later push, never added twice. Its parts, each present only when its job ran:

1. **The verdict:** "❌ N blocking finding(s)" or "✅ nothing blocking", then the checked commit (the PR's head, merged into `main`) and a link to the run.
2. **Blocking:** every blocking finding of every scanner, most serious first, with a job that ran but left no result shown as **did not finish**, and an image scan that could not run because `docker` failed as **not run**; both count as blocking.
3. **Terraform plan**, per module: `infra/base: 0 to add, 1 to change, 0 to destroy`, then, folded, each changed address and its action. A module whose `init` or `plan` failed shows **plan failed, see the log**, and the other module is still planned. `infra/base` is planned without refreshing live resources, so a change made outside Terraform does not show up in it.
4. **IAM Access Analyzer**, per module, most serious first, the blocking types marked; **not checked until applied** for a policy that holds a value known only after apply, **validation failed** for one whose check itself failed. **Today's baseline is five findings**, all on the two CI roles' trust policies and accepted ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decisions 4 and 14): the suggestion `CONFIRM_AUDIENCE_CLAIM_TYPE` three times (twice on `szop-ci-deploy`, once on `szop-ci-plan`) and the warning `SPECIFIC_GITHUB_REPO_AND_BRANCH_RECOMMENDED` once on each, as [ADR 0034](../decisions/0034-network-and-demo-up-details.md) had found on the deploy role. Read a new finding as new, not as one of these.
5. **Trivy config:** the listed findings, folded, and the **accepted exceptions** with their reasons, read from the `trivy:ignore` lines in the code.
6. **Trivy image:** the listed findings, folded; then **fixed in Debian, waiting for the base image** and **unfixed**, each folded with its count by severity and a note on why it does not block.

A fork's PR gets the same text in the run's job summary, with a line saying the plan and Access Analyzer did not run (a fork gets no OIDC token); the post is skipped, since a fork's token is read-only. Every run writes the text to its summary, so a failed post hides nothing. Text that came from the PR or from Trivy's database (addresses, titles, package names, reasons) is filtered before it reaches the comment, and the comment travels only as a file. Everything in it is public, like the job logs. The comment is about 37,000 characters today, most of it the unfixed list, against GitHub's limit of 65,536; a post over the limit would fail and leave the old comment and its verdict. So when the full text passes 60,000 characters, the job posts a short one (`write-ci-comment.sh --short`): the folded listed, waiting and unfixed sections keep their counts by severity and their notes but lose their lines, and a line says the full report is in the run's summary. The verdict, Blocking, the plan and Access Analyzer are always posted in full, and the summary always holds the full text.

### Reading a blocked PR

1. Read the comment's *Blocking* part, or the run's summary. Each line names the scanner's ID, the severity and where: a file and line for Trivy config, a package and its fixed version for the image, a resource address for Access Analyzer.
2. **A Trivy config finding:** its ID links to Aqua's page for the rule, which says how to fix it. Fix the code, or, if the risk is accepted on purpose, [add an exception](#adding-an-exception). Reproduce with `pnpm check:scan`.
3. **An image vulnerability:** a Node package with a fixed version. Update the dependency (or merge Dependabot's PR for it); do not hide it. If it ever must be accepted, an entry in a `.trivyignore.yaml` with a statement and an expiry date is the way decided, created with the first one and passed to Trivy by `scripts/scan.sh`, since the default ignore file is turned off (ADR 0041, decision 13; [Trivy](tools/trivy.md#exceptions)).
4. **An Access Analyzer `ERROR` or `SECURITY_WARNING`:** fix the policy under `infra/`; the issue code names AWS's check. **Validation failed:** Access Analyzer could not be reached or answered something unexpected; rerun the `plan` job.
5. **Did not finish:** the job ran but left no result, for example a failed download of Trivy or of its database. Open the job's log, and rerun it if the cause was outside the PR.
6. **A red `comment` job** blocks nothing; the run's summary still holds the text. A comment too long for GitHub is posted short, so its size alone does not turn the job red.

### Adding an exception

An exception is for a risk the owner has weighed; a fix that takes a line is better. Put one comment line directly above the resource, with the rule's ID and the reason after `--`, for example `# trivy:ignore:AWS-0053 -- the demo is reached from the internet through this load balancer (ADR 0041)`. A wrong ID suppresses nothing, and any other form (`//`, `*`, at the end of a line, no reason, `tfsec:ignore`) fails the scan with `FAIL: non-standard trivy:ignore`. Run `pnpm check:scan`: the finding leaves `BLOCKING` and shows under `EXCEPTIONS`, and the PR's comment lists it under the accepted exceptions, so the reviewer sees it ([Trivy](tools/trivy.md#exceptions)). The three accepted today are recorded in ADR 0041, decision 9.

## Rules for every workflow

From [ADR 0010](../decisions/0010-ci-cd.md), decisions 4 and 20. zizmor checks most of them.

- **`runs-on: ubuntu-24.04`**, a pinned runner image, and a **`timeout-minutes`** on every job.
- **`permissions: {}`** at the top of the workflow, and each job grants only what it needs: `contents: read` to check the repository out; `id-token: write` on the jobs that assume an AWS role, and on those alone (in `ci.yml`, only `plan`); `pull-requests: write` on the one job that posts the PR comment, `comment`. `ci-ok` needs nothing at all.
- **Trivy runs only in a job with `contents: read` and nothing else**, as a release binary checked against its SHA-256, never through Aqua's actions or Docker image: never next to AWS credentials, a write token or the build cache ([ADR 0041](../decisions/0041-security-scanners-details.md), decisions 10 and 11).
- **Every action, GitHub's own included, pinned to a full commit SHA** with its version in a comment (see [GitHub Actions](tools/github-actions.md#configuration)).
- **`persist-credentials: false`** on every `actions/checkout`, so the token is not left in `.git/config` for later steps.
- **Nothing a PR author controls inside `${{ … }}` in a `run:` script** (titles, branch names): such a value goes through `env:` and is read as `"$NAME"`.
- **No `pull_request_target` and no `workflow_run`**: they run with the repository's secrets on a fork's code or data.
- **A job that holds AWS credentials runs no code a PR could change, besides Terraform's:** no project setup action (`./.github/actions/setup`), no `pnpm install`, no project script and no `docker build`; Terraform, the AWS CLI, git, jq and `gh`, plus, for `demo-up`'s image, Docker's `load`, `tag`, `login` and `push`, curl and the shell only ([ADR 0012](../decisions/0012-security-baseline.md), decision 18). No job holds both AWS credentials and a write token for the repository, and a job names the `demo` environment only while it exists with its required reviewer: GitHub would create a missing one with no protection, and the deploy role's trust for it has no branch pin.
- **actionlint and zizmor run before every commit that stages a workflow, a local action or `dependabot.yml`:** the pre-commit hook runs them on the staged files, and `pnpm check:workflows` runs them over everything. Install them with the [setup guide](setup.md#9-actionlint-zizmor-and-uv); CI runs them anyway, and zizmor's online audits only there ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 2).

## CodeQL

CodeQL is GitHub's code analysis engine, switched on with its **default setup** in the repository settings: there is no workflow file for it to maintain. It scans the JavaScript and TypeScript code and the GitHub Actions workflows on every PR to `main` and every push to `main`. Its findings are listed under *Security → Code scanning*, and a PR's checks box shows CodeQL's own checks. Through the ruleset's code scanning rule, a PR that adds a *high* or *critical* alert cannot be merged.
