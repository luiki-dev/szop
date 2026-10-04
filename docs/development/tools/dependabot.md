# Dependabot

Dependabot is GitHub's built-in bot for dependencies: every Monday it looks for new versions of Szop's npm packages and GitHub Actions and opens pull requests for them: one grouped PR for the minor and patch updates of each, and one PR per major update, and it warns about dependencies with known vulnerabilities.

## Why Szop uses it

[ADR 0010](../../decisions/0010-ci-cd.md), decision 18: it is built into GitHub, needs no app to install, and updates both the npm packages and the commit SHAs that pin the actions, with their version comments. Renovate was considered: it is more capable (a dependency dashboard, finer grouping, auto-merge rules) but is an extra app to install and configure; it becomes worth it if Dependabot proves too noisy. [ADR 0018](../../decisions/0018-ci-details.md), decision 8 explains the `deps-dev` scope.

## Configuration

**`.github/dependabot.yml`** configures the version updates. It has one entry per **ecosystem** (a kind of dependency):

- `version: 2`: the file format's version.
- `package-ecosystem: npm` with `directory: /`: the npm packages of the whole workspace, read from the root `package.json` and `pnpm-lock.yaml`.
- `package-ecosystem: github-actions` with `directories: [/, /.github/actions/setup]`: `/` covers the workflows in `.github/workflows/`; the composite setup action is not scanned by default, so its folder is listed too.
- `schedule: interval: weekly, day: monday`: look for updates once a week, on Monday.
- `cooldown: default-days: 7`: propose a version only once it is at least 7 days old, so a malicious release is usually found and removed before it is offered. Security updates skip the wait.
- `groups`: `npm` and `actions`, each with `update-types: [minor, patch]`, put all minor and patch updates of an ecosystem in one PR. A major update matches no group, so it gets a PR of its own.
- `commit-message`: `prefix: build` and `prefix-development: build` with `include: scope` give `build(deps): …` for a dependency and `build(deps-dev): …` for a devDependency; for actions, `prefix: ci` gives `ci(deps): …`. Both scopes are on [commitlint](commitlint.md)'s list.
- `ignore`: major updates of `@types/node` are skipped. Its major version follows Node's, which changes on purpose, together with `.nvmrc` and `engines`.

Later phases add the `docker-compose`, `docker` and `terraform` ecosystems with their own ignore rules ([OP-068](../../open-points.md#op-068)).

**Alerts and security updates** are not in this file: Dependabot alerts (a warning when a dependency has a known vulnerability) and Dependabot security updates (a PR fixing it, without waiting for Monday or the cooldown) are switched on in the repository settings, listed in [GitHub settings](../github-settings.md#security).

## Everyday use

- **The Monday PRs** are reviewed and merged by the owner like any other PR, after CI passes; nothing merges by itself. Read the release notes Dependabot copies into the PR body, above all for a major update.
- **After merging one,** the others are out of date with `main`: click *Update branch* on each and wait for CI.
- **A major version** arrives in its own PR, so it can be read, tested and merged (or closed) on its own. Closing it skips that version, and a later one gets a new PR; the comment `@dependabot ignore this major version` skips the whole major.
- **Insights → Dependency graph → Dependabot** shows each ecosystem's last check. *Check for updates* runs one now, and the log of a run says what Dependabot found and why it opened no PR.
- **Commands,** as a comment on a Dependabot PR: `@dependabot rebase` brings the PR up to date with `main` (Dependabot rebases its own branches); `@dependabot recreate` rebuilds the PR from scratch, discarding any commits added to it.
- Dependabot reads `dependabot.yml` only from `main`: a change to it takes effect once merged.

## Official documentation

- About version updates: <https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates>
- `dependabot.yml` options: <https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference>
- Managing Dependabot PRs and its commands: <https://docs.github.com/en/code-security/dependabot/working-with-dependabot/managing-pull-requests-for-dependency-updates>
