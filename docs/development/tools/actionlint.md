# actionlint

actionlint is a static checker for GitHub Actions workflow files: it finds syntax errors, unknown keys, mistyped `${{ … }}` expressions, `needs:` pointing at jobs that don't exist, and, through shellcheck, bugs in the shell scripts of `run:` steps. In Szop it runs in the pre-commit hook on the staged workflow files, through `pnpm check:workflows`, and in CI's `workflows` job, which runs whenever a workflow, the setup action, `.github/dependabot.yml` or `.github/zizmor.yml` changes ([Change detection](../ci-cd.md#change-detection)).

## Why Szop uses it

- **Workflow correctness, checked before merging:** [ADR 0010](../../decisions/0010-ci-cd.md), decision 21. A typo in a workflow otherwise shows up only when the workflow runs, sometimes long after the merge. [zizmor](zizmor.md) checks the security side; actionlint checks that the workflow is right.
- **Its own release binary, pinned and verified:** [ADR 0018](../../decisions/0018-ci-details.md), decision 5. The project's recommended install, `bash <(curl …/main/…)`, runs whatever is on its `main` branch that day. A Docker image would need the same manual updates plus a pull per run, and a third-party wrapper action adds another party's code for a single binary.
- **Locally and in CI:** [ADR 0018](../../decisions/0018-ci-details.md), decision 6, first kept it in CI only; [ADR 0032](../../decisions/0032-ci-access-and-teardown-details.md), decision 2, adds the pre-commit hook and `pnpm check:workflows` ([OP-066](https://github.com/luiki-dev/szop/issues/79)). A workflow mistake is then caught before the commit, not after the push. It needs the tool installed on every machine that commits: the [setup guide](../setup.md#9-actionlint-zizmor-and-uv) does that.

## Configuration

actionlint has no configuration file in Szop. It is set up in `.github/workflows/ci.yml`, in the `workflows` job:

- `ACTIONLINT_VERSION` and `ACTIONLINT_SHA256` in the job's `env:`: the release to use and the SHA-256 checksum of its Linux archive.
- The `actionlint` step downloads `actionlint_<version>_linux_amd64.tar.gz` from the release on GitHub into the runner's temporary folder, checks it with `sha256sum --check` (a different file fails the job before anything runs), unpacks the binary and runs `actionlint -color` from the repository root. With no arguments, it checks every file in `.github/workflows/`. shellcheck is preinstalled on GitHub's Ubuntu runners, and actionlint uses it when it finds it.

**Locally,** the binary is installed in `~/.local/bin` by the [setup guide](../setup.md#9-actionlint-zizmor-and-uv), with the same version as `ci.yml`. Two things run it:

- **The pre-commit hook:** `lint-staged.config.js` has an entry for staged `.github/**/*.{yml,yaml}` files. It runs `actionlint` on the staged files under `.github/workflows/` (and zizmor on what it audits, see [zizmor](zizmor.md#configuration)). A finding stops the commit. See [husky and lint-staged](husky-and-lint-staged.md).
- **`pnpm check:workflows`:** `scripts/check-workflows.sh` runs `actionlint` with no arguments (every workflow), then zizmor. It stops with `FAIL: actionlint not found` and a pointer to the setup guide if the tool is missing.

Dependabot cannot see a version written inside a `run:` step, so updating actionlint is a manual change (below).

## Everyday use

With the tool installed ([setup guide](../setup.md#9-actionlint-zizmor-and-uv)), the hook runs it on every commit that stages a workflow. To check every workflow by hand, from the repository root:

```bash
actionlint -color      # no output means no problems
pnpm check:workflows   # actionlint, then zizmor
```

shellcheck, which the setup guide installs with `apt`, lets actionlint check the shell scripts of `run:` steps. Without it, actionlint says nothing about them and CI checks them anyway.

Each problem is printed as `file:line:column: message [rule]`, with the line underlined. A shellcheck finding names its code (`SC2086`), which the [shellcheck wiki](https://www.shellcheck.net/wiki/) explains.

**Updating actionlint:**

1. On the [releases page](https://github.com/rhysd/actionlint/releases), pick a release at least 7 days old, the same cooldown Dependabot keeps.
2. Open that release's `actionlint_<version>_checksums.txt` and copy the hash on the `linux_amd64.tar.gz` line.
3. Change the version in both places it lives: `ACTIONLINT_VERSION` and `ACTIONLINT_SHA256` together in `.github/workflows/ci.yml`, and the download URL, the file name and the checksum of the actionlint command in [the setup guide](../setup.md#9-actionlint-zizmor-and-uv).
4. Install the new version as the setup guide now says, run `pnpm check:workflows`, then commit as `ci(deps): bump actionlint to <version>`. Reinstall it the same way on each machine you commit from.

## Official documentation

- actionlint: <https://github.com/rhysd/actionlint>
- Usage: <https://github.com/rhysd/actionlint/blob/main/docs/usage.md>
- The checks it runs: <https://github.com/rhysd/actionlint/blob/main/docs/checks.md>
