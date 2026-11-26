# ADR 0080 — The sandbox's plugins, size, hosts and tools

- **Status:** ✅ Accepted
- **Date:** 2026-11-24
- **Refines:** [ADR 0076](0076-docker-sandbox-setup-phase-details.md), decision 8 (three hosts added, see decision 3), decision 11 (`user/` also says which plugins a new sandbox installs, see decision 1)
- **Revisits:** [ADR 0076](0076-docker-sandbox-setup-phase-details.md), "Settled while building" (the size of 8 CPUs and `8g`, not raised, see decision 2)

## Context

After two weeks of work in the Docker Sandbox (`sbx`), the owner asked for five changes to a new sandbox's setup: the plugin `modern-web-guidance` (Google Chrome's guidance on current web practice) installed at the start, more CPUs and memory, the Terraform registry and Szop's demo address allowed, Mailpit's web UI published, and lazydocker (a terminal UI for Docker) in the image.

`claude-setup` installed three plugins from a list of its own: `superpowers`, `typescript-lsp` and `ponytail`. Meanwhile the owner's `user/settings.json` in the configuration repository, which the backup keeps, already declared the marketplaces (`extraKnownMarketplaces`) and the plugins turned on (`enabledPlugins`) of the sandbox the owner works in, `modern-web-guidance` among them; the two lists had drifted apart. The owner's goal is to get back the environment they ended with, more than to review each change to it.

## Decisions

| # | Decision | Options considered | Outcome |
|---|---|---|---|
| 1 | Where the plugins to install come from | A list in `claude-setup.sh`, as before; a file of its own beside it (`plugins.json`); the merged settings | **The merged settings:** `claude-setup` adds every GitHub marketplace of `extraKnownMarketplaces` not yet known and installs every plugin `enabledPlugins` sets to `true`. The script names no plugin; the list is the owner's `user/settings.json`, in Claude Code's own format, kept by the backup, so a new sandbox gets the plugins the last one ended with. A marketplace of another source type is skipped with a message (none is used today). A file of its own would be a third list to drift; YAML would need `yq`, which the image lacks, while `jq` is there. A plugin now reaches a new sandbox without a PR in Szop, which the owner accepts: the configuration repository is part of the setup anyway. Claude's recommendation; the owner chose it. |
| 2 | The sandbox's size | 8 CPUs and `8g`, as proven in PH-49; 12 CPUs and `12g` | **12 CPUs and `12g`** in `base.sbxenv.yaml`. Stryker's mutation runs brought the sandbox down several times at 8 and `8g`. The runbook's test sandbox takes the same, so `szop` is still stopped before it starts. The owner's choice. |
| 3 | Hosts allowed | — | **`registry.terraform.io` and `releases.hashicorp.com` on 443, `szop.dzwoniec.com` on 443 and 80, in Szop's layer** (`szop.yaml`), since Terraform and the demo are Szop's. `terraform init` asks the registry, which sends the providers' downloads to `releases.hashicorp.com`. The demo's address was needed for checks against the demo (the owner hit the block once). The owner asked for the hosts; Claude added `releases.hashicorp.com`. |
| 4 | Mailpit's web UI | Published by hand with `sbx ports`, as before; in the environment file | **Port 8025 in `szop.sbxenv.yaml`,** beside the dev server's and the production-like environment's. `compose.sandbox.yaml` already publishes it on `0.0.0.0`. The owner's choice. |
| 5 | lazydocker | — | **lazydocker 0.25.2 in the base layer,** a release with its checksum checked for amd64 and arm64, as jq. Docker is in every sandbox, so the tool names nothing of Szop. ADR 0076, decision 4, foresaw it as a line in a layer's Dockerfile. The owner's choice. |

## Consequences

- The base kit moves to 0.8.0 and Szop's to 0.3.0; the changes reach a sandbox at its next rebuild.
- Removing a plugin from the sandbox (`claude plugin uninstall`, or `false` in `enabledPlugins`) keeps it out of the next one, once the backup has pushed the settings.
- `claude-setup` also installs the plugin `chrome-devtools-mcp` when the owner's settings turn it on, beside the Chrome DevTools MCP server that `szop-setup.sh` adds.
- A marketplace or plugin that fails is reported and skipped, so the project's setup still runs.
- The new hosts and the plugin step were checked in a sandbox that already had them; a rebuild is their real test: `claude plugin list` lists every plugin `enabledPlugins` turns on.
