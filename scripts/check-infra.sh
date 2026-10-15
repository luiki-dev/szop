#!/usr/bin/env bash
# Checks the Terraform code under infra/ with no AWS access (ADR 0029):
# formatting, every root module validated, then tflint. Locally:
# pnpm check:infra. CI's infra job runs it too.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> terraform fmt"
if ! terraform fmt -check -recursive -diff infra; then
  echo "FAIL: formatting; run pnpm infra:fmt" >&2
  exit 1
fi

# -backend=false downloads the providers only: no state, no AWS access. Each
# module gets its own data directory: a module's .terraform/ that is already
# initialized with its S3 backend makes init ask for AWS credentials, even
# with -backend=false. The cache keeps the providers between runs.
cache="${XDG_CACHE_HOME:-$HOME/.cache}/szop/terraform-check"
for dir in infra/*/; do
  compgen -G "${dir}*.tf" > /dev/null || continue
  echo "==> terraform validate ${dir}"
  export TF_DATA_DIR="$cache/$(basename "$dir")"
  terraform -chdir="$dir" init -backend=false -input=false > /dev/null \
    || { echo "FAIL: terraform init in ${dir}" >&2; exit 1; }
  terraform -chdir="$dir" validate \
    || { echo "FAIL: terraform validate in ${dir}" >&2; exit 1; }
done
unset TF_DATA_DIR

echo "==> tflint"
config="$PWD/infra/.tflint.hcl"
# Downloads the AWS ruleset from GitHub the first time, then uses the copy in
# ~/.tflint.d/plugins.
tflint --init --config "$config" \
  || { echo "FAIL: tflint --init could not download the AWS ruleset; retry, or see docs/development/tools/tflint.md" >&2; exit 1; }
(cd infra && tflint --recursive --config "$config") \
  || { echo "FAIL: tflint" >&2; exit 1; }
