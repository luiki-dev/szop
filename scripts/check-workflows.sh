#!/usr/bin/env bash
# Checks the workflow files under .github/ with no network access (ADR 0032,
# decision 2): actionlint for correctness, zizmor for security. Locally:
# pnpm check:workflows. The pre-commit hook runs the same tools on the staged
# files; CI's workflows job runs them directly, with zizmor's online audits.
set -euo pipefail
cd "$(dirname "$0")/.."

for tool in actionlint zizmor; do
  command -v "$tool" > /dev/null \
    || { echo "FAIL: $tool not found; see docs/development/setup.md#9-actionlint-zizmor-and-uv" >&2; exit 1; }
done

echo "==> actionlint"
actionlint || { echo "FAIL: actionlint" >&2; exit 1; }

# --offline skips the audits that call GitHub, so no token is needed.
echo "==> zizmor"
zizmor --offline .github || { echo "FAIL: zizmor" >&2; exit 1; }
