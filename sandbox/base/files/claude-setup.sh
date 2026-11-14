#!/usr/bin/env bash
# Sets Claude Code up in a new sandbox from the private configuration repository
# (PH-49, ADR 0076, decisions 5, 11 and 12). Run once by the owner, after the
# machine account's token is given (`sbx secret set github --sandbox <name>`);
# safe to run again. The values come from the kit's args (/etc/claude-base.env).
set -euo pipefail
# shellcheck source=/dev/null
. /etc/claude-base.env

base=/usr/local/share/claude-base
repo="$HOME/claude-config"
claude="$HOME/.claude"
step() { echo "claude-setup: $*"; }

step "git's identity and the proxy's credential helper"
git config --global user.name "$GIT_USER_NAME"
git config --global user.email "$GIT_USER_EMAIL"
gh auth setup-git

if [[ ! -d "$repo/.git" ]]; then
  step "cloning $CLAUDE_CONFIG_REMOTE"
  git clone --quiet "https://github.com/$CLAUDE_CONFIG_REMOTE.git" "$repo"
fi

step "the owner's files from user/"
mkdir -p "$claude" "$HOME/.aws"
cp "$repo/user/CLAUDE.md" "$claude/owner-CLAUDE.md"
cp "$repo/user/statusline-command.sh" "$claude/statusline-command.sh"
if [[ -f "$repo/user/aws-config" ]]; then
  install -m 0600 "$repo/user/aws-config" "$HOME/.aws/config"
fi

step "the settings: the kit's, then the owner's, then the base layer's hooks"
# The kit's own settings are kept once, so a second run merges from the same
# start, and the backup hook can tell the owner's keys from the kit's.
[[ -f "$claude/kit-settings.json" ]] || cp "$claude/settings.json" "$claude/kit-settings.json"
jq -s '
  .[0] as $kit | .[1] as $owner | .[2] as $base
  | ($kit * ($owner | del(.hooks)) * ($base | del(.hooks)))
  | .hooks = reduce ($base.hooks | to_entries[]) as $e
      ($kit.hooks // {}; .[$e.key] = (.[$e.key] // []) + $e.value)
' "$claude/kit-settings.json" "$repo/user/settings.json" "$base/settings-fragment.json" \
  >"$claude/settings.json.new"
mv "$claude/settings.json.new" "$claude/settings.json"

step "the plugins"
add_marketplace() {
  claude plugin marketplace list 2>/dev/null | grep -q "$1" ||
    claude plugin marketplace add "$2"
}
add_marketplace claude-plugins-official anthropics/claude-plugins-official
add_marketplace ponytail DietrichGebert/ponytail
for p in superpowers@claude-plugins-official typescript-lsp@claude-plugins-official ponytail@ponytail; do
  claude plugin install "$p"
done

# A project's layer adds its own setup here (Szop's clones its repository):
# run last, with the token, the network and Docker all there.
for hook in /usr/local/share/claude-setup.d/*.sh; do
  [[ -e "$hook" ]] || continue
  step "running $(basename "$hook")"
  bash "$hook"
done

step "done; start Claude with: claude"
