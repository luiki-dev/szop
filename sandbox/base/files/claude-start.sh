#!/usr/bin/env bash
# The one way Claude starts in the sandbox (PH-49, ADR 0076): the environment
# file's entrypoint and the `claude` alias both run it. In the project, so its
# settings and hooks load; in auto mode, never bypass; with node on the PATH,
# or the push hook lets everything through.
set -euo pipefail
export PATH="/usr/local/bin:$PATH"
claude="$HOME/.claude"

if [[ ! -d "$HOME/claude-config/.git" ]]; then
  echo "claude-start: run claude-setup first (the configuration repository is not cloned)" >&2
  exit 1
fi

# The kit may write its CLAUDE.md again, so the imports are put back at every start.
for import in "@~/.claude/owner-CLAUDE.md" "@/usr/local/share/claude-base/sandbox-notes.md"; do
  grep -qxF "$import" "$claude/CLAUDE.md" 2>/dev/null || printf '\n%s\n' "$import" >>"$claude/CLAUDE.md"
done

cd "${SANDBOX_PROJECT_DIR:-$HOME/workspace}"
exec claude --permission-mode auto "$@"
