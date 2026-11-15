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

# Blocked only when the proxy itself answers 403: a refused connection would also
# fail a plain curl, and would hide an address the policy let through.
unreachable() {
  [[ "$(curl --silent --max-time 5 --output /dev/null --write-out '%{http_code}' "$1")" == 403 ]]
}

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
  [[ "$(grep -E '^\[(profile |default)' "$HOME/.aws/config")" == "[profile claude-readonly]" ]]
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
check "the loader's cache lists libstdc++ (VS Code's server needs it)" bash -c 'ldconfig -p | grep -q libstdc++'
check "bash is the login shell (SSH reads /etc/bash.bashrc)" \
  test "$(awk -F: -v u="$(id -un)" '$1 == u { print $7 }' /etc/passwd)" = /bin/bash
# shellcheck disable=SC2016 # expanded by the inner bash
check "git's pager exists" bash -c 'command -v "$(git var GIT_PAGER)"'
# shortcut: Node reports some names in a canonical form (Etc/UTC as UTC), so
# such a zone fails here; compare canonical names if one is ever used.
# shellcheck disable=SC2016 # expanded by the inner bash
check "the time zone is set, as glibc and Node see it" \
  bash -c 'z="$(cat /etc/timezone)" && test /etc/localtime -ef "/usr/share/zoneinfo/$z" &&
    test "$(node -p "Intl.DateTimeFormat().resolvedOptions().timeZone")" = "$z"'
check "Claude Code's nonessential traffic off" test "${CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:-}" = 1

if ((${#failed[@]})); then
  echo "check-sandbox: ${#failed[@]} failed: $(IFS=';'; echo "${failed[*]}")"
  exit 1
fi
echo "check-sandbox: all passed"
