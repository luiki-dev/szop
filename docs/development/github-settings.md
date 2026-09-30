# GitHub settings

Every GitHub setting Szop's git workflow relies on: its value, where it lives in GitHub, and the decision behind it. The settings are applied by hand in GitHub's web interface ([ADR 0009](../decisions/0009-git-workflow.md), decision 15), so this page is the record of what they should be. How the workflow is used day to day is in [git-workflow.md](git-workflow.md).

All paths start on the repository page (`github.com/luiki-dev/szop`) with the **Settings** tab. The Settings sidebar is grouped into sections; the paths below name the section, then the page. GitHub moves and renames settings from time to time. If a path no longer matches, look for the setting's name and update this page.

## Contents

- [Order of applying](#order-of-applying)
- [Visibility](#visibility)
- [Pull requests](#pull-requests)
- [Ruleset for `main`](#ruleset-for-main)
- [Ruleset for version tags](#ruleset-for-version-tags)
- [Security](#security)
- [Features](#features)
- [Checking the settings](#checking-the-settings)

## Order of applying

1. **Make the repository public first.** Rulesets are not enforced on private repositories on GitHub's Free plan, and some security features are free only for public repositories.
2. Then the pull request settings, the two rulesets and the security settings, in any order.
3. Check the result (see [Checking the settings](#checking-the-settings)).

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
| **Always suggest updating pull request branches** | On | Shows the *Update branch* button whenever `main` has moved, which merges `main` into the branch. ADR 0009, consequences. |
| **Automatically delete head branches** | On | A merged branch is deleted on GitHub, so finished branches do not pile up. ADR 0009, decision 14. |

Leave **Allow auto-merge** off: the owner's manual merge is the approval (ADR 0009, decision 7).

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
| **Require status checks to pass** | **Off for now** | Turned on by the CI/CD phase, with *Require branches to be up to date before merging* and the CI checks listed. Until CI exists there is nothing to require. ADR 0009, decision 13. |
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
| **Dependabot alerts** | Enabled | Warns when a dependency has a known vulnerability. Dependabot *version update* PRs are set up by the CI/CD phase. ADR 0009, decision 14. |
| **Dependabot security updates** | Enabled | Opens a PR that upgrades a dependency with a known vulnerability, without waiting for the cooldown of version updates. It needs Dependabot alerts. ADR 0010, decision 18. |
| **Secret Protection** (secret scanning) | Enabled | Finds secrets committed to the repository. ADR 0009, decision 14; ADR 0008, decision 22. |
| ↳ **Push protection** | Enabled | Rejects a push that contains a recognized secret before it reaches GitHub. ADR 0009, decision 14. |

For public repositories some of these may already be on.

## Features

*Settings → General* → section **Features**. Nothing is changed. **Issues** stay available to visitors, but they are not used for planning: the roadmap (`docs/roadmap.md`, written after the foundation topics) is the tracker (ADR 0009, decision 14).

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
```

Expected: `visibility` is `PUBLIC`, only `mergeCommitAllowed` and `deleteBranchOnMerge` are `true`, and two active rulesets exist.
