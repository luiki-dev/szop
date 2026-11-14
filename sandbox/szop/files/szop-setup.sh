#!/usr/bin/env bash
# Szop's part of claude-setup (PH-49, ADR 0076): the clone, its dependencies,
# the database, the browsers, the graph and Chrome DevTools MCP, so the first
# `pnpm check` passes. Run by claude-setup from /usr/local/share/claude-setup.d;
# safe to run again.
set -euo pipefail
repo="${SANDBOX_PROJECT_DIR:?SANDBOX_PROJECT_DIR is not set}"

[[ -d "$repo/.git" ]] || git clone --quiet https://github.com/luiki-dev/szop.git "$repo"
cd "$repo"
pnpm install --frozen-lockfile
[[ -f apps/api/.env ]] || cp apps/api/.env.example apps/api/.env
# restart: unless-stopped brings the database back with the sandbox's Docker.
pnpm db:up
# --with-deps installs the browsers' libraries with apt, through sudo.
pnpm --filter @szop/e2e exec playwright install --with-deps chromium firefox
# graphify-out/ is ignored by git, so a clone has no graph until this builds it.
graphify update .

# Chrome DevTools MCP in the VM, on Playwright's Chromium (none in the workload).
chromium=$(find "$HOME/.cache/ms-playwright" -path '*/chromium-*/chrome-linux*/chrome' -type f | sort -V | tail -1)
[[ -n "$chromium" ]] || { echo "szop-setup: Playwright's Chromium not found" >&2; exit 1; }
claude mcp remove chrome-devtools --scope local >/dev/null 2>&1 || true
claude mcp add chrome-devtools --scope local -- \
  npx -y chrome-devtools-mcp@1.12.0 --headless --isolated --executablePath "$chromium"
