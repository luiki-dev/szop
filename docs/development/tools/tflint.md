# tflint

tflint is a linter for Terraform code. `terraform validate` checks that the code is well-formed and consistent; tflint goes further: unused variables, missing version constraints, deprecated syntax, and, through its AWS ruleset, values AWS would reject, such as an instance type that does not exist. In Szop it runs in `pnpm check:infra`, on the owner's machine and in CI's `infra` job.

## Why Szop uses it

- **Terraform checks beyond `validate`:** [ADR 0008](../../decisions/0008-hosting.md), decision 30 and [ADR 0010](../../decisions/0010-ci-cd.md), decision 7. A mistake `validate` misses otherwise shows up only when `apply` fails halfway, against AWS.
- **A pinned release binary, checked against its checksum:** [ADR 0029](../../decisions/0029-aws-account-and-terraform-bootstrap-details.md), decision 11, the same approach as [actionlint](actionlint.md). The project's install script runs whatever its `master` branch holds that day.
- **Security posture is not its job:** tflint does not judge whether a bucket is too open or a policy too broad. A scanner for that is an open point, [OP-091](https://github.com/luiki-dev/szop/issues/201).

## Configuration

**`infra/.tflint.hcl`** configures every module:

- `plugin "terraform"` with `preset = "recommended"`: the rules bundled with tflint that its authors recommend: declared but unused variables, locals and data sources; `required_version` and `required_providers` present; variables with a `type`; deprecated syntax; naming in snake_case.
- `plugin "aws"`: [tflint-ruleset-aws](https://github.com/terraform-linters/tflint-ruleset-aws), pinned with `version` and `source`. `tflint --init` downloads it from that GitHub release and checks its signature before using it.

**`scripts/check-infra.sh`** runs it last, after `terraform fmt` and `terraform validate`:

```bash
tflint --init --config "$PWD/infra/.tflint.hcl"
(cd infra && tflint --recursive --config "$PWD/infra/.tflint.hcl")
```

`--recursive` runs tflint in every folder under `infra/` that holds `.tf` files; `--config` with an absolute path makes each of those runs use the one shared file.

In CI, the `infra` job downloads the binary from the version in `TFLINT_VERSION`, checks it against `TFLINT_SHA256` with `sha256sum --check`, and passes `GITHUB_TOKEN` to the script, only so GitHub's API does not rate-limit the plugin download.

## Everyday use

`pnpm check:infra` runs it. A finding looks like this:

```
Warning: variable "unused" is declared but not used (terraform_unused_declarations)

  on infra/bootstrap/unused.tf line 1:
   1: variable "unused" {

Reference: https://github.com/terraform-linters/tflint-ruleset-terraform/blob/v0.x/docs/rules/terraform_unused_declarations.md
```

The name in brackets is the rule; the `Reference` link explains it and how to fix it. Any finding fails `check:infra`. A rule that is wrong for one line can be silenced with a comment above it, `# tflint-ignore: <rule>`, with the reason next to it; silencing should stay rare.

**`FAIL: tflint --init could not download the AWS ruleset`**: the first run downloads the ruleset through GitHub's API, and later runs use the copy in `~/.tflint.d/plugins`. An HTTP `500` or `502` in the message is GitHub failing for a moment: run it again. A `403` means GitHub's limit for anonymous API calls (60 an hour) is used up: wait, or run with a token, `GITHUB_TOKEN=$(gh auth token) pnpm check:infra`. CI always passes its own token.

## Updating

Dependabot does not see tflint or its plugin, so both are updated by hand.

**tflint:**

1. On the [releases page](https://github.com/terraform-linters/tflint/releases), pick a release at least 7 days old.
2. From its `checksums.txt`, copy the hash on the `tflint_linux_amd64.zip` line.
3. Put the version and hash in `TFLINT_VERSION` and `TFLINT_SHA256` in `.github/workflows/ci.yml`, and in the commands of the [setup guide](../setup.md#8-terraform-tflint-and-the-aws-cli).
4. Install it locally with those commands, run `pnpm check:infra`, and commit as `ci: update tflint to <version>`.

**The AWS ruleset:**

1. On its [releases page](https://github.com/terraform-linters/tflint-ruleset-aws/releases), pick a release at least 7 days old.
2. Change `version` in `infra/.tflint.hcl`, run `pnpm check:infra` (its `tflint --init` downloads the new version), and commit as `build(infra): update tflint-ruleset-aws to <version>`.
