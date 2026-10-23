# PH-13 Releases — design

- **Phase:** [PH-13](../../roadmap.md#ph-13-releases) ([#42](https://github.com/luiki-dev/szop/issues/42))
- **Date:** 2026-10-23
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-025](https://github.com/luiki-dev/szop/issues/89) (release notes from GitHub), [OP-026](https://github.com/luiki-dev/szop/issues/90) (`szop:0.1.0`) and [OP-027](https://github.com/luiki-dev/szop/issues/91) (the bot's branch name) settled; [OP-102](https://github.com/luiki-dev/szop/issues/248) done here; the PH-13 parts of [OP-019](https://github.com/luiki-dev/szop/issues/77) (`release-please.yml`), [OP-020](https://github.com/luiki-dev/szop/issues/78) (`szop-ci-release`) and [OP-023](https://github.com/luiki-dev/szop/issues/74) (the release-please page)

[ADR 0009](../../decisions/0009-git-workflow.md), decision 11 chose release-please to cut versions, and [ADR 0010](../../decisions/0010-ci-cd.md), decision 17 said how it runs: on every push to `main`, as a GitHub App, with a follow-up job that gives the release commit's image its version. This phase builds that, and releases the walking skeleton as `v0.1.0`. Before the brainstorm, the owner ran release-please in a throwaway repository with merge commits ([#150](https://github.com/luiki-dev/szop/issues/150#issuecomment-6367966572)); its results drive most decisions below. The decisions are recorded in ADR 0042.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [The trial](#the-trial)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Files](#files)
  - [The release-please configuration](#the-release-please-configuration)
  - [Release notes](#release-notes)
  - [The workflow](#the-workflow)
  - [The release role](#the-release-role)
  - [The ECR lifecycle rule](#the-ecr-lifecycle-rule)
  - [OP-102: the plan role's log reads](#op-102-the-plan-roles-log-reads)
  - [GitHub settings](#github-settings)
  - [The first release, in order](#the-first-release-in-order)
  - [When a release job fails](#when-a-release-job-fails)
- [Documentation and records](#documentation-and-records)
- [Roadmap and GitHub changes](#roadmap-and-github-changes)
- [Owner steps](#owner-steps)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: merging release-please's PR tags a version, publishes a GitHub Release and pushes the versioned image. The walking skeleton is released as `v0.1.0`.

The phase is done when:

- after the phase's PR is merged, `release-please.yml` runs on `main` as `szop-release[bot]` and opens the release PR `chore(main): release 0.1.0`, whose `CHANGELOG.md` entry lists one line per merged PR (no Dependabot PR, no PR labelled `skip-changelog`), and whose CI and PR title check run and pass like any PR's;
- after the owner merges the release PR: the tag `v0.1.0` exists on its merge commit (created by the App through the `version-tags` ruleset's bypass), a GitHub Release `v0.1.0` carries the same notes, and ECR holds the image of that commit with the tags `<commit hash>` and `0.1.0`;
- `szop-ci-release` exists in `infra/base`, trusted only for the `release` environment on `refs/heads/main`, allowed to push and tag images in the `szop` repository and nothing else; Access Analyzer's validation on the PR passes;
- ECR's lifecycle rule 1 shields images tagged `*.*.*`, so `szop:0.1.0` is never expired;
- [OP-102](https://github.com/luiki-dev/szop/issues/248)'s two actions are denied to `szop-ci-plan`;
- **on the demo:** `demo-up` on the phase branch finishes green, `/api/health` answers `200`, and `demo-down` reports `Destroy complete!`;
- `pnpm check`, `pnpm check:infra` and `pnpm check:workflows` pass;
- the docs and records under [Documentation and records](#documentation-and-records) are updated, and the roadmap and GitHub as in [Roadmap and GitHub changes](#roadmap-and-github-changes).

The last two release steps happen after the phase's PR is merged, so the PR is reviewed and merged before they can be seen; the owner's step 7 checks them ([Owner steps](#owner-steps)).

## Out of scope

- **Labelling PRs automatically** (for example `actions/labeler` adding `skip-changelog` for `.claude/**`) *(the owner's choice)*: a workflow with write access to PRs, for a label set by hand a few times a month. Worth it if the label is often forgotten.
- **Grouping release notes into categories** by label: the PR titles are Conventional Commits and read well as a flat list *(the owner's choice)*.
- **Deploying a release**: a version marks the code and deploys nothing ([phase walkthrough](../../development/phase-walkthrough.md#step-11--the-owner-merges-the-release-pr)); showing `v0.1.0` is `demo-up` with ref `v0.1.0`.
- **Signing images or adding provenance** (SBOM, attestations): [ADR 0010](../../decisions/0010-ci-cd.md), decision 19 left supply-chain provenance for later.
- **Publishing the image anywhere but ECR**, and any mutable tag such as `latest` ([ADR 0008](../../decisions/0008-hosting.md), decision 13).
- **Releases from other branches** (hotfix or maintenance branches): GitHub flow has only `main` ([ADR 0009](../../decisions/0009-git-workflow.md), decision 2).
- **`1.0.0`**: set with a `Release-As: 1.0.0` footer when the MVP is done; the trial showed how ([decision 13](#decisions-taken-in-the-brainstorm)).

## The trial

Run by the owner on 2026-10-23 in [luiki-dev/release-please-trial](https://github.com/luiki-dev/release-please-trial): `googleapis/release-please-action@v4` with the workflow's `GITHUB_TOKEN`, `release-type: node`, `bump-minor-pre-major`, merge commits only. Each round was a branch of three empty commits (`feat`, `test`, a review-fix `fix`) merged through a PR whose title is a `feat`, as a Szop phase is. The full results are in [#150](https://github.com/luiki-dev/szop/issues/150#issuecomment-6367966572).

| Round | Tried | Result |
|---|---|---|
| 1, first repository | Defaults, manifest `0.0.0` | ❌ First release `1.0.0`, tag `trial-v1.0.0`: with no earlier tag the manifest is ignored and the default initial version is used; the package's name goes into the tag, the release PR's title and the Release's name |
| 1, again | `initial-version: "0.1.0"`, `include-component-in-tag: false` | ✅ Tag and Release `v0.1.0`, release PR `chore(main): release 0.1.0` |
| 1 | Option B: merge message = PR title (Szop's setting) | ✖️ The PR title **and** the task commits listed, so one feature twice; the review fix listed as a bug fix |
| 2 | Option A: GitHub's default merge message | ✖️ As B: the "Merge pull request" header is skipped, the PR title in the body is parsed, and the `(#N)` link is lost |
| 3 | Option D: `BEGIN_COMMIT_OVERRIDE` in the PR description | ✖️ The override replaces **every** commit of the PR: one entry four times, the `test` and `fix` commits turned into `feat` |
| 4 | `Release-As: 1.0.0` footer on a branch commit, merged through a PR | ✅ The release PR proposes `1.0.0` |
| 5 | Option E: `changelog-type: github` | ✅ One entry per merged PR, `feat(orders): add ordering by @luiki-dev in #10`; the version is still computed from the commits (`1.1.0`) |

Also seen: the release PR's branch is `release-please--branches--main--components--<package name>`, reused for every release and not deleted; release PRs never appear in the notes (the tag sits on their merge commit, outside the next range); a commit pushed straight to `main` does not appear either, since GitHub lists PRs; a release PR merged with GitHub's default message still tags correctly. **Why A, B and D fail:** release-please reads every commit that reaches `main`, the branch commits a merge commit brings in included, and has no first-parent option; it applies a PR's override to every commit associated with that PR.

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | How release notes work with merge commits ([OP-025](https://github.com/luiki-dev/szop/issues/89)) | (A) GitHub's default merge message; (B) the PR title as the merge message, as today; (C) squash merges; (D) `BEGIN_COMMIT_OVERRIDE` in the PR description; (E) `changelog-type: github`, notes from GitHub | **E: release notes from GitHub, merge commits stay** *(the owner's choice, after the trial)*. One entry per merged PR, with its title, author and link; [ADR 0009](../../decisions/0009-git-workflow.md), decision 6 is unchanged and the task commits stay in `main`'s history. The version is still computed from the commits, where duplicates do no harm (the highest bump wins). A, B and D list the task commits next to the PR, and D multiplies one entry by the PR's commit count ([the trial](#the-trial)). C gives clean notes grouped by type, but supersedes ADR 0009, decision 6, loses the task commits on `main` and changes the ruleset. **Cost:** notes are grouped only by label, not by commit type, and every merged PR is listed unless excluded (decision 2). |
| 2 | Which PRs the notes list | Every PR; Dependabot's excluded, a flat list; categories by label | **Every PR except Dependabot's and those labelled `skip-changelog`, as a flat list** *(the owner's choice)*. `.github/release.yml` excludes the author `dependabot` and the label `skip-changelog`. The label is set **by hand**, by Claude when it opens a PR for a change readers of the notes do not need (Claude Code's settings, process docs) or by the owner; it hides the PR from the notes and does not change the version. It works whenever it is set before the release PR is merged: release-please regenerates the notes on every push to `main`. Categories would need a label on every PR, by hand or by a labelling workflow. |
| 3 | The first release's notes | Every PR since the repository began (about 44, half of them foundation `docs:` PRs); label the old `docs:` PRs `skip-changelog`; notes written by hand | **Every PR** *(the owner's choice)*. With no earlier tag GitHub lists every merged PR; that is the walking skeleton's real history, and in a learning project its decisions are part of the product. It happens once and costs nothing. Notes written by hand would be overwritten by release-please on the next push to `main`. |
| 4 | Where the version is written | `release-type: node`, the root `package.json`; `release-type: simple`, a `version.txt`; `node` and every workspace's `package.json` too | **`release-type: node`, the root `package.json`** *(the owner's choice)*. The root `package.json` gains `"version": "0.0.0"`, which each release PR raises, as the phase walkthrough already shows; the workspaces stay without a version, since none is ever published. A `version.txt` is a file nobody reads; four `package.json` files per release PR serve nobody. |
| 5 | Settings the trial showed are needed *(Claude's proposal, accepted)* | — | **`initial-version: "0.1.0"`** (without it the first release is `1.0.0`) and **`include-component-in-tag: false`** (without it the tag is `szop-v0.1.0`, which the `version-tags` ruleset's `v*` pattern would not even match). |
| 6 | The image's version tag ([OP-026](https://github.com/luiki-dev/szop/issues/90)) | `szop:0.1.0`; `szop:v0.1.0`; both | **`szop:0.1.0`, without the git tag's `v`** *(the owner's choice; OP-026's agreed direction)*. It is the convention for images (official images, `docker/metadata-action`'s semver pattern), and it equals `package.json`'s `version`. **Found while designing:** ECR's lifecycle rule 1 shields released images by the tag pattern `v*` ([ADR 0030](../../decisions/0030-domain-and-base-infrastructure-details.md), decision 9), which `0.1.0` does not match, so the release image would expire once 10 newer images exist. Rule 1's pattern becomes **`*.*.*`**: ECR allows several wildcards in a pattern, and a commit hash has no dots, so only versions match. This refines ADR 0030, decision 9. |
| 7 | The release PR's branch ([OP-027](https://github.com/luiki-dev/szop/issues/91)) | — | **Accepted as release-please names it: `release-please--branches--main--components--szop`** *(the owner did not object)*. Nothing in Szop stops it: the `main` ruleset targets only `main`, no rule restricts branch names, `ci.yml` and `pr-title.yml` run on every PR to `main`, and the release commit `chore(main): release 0.1.0` passes commitlint (`main` is on the scope list). `type/short-description` is the rule for branches people and Claude create; the guide names the bot's branch as the exception. |
| 8 | A required reviewer on the `release` environment | No reviewer, `main` only; a reviewer on the environment; a reviewer for the image job only, through a second environment | **No reviewer; deployments from `main` only** *(the owner's choice)*. The workflow runs on every push to `main`, so a reviewer would mean approving every merge, released or not. The owner's merge of the release PR is the approval. The role behind the environment can only push and tag images, AWS pins it to `main` as well (decision 10), and a PR's workflow cannot use the environment. A second environment for the image job only would add a role subject and settings to guard a tag. |
| 9 | How the release job delivers the image | (A) three jobs: `release-please`, `build` without AWS, `publish` with AWS; (B) re-tag only, and fail when the image is missing; (C) one job that builds and pushes with AWS credentials | **A, in its simple form** *(the owner's choice)*. As `demo-up` does ([ADR 0038](../../decisions/0038-app-on-ecs-and-rds-details.md), decision 9), the build runs without AWS credentials and hands the image to the job that holds them, which runs no `pnpm install` and no project scripts ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18). `build` runs on every release, even when ECR already holds the commit's image and `publish` only adds the tag; that happens on a re-run after a partial push, about five minutes of a free runner. Checking ECR first would need another job with AWS credentials before `build`. B fails on almost every release: the release commit is created by the merge and was never deployed. C builds with AWS credentials in the job. |
| 10 | The release role *(Claude's proposal, accepted)* | — | **`szop-ci-release`**, as [ADR 0010](../../decisions/0010-ci-cd.md), decision 16 describes it, in the form of `szop-ci-deploy`'s trust ([ADR 0032](../../decisions/0032-ci-access-and-teardown-details.md), decisions 13 and 14): the immutable subject `repo:luiki-dev@290870182/szop@1380292421:environment:release` **and** the ref `refs/heads/main`. Its permissions are in [The release role](#the-release-role). |
| 11 | [OP-102](https://github.com/luiki-dev/szop/issues/248) | — | **As the issue describes:** `logs:GetQueryResults` and `logs:GetLogRecord` join `szop-ci-plan`'s `DenyLogContents`, and `ReadOnlyAccess`'s current version is checked for other reads of log contents. It lands in this PR because it changes base's CI roles, as the issue asks. |
| 12 | The manifest and Prettier *(found while writing this spec)* | Format the manifest in the release PR; ignore it | **`.release-please-manifest.json` joins `.prettierignore` as a generated file.** release-please writes it compactly (`{".":"0.1.0"}`), which `prettier --check` rejects (checked on the trial's file), so every release PR's `lint` job would fail. `CHANGELOG.md` is Markdown, which Prettier already skips. `package.json` keeps its formatting: release-please keeps the file's indentation (checked on the trial's file). |
| 13 | `1.0.0` | — | **Confirmed as [ADR 0009](../../decisions/0009-git-workflow.md) planned it:** a commit with the footer `Release-As: 1.0.0` on a branch, merged through a PR, makes the release PR propose `1.0.0` (trial, round 4). An empty commit (`git commit --allow-empty`) is enough. |

## Design

### Files

| File | Change |
|---|---|
| `release-please-config.json` (new) | The configuration of [The release-please configuration](#the-release-please-configuration) |
| `.release-please-manifest.json` (new) | `{ ".": "0.0.0" }` |
| `package.json` | `"version": "0.0.0"` |
| `.prettierignore` | `.release-please-manifest.json`, with the reason |
| `.github/release.yml` (new) | Excludes the author `dependabot` and the label `skip-changelog` |
| `.github/workflows/release-please.yml` (new) | The jobs `release-please`, `build` and `publish` |
| `.github/pull_request_template.md` | A line on `skip-changelog` |
| `infra/base/ci_roles.tf` | `szop-ci-release` and its policy; OP-102's two actions |
| `infra/base/registry.tf` | Rule 1's pattern `*.*.*` and its comment |
| `infra/base/outputs.tf` | `ci_release_role_arn` |
| `CHANGELOG.md` | None: release-please creates it in the first release PR |
| Docs | As listed under [Documentation and records](#documentation-and-records) |

The label `skip-changelog` is created on GitHub through the REST API, with a description that says what it does.

### The release-please configuration

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "bump-minor-pre-major": true,
  "include-component-in-tag": false,
  "initial-version": "0.1.0",
  "changelog-type": "github",
  "packages": { ".": {} }
}
```

- **One version for the repository** ([ADR 0010](../../decisions/0010-ci-cd.md), decision 17): one package, `.`.
- **`bump-minor-pre-major`**: a breaking change in `0.x` raises only MINOR ([ADR 0009](../../decisions/0009-git-workflow.md), consequences).
- The manifest starts at `0.0.0`; with no earlier tag, `initial-version` decides the first version ([the trial](#the-trial)).

### Release notes

`changelog-type: github` makes release-please ask GitHub's [generate release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes) API for the notes between the last tag and the release commit. The same text goes into `CHANGELOG.md`, the release PR's description and the GitHub Release:

```
## 0.1.0 (2026-10-2x)

## What's Changed
* feat: release versions with release-please by @luiki-dev in https://github.com/luiki-dev/szop/pull/NNN
* …

**Full Changelog**: https://github.com/luiki-dev/szop/commits/v0.1.0
```

`.github/release.yml`:

```yaml
changelog:
  exclude:
    labels:
      - skip-changelog
    authors:
      - dependabot
```

### The workflow

`.github/workflows/release-please.yml`, on `push` to `main`, `permissions: {}` at the top and per job, `concurrency: release-please` without cancelling, actions pinned to commit SHAs with the version as a comment, as every workflow is ([ADR 0010](../../decisions/0010-ci-cd.md), decision 21):

1. **`release-please`**, `environment: release`, `permissions: {}` (the App's token does the writing): `actions/create-github-app-token` turns `vars.RELEASE_APP_ID` and `secrets.RELEASE_APP_PRIVATE_KEY` into a token limited to this repository that expires within an hour; `googleapis/release-please-action` runs with it and the files above. Outputs: `release_created`, `tag_name`, `version` and `sha`. On an ordinary push this job only opens or updates the release PR, and the two jobs below are skipped.
2. **`build`**, `if: release_created`, no environment, `contents: read`: checks out `sha`, builds the Dockerfile with `GIT_COMMIT=sha`, without a cache (the audit's C10: a privileged release restores no cache), and uploads the image as an artifact, as `demo-up`'s `build` does.
3. **`publish`**, `needs: [release-please, build]`, `environment: release`, `contents: read` and `id-token: write`: assumes `vars.AWS_RELEASE_ROLE_ARN`, then:
   - if ECR has `szop:<sha>` (`ecr describe-images`), adds the tag `<version>` to it by its manifest (`ecr batch-get-image`, then `ecr put-image`), without pulling the layers;
   - otherwise downloads and loads the artifact and pushes it as `szop:<sha>` and `szop:<version>`;
   - writes the tags and the digest to the job summary.

   It checks out no code and runs no project scripts.

The release PR, authored by `szop-release[bot]`, triggers `ci.yml` and `pr-title.yml` like any PR, so its required checks run; a token from the workflow's `GITHUB_TOKEN` would trigger nothing ([ADR 0009](../../decisions/0009-git-workflow.md), consequences). `release-please.yml` is not a required check: it runs on `main`, not on PRs.

### The release role

In `infra/base/ci_roles.tf`, next to the other CI roles, `max_session_duration = 3600`:

- **Trust:** GitHub's OIDC provider; `aud` = `sts.amazonaws.com`; `sub` = `repo:luiki-dev@290870182/szop@1380292421:environment:release`; `ref` = `refs/heads/main`. The environment's branch rule is a GitHub setting this policy cannot see, so `main` is pinned in AWS too ([ADR 0032](../../decisions/0032-ci-access-and-teardown-details.md), decision 14).
- **Permissions:**
  - `ecr:GetAuthorizationToken` on `*`, the only resource it takes;
  - on the `szop` repository only: `ecr:DescribeImages` (does the commit's image exist), `ecr:BatchGetImage` (its manifest, to add a tag), `ecr:PutImage`, and the push's layer actions `ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart` and `ecr:CompleteLayerUpload`.

  No layer downloads, no deletes. ECR's immutable tags already refuse to move an existing tag.
- **Output** `ci_release_role_arn`, which the owner stores as `AWS_RELEASE_ROLE_ARN`.

IAM Access Analyzer validates the new policies in `ci.yml`'s `plan` job, as it does every role policy in `infra/base` ([ADR 0041](../../decisions/0041-security-scanners-details.md)).

### The ECR lifecycle rule

`infra/base/registry.tf`, rule 1: `tagPatternList = ["*.*.*"]` instead of `["v*"]`, its description "Keep released images: version tags are never expired.", and the comment above the policy rewritten (a release image carries its commit hash and its version `X.Y.Z`; commit hashes have no dots). Rule 2 is unchanged. No image in ECR carries a `v*` tag today, so nothing loses its shield.

### OP-102: the plan role's log reads

`szop-ci-plan`'s `DenyLogContents` gains `logs:GetQueryResults` and `logs:GetLogRecord`. While building, `ReadOnlyAccess`'s current version is read for other `logs:` actions that return log contents; any found joins the deny, and the ADR records the version checked.

### GitHub settings

Recorded in `github-settings.md`:

- **The `release` environment:** deployment branches and tags → *Selected branches and tags*, one rule, branch `main`; no required reviewer ([decision 8](#decisions-taken-in-the-brainstorm)). The secret `RELEASE_APP_PRIVATE_KEY` and the variable `RELEASE_APP_ID` live in it, so no PR or branch workflow can read them.
- **The GitHub App `szop-release`:** owned by the owner's account, private (only on this account), webhook off, repository permissions *Contents: Read and write* and *Pull requests: Read and write* (and the mandatory *Metadata: Read-only*), installed on `luiki-dev/szop` only. Its private key is the setup's only long-lived secret ([ADR 0010](../../decisions/0010-ci-cd.md), decision 17).
- **The `version-tags` ruleset:** the App on the bypass list, so it can create `v*` tags; nobody else is ([ADR 0011](../../decisions/0011-design-sanity-check-follow-ups.md), decision 8).
- **The repository variable `AWS_RELEASE_ROLE_ARN`**, next to `AWS_PLAN_ROLE_ARN` and `AWS_DEPLOY_ROLE_ARN`.
- **The label `skip-changelog`.**

### The first release, in order

1. Claude opens the phase's PR.
2. **Before the merge**, the owner: creates the `release` environment, creates and installs the App, stores its ID and key in `release` and puts it on `version-tags`'s bypass list, applies `infra/base` from the branch, stores the role's ARN as `AWS_RELEASE_ROLE_ARN`, and runs the demo check. Without them, the first run on `main` fails.
3. The owner merges the phase's PR. `release-please.yml` runs on `main` and opens the release PR `chore(main): release 0.1.0` from `release-please--branches--main--components--szop`; CI and the PR title check run on it.
4. The owner merges the release PR. release-please tags `v0.1.0` and publishes the GitHub Release; `build` and `publish` push `szop:<hash>` and `szop:0.1.0`.
5. The owner applies `infra/base` again from `main`, and checks the tag, the Release and the image (`aws ecr describe-images --repository-name szop --image-ids imageTag=0.1.0`).

### When a release job fails

- **`release-please` fails** (a wrong App ID or key, the App not installed): nothing was tagged. The owner fixes the setting and re-runs the job; on a release PR's merge, release-please finds the merged PR still labelled `autorelease: pending` and tags it.
- **`build` or `publish` fails** after the tag and the Release exist (a wrong role ARN, a network error): the owner fixes the cause and uses *Re-run failed jobs*; the outputs of `release-please` are kept. `publish` is safe to repeat: a commit image pushed by the failed run is found and only tagged, and ECR's immutable tags refuse a second push of `0.1.0`.

`ci-cd.md` gets both as a short "a release failed" section.

## Documentation and records

- **ADR 0042 "Releases details"**: the decisions above, the trial's results, and what building settles. Notes: [ADR 0009](../../decisions/0009-git-workflow.md), decision 11 (refined: notes from GitHub, one entry per PR; the release branch's name); [ADR 0010](../../decisions/0010-ci-cd.md), decision 16 (completed: `szop-ci-release`'s trust and permissions) and decision 17 (refined: the three jobs, `release` without a reviewer, the image tag without `v`); [ADR 0030](../../decisions/0030-domain-and-base-infrastructure-details.md), decision 9 (refined: rule 1's pattern `*.*.*`); their status lines.
- **`docs/development/tools/release-please.md`** (new, OP-023's last part): what release-please is, why it was chosen, the configuration explained line by line, release notes from GitHub and `skip-changelog`, `Release-As`, the trial's lessons, and how to bump the action.
- **`docs/development/ci-cd.md`**: `release-please.yml` and its jobs; the `release` environment, its variable and secret, `AWS_RELEASE_ROLE_ARN` in the inventory; a release failed.
- **`docs/development/git-workflow.md`**, section 8 *Release*: release notes per PR, `skip-changelog` and when to use it, the bot's branch as the exception to the naming rule, `1.0.0` through `Release-As`.
- **`docs/development/phase-walkthrough.md`**: steps 10 and 11 (the branch name, notes per PR, the image tag `0.4.0`), *Where each thing lives*, and *Open points for the releases phase* replaced by a pointer to ADR 0042.
- **`docs/development/github-settings.md`**: the settings above.
- **`docs/architecture/aws-resources.md`**: `szop-ci-release`, its policy and its references; the lifecycle rule's pattern.
- **`docs/architecture/threat-model.md`**: the App as an actor (what its token can do: open PRs, push to unprotected branches, create `v*` tags; its key in `release`); the release path as an entry point and what guards it (`main` only, in GitHub and AWS; a role that can only push and tag images).
- **`docs/architecture/stack-overview.md`**: a short section on release automation: SemVer, a release PR, tags, release notes, versioned images.
- **`docs/glossary.md`**: SemVer if missing, release PR, and any other new term.
- **`CLAUDE.md`**, *Git workflow*: one line: label a PR `skip-changelog` when its change does not belong in the release notes.
- **`docs/development/tools/github-actions.md`**: the new workflow in its list, if it keeps one.

## Roadmap and GitHub changes

- **`roadmap.md`**, PH-13's entry: **Delivers** (release notes from GitHub, `skip-changelog`, the lifecycle rule, OP-102); **Depends on** (the trial, done); **Owner steps** as below; spec and plan links in the stage table as they land; status and the PR link before the PR opens; the README's diagram with it.
- **GitHub:** owner-step issues for the two new steps (applying `infra/base`, the demo check) as sub-issues of #42, and #152 and #154's bodies extended; #42's body updated when the PR opens; OP-025, OP-026, OP-027, OP-102, OP-020 and OP-023 closed by the PR with a "settled by" comment; OP-019's PH-13 part ticked and the issue re-parented to PH-15 with its Status set to ⬜ Backlog; the label `skip-changelog` created. The project's fields (Started 2026-10-23, Spec, Plan) are set by the owner: this session cannot reach the project's API.

## Owner steps

1. ~~Run the trial~~ ✅ ([#150](https://github.com/luiki-dev/szop/issues/150)).
2. Create the `release` environment: `main` only, no reviewer ([#151](https://github.com/luiki-dev/szop/issues/151)).
3. Create the `szop-release` GitHub App, install it on the repository, store its ID (`RELEASE_APP_ID`) and private key (`RELEASE_APP_PRIVATE_KEY`) in the `release` environment, and put the App on the `version-tags` ruleset's bypass list ([#152](https://github.com/luiki-dev/szop/issues/152)).
4. Apply `infra/base` from the branch; after the merge, again from `main`.
5. Store the release role's ARN (`terraform output ci_release_role_arn`) as the repository variable `AWS_RELEASE_ROLE_ARN` ([#153](https://github.com/luiki-dev/szop/issues/153)).
6. Press `demo-up` on the branch, check that `/api/health` answers `200`, then press `demo-down`.
7. Merge the first release PR, then check the tag `v0.1.0`, the GitHub Release and `szop:0.1.0` in ECR ([#154](https://github.com/luiki-dev/szop/issues/154)).

Steps 2 to 6 come before the phase's PR is merged.

## Tasks

Six, in this order:

1. **The phase starts:** the stage table and the README's diagram → 🚧 (done in the branch's first commit).
2. **ADR 0042** and the notes in ADRs 0009, 0010 and 0030.
3. **`infra/base`:** `szop-ci-release`, its output, OP-102, the lifecycle rule; `aws-resources.md` and `threat-model.md`.
4. **release-please:** the configuration, the manifest, `package.json`'s version, `.prettierignore`, `.github/release.yml`, `release-please.yml`, the label.
5. **The other docs:** the tool page, `ci-cd.md`, `git-workflow.md`, `phase-walkthrough.md`, `github-settings.md`, `stack-overview.md`, the glossary, the PR template, `CLAUDE.md`.
6. **Roadmap and GitHub:** PH-13's entry and owner steps, the owner-step issues, the open points, the PR.

## To verify during implementation

- **The actions' versions and inputs:** `googleapis/release-please-action` and `actions/create-github-app-token` at versions at least two weeks old, pinned by SHA; whether the token action takes `app-id` or `client-id` (the variable's name follows it); the release-please action's output names for a root package (`release_created`, `tag_name`, `version`, `sha`).
- **The author name in `.github/release.yml`**: GitHub's docs exclude bots by login; whether `dependabot` or `dependabot[bot]` matches Dependabot's PRs, checked against the notes API (`POST /repos/luiki-dev/szop/releases/generate-notes` lists what a release would contain).
- **A dry run of the first release**, if this session can: `release-please release-pr --dry-run` against `luiki-dev/szop`, which should propose `0.1.0` with notes per PR. The session's GitHub access has no GraphQL, which release-please may need; if so, the notes API above stands in for the notes, and the first real run is the proof of the rest.
- **Re-tagging by manifest** in ECR: `batch-get-image` with the right `acceptedMediaTypes`, then `put-image` with the same manifest and its media type, keeps the digest (the image is built with `provenance: false`, as in `demo-up`, so it is a single manifest, not an index).
- **The App's permissions:** *Contents* and *Pull requests* write cover the release PR, its labels (`autorelease: pending`, `autorelease: tagged`) and the Release; the trial ran with the same two permissions on `GITHUB_TOKEN`.
- **`ReadOnlyAccess`'s current version** and its `logs:` actions (OP-102).
- **Access Analyzer's findings** on the new policy, in the PR's comment.
