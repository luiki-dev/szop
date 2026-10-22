#!/usr/bin/env bash
# Scans Szop with Trivy (PH-35 spec): `scan.sh config` checks the Terraform
# code under infra/ and the Dockerfile for misconfigurations. CRITICAL and
# HIGH findings block, MEDIUM and LOW are listed, and the inline exceptions
# (# trivy:ignore:<ID> -- <reason>) are listed with their reasons. Locally:
# pnpm check:scan. CI's scan-config job runs it too, with --json to keep the
# sorted result for the PR comment.
#
# Usage: scripts/scan.sh config [--json FILE]
# TRIVY names the Trivy binary (default: trivy on the PATH).
set -euo pipefail
cd "$(dirname "$0")/.."

trivy="${TRIVY:-trivy}"
mode="${1:-}"
[ "$#" -eq 0 ] || shift
json=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --json)
      [ "$#" -ge 2 ] || { echo "FAIL: --json needs a file" >&2; exit 1; }
      json="$2"
      shift 2
      ;;
    *)
      echo "FAIL: unknown argument $1" >&2
      exit 1
      ;;
  esac
done

command -v "$trivy" > /dev/null \
  || { echo "FAIL: $trivy not found; see docs/development/setup.md#8-terraform-tflint-and-the-aws-cli" >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# The findings of one `trivy config` run as a JSON array of
# {severity, id, title, url, target, line}. A Trivy that fails, writes no
# file or writes JSON without Results is a failed scan, never "no findings".
# Targets are relative to the scanned path, so the prefix puts them back at
# the repository root.
config_findings() {
  local path="$1" prefix="$2" out="$tmp/${1//\//_}.json"
  "$trivy" config --quiet --skip-check-update --format json --output "$out" "$path" \
    || { echo "FAIL: trivy config" >&2; exit 1; }
  jq -e .Results "$out" > /dev/null \
    || { echo "FAIL: trivy config wrote no usable JSON for ${path}" >&2; exit 1; }
  jq --arg prefix "$prefix" '[
    .Results[] | .Target as $target | (.Misconfigurations // [])[]
    | select(.Status == "FAIL")
    | { severity: .Severity, id: .ID, title: .Title, url: .PrimaryURL,
        target: ($prefix + $target), line: .CauseMetadata.StartLine }
  ]' "$out"
}

# Every `# trivy:ignore:<ID> -- <reason>` line as {id, reason, file, line}.
# Trivy leaves suppressed findings out of its JSON, so they are read here.
config_exceptions() {
  { grep -rnE --include='*.tf' '^[[:space:]]*#[[:space:]]*trivy:ignore:' infra || true
    grep -nE '^[[:space:]]*#[[:space:]]*trivy:ignore:' Dockerfile | sed 's/^/Dockerfile:/' || true
  } | jq -R 'capture("^(?<file>[^:]+):(?<line>[0-9]+):\\s*#\\s*trivy:ignore:(?<id>[A-Za-z0-9-]+)\\s*(--\\s*)?(?<reason>.*)$")
      | {id, reason, file, line: (.line | tonumber)}' | jq -s .
}

scan_config() {
  config_findings infra infra/ > "$tmp/infra-findings.json"
  config_findings Dockerfile "" > "$tmp/dockerfile-findings.json"
  config_exceptions > "$tmp/exceptions.json"

  # CRITICAL and HIGH block; sorted by severity, then ID.
  jq -s --slurpfile exceptions "$tmp/exceptions.json" '
    def rank: {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}[.] // 4;
    add | sort_by([(.severity | rank), .id, .target, .line])
    | { kind: "config",
        blocking: map(select(.severity == "CRITICAL" or .severity == "HIGH")),
        listed: map(select(.severity != "CRITICAL" and .severity != "HIGH")),
        exceptions: $exceptions[0] }
  ' "$tmp/infra-findings.json" "$tmp/dockerfile-findings.json" > "$tmp/result.json"

  jq -r '
    def where: .target + (if .line != null then ":\(.line)" else "" end);
    def pad(n): . + (if n > length then (" " * (n - length)) else "" end);
    def rows: .[] | "  \(.severity | pad(9))  \(.id | pad(9))  \(where | pad(36))  \(.title)";
    "BLOCKING (\(.blocking | length))", (.blocking | rows),
    "", "LISTED (\(.listed | length))", (.listed | rows),
    "", "EXCEPTIONS (\(.exceptions | length))",
    (.exceptions[] | "  \(.id | pad(9))  \("\(.file):\(.line)" | pad(36))  \(.reason)")
  ' "$tmp/result.json"

  if [ -n "$json" ]; then
    cp "$tmp/result.json" "$json"
  fi

  local blocking
  blocking="$(jq '.blocking | length' "$tmp/result.json")"
  if [ "$blocking" -gt 0 ]; then
    echo "FAIL: ${blocking} blocking finding(s)" >&2
    exit 1
  fi
}

case "$mode" in
  config) echo "==> trivy config"; scan_config ;;
  *)
    echo "Usage: scripts/scan.sh config [--json FILE]" >&2
    exit 1
    ;;
esac
