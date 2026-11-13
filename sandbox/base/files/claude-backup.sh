#!/usr/bin/env bash
# Backs up Claude Code's configuration to a clone of the private configuration
# repository (PH-49, ADR 0076, decisions 5, 10 and 11). Wired as user hooks:
# SessionStart runs `start`, SessionEnd runs `end`.
#
#   claude-backup.sh start   pull what the other environment pushed
#   claude-backup.sh end     copy, commit and push this environment's part
#
# `end` copies only named paths: the stripped transcripts, the usage log and, in
# the sandbox only, user/ (the owner's settings without the kit's, the global
# CLAUDE.md and the status line). The memory is already in the clone
# (autoMemoryDirectory). It never fails a session: it exits 0 and prints at most
# one line, `claude-backup: …`. A conflict leaves this side's commit on a branch
# conflict/<env>-<UTC timestamp> and the clone on the remote's main.
#
#   CLAUDE_CONFIG_REPO   the clone (default ~/claude-config)
#   CLAUDE_BACKUP_ENV    wsl (default) or sandbox
#   CLAUDE_KIT_SETTINGS  the kit's own settings.json, saved at creation
#                        (default ~/.claude/kit-settings.json)
set -uo pipefail

repo="${CLAUDE_CONFIG_REPO:-$HOME/claude-config}"
env_name="${CLAUDE_BACKUP_ENV:-wsl}"
kit_settings="${CLAUDE_KIT_SETTINGS:-$HOME/.claude/kit-settings.json}"
claude="$HOME/.claude"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

fail() {
  echo "claude-backup: $1 did not happen: $2"
  exit 0
}

# Runs git in the clone; on failure, fails with git's first line of output.
g() {
  local out
  out="$(git -C "$repo" "$@" 2>&1)" || fail "git $1" "$(head -n 1 <<<"$out")"
}

sync() {
  local out
  if ! out="$(git -C "$repo" pull --rebase --quiet 2>&1)"; then
    if [[ ! -d "$repo/.git/rebase-merge" && ! -d "$repo/.git/rebase-apply" ]]; then
      fail "the pull" "$(head -n 1 <<<"$out")"
    fi
    local branch="conflict/$env_name-$stamp"
    g rebase --abort
    g push --quiet origin "HEAD:refs/heads/$branch"
    g reset --quiet --hard origin/main
    echo "claude-backup: a conflict with the other environment; this side's version is on $branch"
    exit 0
  fi
  if [[ -n "$(git -C "$repo" rev-list '@{upstream}..HEAD' 2>/dev/null)" ]]; then
    g push --quiet
  fi
}

copy_user() {
  mkdir -p "$repo/user" || fail "the copy of user/" "cannot create it"
  local kit='{}'
  [[ -f "$kit_settings" ]] && kit="$(cat "$kit_settings")"
  jq --argjson kit "$kit" \
    'with_entries(select(.key != "hooks" and .value != $kit[.key]))' \
    "$claude/settings.json" >"$repo/user/settings.json" ||
    fail "the copy of user/settings.json" "jq failed"
  [[ -f "$claude/owner-CLAUDE.md" ]] && cp "$claude/owner-CLAUDE.md" "$repo/user/CLAUDE.md"
  [[ -f "$claude/statusline-command.sh" ]] && cp "$claude/statusline-command.sh" "$repo/user/"
}

end() {
  python3 "$(dirname "$0")/strip-transcripts.py" "$claude/projects" "$repo/transcripts/$env_name" ||
    fail "the copy of the transcripts" "strip-transcripts.py failed"
  if [[ -f "$claude/usage-log.csv" ]]; then
    { mkdir -p "$repo/usage-log" && cp "$claude/usage-log.csv" "$repo/usage-log/$env_name.csv"; } ||
      fail "the copy of the usage log" "cp failed"
  fi
  [[ "$env_name" == sandbox ]] && copy_user

  local paths=() p
  for p in memory transcripts usage-log user; do
    [[ -e "$repo/$p" ]] && paths+=("$p")
  done
  ((${#paths[@]})) && g add -A -- "${paths[@]}"
  if ! git -C "$repo" diff --cached --quiet; then
    g commit --quiet -m "backup($env_name): $stamp"
  fi
}

[[ -d "$repo/.git" ]] || fail "the backup" "no clone at $repo"
exec 9>"$repo/.git/claude-backup.lock"
flock -n 9 || {
  echo "claude-backup: a backup is already running; this one is skipped"
  exit 0
}

case "${1:-}" in
  start) ;;
  end) end ;;
  *) fail "the backup" "usage: claude-backup.sh start|end" ;;
esac
sync
