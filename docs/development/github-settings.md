# GitHub settings

Every GitHub setting Szop's git workflow relies on: its value, where it lives in GitHub, and the decision behind it. The settings are applied by hand in GitHub's web interface ([ADR 0009](../decisions/0009-git-workflow.md), decision 15), so this page is the record of what they should be. How the workflow is used day to day is in [git-workflow.md](git-workflow.md).

All paths start on the repository page (`github.com/luiki-dev/szop`) with the **Settings** tab. The Settings sidebar is grouped into sections; the paths below name the section, then the page. GitHub moves and renames settings from time to time. If a path no longer matches, look for the setting's name and update this page.

## Contents

- [Order of applying](#order-of-applying)
- [Visibility](#visibility)
- [Pull requests](#pull-requests)
- [Actions](#actions)
- [Ruleset for `main`](#ruleset-for-main)
- [Ruleset for version tags](#ruleset-for-version-tags)
- [Security](#security)
- [Features](#features)
- [Checking the settings](#checking-the-settings)

## Order of applying

1. **Make the repository public first.** Rulesets are not enforced on private repositories on GitHub's Free plan, and some security features are free only for public repositories.
2. Then the pull request settings, the two rulesets and the security settings, in any order.
3. The CI settings, in this order, around the [PH-02](../roadmap.md#ph-02-ci-checks) PR: the Actions settings just before it opens, the rest while it is open ([ADR 0018](../decisions/0018-ci-details.md), decision 9):
   1. The [Actions](#actions) settings, just before the PR opens, so its first run already obeys them.
   2. CodeQL's default setup (see [Security](#security)), once the PR's checks have reported.
   3. The required status checks in the [ruleset for `main`](#ruleset-for-main).
   4. The *Require code scanning results* rule last, after CodeQL has succeeded on `main`. The bypass list is empty, so a rule that asks for results CodeQL cannot produce would block every merge.
4. Check the result (see [Checking the settings](#checking-the-settings)).

## Visibility

| Setting | Value | Where | Why |
|---|---|---|---|
| Repository visibility | **Public** | *Settings → General* → *Danger Zone* → **Change repository visibility** → *Change to public* | Rulesets are enforced for free; the repository is a portfolio piece. ADR 0009, decision 1. |

Before making the repository public, keep in mind that the whole history becomes public, including every commit's author email.

## Pull requests

*Settings → General* → section **Pull Requests**.

| Setting | Value | Why |
|---|---|---|
| **Allow merge commits** | On | The only merge method. ADR 0009, decision 6. |
| ↳ Default commit message (dropdown under it) | **Pull request title** | The merge commit's message is the Conventional Commits title of the PR, such as `feat(lists): add shopping lists (#12)`. ADR 0009, decision 14. |
| **Allow squash merging** | Off | One merge method only. ADR 0009, decision 6. |
| **Allow rebase merging** | Off | One merge method only. ADR 0009, decision 6. |
| **Always suggest updating pull request branches** | On | Shows the *Update branch* button whenever `main` has moved, which merges `main` into the branch. ADR 0009, decision 14. |
| **Automatically delete head branches** | On | A merged branch is deleted on GitHub, so finished branches do not pile up. ADR 0009, decision 14. |

Leave **Allow auto-merge** off: the owner's manual merge is the approval (ADR 0009, decision 7).

## Actions

*Settings → Code and automation → Actions → General*.

| Setting | Value | Why |
|---|---|---|
| **Actions permissions** | **Allow all actions and reusable workflows** | GitHub's default. Every action is pinned to a reviewed commit (next row), so an allow-list would add little. |
| ↳ **Require actions to be pinned to a full-length commit SHA** | On | A workflow that refers to an action by a tag or branch fails to start, so a moved tag can never swap the code that runs. ADR 0010, decision 21. |
| **Approval for running fork pull request workflows from contributors** | **Require approval for all external contributors** | A PR from anyone outside the repository runs no workflow until the owner approves it. ADR 0010, decision 21. |
| **Workflow permissions** | **Read repository contents and packages permissions** | The default `GITHUB_TOKEN` can only read; a job that needs more asks for it in its `permissions:`. ADR 0010, decision 21. |
| ↳ **Allow GitHub Actions to create and approve pull requests** | Off | No workflow uses `GITHUB_TOKEN` to open or approve PRs; release-please uses its own GitHub App ([ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 8). ADR 0010, decision 21. |

## Ruleset for `main`

*Settings → Code and automation → Rules → Rulesets* → **New ruleset** → **New branch ruleset**.

| Field or rule | Value | Why |
|---|---|---|
| Ruleset name | `main` | — |
| Enforcement status | **Active** | — |
| Bypass list | **Empty** | The rules apply to the owner too. An admin can still edit the ruleset in an emergency, visibly. ADR 0009, decision 13. |
| Target branches | *Add target* → **Include default branch** | Follows `main` even if the default branch were ever renamed. |
| **Restrict deletions** | On (default) | `main` can never be deleted. |
| **Block force pushes** | On (default) | `main`'s history can never be rewritten. |
| **Require a pull request before merging** | On | Every change reaches `main` through a PR. ADR 0009, decision 2. |
| ↳ Required approvals | **0** | GitHub does not let an author approve their own PR, and every PR is authored by the owner's account. The owner's merge is the approval. ADR 0009, decision 7. |
| ↳ Require conversation resolution before merging | On | No review comment can be skipped by accident. ADR 0009, decision 13. |
| ↳ Allowed merge methods | **Merge** only | Matches the repository setting above. ADR 0009, decision 6. |
| ↳ Require an additional approval for unattributed Copilot pull requests | On (GitHub's default) | Applies only to PRs that Copilot opens under its own app identity, not on behalf of a person; those need one approval more than configured. Szop's PRs are opened by the owner's account, so it never applies, and if Copilot ever opened a PR by itself, the owner's approval would be asked for. The API calls it `require_extra_approval_for_unattributed_changes`. |
| **Require status checks to pass** | **On** | A PR whose checks fail cannot be merged. ADR 0009, decision 13; [ADR 0018](../decisions/0018-ci-details.md). |
| ↳ Require branches to be up to date before merging | On | The checks must have run on a merge with the current `main`. ADR 0009, decision 13. |
| ↳ Status checks | `ci-ok` and `pr-title`, source **GitHub Actions** | Matched by job name: renaming a job means updating this list. See [CI/CD](ci-cd.md#ci-ok-and-the-required-checks). |
| **Require code scanning results** | Tool **CodeQL**, security alerts **High or higher**, alerts **Errors** (the default) | A PR that adds a high or critical alert cannot be merged. Added last, after CodeQL has succeeded on `main` (see [Order of applying](#order-of-applying)). ADR 0010, decision 21; ADR 0018, decision 9. |
| **Require linear history** | Off | It forbids merge commits. ADR 0009, decision 18. |
| **Require signed commits** | Off | One person pushes from one machine. ADR 0009, decision 18. |

Leave every other rule off.

## Ruleset for version tags

*Settings → Code and automation → Rules → Rulesets* → **New ruleset** → **New tag ruleset**.

| Field or rule | Value | Why |
|---|---|---|
| Ruleset name | `version-tags` | — |
| Enforcement status | **Active** | — |
| Bypass list | **Empty** until the release GitHub App exists; then **only that App** | release-please creates the tags through the App ([ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 8). The owner is not on the list: Claude pushes with the owner's credentials, so a bypass for the owner would be one for Claude too. |
| Target tags | *Add target* → **Include by pattern** → `v*` | Every version tag, such as `v0.1.0`. |
| **Restrict creations** | On | Only release-please, through the App on the bypass list, creates version tags. A stray `git push --tags` or a hand-made `v*` tag is refused, instead of becoming a tag that cannot be moved or deleted and that release-please later collides with. ADR 0011, decision 8. |
| **Restrict updates** | On | A version tag can never be moved to another commit, matching the immutable image tags in ECR. ADR 0009, decision 13; ADR 0008, decision 13. |
| **Restrict deletions** | On (default) | A published version can never disappear. |
| **Block force pushes** | On (default) | — |

## Security

*Settings → Security and quality → Advanced Security*.

| Setting | Value | Why |
|---|---|---|
| **Dependabot alerts** | Enabled | Warns when a dependency has a known vulnerability. Dependabot *version update* PRs are configured in `.github/dependabot.yml` (see [the Dependabot page](tools/dependabot.md)). ADR 0009, decision 14. |
| **Dependabot security updates** | Enabled | Opens a PR that upgrades a dependency with a known vulnerability, without waiting for the cooldown of version updates. It needs Dependabot alerts. ADR 0010, decision 18. |
| **Secret Protection** (secret scanning) | Enabled | Finds secrets committed to the repository. ADR 0009, decision 14; ADR 0008, decision 22. |
| ↳ **Push protection** | Enabled | Rejects a push that contains a recognized secret before it reaches GitHub. ADR 0009, decision 14. |
| **CodeQL analysis** (under *Code scanning*) | **Default setup**, languages JavaScript/TypeScript and Actions | Scans the code and the workflows on every PR and push to `main`, with no workflow file to maintain. See [CI/CD](ci-cd.md#codeql). ADR 0010, decision 21; [ADR 0018](../decisions/0018-ci-details.md). |

For public repositories some of these may already be on.

## Features

*Settings → General* → section **Features**. Nothing is changed. **Issues** stay available to visitors, but they are not used for planning: the [roadmap](../roadmap.md) is the tracker (ADR 0009, decision 14).

## Checking the settings

The GitHub CLI shows most settings without opening the browser:

```bash
# Visibility and pull request settings
gh repo view --json visibility,mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed,deleteBranchOnMerge

# The rulesets, then one ruleset's rules (use an id from the first command)
gh api repos/luiki-dev/szop/rulesets
gh api repos/luiki-dev/szop/rulesets/<id>

# The rules that apply to main, from all rulesets together
gh api repos/luiki-dev/szop/rules/branches/main

# Actions: SHA pinning, the default token, approval for outside contributors
gh api repos/luiki-dev/szop/actions/permissions
gh api repos/luiki-dev/szop/actions/permissions/workflow
gh api repos/luiki-dev/szop/actions/permissions/fork-pr-contributor-approval
# CodeQL's default setup
gh api repos/luiki-dev/szop/code-scanning/default-setup
```

Expected:

- `visibility` is `PUBLIC`, only `mergeCommitAllowed` and `deleteBranchOnMerge` are `true`, and two active rulesets exist.
- The rules for `main` include `required_status_checks` (with `ci-ok` and `pr-title`, and `strict_required_status_checks_policy: true`) and `code_scanning`.
- `sha_pinning_required` is `true`.
- `default_workflow_permissions` is `read` and `can_approve_pull_request_reviews` is `false`.
- `approval_policy` is `all_external_contributors`.
- CodeQL's `state` is `configured`, with `actions` among its `languages` once the workflows are on `main` (until then, only the JavaScript and TypeScript entries; [OP-067](../open-points.md#op-067)).
