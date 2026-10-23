# GitHub settings

Every GitHub setting Szop's git workflow relies on: its value, where it lives in GitHub, and the decision behind it. The settings are applied by hand in GitHub's web interface ([ADR 0009](../decisions/0009-git-workflow.md), decision 15), so this page is the record of what they should be. How the workflow is used day to day is in [git-workflow.md](git-workflow.md).

All paths start on the repository page (`github.com/luiki-dev/szop`) with the **Settings** tab. The Settings sidebar is grouped into sections; the paths below name the section, then the page. GitHub moves and renames settings from time to time. If a path no longer matches, look for the setting's name and update this page.

## Contents

- [Order of applying](#order-of-applying)
- [Visibility](#visibility)
- [Pull requests](#pull-requests)
- [Actions](#actions)
- [Environments](#environments)
- [Variables](#variables)
- [Ruleset for `main`](#ruleset-for-main)
- [Ruleset for version tags](#ruleset-for-version-tags)
- [The release App](#the-release-app)
- [Security](#security)
- [Features](#features)
- [Labels](#labels)
- [Milestones](#milestones)
- [Project](#project)
- [Checking the settings](#checking-the-settings)

## Order of applying

1. **Make the repository public first.** Rulesets are not enforced on private repositories on GitHub's Free plan, and some security features are free only for public repositories.
2. Then the pull request settings, the two rulesets and the security settings, in any order.
3. The CI settings, in this order, around the [PH-02](../roadmap.md#ph-02-ci-checks) PR: the Actions settings just before it opens, the rest while it is open ([ADR 0018](../decisions/0018-ci-details.md), decision 9):
   1. The [Actions](#actions) settings, just before the PR opens, so its first run already obeys them.
   2. CodeQL's default setup (see [Security](#security)), once the PR's checks have reported.
   3. The required status checks in the [ruleset for `main`](#ruleset-for-main).
   4. The *Require code scanning results* rule last, after CodeQL has succeeded on `main`. The bypass list is empty, so a rule that asks for results CodeQL cannot produce would block every merge.
4. The labels, milestones and project, with [ADR 0024](../decisions/0024-github-project-tracking.md): see [Labels](#labels), [Milestones](#milestones) and [Project](#project).
5. The settings CI needs to reach AWS, around the [PH-11](../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net) PR ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md)):
   1. The [`demo-teardown` environment](#environments), before `demo-down.yml` reaches `main`: a job that names a missing environment creates it with no protection.
   2. The two [variables](#variables), after `infra/base` is applied from the PR's branch: they hold its outputs, and the PR's `plan` job needs them.
6. The [`demo` environment](#environments), around the [PH-12b](../roadmap.md#ph-12b-network-and-the-demo-up-button) PR, before `infra/base` is applied with the deploy role's trust for it: a job that names a missing environment creates it with no protection, and that trust has no branch pin.
7. The release settings, around the [PH-13](../roadmap.md#ph-13-releases) PR, all before it is merged, since its merge is `release-please.yml`'s first run ([ADR 0042](../decisions/0042-releases-details.md)):
   1. The [`release` environment](#environments): a job that names a missing environment creates it with no branch rule.
   2. The [release App](#the-release-app): created, installed, its client ID and private key stored in `release`, and put on the [version tags ruleset](#ruleset-for-version-tags)'s bypass list.
   3. The variable `AWS_RELEASE_ROLE_ARN` (see [Variables](#variables)), after `infra/base` is applied from the PR's branch.
8. Check the result (see [Checking the settings](#checking-the-settings)).

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
| **OIDC subject claim** | The default claims, with **immutable subject** on (`use_immutable_subject: true`) | The token's `sub` names the owner and the repository with their numeric IDs (`repo:luiki-dev@290870182/szop@1380292421:…`), and the CI roles' trust policies match exactly that. Turning it off changes every `sub`, and both roles would refuse CI. [ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 13. |
| ↳ **Allow GitHub Actions to create and approve pull requests** | Off | No workflow uses `GITHUB_TOKEN` to open or approve PRs; release-please uses its own GitHub App ([ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 8). ADR 0010, decision 21. |

## Environments

*Settings → Code and automation → Environments.* An environment is a named target that a job picks with `environment:`; its rules are checked before the job starts, and the token the job receives names the environment (`sub` `repo:luiki-dev@290870182/szop@1380292421:environment:<name>`), which is what an AWS role's trust policy matches ([CI/CD](ci-cd.md#cis-access-to-aws)).

| Environment | Setting | Value | Why |
|---|---|---|---|
| `demo-teardown` | **Required reviewers** | None | The nightly `demo-down` cannot wait for an approval at night. ADR 0012, decision 16. |
| | **Deployment branches and tags** | **Selected branches and tags**, with one rule: branch **`main`** | The trust policy of `szop-ci-deploy` matches the environment, and the token of an environment job carries the same `sub` from any branch, so the policy cannot tell a branch from `main`. This rule does it in GitHub: a job on any other branch that names `demo-teardown` is refused before it runs and never gets a token. The policy also requires the token's `ref` to be `refs/heads/main`, so AWS refuses such a token too, if the rule were ever loosened ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decision 14). Keep both: the rule stops the job before it runs, the `ref` pin backs it in AWS. ADR 0012, decision 16; [ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decisions 9 and 10. |
| | **Secrets and variables** | None | The role ARN is a repository variable (below). |
| `demo` | **Required reviewers** | The owner | `demo-up` deploys any branch's Terraform with the deploy role's credentials, and the role's trust for `demo` has no branch condition, so the owner's approval of each run is the gate. The job waits at *Review deployments*. ADR 0012, decision 16; [ADR 0032](../decisions/0032-ci-access-and-teardown-details.md), decisions 10 and 14. |
| | **Prevent self-review** | Off | The owner is the only person who can press the button; with it on, the person who started the run could never approve it. |
| | **Deployment branches and tags** | **No restriction** | `demo-up` is pressed on the branch being checked, before it is merged, so any branch must be allowed. Unlike `demo-teardown`, the trust policy has no `ref` pin to back a rule, so nothing but the approval limits what a run deploys. |
| | **Secrets and variables** | None | The role ARN is a repository variable (below). |
| `release` | **Required reviewers** | None | `release-please.yml` runs on every push to `main`, so a reviewer would mean approving every merge; the owner's merge of the release PR is the approval. [ADR 0042](../decisions/0042-releases-details.md), decision 8. |
| | **Deployment branches and tags** | **Selected branches and tags**, with one rule: branch **`main`** | No PR or branch workflow can use the environment, read its secret or get the release role's token. The role's trust also requires the `ref` `refs/heads/main`, as for `demo-teardown`. |
| | **Secrets and variables** | Variable `RELEASE_APP_CLIENT_ID`; secret `RELEASE_APP_PRIVATE_KEY` | The [release App](#the-release-app)'s client ID and private key, kept in the environment so only `main`'s jobs that name it can read them. The release role's ARN is a repository variable (below). |

Create `demo-teardown` by hand, **before** `demo-down.yml` is merged: GitHub creates an environment, with no protection, the first time a job names a missing one. Create `demo` before base is applied with its trust and before `demo-up.yml` first runs ([PH-12b](../roadmap.md#ph-12b-network-and-the-demo-up-button), [runbook](../operations/demo-environment.md#cis-roles-and-variables)). Create `release` before the [PH-13](../roadmap.md#ph-13-releases) PR is merged: the merge runs `release-please.yml`, whose jobs name it.

## Variables

*Settings → Secrets and variables → Actions → Variables → Repository variables.*

| Variable | Value | Why |
|---|---|---|
| `AWS_PLAN_ROLE_ARN` | The ARN of `szop-ci-plan`: base's output `ci_plan_role_arn` | Read by `ci.yml`'s `plan` job (`vars.AWS_PLAN_ROLE_ARN`) to assume the read-only plan role. |
| `AWS_DEPLOY_ROLE_ARN` | The ARN of `szop-ci-deploy`: base's output `ci_deploy_role_arn` | Read by `demo-down.yml` and `demo-up.yml` to assume the deploy role. |
| `AWS_RELEASE_ROLE_ARN` | The ARN of `szop-ci-release`: base's output `ci_release_role_arn` | Read by `release-please.yml`'s `publish` job to assume the release role. |

They are variables, not secrets: an ARN is a name, not a credential, and what protects the roles is their trust policies. **No AWS access key and no account ID is stored in GitHub**; the workflows read the account ID from their own credentials. `gh variable set` sets them; the runbook has the commands ([CI's roles and variables](../operations/demo-environment.md#cis-roles-and-variables)). A variable that is missing makes the job fail at the credentials step, with an error about the role.

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
| Bypass list | **Only the App `szop-release`** (*Add bypass* → *Apps*), from PH-13; empty before it | release-please creates the tags through the App ([ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md), decision 8). The owner is not on the list: Claude pushes with the owner's credentials, so a bypass for the owner would be one for Claude too. |
| Target tags | *Add target* → **Include by pattern** → `v*` | Every version tag, such as `v0.1.0`. |
| **Restrict creations** | On | Only release-please, through the App on the bypass list, creates version tags. A stray `git push --tags` or a hand-made `v*` tag is refused, instead of becoming a tag that cannot be moved or deleted and that release-please later collides with. ADR 0011, decision 8. |
| **Restrict updates** | On | A version tag can never be moved to another commit, matching the immutable image tags in ECR. ADR 0009, decision 13; ADR 0008, decision 13. |
| **Restrict deletions** | On (default) | A published version can never disappear. |
| **Block force pushes** | On (default) | — |

## The release App

*Your account's Settings → Developer settings → GitHub Apps → New GitHub App.* release-please acts as this App, so the release PR it opens triggers CI, which a PR opened with the workflow's own token would not ([ADR 0010](../decisions/0010-ci-cd.md), decision 17; [ADR 0042](../decisions/0042-releases-details.md)).

| Field | Value | Why |
|---|---|---|
| GitHub App name | `szop-release` | The release PR's author shows as `szop-release[bot]`. |
| Homepage URL | The repository's URL | Required by the form; nothing reads it. |
| Webhook | **Active** off | The App receives no events; the workflow calls GitHub. |
| Repository permissions | **Contents: Read and write**; **Pull requests: Read and write**; Metadata: Read-only (mandatory) | Contents to push the release branch, create the tag and publish the Release; pull requests to open, update and label the release PR. Nothing else. |
| Where can this GitHub App be installed? | **Only on this account** | A private App. |
| After creating | **Generate a private key** (a `.pem` file); copy the **Client ID** | Stored in the `release` environment as `RELEASE_APP_PRIVATE_KEY` (the file's whole content) and `RELEASE_APP_CLIENT_ID`. Delete the downloaded file afterwards. |
| Install App | On `luiki-dev/szop` only (*Only select repositories*) | Its token can reach nothing else. |

Then add the App to the [version tags ruleset](#ruleset-for-version-tags)'s bypass list. **Rotating the key:** generate a new one in the App's settings, replace the secret, then delete the old key there.

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

*Settings → General* → section **Features**. Nothing is changed. **Issues** are used: since [ADR 0024](../decisions/0024-github-project-tracking.md) they track the phases, open points and decision work, next to the [roadmap](../roadmap.md). **Projects** stays on; the project itself belongs to the owner's account (see [Project](#project)).

## Labels

*Issues → Labels.* Only `phase`, `open-point`, `spike`, `candidate`, `owner` and `adr`, and from PH-13 `skip-changelog`, which leaves a PR out of the release notes ([release-please](tools/release-please.md#release-notes)); GitHub's default labels are deleted. Dependabot creates its own labels when it opens its first PR. What each label means is in [project tracking](project-tracking.md#labels). ADR 0024, decision 6.

## Milestones

*Issues → Milestones.* One per roadmap stage, `Stage 1: Local foundations` to `Stage 5: Later`, and `Definition` for the decision work before PH-01; no due dates. ADR 0024, decision 4.

## Project

The [Szop project](https://github.com/users/luiki-dev/projects/3), owned by the `luiki-dev` account, not the repository.

| Setting | Value | Why |
|---|---|---|
| **Visibility** | Public | The README and the roadmap link it. ADR 0024, decision 13. |
| **Fields** | Status (six options), Order, Path, Spec, Plan, Started, Finished | See [project tracking](project-tracking.md#fields). ADR 0024, decisions 7 and 8. |
| **Workflows** | On: Item added → ⬜ Backlog; Item closed → ✅ Done; Item reopened → 📌 Todo; auto-add `is:issue label:phase,open-point,adr,owner`; auto-add sub-issues. Off: Auto-close issue, Pull request linked to issue, Pull request merged | See [project tracking](project-tracking.md#workflows). |
| **Views** | Timeline, Backlog, Board, Open Points, Next Up, Owner Steps | See [project tracking](project-tracking.md#views). |

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
# The OIDC subject claim the CI roles match
gh api repos/luiki-dev/szop/actions/oidc/customization/sub
# CodeQL's default setup
gh api repos/luiki-dev/szop/code-scanning/default-setup

# The demo-teardown, demo and release environments, the branch rules, and the variables
gh api repos/luiki-dev/szop/environments/demo-teardown
gh api repos/luiki-dev/szop/environments/demo-teardown/deployment-branch-policies
gh api repos/luiki-dev/szop/environments/demo
gh api repos/luiki-dev/szop/environments/release
gh api repos/luiki-dev/szop/environments/release/deployment-branch-policies
gh variable list --repo luiki-dev/szop
gh variable list --repo luiki-dev/szop --env release
gh secret list --repo luiki-dev/szop --env release

# Labels, milestones and the project
gh label list --repo luiki-dev/szop
gh api "repos/luiki-dev/szop/milestones?state=all"
gh project view 3 --owner luiki-dev
```

Expected:

- `visibility` is `PUBLIC`, only `mergeCommitAllowed` and `deleteBranchOnMerge` are `true`, and two active rulesets exist.
- The rules for `main` include `required_status_checks` (with `ci-ok` and `pr-title`, and `strict_required_status_checks_policy: true`) and `code_scanning`.
- `sha_pinning_required` is `true`.
- `default_workflow_permissions` is `read` and `can_approve_pull_request_reviews` is `false`.
- `approval_policy` is `all_external_contributors`.
- The environment `demo-teardown` exists with `protection_rules` empty (no reviewer) and `deployment_branch_policy` set to `custom_branch_policies: true`; its one branch policy has the name `main`. The environment `demo` has one `required_reviewers` rule naming the owner, with `prevent_self_review` `false`, and `deployment_branch_policy` `null` (no restriction). The environment `release` has `protection_rules` with no reviewer and one branch policy named `main`. `gh variable list` shows `AWS_PLAN_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN` and `AWS_RELEASE_ROLE_ARN`, and no other variable; for `release` it shows `RELEASE_APP_CLIENT_ID`, and `gh secret list` shows `RELEASE_APP_PRIVATE_KEY`.
- CodeQL's `state` is `configured`, with `actions` among its `languages` once the workflows are on `main` (until then, only the JavaScript and TypeScript entries; [OP-067](https://github.com/luiki-dev/szop/issues/27)).
- Seven labels; six milestones, with `Definition` and `Stage 1: Local foundations` closed; the project is public.
