# zizmor

zizmor is a security linter for GitHub Actions: it audits the workflow files, composite actions and `dependabot.yml`, and finds the mistakes behind most published CI attacks, such as template injection, excessive token permissions, actions not pinned to a commit SHA and impostor commits. In Szop it runs in the pre-commit hook on the staged files it audits, through `pnpm check:workflows`, and in CI's `workflows` job whenever a workflow, the setup action, `.github/dependabot.yml` or zizmor's own `.github/zizmor.yml` changes. Any finding fails the commit or the job.

## Why Szop uses it

- **Workflow security, checked by a tool:** [ADR 0010](../../decisions/0010-ci-cd.md), decision 21. The rules every workflow follows (decision 20 of the same ADR) are easy to break by accident; zizmor checks them on every change. [actionlint](actionlint.md) checks correctness; zizmor checks security. CodeQL also scans the workflows, but blocks a merge only for *high* or *critical* alerts, while any zizmor finding fails the job.
- **Its maintainers' own action, in annotation mode:** [ADR 0018](../../decisions/0018-ci-details.md), decision 5. `zizmorcore/zizmor-action` is pinned by SHA, so Dependabot keeps it current. By default it uploads its results to GitHub's code scanning, which needs the `security-events: write` permission and never fails the job, so a finding would block only through the code scanning rule. With `advanced-security: false`, findings fail the job directly, with only `contents: read`.
- **Locally and in CI:** [ADR 0018](../../decisions/0018-ci-details.md), decision 6, first kept it in CI only; [ADR 0032](../../decisions/0032-ci-access-and-teardown-details.md), decision 2, adds the pre-commit hook and `pnpm check:workflows` ([OP-066](https://github.com/luiki-dev/szop/issues/79)). Locally it runs `--offline` (no GitHub token needed), so only CI runs the online audits. It is a Python tool, installed with [uv](https://docs.astral.sh/uv/) by the [setup guide](../setup.md#9-actionlint-zizmor-and-uv).

## Configuration

**The `zizmorcore/zizmor-action` step** in `.github/workflows/ci.yml`, `workflows` job:

- `advanced-security: false`: print the findings and fail the job on any of them, instead of uploading them to code scanning.
- `annotations: true`: also show each finding as an annotation on the workflow line, in the run's summary and in the PR's *Files changed*.
- `version: 1.30.1`: the action runs zizmor's Docker image, pinned by digest, and its `version` input defaults to `latest`, which is the newest version its own release lists. Szop sets the version explicitly so that CI and the local install ([setup guide](../setup.md#9-actionlint-zizmor-and-uv)) run the same zizmor. A bump of the action alone no longer changes zizmor's version; see the update steps below.
- The action runs zizmor's online audits too, with the job's read-only token. They look up the public repositories of the actions Szop uses, for example to check that each pinned SHA belongs to its action's repository and matches its version comment.

**`.github/zizmor.yml`**, which zizmor finds on its own:

- `rules: self-repository: disable: true`: turns off the audit that reports every local action referred to as `./…`. GitHub's newer `$/…` syntax is safer, but actionlint 1.7.12 rejects it as invalid, so Szop keeps `./` and this audit off until actionlint accepts `$/` ([ADR 0018](../../decisions/0018-ci-details.md), decision 12; [OP-069](https://github.com/luiki-dev/szop/issues/80)).

**Locally,** two things run it, with the version `ci.yml` pins:

- **The pre-commit hook:** `lint-staged.config.js` has an entry for staged `.github/**/*.{yml,yaml}` files. It runs `zizmor --offline` on the staged workflows, local actions and `dependabot.yml`, and actionlint on the workflows ([actionlint](actionlint.md#configuration)). Other YAML under `.github/` (issue templates, `zizmor.yml` itself) is left out: zizmor, given only files it does not audit, fails with `no inputs collected`. It finds `.github/zizmor.yml` by itself, also when given single files, so no `--config` is needed. A finding stops the commit. See [husky and lint-staged](husky-and-lint-staged.md).
- **`pnpm check:workflows`:** `scripts/check-workflows.sh` runs actionlint, then `zizmor --offline .github`. It stops with `FAIL: zizmor not found` and a pointer to the setup guide if the tool is missing.

## Everyday use

With the tool installed ([setup guide](../setup.md#9-actionlint-zizmor-and-uv)), the hook runs it on every commit that stages a file it audits. To check everything by hand, from the repository root:

```bash
pnpm check:workflows                          # actionlint, then zizmor, offline
GH_TOKEN=$(gh auth token) zizmor .            # every workflow and action, with the online audits CI runs
zizmor --offline .                            # no network access at all: the online audits are skipped
```

`No findings to report. Good job!` means clean. A finding prints its audit's name in brackets, its severity, the file and line with the problem underlined, and a link to the audit's documentation, which explains the risk and the fix.

**Fixing a template injection** (`template-injection`): a value a PR author controls, written as `${{ … }}` inside a `run:` script, is pasted into the script before the shell sees it, so a crafted PR title runs as code. Move the value to `env:` and read it as a shell variable:

```yaml
# Flagged:
- run: echo "${{ github.event.pull_request.title }}"
# Fixed:
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "$PR_TITLE"
```

A finding that is a false positive can be silenced in `.github/zizmor.yml` or with a `# zizmor: ignore[<audit>]` comment on the line, always with the reason next to it.

**Updating zizmor:**

1. Pick a version at least 7 days old that [zizmor-action's `support/versions` file](https://github.com/zizmorcore/zizmor-action/blob/main/support/versions) lists. The action refuses a version it has no image digest for, so a bump of the action may be needed first (Dependabot opens it).
2. Change the version in both places it lives: `version:` of the zizmor step in `.github/workflows/ci.yml`, and `uv tool install zizmor==<version>` in [the setup guide](../setup.md#9-actionlint-zizmor-and-uv).
3. Install the new version as the setup guide now says, run `pnpm check:workflows`, then commit as `ci(deps): bump zizmor to <version>`. Reinstall it the same way on each machine you commit from.

## Official documentation

- zizmor: <https://docs.zizmor.sh/>
- Audits, with each risk and fix: <https://docs.zizmor.sh/audits/>
- Configuration: <https://docs.zizmor.sh/configuration/>
- zizmor-action: <https://github.com/zizmorcore/zizmor-action>
