#!/usr/bin/env bash
# The isolation checks of PH-48 that hold inside a sandbox (PH-49, ADR 0076,
# decision 16): run after a rebuild and after an update of sbx. Runs every
# check, prints each result, and exits non-zero naming the checks that failed.
set -uo pipefail

failed=()
check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "ok    $name"
  else
    echo "FAIL  $name"
    failed+=("$name")
  fi
}

# The proxy answers a blocked request with 403, so --fail turns it into an error.
unreachable() { ! curl --fail --silent --max-time 5 --output /dev/null "$1"; }

# The default route's gateway, from the kernel's table (little-endian hex).
gateway() {
  awk '$2 == "00000000" { print $3; exit }' /proc/net/route |
    sed -E 's/(..)(..)(..)(..)/0x\4 0x\3 0x\2 0x\1/' |
    xargs printf '%d.%d.%d.%d'
}

placeholder() { [[ "$1" == *proxy-managed* || "$1" == *sbxproxymanaged* ]]; }
anthropic_placeholder() {
  local f="$HOME/.claude/.credentials.json"
  [[ ! -f "$f" ]] || placeholder "$(jq -r '.claudeAiOauth.accessToken // ""' "$f")"
}
only_readonly_profile() {
  [[ "$(grep -E '^\[profile ' "$HOME/.aws/config")" == "[profile claude-readonly]" ]]
}

check "no Windows disk (/mnt/c absent)" test ! -e /mnt/c
check "the host's ports blocked (host.docker.internal)" unreachable http://host.docker.internal/
check "the LAN's ports blocked (the default gateway)" unreachable "http://$(gateway)/"
check "no SSH agent (SSH_AUTH_SOCK unset)" test -z "${SSH_AUTH_SOCK:-}"
check "the GitHub token is a placeholder" placeholder "$(gh auth token 2>/dev/null)"
check "the Claude login is a placeholder" anthropic_placeholder
check "AWS has only the claude-readonly profile" only_readonly_profile
check "node on the PATH of a login shell" bash -lc 'node --version | grep -q ^v24'
check "node on the PATH of a non-login shell" bash -c 'node --version | grep -q ^v24'
check "Claude Code's nonessential traffic off" test "${CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:-}" = 1

if ((${#failed[@]})); then
  echo "check-sandbox: ${#failed[@]} failed: $(IFS=';'; echo "${failed[*]}")"
  exit 1
fi
echo "check-sandbox: all passed"
