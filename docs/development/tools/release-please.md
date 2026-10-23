# release-please

release-please is a release tool from Google. It reads the Conventional Commits that reach `main`, works out the next version under Semantic Versioning (SemVer, see the [glossary](../../glossary.md#acronyms)), and keeps one open **release PR** that would raise the version and add the release's notes to `CHANGELOG.md`. Merging that PR is the release: release-please tags the version and publishes a GitHub Release. In Szop it runs as a GitHub Action, in `.github/workflows/release-please.yml`, on every push to `main`.

The decisions are recorded in [ADR 0009](../../decisions/0009-git-workflow.md), decision 11, [ADR 0010](../../decisions/0010-ci-cd.md), decision 17, and [ADR 0042](../../decisions/0042-releases-details.md). How the workflow's jobs, the `release` environment and the image fit together is in [CI/CD](../ci-cd.md#releases); the day-to-day side is in the [git workflow guide](../git-workflow.md#8-release).

## Contents

- [Why Szop uses it](#why-szop-uses-it)
- [The configuration](#the-configuration)
- [Release notes](#release-notes)
- [Which version comes next](#which-version-comes-next)
- [What the trial taught](#what-the-trial-taught)
- [Updating](#updating)
- [Official documentation](#official-documentation)

## Why Szop uses it

- **A release is a human choice with automated bookkeeping** ([ADR 0009](../../decisions/0009-git-workflow.md), decision 11). The release PR waits until the owner merges it, typically after a phase. semantic-release would release on every merge with a `feat` or `fix`, and tags made by hand would leave every number to be chosen.
- **It authenticates as a GitHub App, `szop-release`** ([ADR 0010](../../decisions/0010-ci-cd.md), decision 17). A PR opened with the workflow's own `GITHUB_TOKEN` triggers no other workflow, so the release PR would never get its required checks. Each run turns the App's private key into a token for this repository that expires within an hour (`actions/create-github-app-token`), and the release PR is authored by `szop-release[bot]`.

## The configuration

`release-please-config.json`:

| Setting | Value | Why |
|---|---|---|
| `release-type` | `node` | The version lives in the root `package.json`'s `"version"`, which each release PR raises. The workspaces have no version: none is published ([ADR 0042](../../decisions/0042-releases-details.md), decision 4). |
| `bump-minor-pre-major` | `true` | While the version is `0.x`, a breaking change raises only MINOR ([ADR 0009](../../decisions/0009-git-workflow.md), consequences). |
| `include-component-in-tag` | `false` | Without it the tag would be `szop-v0.1.0`, named after the package, and the `version-tags` ruleset's `v*` would not match it (ADR 0042, decision 5). |
| `initial-version` | `"0.1.0"` | With no earlier tag, release-please ignores the manifest and starts at `1.0.0` unless told otherwise (ADR 0042, decision 5). |
| `changelog-type` | `github` | The notes come from GitHub, one line per merged PR, instead of one line per commit (ADR 0042, decision 1; [Release notes](#release-notes)). |
| `packages` | `{ ".": {} }` | One version for the whole repository ([ADR 0010](../../decisions/0010-ci-cd.md), decision 17). |

`.release-please-manifest.json` holds the last released version (`{ ".": "0.0.0" }` before the first release). release-please rewrites it in each release PR, compactly, so it is in `.prettierignore` (ADR 0042, decision 12).

The release PR's branch is `release-please--branches--main--components--szop`. It is the one branch in Szop that does not follow `type/short-description` (ADR 0042, decision 7). GitHub deletes it when the release PR is merged, as it does every merged branch, and release-please creates it again for the next release.

## Release notes

With `changelog-type: github`, release-please asks GitHub's [automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes) for the PRs merged between the last tag and the release commit. The same text goes into `CHANGELOG.md`, the release PR's description and the GitHub Release:

```
## What's Changed
* feat: release versions with release-please by @luiki-dev in https://github.com/luiki-dev/szop/pull/NNN

**Full Changelog**: https://github.com/luiki-dev/szop/compare/v0.1.0...v0.2.0
```

`.github/release.yml` decides what is left out:

- PRs by **`dependabot[bot]`**. The plain name `dependabot` does not match its PRs (checked with the notes API).
- PRs labelled **`skip-changelog`**, set by hand on a PR that readers of the notes do not need: Claude Code's settings, process docs. The label hides the PR from the notes; it does not change the version. It works whenever it is set before the release PR is merged, since the notes are asked for again on every push to `main`.

GitHub adds a "New Contributors" section the first time someone's PR appears, and `release.yml` cannot remove it, so `v0.1.0` names `@dependabot[bot]` there once.

To see what a release would list without creating anything:

```bash
gh api -X POST repos/luiki-dev/szop/releases/generate-notes -f tag_name=v0.2.0 -f target_commitish=main --jq .body
```

## Which version comes next

release-please computes the version from the commits, not from the notes. Since `main` holds every task commit of a phase as well as its merge commit, the highest bump among them wins; the [phase walkthrough](../phase-walkthrough.md#what-makes-a-release-and-which-number-changes) has the table. Only a `feat`, `fix`, `perf` or breaking change opens or updates the release PR.

**`1.0.0`** is set by a commit whose footer is `Release-As: 1.0.0`, merged through a PR; an empty commit is enough:

```bash
git commit --allow-empty -m "chore: release 1.0.0" -m "Release-As: 1.0.0"
```

## What the trial taught

Before PH-13 the owner ran release-please in a throwaway repository with merge commits ([ADR 0042](../../decisions/0042-releases-details.md#the-trial)):

- With release-please's default notes, built from commits, every phase would be listed twice (its PR title and its task commits) and its review fixes as bug fixes of code never released. GitHub's merge message, the PR title or a `BEGIN_COMMIT_OVERRIDE` block do not change that: release-please reads every commit a merge brings in and has no first-parent option, and it applies an override to every commit of the PR.
- The first release needs `initial-version`, and the tag needs `include-component-in-tag: false`.
- `Release-As` works as the footer of a branch commit.

## Updating

The action is pinned by commit hash in `release-please.yml`, with its version as a comment; Dependabot proposes new versions (the `github-actions` ecosystem). Before merging a bump, read the action's changelog: a new major version may change its inputs or outputs, which the workflow's `if` conditions and `publish` job read (`release_created`, `tag_name`, `version`, `sha`). Take a version at least two weeks old.

## Official documentation

- [release-please](https://github.com/googleapis/release-please), its [manifest configuration](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md) and [customizing](https://github.com/googleapis/release-please/blob/main/docs/customizing.md)
- [release-please-action](https://github.com/googleapis/release-please-action)
- [create-github-app-token](https://github.com/actions/create-github-app-token)
- GitHub's [automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
