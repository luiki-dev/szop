# CI/CD

How Szop's continuous integration (CI) works: which checks run on which event, how to read a failed run, and the rules every workflow follows. Every pull request is checked in GitHub Actions, and a failing check blocks the merge; CodeQL scans the code and the workflows, and Dependabot proposes updates every week. *Why* it works this way is in [ADR 0010](../decisions/0010-ci-cd.md) (the direction) and [ADR 0018](../decisions/0018-ci-details.md) (the details). Later phases add to this guide: the PostgreSQL service for the tests ([PH-04](../roadmap.md#ph-04-database)), end-to-end (E2E) tests ([PH-07](../roadmap.md#ph-07-first-e2e-journey)), the container image check ([PH-08](../roadmap.md#ph-08-container-image)), the Terraform checks ([PH-09](../roadmap.md#ph-09-aws-account-and-terraform-bootstrap)), the demo buttons ([PH-11](../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net), [PH-12](../roadmap.md#ph-12-first-deploy)) and releases ([PH-13](../roadmap.md#ph-13-releases)).

The checks run the PR's own code and configuration: its workflows, its `package.json` scripts, its `commitlint.config.js`. A PR could therefore weaken a check along with the change it checks; the owner's review of every changed file is what catches that.

## Contents

- [What runs when](#what-runs-when)
- [The jobs](#the-jobs)
  - [The merge ref](#the-merge-ref)
- [ci-ok and the required checks](#ci-ok-and-the-required-checks)
- [Change detection](#change-detection)
- [Reading a failed run](#reading-a-failed-run)
- [Dependabot](#dependabot)
- [Rules for every workflow](#rules-for-every-workflow)
- [CodeQL](#codeql)

## What runs when

| Event | What runs |
|---|---|
| A push to a branch without a PR | Nothing. Open a PR to get the checks. |
| A PR to `main` opened, reopened or pushed to | `ci.yml`, `pr-title.yml` and CodeQL |
| A PR's title edited | `pr-title.yml` only (it also reruns when the description is edited, which is harmless) |
| A push to `main` (every merge) | `ci.yml` and CodeQL |
| Every Monday | Dependabot looks for updates and opens PRs, which then run like any PR |

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
| `commits` | every PR, never on `main` | commitlint on every commit of the branch that is not on `main`, from `HEAD^1` to `HEAD^2` (see [The merge ref](#the-merge-ref)) | `pnpm exec commitlint --from origin/main --to HEAD` |
| `workflows` | a file under `.github/workflows/` or `.github/actions/`, or `.github/dependabot.yml` or `.github/zizmor.yml`, changed | [actionlint](tools/actionlint.md), then [zizmor](tools/zizmor.md) | see their tool pages |
| `ci-ok` | always, after all the others | Sums up the results ([below](#ci-ok-and-the-required-checks)) | — |

`pr-title.yml` has one job, **`pr-title`**: it pipes the PR title into commitlint, with the same rules as every commit, because the title becomes the merge commit's message. Check a title locally with `echo "feat(api): add health check" | pnpm exec commitlint`. It is a workflow of its own so that editing the title reruns only this check, not the whole of `ci.yml`.

`commits` does not wait for `changes`, since it runs on every PR whatever it changes. Merge commits that bring `main` into the branch (GitHub's *Update branch* writes `Merge branch 'main' into …`, a local `git merge origin/main` writes `Merge remote-tracking branch 'origin/main' into …`) are skipped by commitlint's default ignore rules. Those rules match the standard messages git and GitHub write, not hand-edited ones. Commits on `main` are not checked again: every one came through a checked PR.

### The merge ref

For a PR, GitHub keeps a hidden branch, `refs/pull/<N>/merge`, holding a test merge of the PR's branch into the current `main`. CI checks that merge commit, not the branch's last commit, so it tests what `main` would look like after merging. In that commit, `HEAD^1` (the first parent) is `main` and `HEAD^2` (the second parent) is the branch's last commit. That is why `changes` can diff `HEAD^1` against `HEAD` to see exactly what the PR changes on `main`, and why `commits` checks `HEAD^1..HEAD^2`.

A PR with merge conflicts has no test merge, so GitHub runs nothing for it until the conflicts are resolved.

## ci-ok and the required checks

The `main` ruleset requires two status checks: **`ci-ok`** and **`pr-title`**. It also has the *Require code scanning results* rule: CodeQL must have run, and a PR that adds a security alert of *high* or *critical* severity cannot be merged. The settings are listed in [GitHub settings](github-settings.md#ruleset-for-main).

Why one aggregating job instead of requiring every job:

- Requiring every job would not work well. Each new job would need the ruleset edited too, and a required job that is skipped passes anyway: a job skipped by its `if:` reports, and GitHub counts it as passed. (Skipping with a `paths:` filter instead is worse: a workflow skipped that way never starts and never reports, and a required check on it leaves the PR waiting forever. That is why `ci.yml` always runs and skips jobs with `if:`.) One job that sees every result is the single place to decide. It always runs (`if: always()`), always reports, and fails when `changes` fails: otherwise a broken detection, which leaves every other job skipped, would let the PR through.
- Adding a job later means adding it to `ci-ok`'s `needs:` list, without touching the ruleset. `build` is one of the jobs `ci-ok` waits for; the required check is still only `ci-ok`, so adding it changed no GitHub setting.

**`ci-ok`'s rule:** it passes only when `changes` succeeded and every other job either succeeded or was skipped. A job that failed or was cancelled fails it. The first condition matters: when `changes` fails, every job that needs it is skipped, and "everything skipped" alone would look green.

**Never rename `ci-ok` or `pr-title` without updating the ruleset in the same change.** GitHub matches required checks by job name; a renamed job is a new check, and the PR waits forever for the old one.

**Branches must be up to date with `main` before merging.** The checks ran on a merge with the `main` of that moment; once `main` moves, the result no longer proves anything. After every merge to `main`, an open PR shows *Update branch*: click it (or merge `main` locally and push), and CI runs again.

## Change detection

The `changes` job decides which jobs a PR needs, from the list of files it changes:

- **Code** is any file that is not Markdown (`*.md`). A PR that changes only Markdown skips `lint`, `typecheck`, `test` and `build`; `ci-ok` stays green. Counting everything else as code is the safe way round: a new file type or configuration file is checked without anyone remembering to add it.
- **Workflows:** a change under `.github/workflows/` or `.github/actions/`, or to `.github/dependabot.yml` or `.github/zizmor.yml`, runs the `workflows` job. zizmor audits the Dependabot configuration too, and its own configuration file changes what it reports, so a change to either can turn the check red.
- `commits` runs on every PR, whatever it changes.
- **A push to `main` runs every job**, whatever it changes.

The job prints the changed files and its two answers (`code=…, workflows=…`) in its log.

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

From the terminal, `gh pr checks` shows the PR's checks and `gh run view --log-failed` prints the logs of the failed steps; see the [GitHub Actions page](tools/github-actions.md#everyday-use).

## Dependabot

Dependabot ([tool page](tools/dependabot.md)) opens update PRs every Monday:

- **Groups:** one PR for all minor and patch updates of the npm packages, one for those of the GitHub Actions, one for those of the images in `compose.yaml`, and a separate PR for each major version.
- **Cooldown:** a version is proposed only once it is at least 7 days old; security updates skip the wait.
- **Commit messages:** `build(deps): …` for a dependency, `build(deps-dev): …` for a devDependency, `ci(deps): …` for an action. They pass commitlint like any commit.
- **`@types/node`'s major updates are ignored**, since its major version follows Node's, which changes on purpose together with `.nvmrc`.
- **PostgreSQL's major updates are ignored** the same way: the major version changes on purpose, together with RDS and `compose.yaml`.

A Dependabot PR is reviewed and merged by the owner like any other PR; nothing merges by itself. Merging one makes the others out of date, so each needs *Update branch* and a new CI run before it can be merged.

## Rules for every workflow

From [ADR 0010](../decisions/0010-ci-cd.md), decisions 4 and 20. zizmor checks most of them.

- **`runs-on: ubuntu-24.04`**, a pinned runner image, and a **`timeout-minutes`** on every job.
- **`permissions: {}`** at the top of the workflow, and each job grants only what it needs: `contents: read` to check the repository out, nothing else in this phase (`ci-ok` needs nothing at all).
- **Every action, GitHub's own included, pinned to a full commit SHA** with its version in a comment (see [GitHub Actions](tools/github-actions.md#configuration)).
- **`persist-credentials: false`** on every `actions/checkout`, so the token is not left in `.git/config` for later steps.
- **Nothing a PR author controls inside `${{ … }}` in a `run:` script** (titles, branch names): such a value goes through `env:` and is read as `"$NAME"`.
- **No `pull_request_target` and no `workflow_run`**: they run with the repository's secrets on a fork's code or data.
- **Before pushing a workflow change, run actionlint and zizmor** locally when you can (their tool pages say how); CI runs them anyway.

## CodeQL

CodeQL is GitHub's code analysis engine, switched on with its **default setup** in the repository settings: there is no workflow file for it to maintain. It scans the JavaScript and TypeScript code and the GitHub Actions workflows on every PR to `main` and every push to `main`. Its findings are listed under *Security → Code scanning*, and a PR's checks box shows CodeQL's own checks. Through the ruleset's code scanning rule, a PR that adds a *high* or *critical* alert cannot be merged.
