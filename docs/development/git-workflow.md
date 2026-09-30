# Git workflow

How a change travels from an idea to `main`, and how releases are cut. The decisions and the alternatives behind them are in [ADR 0009](../decisions/0009-git-workflow.md); the GitHub settings that enforce them are listed in [github-settings.md](github-settings.md). Terms are explained in the [glossary](../glossary.md).

## Contents

- [The model in one picture](#the-model-in-one-picture)
- [1. Start a branch](#1-start-a-branch)
- [2. Commit](#2-commit)
- [3. Open a pull request](#3-open-a-pull-request)
- [4. Review](#4-review)
- [5. Keep the branch up to date](#5-keep-the-branch-up-to-date)
- [6. Merge](#6-merge)
- [7. Read the history](#7-read-the-history)
- [8. Release](#8-release)
- [What is enforced, and by what](#what-is-enforced-and-by-what)

## The model in one picture

Szop uses **GitHub flow**: `main` is the only long-lived branch and is always releasable. Every change is made on a short-lived branch and reaches `main` only through a pull request (PR).

```
main ──●─────────────────────●──────────────────●──── (merge commits mark phases)
        \                   / \                /
         ● spec  ● plan  ● task 1 … task n    ● docs/fix-typo
         feat/shopping-lists                  (a small change outside a phase)
```

For the whole journey of one example phase, from the first commit to the release and the demo, see the [phase walkthrough](phase-walkthrough.md).

One **roadmap phase** is one branch and one PR. A change outside a phase (a foundation ADR, a typo fix, a dependency bump) gets its own small branch and PR.

## 1. Start a branch

Branch names are `type/short-description`, using the commit types below.

```bash
git switch main
git pull
git switch -c feat/shopping-lists
```

Work happens in the main checkout, on a plain branch. Git worktrees (a second working directory for another branch) are possible for parallel work, but each needs its own `pnpm install`, `.env` and Docker Compose ports, so they are not the default.

## 2. Commit

Commit messages follow **Conventional Commits**:

```
type(scope): short imperative description

Optional body explaining why the change is needed, when that is not
obvious, wrapped at about 72 characters.

Optional footers, such as BREAKING CHANGE: … or Co-Authored-By: …
```

| Type | For | Effect on the version |
|---|---|---|
| `feat` | A new capability for users | Raises MINOR |
| `fix` | A bug fix | Raises PATCH |
| `docs` | Documentation only | None |
| `test` | Tests only | None |
| `refactor` | Code change that neither fixes a bug nor adds a feature | None |
| `perf` | A performance improvement | Raises PATCH |
| `build` | Build system, dependencies, Dockerfile | None |
| `ci` | CI configuration | None |
| `chore` | Anything else (tooling, housekeeping) | None |

- **The scope is optional** and names a workspace or area: `web`, `api`, `shared`, `infra`, `adr`, `deps`.
- **A breaking change** is marked with `!` after the type (`feat(api)!: …`) or a `BREAKING CHANGE:` footer. While Szop is in `0.x`, it raises MINOR.
- **Subjects are imperative**: "add", not "added" or "adds". Read it as "this commit will… add item reordering".

Examples:

```
feat(lists): add item reordering
fix(api): reject empty list names
docs(adr): add ADR 0009 git workflow
build(deps): bump vitest to 3.2
```

**Within a phase, commits follow the plan's tasks**, so the PR can be reviewed one task at a time.

**One commit per task holds its tests and its code together**, made once the task's tests pass. Test-driven development (TDD, [ADR 0007](../decisions/0007-testing-strategy.md), decision 3) happens in the working tree: write a failing test, see it fail, write the code, see it pass, tidy up, then commit. The plan spells these steps out in each task. Committing the failing test separately would record the TDD cycle in the history, but leave commits that fail their own tests, which breaks `git bisect` and a demo built from such a commit. With test and code together, every commit passes its tests and the diff shows each test next to the code it drives.

Two git hooks run on every commit, once the development environment phase has set them up: the **pre-commit** hook formats and lints the staged files ([ADR 0005](../decisions/0005-development-environment.md), decision 13), and the **commit-msg** hook runs commitlint, which rejects a message that does not follow the format.

## 3. Open a pull request

Before opening the PR, Claude reviews its own changes (the superpowers code review step) and fixes what it finds. Then:

```bash
git push -u origin feat/shopping-lists
gh pr create --title "feat(lists): add shopping lists"
```

`gh` opens an editor with the PR template for the description.

- **The PR title follows Conventional Commits**: it becomes the merge commit's message on `main`.
- **The description follows the PR template** (`.github/pull_request_template.md`): what and why, links to the roadmap phase, spec, plan, requirement IDs and ADRs, how it was tested, and the definition-of-done checklist.
- A phase's spec and plan are already on the branch, so the PR shows the design next to the code.

## 4. Review

The owner reviews; Claude addresses the comments.

- **Review commit by commit** in the PR's *Commits* tab, or pick a commit from the *Files changed* tab's commit menu. Each commit is one task of the plan. Look at the whole diff last.
- **Comments are answered with new commits on the branch**, not by rewriting existing ones. Rewriting history during a review (a rebase and force push) hides what changed since the last look, and changes the hashes of commits whose images may already have been checked.
- **Every conversation must be resolved** before the merge button unlocks, so no comment is skipped by accident.

## 5. Keep the branch up to date

If `main` moves while a branch is open (for example, a release PR was merged), bring it in by **merging `main` into the branch**, which is what GitHub's *Update branch* button does:

```bash
git switch feat/shopping-lists
git merge main
```

Rebasing the branch onto `main` would also work, but it gives every commit a new hash; merging keeps them.

Once CI exists, GitHub requires the branch to be up to date before merging, so what lands on `main` is exactly what CI tested.

## 6. Merge

**Only the owner merges; the merge is the approval.** GitHub does not let an author approve their own PR, and every PR is authored by the owner's account, so there is no formal approving review.

A phase PR is merged when the **definition of done** is met on the branch ([ADR 0004](../decisions/0004-implementation-process.md), decision 7): the tests pass, CI is green, the change was deployed to a demo environment from the branch's image and checked there ([ADR 0008](../decisions/0008-hosting.md), decision 29; the `demo-up` workflow of [ADR 0010](../decisions/0010-ci-cd.md)), and the living docs, including the roadmap status, are updated.

The only merge method is a **merge commit**. GitHub deletes the remote branch afterwards. Locally:

```bash
git switch main
git pull
git branch -d feat/shopping-lists
git fetch --prune   # forget remote branches that no longer exist
```

## 7. Read the history

Merge commits keep every task commit and mark where each phase landed:

```bash
git log --oneline --first-parent main   # one line per merged PR (phase)
git log --oneline --graph               # every commit, with the branch structure
git bisect start                        # find the commit that introduced a bug,
                                        # down to a single task
```

## 8. Release

Szop uses **Semantic Versioning (SemVer)**, `MAJOR.MINOR.PATCH`, with one version for the whole repository:

- **`0.x` until the MVP is complete.** A `feat` raises MINOR, a `fix` raises PATCH, and a breaking change also raises only MINOR.
- **`1.0.0` marks the finished MVP.**

Releases are cut by **release-please**, set up in the CI/CD phase. It reads the commits on `main` and keeps an open **release PR** titled like `chore(main): release 0.3.0`, holding the next version and the new `CHANGELOG.md` entry. The PR updates itself as more changes are merged.

**Merging the release PR is the release.** It creates the `v0.3.0` tag and a GitHub Release, and CI builds the image tagged with that version. Merge it when a milestone is worth marking, typically after a phase. The first release, `v0.1.0`, is expected after the walking skeleton.

A version marks a state of the code; it deploys nothing. The demo environment can be created from any image, versioned or not ([ADR 0008](../decisions/0008-hosting.md), decision 13).

## What is enforced, and by what

| Rule | Enforced by | From |
|---|---|---|
| No direct pushes, force pushes or deletion of `main` | Ruleset for `main` | This ADR's merge |
| Every change goes through a PR | Ruleset for `main` | This ADR's merge |
| Merge commits only | Ruleset for `main` and repository settings | This ADR's merge |
| Review conversations resolved before merging | Ruleset for `main` | This ADR's merge |
| Version tags cannot be moved or deleted | Ruleset for `v*` tags | This ADR's merge |
| Secrets cannot be pushed | Secret scanning push protection | This ADR's merge |
| Staged files formatted and linted | pre-commit hook | Development environment phase |
| Commit messages follow Conventional Commits | commit-msg hook (commitlint) | Development environment phase |
| Every commit of a PR follows Conventional Commits, even if the hook was skipped | CI check (commitlint) | CI/CD phase |
| CI green and branch up to date before merging | Ruleset for `main` (required status checks `ci-ok` and the PR title check) | CI/CD phase |
| No new high or critical code scanning alerts | Ruleset for `main` (code scanning results) | CI/CD phase |
| PR title follows Conventional Commits | CI check | CI/CD phase |
| Claude never merges a PR | `CLAUDE.md` only | This ADR's merge |
