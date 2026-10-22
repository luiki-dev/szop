#!/usr/bin/env bash
# Writes the PR comment that CI's comment job posts, as Markdown on stdout
# (PH-35 spec, "The comment"). It reads a directory holding what the jobs
# left as artifacts:
#   plan/{base,demo}/   from plan: result (ok or failed), counts.json,
#                       changes.json, findings.jsonl, unchecked.txt,
#                       aa-errors.txt, checked
#   scan-config.json    from scan-config (scripts/scan.sh config --json)
#   scan-image.json     from scan-image (scripts/scan.sh image --json)
# Each of them can be missing. The environment says why:
#   PLANNED_SHA, RUN_URL                      the planned commit, the run's link
#   PLAN_RESULT, SCAN_CONFIG_RESULT,
#   SCAN_IMAGE_RESULT                         each job's result (success,
#                                             failure, skipped ...); unset
#                                             counts as "ran"
#   FORK_INFRA=true                           a fork's PR changed infra/, so
#                                             plan could not run
# A job that ran but left no artifact (a failed checkout, no AWS credentials,
# a crashed scan) is shown as failed and counts as blocking, never as "no
# findings". A job that was skipped is left out.
#
# Everything that came from a PR or from Trivy's database (titles, package
# names, paths, reasons, Access Analyzer's messages) passes through a filter:
# a name that goes into a code span only loses backticks and line breaks
# (`code`, the brackets of dkim[0] stay); text that goes into the prose also
# loses angle and square brackets (no HTML, no links) and gets no @ that would
# mention someone. A link is written only for an avd.aquasec.com address. The
# filter covers what an honest scan prints; the real boundary is that the
# comment job holds only pull-requests: write and no AWS credentials.
#
# Usage: PLANNED_SHA=... RUN_URL=... scripts/write-ci-comment.sh DIR
set -euo pipefail

dir="${1:-}"
[ -d "$dir" ] || { echo "FAIL: usage: write-ci-comment.sh DIR" >&2; exit 1; }
planned_sha="${PLANNED_SHA:-unknown}"
run_url="${RUN_URL:-}"
plan_result="${PLAN_RESULT:-success}"
config_result="${SCAN_CONFIG_RESULT:-success}"
image_result="${SCAN_IMAGE_RESULT:-success}"
fork_infra="${FORK_INFRA:-false}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

config_json="$dir/scan-config.json"
image_json="$dir/scan-image.json"
modules=(base demo)

# The filters, and the lines of a finding, shared by every part.
# The jq programs hold backticks (Markdown code spans) in single quotes on purpose.
# shellcheck disable=SC2016
defs='
  def code: (. // "" | tostring) | gsub("[`\\r\\n]"; " ");
  def text: (. // "" | tostring) | gsub("[`<>\\[\\]\\r\\n]"; " ") | gsub("@"; "@​");
  def rank: {"CRITICAL": 0, "ERROR": 0, "HIGH": 1, "SECURITY_WARNING": 1, "MEDIUM": 2, "LOW": 3}[.] // 4;
  def by_severity: group_by(.severity) | sort_by(.[0].severity | rank) | map("\(length) \(.[0].severity | text)") | join(", ");
  def link: if (.url | type) == "string" and (.url | test("^https://avd\\.aquasec\\.com/[A-Za-z0-9/_.-]+$"))
            then "[`\(.id | code)`](\(.url))" else "`\(.id | code)`" end;
  def config_line: "**\(.severity | text)** \(link) \(.title | text): `\(.target | code)\(if .line then ":\(.line)" else "" end)`";
  def image_line: "**\(.severity | text)** \(link) \(.title | text): `\(.pkg | code) \(.installed | code)`\(if (.fixed // "") != "" then ", fixed in `\(.fixed | code)`" else "" end)";
  def aa_blocking: .findingType == "ERROR" or .findingType == "SECURITY_WARNING";
'

# ---------------------------------------------------------------------------
# What blocks, as {rank, key, line} objects: a job that ran and left nothing
# first, then every blocking finding by severity.
# ---------------------------------------------------------------------------
blocking="$tmp/blocking.jsonl"
: > "$blocking"
failure() {
  jq -cn --arg line "$1" '{rank: -1, key: $line, line: ("**did not finish** " + $line)}' >> "$blocking"
}

plan_ran=false
[ "$plan_result" = skipped ] || plan_ran=true
declare -A plan_ok
for m in "${modules[@]}"; do
  plan_ok[$m]=false
  if [ "$plan_ran" = true ]; then
    if [ "$(cat "$dir/plan/$m/result" 2>/dev/null || true)" = ok ]; then
      plan_ok[$m]=true
    else
      failure "The plan of \`infra/$m\`: see the log."
    fi
  fi
done

if [ "$config_result" != skipped ] && [ ! -f "$config_json" ]; then
  failure "The Trivy config scan: see the log."
fi
if [ "$image_result" != skipped ] && [ ! -f "$image_json" ]; then
  failure "The Trivy image scan: see the log."
fi

if [ -f "$config_json" ]; then
  jq -c "$defs"'.blocking[] | {rank: (.severity | rank), key: .id, line: (config_line + " (Trivy config)")}' "$config_json" >> "$blocking"
fi
if [ -f "$image_json" ]; then
  jq -c "$defs"'.blocking[] | {rank: (.severity | rank), key: .id, line: (image_line + " (Trivy image)")}' "$image_json" >> "$blocking"
fi
for m in "${modules[@]}"; do
  [ "${plan_ok[$m]}" = true ] || continue
  jq -c --arg m "$m" "$defs"'select(aa_blocking)
      | {rank: (.findingType | rank), key: .issueCode,
         line: "**\(.findingType | text)** `\(.address | code)`: \(.issueCode | text): \(.findingDetails | text) (IAM Access Analyzer, `infra/\($m)`)"}' \
    "$dir/plan/$m/findings.jsonl" >> "$blocking"
  if [ -s "$dir/plan/$m/aa-errors.txt" ]; then
    jq -cR --arg m "$m" "$defs"'{rank: -1, key: ., line: "**did not finish** Access Analyzer could not validate the policy of `\(. | code)` in `infra/\($m)`: see the log."}' \
      "$dir/plan/$m/aa-errors.txt" >> "$blocking"
  fi
done
count="$(wc -l < "$blocking")"

# ---------------------------------------------------------------------------
# The comment
# ---------------------------------------------------------------------------
echo "<!-- ci-scans -->"
if [ "$count" -gt 0 ]; then
  echo "**❌ $count blocking finding(s)**"
else
  echo "**✅ nothing blocking**"
fi
echo
echo "Planned commit: \`$planned_sha\` (the PR's head, merged into \`main\`). [Run log]($run_url)"

if [ "$count" -gt 0 ]; then
  echo
  echo "### Blocking"
  echo
  jq -rs 'sort_by([.rank, .key]) | .[] | "- \(.line)"' "$blocking"
fi

# --- Terraform plan --------------------------------------------------------
if [ "$plan_ran" = true ]; then
  echo
  echo "### Terraform plan"
  for m in "${modules[@]}"; do
    out="$dir/plan/$m"
    echo
    if [ "${plan_ok[$m]}" != true ]; then
      echo "#### infra/$m: ❌ plan failed, see the log"
      continue
    fi
    jq -r --arg m "$m" '"#### infra/\($m): \(.add) to add, \(.change) to change, \(.destroy) to destroy"' "$out/counts.json"
    jq -r "$defs"'
        if length == 0 then empty else
          "", "<details><summary>Changed resources</summary>", "",
          (.[] | "- `\(.address | code)`: \(.action | text)"),
          "", "</details>"
        end' "$out/changes.json"
  done

  # --- IAM Access Analyzer --------------------------------------------------
  # Only of a module that was planned: a failed plan is already shown above.
  if [ "${plan_ok[base]}" = true ] || [ "${plan_ok[demo]}" = true ]; then
    echo
    echo "### IAM Access Analyzer"
  fi
  for m in "${modules[@]}"; do
    [ "${plan_ok[$m]}" = true ] || continue
    out="$dir/plan/$m"
    echo
    jq -rs --arg m "$m" --arg n "$(cat "$out/checked")" --argjson e "$(wc -l < "$out/aa-errors.txt")" "$defs"'
        if length == 0 and $e > 0 then "**infra/\($m):** incomplete, \($e) of \($n) policies could not be validated", ""
        elif length == 0 then "**infra/\($m):** no findings (\($n) policies checked)", ""
        else "**infra/\($m):** \(length) finding(s) (\($n) policies checked)", ""
          , (sort_by(.findingType | rank) | .[]
            | "- \(if aa_blocking then "❌ " + (.findingType | text) + ", blocking" else (.findingType | text) end): `\(.address | code)`: \(.issueCode | text): \(.findingDetails | text)")
        end' "$out/findings.jsonl"
    jq -rR "$defs"'"- ⏳ not checked until applied: `\(. | code)`"' "$out/unchecked.txt"
    jq -rR "$defs"'"- ❌ validation failed, see the log: `\(. | code)`"' "$out/aa-errors.txt"
  done
elif [ "$fork_infra" = true ]; then
  echo
  echo "### Terraform plan and IAM Access Analyzer"
  echo
  echo "Not run: this pull request comes from a fork and changes \`infra/\`, and a fork gets no AWS credentials. The scans still ran."
fi

# --- Trivy config ----------------------------------------------------------
if [ -f "$config_json" ]; then
  echo
  echo "### Trivy config"
  echo
  jq -r '"\(.blocking | length) blocking, \(.listed | length) listed, \(.exceptions | length) accepted exception(s)"' "$config_json"
  jq -r "$defs"'
      if (.listed | length) == 0 then empty else
        "", "<details><summary>Listed findings (MEDIUM and LOW, \(.listed | length))</summary>", "",
        (.listed[] | "- " + config_line),
        "", "</details>"
      end' "$config_json"
  jq -r "$defs"'
      if (.exceptions | length) == 0 then empty else
        "", "**Accepted exceptions** (`# trivy:ignore` in the code, each with its reason):", "",
        (.exceptions[] | "- `\(.id | code)` at `\(.file | code):\(.line)`: \(.reason | text)")
      end' "$config_json"
fi

# --- Trivy image -----------------------------------------------------------
if [ -f "$image_json" ]; then
  echo
  echo "### Trivy image"
  echo
  jq -r '"\(.blocking | length) blocking, \(.waiting | length) waiting for the base image, \(.unfixed | length) unfixed, \(.listed | length) listed"' "$image_json"
  jq -r "$defs"'
      if (.listed | length) == 0 then empty else
        "", "<details><summary>Listed findings (fixed, not blocking, \(.listed | length))</summary>", "",
        (.listed[] | "- " + image_line),
        "", "</details>"
      end' "$image_json"
  jq -r "$defs"'
      if (.waiting | length) == 0 then empty else
        "", "**Fixed in Debian, waiting for the base image** (\(.waiting | by_severity))", "",
        "Debian has published a fix, but the official `node:24-trixie-slim` image does not include it yet. These do not block: no change in this repository can install the fix. Dependabot proposes the new base image once it is published (PH-35 spec, decision 17).",
        "", "<details><summary>\(.waiting | length) finding(s)</summary>", "",
        (.waiting[] | "- " + image_line),
        "", "</details>"
      end' "$image_json"
  jq -r "$defs"'
      if (.unfixed | length) == 0 then empty else
        "", "**Unfixed** (\(.unfixed | by_severity))", "",
        "No fix exists yet. These do not block: they are in the base image'"'"'s operating-system packages, which the app does not use; the container runs as `node`, not root, and exposes only the app'"'"'s port behind the load balancer. When a fix appears, the finding moves to the section above (PH-35 spec, decision 7).",
        "", "<details><summary>\(.unfixed | length) finding(s)</summary>", "",
        (.unfixed[] | "- " + image_line),
        "", "</details>"
      end' "$image_json"
fi
