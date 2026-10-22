# Trivy

Trivy is a security scanner from Aqua Security. It reads things that describe how Szop is built and compares them with what is known to go wrong: Terraform code and Dockerfiles against a library of misconfiguration rules (a security group open to the world, a bucket without encryption), and, in later parts of the phase, a container image against a database of published vulnerabilities (CVEs, see the [glossary](../../glossary.md)). In Szop it runs in `pnpm check:scan`, on the owner's machine and in CI's `scan-config` job.

This page covers the tool and the **config scan**, which checks the Terraform code under `infra/` and the `Dockerfile`.

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

## Install and version

CI's `scan-config` job holds `TRIVY_VERSION` and `TRIVY_SHA256` in its `env`, downloads `trivy_<version>_Linux-64bit.tar.gz` from the release, checks it with `sha256sum --check`, extracts only the `trivy` binary and puts it on the `PATH`. The job runs on pull requests only and holds `contents: read` and nothing else: Trivy never runs in a job with AWS credentials, a write token or the build cache.

On the owner's machine, the [setup guide](../setup.md#8-terraform-tflint-and-the-aws-cli) installs the same version with the same checksum.

## Updating

Dependabot does not see Trivy, which lives in a `run:` step, so it is updated by hand:

1. On the [releases page](https://github.com/aquasecurity/trivy/releases), pick a release at least **two weeks** old, and read its release notes. Read [Aqua's security advisories](https://github.com/aquasecurity/trivy/security/advisories) too: the March 2026 incident is the reason for the wait.
2. From the release's `trivy_<version>_checksums.txt`, copy the hash on the `trivy_<version>_Linux-64bit.tar.gz` line.
3. Put the version and hash in `TRIVY_VERSION` and `TRIVY_SHA256` in `.github/workflows/ci.yml`, and in the commands of the [setup guide](../setup.md#8-terraform-tflint-and-the-aws-cli).
4. Install it locally with those commands and run `pnpm check:scan`. A new version can bring new rules: list the findings that are new, and fix or accept each one in the same PR. Commit as `ci: update Trivy to <version>`.

## Everyday use

`pnpm check:scan` runs the config scan. Success looks like `BLOCKING (0)`, the listed findings, the exceptions and an exit code of 0. A blocking finding looks like this:

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
