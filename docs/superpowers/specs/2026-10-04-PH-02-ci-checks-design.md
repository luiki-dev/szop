# PH-02 CI checks — design

- **Phase:** [PH-02](../../roadmap.md#ph-02-ci-checks)
- **Date:** 2026-10-04
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-019](../../open-points.md#op-019) (PH-02 part), [OP-022](../../open-points.md#op-022), [OP-023](../../open-points.md#op-023) (PH-02 part), [OP-062](../../open-points.md#op-062) (PH-02 part)

Every PR is checked in GitHub Actions, and a failing check blocks the merge. CodeQL scans the code and the workflows, and Dependabot proposes updates every week. The direction was settled by [ADR 0010](../../decisions/0010-ci-cd.md) (CI/CD), [ADR 0009](../../decisions/0009-git-workflow.md), decision 13 (the `main` ruleset) and [ADR 0012](../../decisions/0012-security-baseline.md). This spec holds the details those ADRs left to the phase, as agreed in the brainstorm. Two guides were inputs as well as outputs: the [git workflow](../../development/git-workflow.md) and the [phase walkthrough](../../development/phase-walkthrough.md).

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Rules for every workflow](#rules-for-every-workflow)
  - [`ci.yml`](#ciyml)
  - [`pr-title.yml`](#pr-titleyml)
  - [The setup action](#the-setup-action)
  - [`dependabot.yml` and commitlint](#dependabotyml-and-commitlint)
  - [Order of the work and the owner's steps](#order-of-the-work-and-the-owners-steps)
  - [Proving the gates](#proving-the-gates)
- [Documentation and records](#documentation-and-records)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: every PR runs the lint, type and commit message checks in GitHub Actions and has its title checked, and a failing check blocks the merge. CodeQL scans the code and the workflows, and Dependabot proposes updates every week.

The phase is done when:

- on the PH-02 PR, `ci-ok` and `pr-title` are green, and both are required checks of the `main` ruleset, with branches required to be up to date;
- a throwaway proof PR showed each of these turning `ci-ok` or `pr-title` red and the merge button blocked: an ESLint error, a Prettier difference, a type error, a failing hook test, a bad commit message, a bad PR title, a template injection in a workflow, and a failing change-detection job;
- a PR that changes only Markdown skips `lint`, `typecheck`, `test` and `workflows`, and `ci-ok` is green;
- commitlint accepts a real Dependabot commit message (subject and body), and the `build(deps-dev)` scope;
- the Actions settings are applied (actions pinned to a full commit SHA, a read-only default token, approval for all outside contributors' runs), CodeQL's default setup has run on `main` under them, and the code scanning rule is part of the `main` ruleset;
- the settings read back with `gh api` match `github-settings.md`;
- `ci-cd.md`, the tool pages, the stack overview, `github-settings.md`, `git-workflow.md` and the walkthrough describe all of the above.

## Out of scope

- The `e2e`, `docker` and `infra` jobs, the PostgreSQL service of `test`, and coverage in the job summary: each joins `ci.yml` in the phase that creates what it checks (PH-04, PH-07, PH-08, PH-09; [ADR 0010](../../decisions/0010-ci-cd.md), decision 23).
- `infra-plan.yml` and `demo-down.yml` (PH-11), `demo-up.yml` (PH-12), `release-please.yml` (PH-13), `mutation.yml` (PH-15) ([OP-019](../../open-points.md#op-019)).
- Dependabot's `docker-compose`, `docker` and `terraform` ecosystems, with their audit m13 ignore rules: PH-04, PH-08 and PH-09.
- A local hook running actionlint and zizmor (decision 6).
- Confirming Dependabot on its first real PRs: after the merge (decision 10).

## Decisions taken in the brainstorm

Each refines an accepted ADR or fills a detail it left open; ADR 0018 records them.

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Size of the phase | One phase as on the roadmap; split Dependabot and CodeQL into a phase of their own | **One phase.** Dependabot and CodeQL are mostly configuration and the owner's clicks, and keeping Dependabot here lets audit m9 (try `commits` on a Dependabot commit before `ci-ok` is required) be met before the merge. The plan stays at 8 tasks. |
| 2 | Change detection | Our own `git diff` step; `dorny/paths-filter`; no detection until heavy jobs arrive | **Our own step.** On a PR, the checkout is GitHub's test merge of the branch into `main` (`refs/pull/<N>/merge`), so `git diff --name-only HEAD^1 HEAD` lists exactly what the PR would change on `main`, whatever the branch's history. About 15 lines, no third-party code. On a push to `main`, everything runs: the safety net, with no "base of a push" edge cases. `dorny/paths-filter` is popular but is third-party code in the pipeline (the March 2025 `tj-actions/changed-files` compromise retagged a similar action; only SHA-pinned users were safe) and needs `pull-requests: read`. No detection would postpone ADR 0010, decision 8 and leave audit m10 unproven. |
| 3 | What counts as code | A list of code paths; everything except Markdown | **Everything except Markdown.** The safe way round: a new file type, a config file or a workflow (which Prettier formats) triggers the checks by default. Prettier already ignores `*.md` ([ADR 0016](../../decisions/0016-toolchain-details.md), decision 7), so a Markdown-only PR loses nothing by skipping them. |
| 4 | PR title check | commitlint on the title with `commitlint.config.js`; `amannn/action-semantic-pull-request` | **commitlint.** One source of truth: the title, which becomes the merge commit's message, obeys the same types and `scope-enum` as every commit. The dedicated action is faster but would repeat the type and scope lists in YAML, where they drift, and is another third-party action. Costs a cached `pnpm install`, about 20–30 seconds. |
| 5 | Getting actionlint and zizmor | Each maintainer's distribution, pinned; Docker images pinned by digest; third-party wrapper actions | **Each maintainer's distribution, pinned.** zizmor through its maintainers' `zizmorcore/zizmor-action`, pinned by SHA (Dependabot updates it), with `advanced-security: false`: findings become annotations and **fail the job**, with only `contents: read`. In the default mode it uploads to code scanning, needs `security-events: write` and always exits 0, so findings would block only through the code scanning rule. actionlint as a release binary of `rhysd/actionlint`, its version and SHA-256 checksum in the workflow, verified before it runs; the project's recommended `bash <(curl …/main/…)` runs whatever is on their `main` today. Dependabot cannot bump a version inside `run:`, so updating actionlint is manual (its tool page says how). Docker images have the same manual updates plus a pull per run; wrappers add another party's code for a single binary. |
| 6 | actionlint and zizmor before committing | A lint-staged hook on workflow files; CI only | **CI only, for now.** A hook would catch a slip before the commit exists, which matters here since an open PR's history is not rewritten. But both tools would be installed outside pnpm, by hand, in step with CI's versions, and the hook would need a rule for a missing tool. Workflow files change in a handful of phases (PH-02, PH-11, PH-12, PH-13, PH-15). In this phase Claude runs both tools at the pinned versions, from a temporary folder, before each commit touching `.github/`. Revisited in PH-11 (OP-066). |
| 7 | Installing pnpm in CI | `pnpm/action-setup`, then `actions/setup-node` with `cache: pnpm`; `npm install -g pnpm` as `setup.md` does, with the store cached by hand | **`pnpm/action-setup`**, from pnpm's own maintainers, reading the version from `packageManager`. Fewer steps for the same result, and the built-in cache of `setup-node`. |
| 8 | Dependabot's scope | Add `deps-dev` to `scope-enum`; drop `include: scope` | **Add `deps-dev`.** With `include: scope`, Dependabot writes `deps` for a production dependency and `deps-dev` for a devDependency, and the scope is not ours to choose. Almost every Szop dependency is a devDependency today, so without it nearly every npm PR would fail `commits`. The history keeps the difference between what ships and what doesn't. Dropping the scope would lose the "dependency bump" marker and contradict ADR 0010, decision 18. |
| 9 | Order of the owner's steps | All settings before the merge, during review; settings after the merge, once a real Dependabot PR passed | **Before the merge.** The PH-02 PR becomes the first PR the new gates hold back. Audit m9 is met with a real Dependabot commit message copied from a public repository whose Dependabot uses the same `commit-message` settings, checked by commitlint in the plan and by `commits` in CI. The first real Dependabot PRs confirm it after the merge (decision 10). Settings after the merge would meet m9 to the letter, but leave PH-02 ✅ with its gates off. |
| 10 | Confirming Dependabot | A box in this PR; an open point after the merge | **An open point (OP-067, PH-03).** Dependabot reads `dependabot.yml` only from `main`, so its first PRs exist only after the merge. Right after it, the owner asks for updates (*Insights → Dependency graph → Dependabot → Check for updates*). The open point covers both m9 on a real commit and whether Dependabot handles pnpm 12's lockfile. |
| 11 | Proving the gates | A throwaway proof PR; break-and-revert commits on the PH-02 PR; prove only m10 | **A throwaway proof PR**, from a scratch branch off the phase branch, one deliberate break at a time, each fixed before the next. It runs once the required checks are on, so "blocks the merge" is visible. Its runs are linked from the PH-02 PR, then it is closed unmerged and the owner deletes the branch (Claude cannot delete remote branches). The phase branch keeps only commits that pass. Break-and-revert would leave about 16 failing commits in the history, against "every commit passes its checks" and `git bisect`; proving only m10 leaves the phase's own goal unproven. |

## Design

### Rules for every workflow

From [ADR 0010](../../decisions/0010-ci-cd.md), decisions 4 and 20:

- `runs-on: ubuntu-24.04`, and a `timeout-minutes` on every job.
- `permissions: {}` at the top of the workflow; each job grants `contents: read`, and nothing else in this phase.
- Every action, GitHub's own included, pinned to a full commit SHA with its version in a comment.
- `actions/checkout` with `persist-credentials: false`.
- No `${{ … }}` inside `run:` scripts for anything a PR author controls (titles, branch names); such values go through `env:`.
- No `pull_request_target` and no `workflow_run`.

### `ci.yml`

- **Triggers:** `pull_request` to `main`, and `push` to `main`. A branch without a PR runs nothing.
- **Concurrency:** one group per PR (or per ref on `main`), `cancel-in-progress` only for PRs, so every merge to `main` gets a full run.

| Job | Runs when | What it does |
|---|---|---|
| `changes` | always | Checkout with `fetch-depth: 2`. On a PR, `git diff --name-only HEAD^1 HEAD`; outputs **`code`** (true if any changed file is not `*.md`) and **`workflows`** (true if anything under `.github/workflows/` or `.github/actions/` changed). On a push to `main`, both are `true`. |
| `lint` | `code` | Setup action, `pnpm lint` (ESLint), `pnpm format:check` (new: `prettier --check .`). |
| `typecheck` | `code` | Setup action, `pnpm typecheck`. |
| `test` | `code` | Setup action, `pnpm test`: the push hook's `node:test` tests ([OP-062](../../open-points.md#op-062)). |
| `commits` | PRs only | Checkout with `fetch-depth: 0`, setup action, `pnpm exec commitlint --from HEAD^1 --to HEAD^2`: every commit on the branch that is not on `main`. Merge commits from *Update branch* are skipped by commitlint's default ignores. Not run on `main`: every commit there came through a checked PR. |
| `workflows` | `workflows` | actionlint (release binary, version and SHA-256 pinned, checksum verified) and `zizmorcore/zizmor-action` (pinned by SHA, `advanced-security: false`). |
| `ci-ok` | `if: always()`, `needs:` every job above | Fails unless `changes` succeeded and no job's result is `failure` or `cancelled`; `skipped` is fine. A short script reads the results from `env:` (`toJSON(needs)`). A failed `changes` leaves every other job `skipped`, so without the first condition a broken detection would pass (audit m10). |

### `pr-title.yml`

- **Trigger:** `pull_request` with the types `opened`, `edited`, `synchronize` and `reopened`. It is a workflow of its own so that editing the title does not rerun `ci.yml`.
- **Concurrency:** one group per PR, cancelling the older run.
- **One job, `pr-title`:** checkout, setup action, then `printf '%s\n' "$PR_TITLE" | pnpm exec commitlint`, with `PR_TITLE: ${{ github.event.pull_request.title }}` in `env:`.
- **Required checks are matched by job name,** so `ci-ok` and `pr-title` must not be renamed without updating the ruleset. `ci-cd.md` and the GitHub Actions page say so.

### The setup action

`.github/actions/setup/action.yml`, a composite action. It cannot contain the checkout: GitHub must clone the repository before it can read an action stored in it. Every job checks out, then:

1. `pnpm/action-setup`, pinned by SHA, reading the version from `packageManager`;
2. `actions/setup-node`, pinned by SHA, with `node-version-file: .nvmrc` and `cache: pnpm` (the store, keyed on `pnpm-lock.yaml`);
3. `pnpm install --frozen-lockfile`, which fails instead of updating a lockfile that does not match `package.json`. pnpm's `allowBuilds` list applies as locally ([ADR 0016](../../decisions/0016-toolchain-details.md), decision 3).

### `dependabot.yml` and commitlint

| | `npm` | `github-actions` |
|---|---|---|
| Directories | `/` (one workspace, one lockfile) | `/` (the workflows) and `/.github/actions/setup` (the composite action, which Dependabot does not scan by default) |
| Schedule | weekly, Monday | weekly, Monday |
| Cooldown | 7 days; security updates skip it | 7 days |
| Groups | one group for minor and patch updates; each major as its own PR | the same |
| Commit message | `prefix: build`, `prefix-development: build`, `include: scope`: `build(deps): …`, `build(deps-dev): …` | `prefix: ci`, `include: scope`: `ci(deps): …` |
| Ignore | major updates of `@types/node`, whose major follows Node's (audit m13) | — |

`commitlint.config.js` gains the scope `deps-dev`, under Tooling next to `deps`.

### Order of the work and the owner's steps

| # | Who | When | What |
|---|---|---|---|
| 1 | Claude | branch `ci/ci-checks` | The spec, the plan, then the plan's tasks. Before each commit touching `.github/`, actionlint and zizmor at the pinned versions, from a temporary folder. |
| 2 | Owner | before the PR opens | **Actions settings:** require actions pinned to a full-length commit SHA; default `GITHUB_TOKEN` permissions read-only, *Allow GitHub Actions to create and approve pull requests* off; approval required for workflow runs from all outside contributors. Applied first, so the PR's first run proves the pins satisfy the policy; no workflow exists yet to break. |
| 3 | Claude | | Push and open the PH-02 PR; `ci-ok` and `pr-title` report for the first time. |
| 4 | Owner | once they reported | **CodeQL default setup** for JavaScript/TypeScript and Actions. It scans `main` at once and every PR after. Checks audit C9: CodeQL's managed workflow runs under the SHA-pinning policy. |
| 5 | Owner | | **`main` ruleset:** required status checks `ci-ok` and `pr-title`, with *Require branches to be up to date before merging*. |
| 6 | Owner | after CodeQL succeeded on `main` | **`main` ruleset:** *Require code scanning results*, CodeQL, blocking security alerts of *high or higher*. Last, since with an empty bypass list a CodeQL that cannot run would block every merge ([OP-022](../../open-points.md#op-022)). |
| 7 | Claude | | Read the settings back with `gh api` (read-only) and compare them with `github-settings.md`, which gains the commands. |
| 8 | Claude, then owner | | The proof PR ([Proving the gates](#proving-the-gates)); the owner deletes its branch after it is closed. |
| 9 | Owner | | Review and merge PH-02. |
| 10 | Owner | right after the merge | Ask Dependabot for updates; the result closes or extends OP-067. |

**Definition of done for the PH-02 PR:** item 1 (tests) through the hook's tests and the proof PR; item 3 (CI green) ticked for the first time; item 4 (the demo check) "➖ N/A: there is no app or demo yet"; items 6–9 and 11 as in [Documentation and records](#documentation-and-records).

### Proving the gates

A scratch branch `ci/gate-proofs`, from the phase branch once the owner's steps 2–6 are done, with a PR to `main` titled as a proof. One break per push, each undone in the next push before the following break:

| Break | Expected red |
|---|---|
| An ESLint error in a `.ts` file | `lint` → `ci-ok` |
| A Prettier difference in a `.json` file | `lint` → `ci-ok` |
| A type error | `typecheck` → `ci-ok` |
| A failing assertion in the hook's tests | `test` → `ci-ok` |
| A commit message outside the rules, made with `--no-verify` | `commits` → `ci-ok` |
| A PR title outside the rules | `pr-title` |
| `${{ github.event.pull_request.title }}` inside a `run:` script | `workflows` (zizmor) → `ci-ok` |
| `changes` forced to fail (`exit 1`) | `ci-ok`, with every other job `skipped` (audit m10) |

For each: the run's link and the merge box showing the merge blocked go into the PH-02 PR's *How it was tested*. A Markdown-only push, which skips the code jobs while `ci-ok` stays green, is recorded the same way. The PR is then closed unmerged.

## Documentation and records

- **ADR 0018, "CI details":** the decisions above. Refines [ADR 0010](../../decisions/0010-ci-cd.md), decisions 5 (decisions 4, 7), 7 (decisions 2, 3, 5, 6), 8 (decisions 2, 3), 18 (decision 8) and 21 (decisions 5, 9), noted in ADR 0018's header, ADR 0010's status line and a `✏️ Refined by` line in each of those cells, as `CLAUDE.md` asks.
- **`docs/development/ci-cd.md`** (new): what runs on which event, the jobs and `ci-ok`, change detection, reading a failed run, the required checks and why their names are fixed, Dependabot's weekly rhythm, and the rules for every workflow. Later phases add the demo buttons, the PostgreSQL service and releases.
- **Tool pages** in `docs/development/tools/`: `github-actions.md`, `dependabot.md`, `actionlint.md` (with the manual update), `zizmor.md`, in the format of [ADR 0005](../../decisions/0005-development-environment.md), decision 15.
- **Stack overview:** a CI/CD section on pipelines, runners, the merge ref, required checks, supply-chain security and SHA pinning. OIDC and environments come with PH-11.
- **`github-settings.md`:** the Actions settings, CodeQL, the two required checks, the code scanning rule, and the `gh api` commands to verify them.
- **`git-workflow.md`:** "Once CI exists" in the present tense; the PH-02 rows of "What is enforced" in force; `build(deps-dev)` next to `build(deps)`; a link to `ci-cd.md` for failed runs.
- **`phase-walkthrough.md`:** a PH-02 row of its own in "When this all exists"; `format:check` in step 3; `build(deps-dev)` for the Dependabot actor.
- **`CLAUDE.md`:** `ci-cd.md` in the documentation list ([OP-023](../../open-points.md#op-023)).
- **Glossary:** CI and CD, runner, composite action, required status check, template injection, actionlint, zizmor.
- **Open points:** [OP-022](../../open-points.md#op-022) closed; the PH-02 parts of [OP-019](../../open-points.md#op-019), [OP-023](../../open-points.md#op-023) and [OP-062](../../open-points.md#op-062) ✅; new **OP-066** (PH-11): revisit a local actionlint and zizmor hook; new **OP-067** (PH-03): confirm the first Dependabot PRs (m9 on a real commit, pnpm 12's lockfile); new **OP-068** (PH-04, PH-08, PH-09): the `docker-compose`, `docker` and `terraform` ecosystems with their m13 ignores.
- **Roadmap and README diagram:** the PH-02 row 🚧 with the spec, plan and PR links as they land, ✅ before the merge, in the same commits ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)).

## Tasks

One commit per task. Tasks 2–5 are checked locally with actionlint and zizmor before committing.

1. **Scripts and scope:** `format:check` in `package.json`; `deps-dev` in `commitlint.config.js`. *Verify:* `pnpm format:check` passes; commitlint accepts the copied Dependabot message and `build(deps-dev): x`, rejects `build(dev-deps): x`, and ignores `Merge branch 'main' into ci/ci-checks`.
2. **Setup action and the core of `ci.yml`:** `changes`, `lint`, `typecheck`, `test`, `ci-ok`. *Verify:* actionlint and zizmor clean; the `changes` script tried locally on a merge commit with and without non-Markdown files; the `ci-ok` script tried locally on sample `needs` JSON (all success, one skipped, one failure, `changes` failed).
3. **`commits` and `workflows` jobs.** *Verify:* actionlint and zizmor clean; the commitlint range tried locally on a merge of the branch into `main`; the actionlint checksum matches the release.
4. **`pr-title.yml`.** *Verify:* actionlint and zizmor clean.
5. **`dependabot.yml`.** *Verify:* the file matches Dependabot's schema (GitHub's documented keys), and actionlint and zizmor stay clean.
6. **Records and new docs:** ADR 0018 and the cross-references in ADR 0010, `ci-cd.md`, the four tool pages, the stack overview section, the glossary. *Verify:* links resolve; contents lists in sync.
7. **Guides and registers:** `github-settings.md`, `git-workflow.md`, the walkthrough, `CLAUDE.md`, the open points, the roadmap and the README. *Verify:* links resolve; the definition of done is walked through.
8. **Gates proven:** after the PR is open and the owner's steps 2–6 are done, read the settings back, run the proof PR, and record the results in the PR (and fix `github-settings.md` if the read-back differs). *Verify:* every row of [Proving the gates](#proving-the-gates) has its run linked.

## To verify during implementation

- **commitlint's default ignores** skip `Merge branch 'main' into …` (task 1). If not, `commitlint.config.js` adds an ignore for it.
- **`--from HEAD^1 --to HEAD^2`** on the merge checkout lists exactly the branch's commits, including when `main` was merged into the branch (task 3).
- **`zizmorcore/zizmor-action`'s inputs:** that `advanced-security: false` fails the job on findings with only `contents: read` (task 3).
- **zizmor on `ci-ok`:** whether it flags `toJSON(needs)` in `env:` or the composite action's inputs, and the fix if it does (tasks 2–3).
- **Dependabot's keys:** `cooldown`, `directories` and `prefix-development` as GitHub documents them today (task 5).
- **The SHA-pinning policy and CodeQL's default setup** run together (owner step 4; audit C9). If they clash, the policy's allow-list or the order changes, and `github-settings.md` says why.
