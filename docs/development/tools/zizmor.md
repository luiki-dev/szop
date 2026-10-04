# zizmor

zizmor is a security linter for GitHub Actions: it audits the workflow files, composite actions and `dependabot.yml`, and finds the mistakes behind most published CI attacks, such as template injection, excessive token permissions, actions not pinned to a commit SHA and impostor commits. In Szop it runs in CI's `workflows` job whenever a workflow, the setup action, `.github/dependabot.yml` or zizmor's own `.github/zizmor.yml` changes, and any finding fails the job.

## Why Szop uses it

- **Workflow security, checked by a tool:** [ADR 0010](../../decisions/0010-ci-cd.md), decision 21. The rules every workflow follows (decision 20 of the same ADR) are easy to break by accident; zizmor checks them on every change. [actionlint](actionlint.md) checks correctness; zizmor checks security. CodeQL also scans the workflows, but blocks a merge only for *high* or *critical* alerts, while any zizmor finding fails the job.
- **Its maintainers' own action, in annotation mode:** [ADR 0018](../../decisions/0018-ci-details.md), decision 5. `zizmorcore/zizmor-action` is pinned by SHA, so Dependabot keeps it current. By default it uploads its results to GitHub's code scanning, which needs the `security-events: write` permission and never fails the job, so a finding would block only through the code scanning rule. With `advanced-security: false`, findings fail the job directly, with only `contents: read`.
- **In CI only, for now:** [ADR 0018](../../decisions/0018-ci-details.md), decision 6. A local hook is revisited in PH-11 ([OP-066](../../open-points.md#op-066)).

## Configuration

**The `zizmorcore/zizmor-action` step** in `.github/workflows/ci.yml`, `workflows` job:

- `advanced-security: false`: print the findings and fail the job on any of them, instead of uploading them to code scanning.
- `annotations: true`: also show each finding as an annotation on the workflow line, in the run's summary and in the PR's *Files changed*.
- No `version:` input: the action runs zizmor's Docker image, pinned by digest, at the newest version its own release lists (zizmor 1.30.1 for the pinned v0.6.4). zizmor's version therefore changes only when Dependabot bumps the action.
- The action runs zizmor's online audits too, with the job's read-only token. They look up the public repositories of the actions Szop uses, for example to check that each pinned SHA belongs to its action's repository and matches its version comment.

**`.github/zizmor.yml`**, which zizmor finds on its own:

- `rules: self-repository: disable: true`: turns off the audit that reports every local action referred to as `./…`. GitHub's newer `$/…` syntax is safer, but actionlint 1.7.12 rejects it as invalid, so Szop keeps `./` and this audit off until actionlint accepts `$/` ([ADR 0018](../../decisions/0018-ci-details.md), decision 12; [OP-069](../../open-points.md#op-069)).

## Everyday use

Run it locally from the repository root before pushing a workflow change. It is a Python tool; `uvx`, from [uv](https://docs.astral.sh/uv/), runs it without installing it for good. Use the version the pinned action runs:

```bash
GH_TOKEN=$(gh auth token) uvx zizmor@1.30.1 .   # every workflow and action, with the online audits
uvx zizmor@1.30.1 --offline .                    # no network access at all: the online audits are skipped
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

## Official documentation

- zizmor: <https://docs.zizmor.sh/>
- Audits, with each risk and fix: <https://docs.zizmor.sh/audits/>
- Configuration: <https://docs.zizmor.sh/configuration/>
- zizmor-action: <https://github.com/zizmorcore/zizmor-action>
