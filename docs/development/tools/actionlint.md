# actionlint

actionlint is a static checker for GitHub Actions workflow files: it finds syntax errors, unknown keys, mistyped `${{ … }}` expressions, `needs:` pointing at jobs that don't exist, and, through shellcheck, bugs in the shell scripts of `run:` steps. In Szop it runs in CI's `workflows` job, which runs whenever a workflow, the setup action, `.github/dependabot.yml` or `.github/zizmor.yml` changes ([Change detection](../ci-cd.md#change-detection)).

## Why Szop uses it

- **Workflow correctness, checked before merging:** [ADR 0010](../../decisions/0010-ci-cd.md), decision 21. A typo in a workflow otherwise shows up only when the workflow runs, sometimes long after the merge. [zizmor](zizmor.md) checks the security side; actionlint checks that the workflow is right.
- **Its own release binary, pinned and verified:** [ADR 0018](../../decisions/0018-ci-details.md), decision 5. The project's recommended install, `bash <(curl …/main/…)`, runs whatever is on its `main` branch that day. A Docker image would need the same manual updates plus a pull per run, and a third-party wrapper action adds another party's code for a single binary.
- **In CI only, for now:** [ADR 0018](../../decisions/0018-ci-details.md), decision 6. A local hook is revisited in PH-11 ([OP-066](../../open-points.md#op-066)).

## Configuration

actionlint has no configuration file in Szop. It is set up in `.github/workflows/ci.yml`, in the `workflows` job:

- `ACTIONLINT_VERSION` and `ACTIONLINT_SHA256` in the job's `env:`: the release to use and the SHA-256 checksum of its Linux archive.
- The `actionlint` step downloads `actionlint_<version>_linux_amd64.tar.gz` from the release on GitHub into the runner's temporary folder, checks it with `sha256sum --check` (a different file fails the job before anything runs), unpacks the binary and runs `actionlint -color` from the repository root. With no arguments, it checks every file in `.github/workflows/`. shellcheck is preinstalled on GitHub's Ubuntu runners, and actionlint uses it when it finds it.

Dependabot cannot see a version written inside a `run:` step, so updating actionlint is a manual change (below).

## Everyday use

Run it locally before pushing a workflow change, from a scratch folder outside the repository (nothing is installed for good):

```bash
S=/tmp/szop-tools; mkdir -p "$S/bin"; cd "$S"
curl -fsSL -o al.tgz https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz
echo "8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8  al.tgz" | sha256sum --check   # al.tgz: OK
tar -xzf al.tgz -C bin actionlint && bin/actionlint -version
cd -                       # back to the repository root
"$S/bin/actionlint" -color # no output means no problems
```

Use the version and checksum currently in `ci.yml`. Without shellcheck installed locally, the `run:` scripts are not checked; CI checks them anyway.

Each problem is printed as `file:line:column: message [rule]`, with the line underlined. A shellcheck finding names its code (`SC2086`), which the [shellcheck wiki](https://www.shellcheck.net/wiki/) explains.

**Updating actionlint:**

1. On the [releases page](https://github.com/rhysd/actionlint/releases), pick a release at least 7 days old, the same cooldown Dependabot keeps.
2. Open that release's `actionlint_<version>_checksums.txt` and copy the hash on the `linux_amd64.tar.gz` line.
3. In `.github/workflows/ci.yml`, change `ACTIONLINT_VERSION` and `ACTIONLINT_SHA256` together.
4. Run the new version locally as above, then commit as `ci(deps): bump actionlint to <version>`.

## Official documentation

- actionlint: <https://github.com/rhysd/actionlint>
- Usage: <https://github.com/rhysd/actionlint/blob/main/docs/usage.md>
- The checks it runs: <https://github.com/rhysd/actionlint/blob/main/docs/checks.md>
