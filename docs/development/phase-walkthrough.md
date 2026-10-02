# A phase, end to end

One example phase, from the first commit to the release, showing where each thing happens and in what order. It pulls together the [git workflow](git-workflow.md) ([ADR 0009](../decisions/0009-git-workflow.md)), the testing strategy ([ADR 0007](../decisions/0007-testing-strategy.md)), CI/CD ([ADR 0010](../decisions/0010-ci-cd.md)) and the demo environment ([ADR 0008](../decisions/0008-hosting.md)). The phase is made up; the names, numbers and hashes are only there to make the picture concrete.

**The example:** the roadmap phase *Templates*. When it starts, `main` is at release `v0.3.0` and has no open release PR. While the phase is under review, a Dependabot PR is merged into `main`. At the end, the phase is released as `v0.4.0`.

## Contents

- [Who and what takes part](#who-and-what-takes-part)
- [The whole phase in one graph](#the-whole-phase-in-one-graph)
- [Step by step](#step-by-step)
  - [Step 1 — Brainstorm, spec and plan](#step-1--brainstorm-spec-and-plan)
  - [Step 2 — Implement, task by task, test first](#step-2--implement-task-by-task-test-first)
  - [Step 3 — Check locally while implementing](#step-3--check-locally-while-implementing)
  - [Step 4 — Self-review, then open the PR](#step-4--self-review-then-open-the-pr)
  - [Step 5 — Deploy the branch to the demo](#step-5--deploy-the-branch-to-the-demo)
  - [Step 6 — Review comments and a fix](#step-6--review-comments-and-a-fix)
  - [Step 7 — `main` moves: update the branch](#step-7--main-moves-update-the-branch)
  - [Step 8 — Redeploy, check, tear down](#step-8--redeploy-check-tear-down)
  - [Step 9 — The owner merges the phase](#step-9--the-owner-merges-the-phase)
  - [Step 10 — The release PR waits](#step-10--the-release-pr-waits)
  - [Step 11 — The owner merges the release PR](#step-11--the-owner-merges-the-release-pr)
- [What makes a release, and which number changes](#what-makes-a-release-and-which-number-changes)
- [Where each thing lives](#where-each-thing-lives)
- [What runs on which event](#what-runs-on-which-event)
- [When this all exists](#when-this-all-exists)
- [Open points for the releases phase](#open-points-for-the-releases-phase)

## Who and what takes part

| Actor | Where it acts | What it does |
|---|---|---|
| **Claude** | The owner's machine, the branch | Writes the spec, plan, tests and code; commits; pushes; opens the PR; answers review comments. Never merges, never presses `demo-up`/`demo-down` unless asked. |
| **Owner** | The owner's machine, GitHub | Approves the design and the plan, tries the app locally, reviews, presses `demo-up`/`demo-down`, merges PRs (the merge is the approval). |
| **CI** (`ci.yml`, `pr-title.yml`, CodeQL) | GitHub Actions | Checks every push to a branch with an open PR, and every push to `main`. |
| **Dependabot** | GitHub | Opens `build(deps)`/`ci(deps)` PRs on Mondays. |
| **release-please** (`szop-release[bot]`) | GitHub Actions on `main` | Keeps the release PR up to date; on its merge, tags the version and publishes the GitHub Release. |
| **`demo-up` / `demo-down`** | GitHub Actions → AWS | Build the image if missing, create or update the demo; destroy it (by hand or nightly). |

## The whole phase in one graph

Time flows left to right. `●` is a commit, `M` a merge commit.

```
                                        dependabot/npm_and_yarn/...
                                              ●  (PR #13)
                                             / \
 main ──●───────────────────────────────────●───M13──────────────M12────────────M14───────▶
        │                                          \             /  \           /
      v0.3.0                                        \           /    ●─────────┘
        \                                            \         /     release-please--branches--main
         \                                            \       /      (PR #14, szop-release[bot])
          ●───●───●───●───●───●───●───────●────────────M─────┘                  │
          1   2   3   4   5   6   7       8            9                      v0.4.0
          └──────────── feat/templates (PR #12) ──────────┘                   (tag on M14)
                                  ▲                    ▲
                        demo-up @ 7 (create)  demo-up @ 9 (redeploy) → check → demo-down
```

| # | Branch | Commit message | Why it is there |
|---|---|---|---|
| 1 | `feat/templates` | `docs(spec): add templates design` | The approved spec, `docs/superpowers/specs/2026-10-05-templates-design.md` |
| 2 | `feat/templates` | `docs(plan): add templates implementation plan` | The approved plan, `docs/superpowers/plans/2026-10-05-templates.md` |
| 3 | `feat/templates` | `feat(shared): add template schema` | Plan task 1: the schema and its tests (TDD) |
| 4 | `feat/templates` | `feat(api): add templates endpoints` | Plan task 2: the routes, services and their tests (TDD) |
| 5 | `feat/templates` | `feat(web): start a list from a template` | Plan task 3: the page and its component tests (test-after) |
| 6 | `feat/templates` | `test(e2e): cover the template journey` | Plan task 4: the Playwright journey |
| 7 | `feat/templates` | `docs: update architecture and roadmap for templates` | Plan task 5: living docs, roadmap status |
| 8 | `feat/templates` | `fix(web): keep the template name after a failed save` | Answer to a review comment: a **new** commit with a test reproducing the bug, no rewriting |
| 9 | `feat/templates` | `Merge branch 'main' into feat/templates` | *Update branch*: brings Dependabot's change in, because the PR must be up to date with `main` |
| M13 | `main` | `build(deps): bump the npm group (#13)` | The owner merged Dependabot's PR |
| M12 | `main` | `feat(templates): add templates (#12)` | The owner merged the phase: the **PR title** is the merge commit's message |
| — | `release-please--branches--main` | `chore(main): release 0.4.0` | release-please's commit: version bump and `CHANGELOG.md` |
| M14 | `main` | `chore(main): release 0.4.0 (#14)` | The owner merged the release PR: **this is the release** |

## Step by step

### Step 1 — Brainstorm, spec and plan

*Where: the owner's machine, then the branch.*

```
 main ──●  v0.3.0
         \
          ●───●            git switch main && git pull
          1   2            git switch -c feat/templates
          feat/templates   commit 1: spec   (after the owner approves the design)
                           commit 2: plan   (after the owner approves the plan)
```

- The branch name is `type/short-description`; a phase that adds a capability is `feat/…`.
- A small, well-scoped phase may skip the written spec and plan ([ADR 0004](../decisions/0004-implementation-process.md), decision 8); then commits 1 and 2 do not exist.

### Step 2 — Implement, task by task, test first

*Where: the owner's machine, the branch.*

```
          ●───●───●───●───●───●───●
          1   2   3   4   5   6   7
                  └── one commit per plan task ──┘

 inside one task (commit 4, "feat(api): add templates endpoints"):

   write a failing test ──▶ run it: RED ──▶ write the code ──▶ run it: GREEN ──▶ tidy up ──▶ git commit
   └─────────────────────────── all in the working tree ─────────────────────────────┘   test + code
                                                                                          in one commit
```

- **TDD where [ADR 0007](../decisions/0007-testing-strategy.md), decision 3 says so:** test first for domain rules, services and API routes; test-after for components and pages, in the same task. The plan spells the red-green steps out in each task.
- **One commit per task, holding the tests and the code together**, made when the task is green. The red-green cycle happens in the working tree; it is not recorded as separate commits. Every commit then passes its own tests, so `git bisect` and a demo built from any commit work, and the diff shows the test next to the code it drives.
- On every `git commit`: the **pre-commit** hook formats and lints the staged files, the **commit-msg** hook runs commitlint on the message.
- Pushing the branch (`git push -u origin feat/templates`) is fine at any point: **without an open PR, no CI runs.**

### Step 3 — Check locally while implementing

*Where: the owner's machine.* The demo is for the end of a phase; the day-to-day checks are local and take seconds to minutes ([ADR 0005](../decisions/0005-development-environment.md), [ADR 0007](../decisions/0007-testing-strategy.md)).

```
 docker compose up -d        PostgreSQL in a container
 pnpm dev                    SPA (Vite) + API (tsx watch), http://localhost:5173 → try the feature by hand
 pnpm test:watch             Vitest re-runs the affected tests on every save
 pnpm test                   all unit, API and component tests
 pnpm test:e2e               Playwright on a production build, both viewports
 pnpm typecheck / lint       what CI's typecheck and lint jobs run
```

- CI runs the same scripts, so a green local run predicts a green CI run.
- `demo-up` can still be pressed on the branch at any time, for example to try a change to `infra/demo`, but a local check is the default.

### Step 4 — Self-review, then open the PR

*Where: GitHub.*

```
 feat/templates ─── ● 7 ──push──▶  PR #12  "feat(templates): add templates"
                                      │
                                      ├─▶ ci.yml         lint · typecheck · test · e2e · docker
                                      │                  · commits · infra · workflows → ci-ok
                                      ├─▶ pr-title.yml   title follows Conventional Commits
                                      ├─▶ CodeQL         no new high/critical alerts
                                      └─▶ infra-plan.yml only if infra/ changed: plan as a PR comment
```

- Claude reviews its own diff first, then opens the PR with the **template** filled in.
- The **PR title** matters most: it becomes the merge commit's message on `main`, and release-please reads it.
- CI tests `refs/pull/12/merge`: what `main` would look like after the merge. A newer push cancels the older run.

### Step 5 — Deploy the branch to the demo

*Where: GitHub Actions → AWS.*

```
 owner: Actions ▶ demo-up ▶ ref = feat/templates
          │
          ├─ resolve ref → full commit hash of 7 (a1b2c3d…)
          ├─ ⏸ image and deploy jobs (environment "demo") wait → owner: Review deployments ▶ Approve
          ├─ image job:  ECR has szop:a1b2c3d? no → build and push szop:a1b2c3d
          ├─ deploy job: terraform apply infra/demo   ~10–15 min (RDS)
          │                                   migrations run as the container starts
          ├─ re-enable the nightly demo-down schedule
          └─ wait for https://demo.<domain>/api/health → summary: URL, commit, image
```

The approval is the owner confirming that they started this run: a deploy nobody pressed, for example from a workflow a branch added, waits there and is rejected ([ADR 0012](../decisions/0012-security-baseline.md), decision 16). The owner then checks the phase's behavior in a browser on the demo, and reviews the PR commit by commit.

### Step 6 — Review comments and a fix

*Where: the branch.*

```
          ●───●───●───●───●───●───●───────●
          1                       7       8   fix(web): keep the template name…
                                          │   (a test reproducing the bug first, then the fix)
                                          └─ push → CI runs again on PR #12
```

- Every comment is answered with a **new commit**; no rebase, amend or force push once the PR is open.
- A bug fix starts with a failing test that reproduces it (ADR 0007, decision 3).
- Every review conversation must be **resolved** before the merge button unlocks.

### Step 7 — `main` moves: update the branch

*Where: GitHub, then the branch.*

```
                               dependabot/npm_and_yarn/...  ●  (PR #13)
                                                           / \
 main ──●─────────────────────────────────────────────────●───M13     ← owner merges #13
         \                                                      \
          ●───●───●───●───●───●───●───────●──────────────────────M 9  ← "Update branch"
          1                       7       8                           (merges main INTO the branch)
```

- `build(deps)` is not a releasable change, so release-please opens **no** release PR for M13 (see [what makes a release](#what-makes-a-release-and-which-number-changes)).
- PR #12 is now behind `main`, and the ruleset requires it to be up to date. *Update branch* (or `git merge main` locally) adds merge commit 9. **No rebase**, so hashes 1–8, and the image `szop:a1b2c3d` built from 7, stay valid.
- commitlint ignores merge commits such as 9. CI runs again on the new head.

### Step 8 — Redeploy, check, tear down

*Where: GitHub Actions → AWS.*

```
 owner: demo-up ▶ ref = feat/templates → hash of 9 (e4f5a6b…) ▶ Approve
          ├─ build and push szop:e4f5a6b
          └─ terraform apply: only the ECS service's image changes
                → ECS rolling update: starts a task on the new image, waits for it to be healthy,
                  then stops the old one (a few minutes, the demo stays up)

 owner checks the demo again … done

 owner: demo-down ▶ ref = main ▶ terraform destroy infra/demo   (by hand, right away; no approval)
        safety net: demo-down also runs every night at 01:17 UTC, and does nothing if there is no demo
        both run in the environment "demo-teardown", which only main may use
```

- **Redeploying** with the demo up does not rebuild everything: the ECS service replaces its tasks one by one (a rolling update).
- `demo-up` and `demo-down` never run Terraform at the same time: each waits for the other's state lock, and neither cancels a running job. `demo-down` destroys with the Terraform code of the commit that was deployed, which `demo-up` records ([ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 7).
- The *Deployed* box of the [definition of done](definition-of-done.md) can now be ticked, with a link to this `demo-up` run: the image of the head that will be merged was built, deployed, checked and destroyed.
- Szop has no *rollout* in the usual sense (getting a new version to users, often gradually, with canary releases or feature flags): there are no users, and the demo exists only for a session.

### Step 9 — The owner merges the phase

*Where: GitHub, `main`.*

```
 main ──●──────────────────●───M13──────────────M12
        v0.3.0                   \              /      M12: "feat(templates): add templates (#12)"
                                  ●────────────●9
                                                       GitHub deletes feat/templates on the remote

 push to main triggers:
   ├─ ci.yml              the same checks, on main
   ├─ CodeQL
   └─ release-please.yml  finds a feat since v0.3.0 → opens PR #14 "chore(main): release 0.4.0"
```

Locally, afterwards:

```bash
git switch main && git pull
git branch -d feat/templates
git fetch --prune
```

### Step 10 — The release PR waits

*Where: GitHub.*

```
 main ──…──M12──────────────────────▶  (more PRs may be merged here;
             \                          the release PR updates itself each time)
              ●  release-please--branches--main
                 chore(main): release 0.4.0
                 ├─ package.json versions   0.3.0 → 0.4.0
                 ├─ .release-please-manifest.json
                 └─ CHANGELOG.md            "## 0.4.0 … Features: add templates …"
```

- The PR is authored by `szop-release[bot]` (the GitHub App), so CI and the required checks run on it like on any PR.
- **An open release PR is only a proposal.** Nothing forces a release now: the owner merges it when the milestone is worth marking, typically after a phase. Until then it collects whatever else is merged.

### Step 11 — The owner merges the release PR

*Where: GitHub, `main`.*

```
 main ──…──M12───────────M14 ──▶ tag v0.4.0 on M14   (immutable: the v* tag ruleset)
             \           /   ──▶ GitHub Release "v0.4.0" with the changelog entry
              ●─────────┘    ──▶ follow-up job (environment "release", main only):
                                   ECR has szop:<hash of M14>?
                                     yes → add the tag 0.4.0 to it
                                     no  → build and push with both tags
```

- **A version marks the code; it deploys nothing.** Nothing is running at this point, and that is fine.
- To show `v0.4.0` later: `demo-up` with ref `v0.4.0`, then `demo-down`.
- release-please runs again on this push, finds nothing releasable since `v0.4.0`, and opens no PR.

## What makes a release, and which number changes

release-please runs on **every** push to `main`, but it opens or updates the release PR only when `main` holds a **releasable** commit since the last version: a `feat`, a `fix`, a `perf` or a breaking change. Everything else (`docs`, `test`, `refactor`, `build`, `ci`, `chore`) goes to `main` without touching the release PR. The full table of types is in the [git workflow guide](git-workflow.md#2-commit).

| Merged into `main` since `v0.3.0` | Release PR | Next version while in `0.x` | After `1.0.0` (from `1.3.0`) |
|---|---|---|---|
| Only `docs`, `test`, `refactor`, `build`, `ci`, `chore` (a typo fix, a dependency bump) | None | — | — |
| At least one `fix` or `perf`, no `feat` | Opened or updated | `0.3.1` (PATCH) | `1.3.1` |
| At least one `feat` | Opened or updated | `0.4.0` (MINOR) | `1.4.0` |
| A breaking change (`feat!`, `fix!` or a `BREAKING CHANGE:` footer) | Opened or updated | `0.4.0` (MINOR, `bump-minor-pre-major`) | `2.0.0` (MAJOR) |
| A `Release-As: 1.0.0` footer | Opened or updated | `1.0.0` (the MVP is done) | — |

The highest bump wins: a `feat` and three `fix`es since `v0.3.0` make `0.4.0`. And since merging the release PR is a separate choice, a small releasable change (a one-word `fix` in a label) can simply wait in the open release PR for the next milestone.

## Where each thing lives

| Thing | Where | Name or example |
|---|---|---|
| Phase branch | GitHub, deleted after the merge | `type/short-description`: `feat/templates` |
| Branch outside a phase | GitHub | `docs/fix-typo`, `chore/bump-vitest` |
| Dependabot branch | GitHub | `dependabot/npm_and_yarn/…` |
| Release branch | GitHub, kept up to date by release-please | `release-please--branches--main` (to be confirmed, see [open points](#open-points-for-the-releases-phase)) |
| Commit message | Every commit | `type(scope): imperative description` |
| PR title → merge commit | `main` | `feat(templates): add templates (#12)` |
| Update-branch merge | The PR branch | `Merge branch 'main' into feat/templates` |
| Release PR / commit | `main` | `chore(main): release 0.4.0` |
| Version tag | git, immutable | `v0.4.0` |
| GitHub Release | GitHub | `v0.4.0`, body = the changelog entry |
| Image for any deploy | ECR, immutable | `szop:<commit hash>` |
| Image of a release | ECR, immutable, the same image | `szop:<hash of M14>` and `szop:0.4.0` |
| Spec / plan | The phase branch, then `main` | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` |
| Demo | AWS, only during a session | `https://demo.<domain>` |

## What runs on which event

| Event | What runs |
|---|---|
| `git commit` (local) | pre-commit (format, lint), commit-msg (commitlint) |
| Push to a branch **without** a PR | Nothing |
| PR opened, or push to a PR branch | `ci.yml`, CodeQL, `infra-plan.yml` if `infra/` changed |
| PR opened, title edited, or pushed to | `pr-title.yml` |
| Push to `main` (any merge) | `ci.yml`, CodeQL, `release-please.yml` |
| Release PR merged | release-please tags and publishes the release; the follow-up job tags the image |
| Owner presses `demo-up` | Image build if missing, `terraform apply` of `infra/demo`, health check |
| Owner presses `demo-down`, or every night at 01:17 UTC | `terraform destroy` of `infra/demo` |
| Owner presses `mutation` | StrykerJS mutation testing |
| Monday | Dependabot version update PRs |

## When this all exists

This is the target state. The pieces arrive in the [roadmap](../roadmap.md)'s phases that introduce them ([ADR 0009](../decisions/0009-git-workflow.md), decision 16; [ADR 0010](../decisions/0010-ci-cd.md), decision 23):

| From | What works |
|---|---|
| Now (ADR 0009 merged) | Branches, PRs, merge commits only, the `main` and `v*` rulesets, the PR template |
| [PH-01](../roadmap.md#ph-01-monorepo-and-toolchain) | The local loop of step 3, the pre-commit and commit-msg hooks |
| [PH-02](../roadmap.md#ph-02-ci-checks), [PH-11](../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net), [PH-12](../roadmap.md#ph-12-first-deploy) and [PH-13](../roadmap.md#ph-13-releases) | CI checks and required status checks, `demo-up`/`demo-down` (the nightly teardown and a placeholder `demo-up` merged before any demo, [ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 2), release-please, versioned images, Dependabot |
| [PH-13](../roadmap.md#ph-13-releases), the end of the walking skeleton | The first release, `v0.1.0` |
| When the MVP is done | `1.0.0`, set with a `Release-As: 1.0.0` footer |

Until a piece exists, its step is simply skipped, and the matching [definition-of-done](definition-of-done.md) item in the PR is marked N/A, with the reason.

## Open points for the releases phase

Details this walkthrough runs into that the ADRs leave open. They belong to [PH-13](../roadmap.md#ph-13-releases) and are tracked in the [open points register](../open-points.md#ph-13-releases):

- **Review fixes and duplicate entries in the changelog** ([OP-025](../open-points.md#op-025)). A review fix such as commit 8 is a `fix(…)` commit, and release-please reads every commit that reaches `main`, including those a merge commit brings in, so `CHANGELOG.md` will probably list it as a bug fix of code that was never released. The task commits and the merge commit's PR title may also appear as separate features.
- **Image version tag format** ([OP-026](../open-points.md#op-026)): agreed direction `szop:0.4.0`, without the `v` of the git tag.
- **release-please's branch name** ([OP-027](../open-points.md#op-027)): `release-please--branches--main` by default, to check against the ruleset and branch naming.
