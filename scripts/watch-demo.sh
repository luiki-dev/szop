#!/usr/bin/env bash
# Asks /api/health once a second and prints what answered: the time, the HTTP
# status (000 for no answer), the commit and the schema version. Run it during
# a demo-up redeploy to see that the demo keeps answering and the moment the new
# commit takes over (PH-12d). Ctrl+C prints a summary and stops.
#
#   scripts/watch-demo.sh [url]      default: https://szop.dzwoniec.com/api/health
#
# Bash and curl only; it needs no AWS credentials. How to use it in a redeploy:
# docs/operations/demo-environment.md, "Watching a redeploy".
set -euo pipefail

url="${1:-https://szop.dzwoniec.com/api/health}"

requests=0
failures=0
last_commit=""
commits=() # every commit seen, in the order first seen
first=()   # the time each was first seen
last=()    # the time each was last seen

summary() {
  echo
  echo "Requests: $requests, not 200: $failures"
  local i
  for i in "${!commits[@]}"; do
    echo "Commit ${commits[$i]:0:12}: first seen ${first[$i]}, last seen ${last[$i]}"
  done
  exit 0
}
trap summary INT

while true; do
  now=$(date +%T)
  # On a failed request curl still writes the status, 000; the || keeps
  # "set -e" from stopping the script.
  response=$(curl --silent --max-time 2 --write-out '\n%{http_code}' "$url") || true
  status=${response##*$'\n'}
  body=${response%$'\n'*}
  [[ $status =~ ^[0-9]{3}$ ]] || status=000

  commit=""
  schema="-"
  [[ $body =~ \"commit\":\"([^\"]*)\" ]] && commit=${BASH_REMATCH[1]}
  [[ $body =~ \"schemaVersion\":\"([^\"]*)\" ]] && schema=${BASH_REMATCH[1]}

  note=""
  short="-"
  if [[ -n $commit ]]; then
    short=${commit:0:12}
    if [[ -n $last_commit && $commit != "$last_commit" ]]; then note="  <- new commit"; fi
    last_commit=$commit
    found=-1
    for i in "${!commits[@]}"; do
      if [[ ${commits[$i]} == "$commit" ]]; then found=$i; fi
    done
    if ((found < 0)); then
      commits+=("$commit")
      first+=("$now")
      last+=("$now")
    else
      last[found]=$now
    fi
  fi

  requests=$((requests + 1))
  if [[ $status != 200 ]]; then failures=$((failures + 1)); fi

  echo "$now  $status  $short  $schema$note"
  sleep 1
done
