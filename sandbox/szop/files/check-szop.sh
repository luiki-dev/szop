#!/usr/bin/env bash
# Szop's checks in a sandbox (PH-49, ADR 0076, decision 16), beside
# check-sandbox: the push hook blocks, and `pnpm check` passes. Runs both and
# exits non-zero naming the ones that failed.
set -uo pipefail
cd "${SANDBOX_PROJECT_DIR:?SANDBOX_PROJECT_DIR is not set}" || exit 1

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

# The hook exits 2 to block; any other code, 0 among them, lets the push through.
push_hook_blocks() {
  printf '%s' '{"tool_input":{"command":"git push origin :refs/heads/x"}}' |
    node .claude/hooks/guard-git-push.ts
  [[ $? -eq 2 ]]
}

check "the push hook blocks a branch deletion" push_hook_blocks
check "pnpm check passes" pnpm check

if ((${#failed[@]})); then
  echo "check-szop: ${#failed[@]} failed: $(IFS=';'; echo "${failed[*]}")"
  exit 1
fi
echo "check-szop: all passed"
