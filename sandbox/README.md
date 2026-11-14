# sandbox

The Docker Sandbox Claude Code works on Szop in, described in files so it can be rebuilt ([ADR 0076](../docs/decisions/0076-docker-sandbox-setup-phase-details.md)).

- `base/`: the generic layer, a mixin on Docker's Claude Code workload that names nothing of Szop, and its environment file.
- `szop/`: Szop's layer, laid over the base one: the tools of `pnpm check:*`, the repository's setup and `check-szop`, and its environment file. `compose.sandbox.yaml`, at the repository's root, publishes the production-like environment for `sbx ports`.
- `host/settings.sh`: the host's `sbx` settings and network policy, run by the owner from WSL.

What each file does and why: [Docker Sandboxes](../docs/development/tools/docker-sandboxes.md). How to rebuild, update and go back to WSL: the runbook, `docs/operations/docker-sandbox.md`.
