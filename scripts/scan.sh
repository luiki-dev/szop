#!/usr/bin/env bash
# Scans Szop with Trivy (PH-35 spec).
#
# `scan.sh config` checks the Terraform code under infra/ and the Dockerfile
# for misconfigurations. CRITICAL and HIGH findings block, MEDIUM and LOW are
# listed, and the inline exceptions (# trivy:ignore:<ID> -- <reason>) are
# listed with their reasons.
#
# `scan.sh image` scans the container image for known vulnerabilities and
# sorts them in four (decisions 2, 7 and 17 of the spec). BLOCKING: CRITICAL
# or HIGH, with a fix, in a language package (Trivy's class lang-pkgs: the
# Node packages the lockfile or the Dockerfile controls). WAITING FOR THE BASE
# IMAGE: fixed in Debian, in an operating-system package (os-pkgs), whatever
# the severity; the official image is rebuilt weeks after Debian ships a fix,
# and no PR can speed that up. UNFIXED: no fix exists. LISTED: the rest. Only
# the first blocks.
#
# `scan.sh all` runs config, then image, and fails if either failed.
#
# Locally: pnpm check:scan (all). CI's scan-config and scan-image jobs run
# one each, with --json to keep the sorted result for the PR comment.
#
# Usage: scripts/scan.sh config [--json FILE]
#        scripts/scan.sh image [--no-build | --input ARCHIVE] [--json FILE]
#        scripts/scan.sh all [--no-build]
# image builds szop:local as check-image.sh does; --no-build scans the
# szop:local that exists; --input scans an archive made by `docker save`,
# with no Docker daemon (CI). TRIVY names the Trivy binary (default: trivy on
# the PATH).
set -euo pipefail
cd "$(dirname "$0")/.."

trivy="${TRIVY:-trivy}"
mode="${1:-}"
[ "$#" -eq 0 ] || shift
json=""
build=true
input=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --json)
      [ "$#" -ge 2 ] || { echo "FAIL: --json needs a file" >&2; exit 1; }
      json="$2"
      shift 2
      ;;
    --no-build)
      build=false
      shift
      ;;
    --input)
      [ "$#" -ge 2 ] || { echo "FAIL: --input needs an archive" >&2; exit 1; }
      input="$2"
      shift 2
      ;;
    *)
      echo "FAIL: unknown argument $1" >&2
      exit 1
      ;;
  esac
done
if [ -n "$input" ] && [ "$build" = false ]; then
  echo "FAIL: --input and --no-build exclude each other" >&2
  exit 1
fi

# `all` runs the two scans as scripts of their own, so each keeps its own
# `exit` and `set -e`, and both run even when the first fails.
if [ "$mode" = all ]; then
  [ -z "$input" ] && [ -z "$json" ] \
    || { echo "FAIL: all takes no --input or --json" >&2; exit 1; }
  status=0
  "$0" config || status=1
  if [ "$build" = true ]; then "$0" image || status=1; else "$0" image --no-build || status=1; fi
  exit "$status"
fi

command -v "$trivy" > /dev/null \
  || { echo "FAIL: $trivy not found; see docs/development/setup.md#8-terraform-tflint-and-the-aws-cli" >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# One Trivy run, written as JSON to $2. A Trivy that fails, writes no file or
# writes JSON without Results is a failed scan, never "no findings".
# Usage: run_trivy config|image OUTPUT ARGS...
run_trivy() {
  local kind="$1" out="$2"
  shift 2
  "$trivy" "$kind" --quiet --format json --output "$out" "$@" \
    || { echo "FAIL: trivy ${kind}" >&2; exit 1; }
  jq -e .Results "$out" > /dev/null \
    || { echo "FAIL: trivy ${kind} wrote no usable JSON" >&2; exit 1; }
}

# jq definitions both scans share: the order of severities, the table's
# padding and "2 HIGH, 5 MEDIUM" for the categories that only show a count.
jq_defs='
  def rank: {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}[.] // 4;
  def pad(n): . + (if n > length then (" " * (n - length)) else "" end);
  def count_by_severity: group_by(.severity) | sort_by(.[0].severity | rank) | map("\(length) \(.[0].severity)") | join(", ");
'

# Writes the sorted JSON when asked, and fails when anything blocks.
finish() {
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

# The findings of one `trivy config` run as a JSON array of
# {severity, id, title, url, target, line}. Targets are relative to the
# scanned path, so the prefix puts them back at the repository root.
config_findings() {
  local path="$1" prefix="$2" out="$tmp/${1//\//_}.json"
  run_trivy config "$out" --skip-check-update "$path"
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
  jq -s --slurpfile exceptions "$tmp/exceptions.json" "$jq_defs"'
    add | sort_by([(.severity | rank), .id, .target, .line])
    | { kind: "config",
        blocking: map(select(.severity == "CRITICAL" or .severity == "HIGH")),
        listed: map(select(.severity != "CRITICAL" and .severity != "HIGH")),
        exceptions: $exceptions[0] }
  ' "$tmp/infra-findings.json" "$tmp/dockerfile-findings.json" > "$tmp/result.json"

  jq -r "$jq_defs"'
    def where: .target + (if .line != null then ":\(.line)" else "" end);
    def rows: .[] | "  \(.severity | pad(9))  \(.id | pad(9))  \(where | pad(36))  \(.title)";
    "BLOCKING (\(.blocking | length))", (.blocking | rows),
    "", "LISTED (\(.listed | length))", (.listed | rows),
    "", "EXCEPTIONS (\(.exceptions | length))",
    (.exceptions[] | "  \(.id | pad(9))  \("\(.file):\(.line)" | pad(36))  \(.reason)")
  ' "$tmp/result.json"

  finish
}

# Builds szop:local the way check-image.sh does, through Compose, so the
# scanned image is the one the checks start.
build_image() {
  GIT_COMMIT="${GIT_COMMIT:-$(git rev-parse HEAD)}" docker compose --profile app build app \
    || { echo "FAIL: docker compose build" >&2; exit 1; }
}

scan_image() {
  local target=(szop:local)
  if [ -n "$input" ]; then
    target=(--input "$input")
  elif [ "$build" = true ]; then
    build_image
  fi
  run_trivy image "$tmp/image.json" --scanners vuln "${target[@]}"

  # Each vulnerability goes in the first category it fits: no fix (unfixed);
  # fixed in an operating-system package (waiting for the base image); fixed
  # in a language package at CRITICAL or HIGH (blocking); the rest (listed).
  # Sorted by severity, then ID.
  jq "$jq_defs"'
    [ .Results[] | .Class as $class | .Target as $target
      | (.Vulnerabilities // [])[]
      | { severity: .Severity, id: .VulnerabilityID, title: (.Title // ""),
          url: .PrimaryURL, target: $target, pkg: .PkgName,
          installed: .InstalledVersion, fixed: (.FixedVersion // ""), class: $class } ]
    | sort_by([(.severity | rank), .id, .pkg, .target])
    | map(. + {category:
        (if .fixed == "" then "unfixed"
         elif .class == "os-pkgs" then "waiting"
         elif .class == "lang-pkgs" and (.severity == "CRITICAL" or .severity == "HIGH") then "blocking"
         else "listed" end)})
    | def pick($c): map(select(.category == $c) | del(.class, .category));
      { kind: "image", blocking: pick("blocking"), waiting: pick("waiting"),
        unfixed: pick("unfixed"), listed: pick("listed") }
  ' "$tmp/image.json" > "$tmp/result.json"

  jq -r "$jq_defs"'
    def rows: .[] | "  \(.severity | pad(9))  \(.id | pad(18))  \("\(.pkg) \(.installed) -> \(.fixed)" | pad(48))  \(.target)";
    "BLOCKING (\(.blocking | length))", (.blocking | rows),
    "", "WAITING FOR THE BASE IMAGE (\(.waiting | length)): \(.waiting | count_by_severity)",
    "", "UNFIXED (\(.unfixed | length)): \(.unfixed | count_by_severity)",
    "", "LISTED (\(.listed | length))", (.listed | rows)
  ' "$tmp/result.json"

  finish
}

case "$mode" in
  config) echo "==> trivy config"; scan_config ;;
  image) echo "==> trivy image"; scan_image ;;
  *)
    cat >&2 <<'USAGE'
Usage: scripts/scan.sh config [--json FILE]
       scripts/scan.sh image [--no-build | --input ARCHIVE] [--json FILE]
       scripts/scan.sh all [--no-build]
USAGE
    exit 1
    ;;
esac
