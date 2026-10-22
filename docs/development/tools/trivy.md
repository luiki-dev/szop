# Trivy

Trivy is a security scanner from Aqua Security. It reads things that describe how Szop is built and compares them with what is known to go wrong: Terraform code and Dockerfiles against a library of misconfiguration rules (a security group open to the world, a bucket without encryption), and a container image against a database of published vulnerabilities, Common Vulnerabilities and Exposures (CVEs, see the [glossary](../../glossary.md#acronyms)). In Szop it runs in `pnpm check:scan`, on the owner's machine and in CI's `scan-config` and `scan-image` jobs.

This page covers the tool, the **config scan**, which checks the Terraform code under `infra/` and the `Dockerfile`, and the **image scan**. The decisions are recorded in [ADR 0041](../../decisions/0041-security-scanners-details.md); how CI runs the scans and reports them in one PR comment is in [CI/CD](../ci-cd.md#the-security-scans-and-the-pr-comment).

## Why Szop uses it

- **One tool for every scan:** [the PH-35 design](../../superpowers/specs/2026-10-22-PH-35-security-scanners-design.md), decision 3. One tool gives one severity scale, one way to record exceptions and one output to read. Checkov has more Terraform rules but is a second tool on Python; hadolint adds style, not security.
- **A pinned release binary, checked against its checksum:** decision 10 of the same design, the same approach as [tflint](tflint.md) and [actionlint](actionlint.md). On 19 and 20 March 2026 a stolen credential was used to publish a malicious Trivy v0.69.4 and to point almost every tag of Aqua's GitHub Actions at a credential stealer, for about 12 hours ([CVE-2026-33634](https://cve.circl.lu/cve/CVE-2026-33634)). So Szop never uses `aquasecurity/trivy-action`, `setup-trivy` or Trivy's Docker image: it downloads the release archive of one exact version and checks it against a SHA-256 kept in the workflow. A checksum stops a swapped download; a version at least two weeks old makes pinning a bad release unlikely.
- **Not a linter:** [tflint](tflint.md) finds Terraform mistakes (an unused variable, an instance type that does not exist). Trivy judges security posture: whether a rule is too open, a resource unencrypted.

## The config scan

`scripts/scan.sh config` runs `trivy config` twice, over `infra/` (all three modules) and over the `Dockerfile`, and joins the results. It always passes `--skip-check-update`, so the rules are the ones built into the pinned binary and change only when Trivy's version is bumped, in a PR that shows what changed ([design](../../superpowers/specs/2026-10-22-PH-35-security-scanners-design.md), decision 12).

| Severity | What happens |
|---|---|
| `CRITICAL`, `HIGH` | Blocks: the script prints them under `BLOCKING` and exits 1, which fails CI's `scan-config` job |
| `MEDIUM`, `LOW` | Listed under `LISTED`; they never fail the scan |

The script fails, rather than reporting "no findings", whenever the scan itself did not run: Trivy exits non-zero, writes no output, or writes something that is not JSON. The line is `FAIL: trivy config`.

With `--json FILE` it also writes the findings, sorted by severity and then rule ID, as `{kind: "config", blocking, listed, exceptions}`. CI uploads that file as the `scan-config` artifact for one day.

## The image scan

`scripts/scan.sh image` scans the container image for known vulnerabilities (`trivy image --scanners vuln`). By default it builds `szop:local` the way `pnpm check:image` does; `--no-build` scans the `szop:local` that exists, and `--input ARCHIVE` scans a file made by `docker save`, which needs no Docker daemon. CI's `docker` job saves the image it built and uploads it as the `image` artifact, and `scan-image` downloads it and uses `--input`: Trivy then runs in a job that holds `contents: read` and nothing else, never next to the build cache token ([design](../../superpowers/specs/2026-10-22-PH-35-security-scanners-design.md), decision 11). Both ways find the same vulnerabilities; only the `target` text differs (the archive's path or `szop:local`).

Every vulnerability goes in the first of four categories it fits (Trivy's `Class` says whether a package is the operating system's or a language's):

| Category | What it holds | What happens |
|---|---|---|
| `UNFIXED` | No fixed version exists, whatever the severity or class | Counted by severity, never blocks: nothing can be done yet |
| `WAITING FOR THE BASE IMAGE` | A fixed version exists, in an operating-system package (`os-pkgs`), whatever the severity | Counted by severity, never blocks: Debian has shipped the fix, but the official `node` image is rebuilt weeks later and Dependabot proposes the new one; no PR can speed that up (decision 17) |
| `BLOCKING` | `CRITICAL` or `HIGH`, with a fixed version, in a language package (`lang-pkgs`): the Node packages the lockfile or the Dockerfile controls | Fails the scan, so the PR is red until the dependency is updated |
| `LISTED` | The rest: fixed, in a language package, `MEDIUM` or lower | Listed, never fails |

The script fails, rather than reporting "no findings", when Trivy exits non-zero or writes no JSON (`FAIL: trivy image`). With `--json FILE` it writes `{kind: "image", blocking, waiting, unfixed, listed}`, each finding `{severity, id, title, url, target, pkg, installed, fixed}`, sorted by severity and then ID; CI keeps it as the `scan-image` artifact for one day. Trivy downloads its vulnerability database on every run. CI does not cache it: a cache would give the job the cache token for a saving of a few seconds.

**npm is not in the image.** The first scan of the image found seven fixable `HIGH` vulnerabilities, all in npm's own bundled dependencies (`brace-expansion`, `tar`, `undici`, `ip-address`), under `/usr/local/lib/node_modules/npm`. Nothing in the image runs npm: the app and `db-setup` start with `node`. So the final stage of the `Dockerfile` removes npm, Corepack and the links in `/usr/local/bin` (`npm`, `npx`, `corepack`, and the `pnpm`, `pnpx`, `yarn` and `yarnpkg` shims that Corepack added), which fixes them and leaves an attacker in the container fewer tools ([design](../../superpowers/specs/2026-10-22-PH-35-security-scanners-design.md), decision 8). Exceptions would have hidden a problem that one line removes. If a fixable `HIGH` shows up in a package the app itself depends on, update the dependency (Dependabot proposes it); do not add the vulnerability to an ignore list.

## Exceptions

A finding that is accepted on purpose gets an inline comment on the line above its resource, with the reason after `--`:

```hcl
# trivy:ignore:AWS-0053 -- the demo is reached from the internet through this load balancer (ADR 0041)
resource "aws_lb" "main" {
```

To add one:

1. Run `pnpm check:scan`, and copy the rule ID of the blocking finding (`AWS-0053`).
2. Put the comment on the line directly above the resource, with the ID and the reason. A comment with the wrong ID suppresses nothing; the text after the ID does not matter to Trivy, which is why the reason can sit there.
3. Run `pnpm check:scan` again: the finding leaves `BLOCKING`.

Trivy leaves a suppressed finding out of its JSON, so the script finds the exceptions itself, by reading every `trivy:ignore` line under `infra/` and in the `Dockerfile`, and lists them under `EXCEPTIONS` with their reasons. They stay visible that way. An exception is for a risk the owner has weighed; a fix that takes a line is better than an exception that hides the problem.

**That one form is the only one accepted.** Trivy honours others that would hide a finding without it showing under `EXCEPTIONS`: a `.trivyignore` or a `trivy.yaml` at the repository root, which it loads by default, `// trivy:ignore:…`, `# trivy:ignore:*`, a `trivy:ignore` at the end of a code line, the long rule IDs and the older `tfsec:ignore`. So the script runs Trivy with `--ignorefile "" --config ""`, which loads neither file, in both scans, and fails with `FAIL: non-standard trivy:ignore at <file>:<line>` on any line under `infra/` or in the `Dockerfile` that names `trivy:ignore` or `tfsec:ignore` and is not exactly `# trivy:ignore:<ID> -- <reason>`, with an ID like `AWS-0104` or `DS-0026` and a reason.

**An image vulnerability** cannot take an inline comment. If one ever has to be accepted, it goes in a `.trivyignore.yaml` with a statement and an expiry date ([ADR 0041](../../decisions/0041-security-scanners-details.md), decision 13), and since the default ignore file is turned off, `scripts/scan.sh` must pass that file explicitly (`--ignorefile .trivyignore.yaml`) and list its entries as accepted exceptions in the comment, as it does for the inline ones. Neither exists until the first such exception is needed.

## Install and version

CI's `scan-config` and `scan-image` jobs each hold `TRIVY_VERSION` and `TRIVY_SHA256` in their `env`, download `trivy_<version>_Linux-64bit.tar.gz` from the release, check it with `sha256sum --check`, extract only the `trivy` binary and put it on the `PATH`. The jobs run on pull requests only and hold `contents: read` and nothing else: Trivy never runs in a job with AWS credentials, a write token or the build cache.

On the owner's machine, the [setup guide](../setup.md#8-terraform-tflint-and-the-aws-cli) installs the same version with the same checksum.

## Updating

Dependabot does not see Trivy, which lives in a `run:` step, so it is updated by hand:

1. On the [releases page](https://github.com/aquasecurity/trivy/releases), pick a release at least **two weeks** old, and read its release notes. Read [Aqua's security advisories](https://github.com/aquasecurity/trivy/security/advisories) too: the March 2026 incident is the reason for the wait.
2. From the release's `trivy_<version>_checksums.txt`, copy the hash on the `trivy_<version>_Linux-64bit.tar.gz` line.
3. Put the version and hash in `TRIVY_VERSION` and `TRIVY_SHA256` in both the `scan-config` and `scan-image` jobs of `.github/workflows/ci.yml`, and in the commands of the [setup guide](../setup.md#8-terraform-tflint-and-the-aws-cli).
4. Install it locally with those commands and run `pnpm check:scan`. A new version can bring new rules: list the findings that are new, and fix or accept each one in the same PR. Commit as `ci: update Trivy to <version>`.

## Everyday use

`pnpm check:scan` runs the config scan, then the image scan (`scripts/scan.sh config` or `scripts/scan.sh image --no-build` run one of them). Success looks like `BLOCKING (0)` under each, the listed findings, the exceptions and an exit code of 0. A blocking finding looks like this:

```
BLOCKING (1)
  HIGH       AWS-0053   infra/demo/load_balancer.tf:47        Load balancer is exposed to the internet.
FAIL: 1 blocking finding(s)
```

The ID is the rule; its page on `avd.aquasec.com/misconfig/<id>` explains it and how to fix it. Either fix the code or add an exception as above.

`FAIL: trivy not found` means Trivy is not installed (setup guide); `TRIVY=/path/to/trivy pnpm check:scan` runs another binary.

## Official documentation

- [Trivy](https://trivy.dev/), with its documentation
- [The repository](https://github.com/aquasecurity/trivy), with the releases and security advisories
