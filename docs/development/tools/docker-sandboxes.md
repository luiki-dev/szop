# Docker Sandboxes

Docker Sandboxes (`sbx`) runs an AI agent, here Claude Code, in a small virtual machine of its own, with a proxy between it and the network: the agent sees neither the Windows disk nor the owner's credentials, only placeholders the proxy swaps for the real values on the hosts allowed. [PH-48](../../roadmap.md#ph-48-docker-sandbox-proof-of-concept) proved Szop can be worked on that way ([ADR 0075](../../decisions/0075-docker-sandbox-poc-phase-details.md)); [PH-49](../../roadmap.md#ph-49-reproducible-docker-sandbox-setup) builds the sandbox from files in `sandbox/`, so it can be rebuilt in minutes ([ADR 0076](../../decisions/0076-docker-sandbox-setup-phase-details.md)).

## Contents

- [Why Szop uses it](#why-szop-uses-it)
- [Kits and environment files](#kits-and-environment-files)
- [The files in `sandbox/`](#the-files-in-sandbox)
- [The base layer](#the-base-layer)
- [The host's settings](#the-hosts-settings)
- [The network policy](#the-network-policy)
- [The backup hook](#the-backup-hook)
- [Claude's `sbx` calls](#claudes-sbx-calls)
- [Installing and updating `sbx`](#installing-and-updating-sbx)

## Why Szop uses it

- **Claude in isolation:** [ADR 0075](../../decisions/0075-docker-sandbox-poc-phase-details.md). On WSL, Claude Code runs with the owner's rights, next to the owner's files and credentials; in a sandbox, a mistake or a hostile instruction reaches only a virtual machine whose loss is accepted.
- **Rebuilt from source:** [ADR 0076](../../decisions/0076-docker-sandbox-setup-phase-details.md), decisions 4 and 9. `sbx` is at `0.x` and some releases need a new sandbox, so the sandbox is described in files and rebuilt from them, not set up by hand.

## Kits and environment files

`sbx` builds a sandbox from two kinds of source. The format is defined in Docker's [sandbox-kit-spec](https://github.com/docker/sandbox-kit-spec) repository (kit format v3; `sbx` 0.45 or later).

- **A kit** is a YAML descriptor, whose first line `# syntax=docker/sandbox-kit:3` makes `docker buildx` build it, and an optional Dockerfile beside it with the same name. The descriptor lists **capabilities**: typed requests the host answers, such as the network hosts the kit needs (`network-policy@1`) or the commands it runs at create and at every start (`lifecycle@1`). A **workload** kit gives the base system and the agent; **mixins** add to it.
- **An environment file** (`*.sbxenv.yaml`) names the workload and the mixins, the sandbox's size, ports, secrets and host-side lifecycle commands. Several files given to `sbx env` merge in order, later ones winning.

Two rules of the format shape Szop's layers:

- **A mixin's Dockerfile builds an overlay** (`FROM scratch`), laid over a workload it has never seen. apt packages cannot travel in one, since they need the base's package database; they would have to be installed by a `lifecycle@1` install hook at create, as root. The base layer avoids apt altogether: each tool it adds is a self-contained release, downloaded and checked in a build stage and copied into the overlay.
- **A mixin cannot set the start command** (`ENTRYPOINT`, `CMD`); the workload owns it. The environment file's `entrypoint` and `cmd` can replace it.

## The files in `sandbox/`

| File | What it is |
|---|---|
| `sandbox/README.md` | What is in `sandbox/`, and a pointer to the runbook |
| `sandbox/host/settings.sh` | The host's `sbx` settings and global network policy; run by the owner from WSL ([below](#the-hosts-settings)) |
| `sandbox/base/base.yaml` | The base layer's descriptor: a mixin on Docker's Claude Code workload that names nothing of Szop. Its args (`gitName`, `gitEmail`, `configRepo`), the hosts every project needs (GitHub's, the npm registry, `mcp.context7.com`), an install hook that writes the args to `/etc/claude-base.env` and the `claude` alias to `/etc/bash.bashrc`, and the VS Code server's `telemetry.telemetryLevel` `off` ([below](#the-base-layer)) |
| `sandbox/base/base.dockerfile` | The base layer's overlay: Node 24, the AWS CLI and jq as self-contained releases, their versions pinned and Node's and jq's checksums checked; the scripts of `sandbox/base/files/` in `/usr/local/share/claude-base/`, with `claude-setup`, `claude-start` and `check-sandbox` linked in `/usr/local/bin`; `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` and `BRAINSTORM_PORT=61935` |
| `sandbox/base/base.sbxenv.yaml` | The base environment file: the workload `docker/sbx-kit-claude`, its version pinned, the base layer with its args (the machine account's name and noreply address, `luiki-dev/claude-config`), `claude-start` as the entrypoint, port 61935 published, 8 CPUs and `8g` of memory |
| `sandbox/base/files/claude-setup.sh` | `claude-setup`: the one-time setup the owner runs after giving the GitHub token ([below](#the-base-layer)) |
| `sandbox/base/files/claude-start.sh` | `claude-start`: the one way Claude starts, through the entrypoint and the `claude` alias ([below](#the-base-layer)) |
| `sandbox/base/files/settings-fragment.json` | What the base layer adds to Claude's settings: auto mode, the owner's status line, the `Stop` hook that prints the time of each reply, and the backup hook at `SessionStart` and `SessionEnd` |
| `sandbox/base/files/sandbox-notes.md` | What Claude must know in a sandbox (the visual companion's port, the proxy, the placeholders, AWS, the checks), imported into the kit's `CLAUDE.md` |
| `sandbox/base/files/check-sandbox.sh` | `check-sandbox`: the isolation checks, run after a rebuild and after an update of `sbx`; prints each result and exits non-zero naming the checks that failed |
| `sandbox/base/files/strip-transcripts.py` | Copies Claude Code's transcripts with only the fields `scripts/token-usage.py` reads ([below](#the-backup-hook)) |
| `sandbox/base/files/claude-backup.sh` | The backup hook, run at every session's start and end, on WSL and in the sandbox ([below](#the-backup-hook)) |

## The base layer

The base layer gives any project worked on with Claude Code in a sandbox what it needs ([ADR 0076](../../decisions/0076-docker-sandbox-setup-phase-details.md), decision 4, and "Settled while building"). It is set up in two steps, since the machine account's token reaches the sandbox only after it is created (`sbx secret set github --sandbox <name>`):

1. **At create**, the kit builds the overlay, the install hook writes `/etc/claude-base.env` (git's identity and the configuration repository, from the environment file's args) and the `claude` alias, and the VS Code server's settings file is written.
2. **`claude-setup`**, run once by the owner after the token, and safe to run again: sets git's identity and `gh auth setup-git`, clones the configuration repository to `~/claude-config`, copies `user/CLAUDE.md` to `~/.claude/owner-CLAUDE.md`, `user/statusline-command.sh` to `~/.claude/` and `user/aws-config` to `~/.aws/config` (the `claude-readonly` profile only), merges the settings and installs the plugins (`superpowers` and `typescript-lsp` from `claude-plugins-official`, `ponytail` from its marketplace).

**The settings** are merged with `jq` in three layers, later ones winning: the kit's own `~/.claude/settings.json` (kept the first time as `~/.claude/kit-settings.json`, so a second run starts from the same file), then the owner's `user/settings.json` without `hooks`, then `settings-fragment.json` without `hooks`. The fragment's hooks are appended to the kit's, never replacing them; `user/` holds no hooks (decision 11).

**What `user/settings.json` may hold from the base layer.** The backup hook writes back every top-level key that differs from the kit's, whole, so `user/settings.json` can gain keys the owner never set by hand: `permissions.defaultMode` `auto` from the fragment, carried with the owner's `permissions` allow list, and `extraKnownMarketplaces` written by `claude plugin marketplace add`. Both are what the next sandbox would set anyway, so they are kept as written rather than filtered out.

**`claude-start`** is the entrypoint and the `claude` alias: it refuses to start before `claude-setup` has cloned the configuration repository, puts back the two `@` imports at the end of the kit's `CLAUDE.md` (`~/.claude/owner-CLAUDE.md` and `sandbox-notes.md`), since the kit may write that file again, then starts Claude in `$SANDBOX_PROJECT_DIR` in auto mode with `/usr/local/bin` first on the `PATH`. Bypass mode is never used.

**`check-sandbox`** checks: no Windows disk (`/mnt/c`), the host's and the LAN's ports unreachable (`host.docker.internal` and the default gateway), no SSH agent, the GitHub token and the Claude login only placeholders, AWS with only `claude-readonly`, Node 24 on the `PATH` of a login and a non-login shell, and Claude Code's nonessential traffic off. With no Claude login injected the login check passes because there is no credentials file to read, so the Anthropic login is given at `sbx env create`.

## The host's settings

`sandbox/host/settings.sh` runs from WSL and calls `sbx.exe`. It is safe to run again, and it ends by printing `sbx settings ls` and `sbx policy ls`.

| Setting | Value | What it does, and why this value |
|---|---|---|
| `telemetry.disabled` | `true` | Stops `sbx` sending usage data to Docker; nothing in Szop needs it |
| `ssh.agentForwardingEnabled` | `false` | Would let the sandbox use the host's SSH keys through the agent; the sandbox must not reach the owner's keys |
| `model.server.enabled` | `false` | Runs a local model server for sandboxes; nothing uses it, so it is one less service listening |
| `env.rememberHostCommands` | `false` | When `true`, an environment file's host commands are approved once and then run unasked until they change; `false` asks at every run, so a changed file cannot slip a command past the owner |
| `kit.requireSignature` | `false` | When `true`, only signed kits load; Szop's kits are local directories and unsigned, so `true` would refuse them |

## The network policy

`settings.sh` starts the global policy with `sbx policy init balanced` when none exists, then adds deny rules for the telemetry hosts that kept asking in PH-48 and for the cloud metadata service (`169.254.169.254`, `metadata.google.internal`), and removes the groups listed in its `REMOVED_GROUPS` array. A kit's own hosts (its `network-policy@1` capability) are added for its sandbox only.

**Never approve** `localhost`, `host.docker.internal`, a private, link-local or metadata address in the approval queue (`sbx policy approval ls`).

`balanced` allows 195 hosts in six groups, each a rule that `sbx policy rm network --id <group>` removes (read with `sbx policy ls --json`, `sbx` 0.51.0):

| Group | Hosts | What it allows | What Szop needs from it |
|---|---|---|---|
| `default-ai-services` | 23 | Anthropic's API and downloads, and OpenAI, Cursor, Gemini, Perplexity, Factory | Claude Code itself; the other providers are unused |
| `default-package-managers` | 56 | npm, Node.js and NodeSource, PyPI and `astral.sh`, and the registries of Rust, Go, Java, PHP, Ruby, .NET, Dart, Elixir, Perl, Haskell, Swift, Zig; sigstore | npm (pnpm, Claude Code's plugins), Node.js, PyPI and `astral.sh` (`uv`, graphify) |
| `default-code-and-containers` | 34 | GitHub (`github.com`, `**.github.com`, `**.githubusercontent.com`), GitLab, Bitbucket, Docker Hub and other registries (`ghcr.io`, `gcr.io`, `mcr.microsoft.com`, `quay.io`, `public.ecr.aws`), VS Code's downloads | GitHub (`git`, `gh`, release downloads of the tools), Docker Hub (the database and app images), VS Code's server |
| `default-cloud-infrastructure` | 36 | `**.amazonaws.com`, `**.googleapis.com`, Azure, `**.blob.core.windows.net`, HashiCorp, Vercel, Cloudflare, `unpkg.com`, `jsdelivr.net`, Playwright's CDNs, Google's other hosts, Prisma, Supabase, Clerk, Figma | AWS (`claude-readonly`), HashiCorp (Terraform and its providers), Playwright's browsers |
| `default-os-packages` | 16 | Ubuntu, Debian, Arch, Alpine, CentOS, Fedora, LLVM's apt and `packagecloud.io` | Nothing today: the base layer installs no apt package. Kept for a later layer that does (`apt-get` in an install hook) |
| `default-cert-validation` | 30 | Certificate revocation checks (OCSP and CRL) of Let's Encrypt, DigiCert, Sectigo, Google, Amazon, Microsoft, GlobalSign | Every HTTPS client that checks revocation |

Every group holds something Szop uses, and the broad entries (`**.amazonaws.com`, `**.blob.core.windows.net`, `github.com`) are in groups Szop cannot drop, so removing a group narrows little: all six are kept ([ADR 0076](../../decisions/0076-docker-sandbox-setup-phase-details.md), "Settled while building"). Narrowing host by host waits for [OP-144](https://github.com/luiki-dev/szop/issues/430), which collects `sbx policy log` over a whole phase.

## The backup hook

`claude-backup.sh` keeps Claude Code's configuration in a clone of the private configuration repository, `~/claude-config`, on WSL and in the sandbox ([ADR 0076](../../decisions/0076-docker-sandbox-setup-phase-details.md), decisions 5, 10 and 11). It runs as two user hooks: `SessionStart` runs `claude-backup.sh start`, which pulls what the other environment pushed, and `SessionEnd` runs `claude-backup.sh end`, which copies, commits and pushes this environment's part.

| Copied to the clone | Where in the clone | From |
|---|---|---|
| The memory | `memory/` | Nothing is copied: `autoMemoryDirectory` points into the clone |
| The transcripts, stripped by `strip-transcripts.py` | `transcripts/wsl/` or `transcripts/sandbox/` | `~/.claude/projects/` |
| The usage log | `usage-log/wsl.csv` or `usage-log/sandbox.csv` | `~/.claude/usage-log.csv` |
| In the sandbox only: the owner's settings, without the kit's own keys and without `hooks` | `user/settings.json` | `~/.claude/settings.json`, compared with `~/.claude/kit-settings.json` |
| In the sandbox only: the global `CLAUDE.md` and the status line | `user/CLAUDE.md`, `user/statusline-command.sh` | `~/.claude/owner-CLAUDE.md`, `~/.claude/statusline-command.sh` |

**Never copied:** anything not in the table, such as `~/.claude/.credentials.json`, an `.env` file or a whole transcript. The hook copies named paths and stages only `memory`, `transcripts`, `usage-log` and `user`. A stripped transcript keeps, per line, only `type`, `timestamp`, `requestId`, `gitBranch` and the message's `id`, `model` and `usage`, and of a subagent's `.meta.json` only `description`; a line still being written is skipped, and a transcript is copied again only when it changed. On WSL the hook never writes `user/`: the sandbox owns it, and WSL takes it only by the owner's copy after reading the diff.

**It never fails a session.** It always exits 0 and prints at most one line, starting `claude-backup:`. With no network, the line names what did not happen, and the commit stays in the clone until the next run pushes it. If another session's backup holds the lock (`.git/claude-backup.lock`), the second one says so and does nothing.

**A conflict** happens when both environments changed the same lines, in practice the same memory file, since each environment writes its own transcripts and usage log. The hook then keeps both: the remote's `main` stays as it is, this side's commit is pushed to a branch `conflict/<env>-<UTC timestamp>` named in the line it prints, and the clone goes back to `main`. To resolve it, merge the branch in the clone and delete it:

```bash
cd ~/claude-config
git fetch && git merge origin/conflict/wsl-20261113T120000Z   # fix the files git names, then git commit
git push && git push origin --delete conflict/wsl-20261113T120000Z
```

## Claude's `sbx` calls

While Claude runs on WSL, `.claude/settings.json` holds an `ask` rule for every call of `sbx`, `sbx.exe` and its full Windows path (`/mnt/c/Users/<user>/AppData/Local/DockerSandboxes/bin/sbx.exe`), so each call waits for the owner even in auto mode, and `deny` rules for the calls that change a boundary: `policy allow`, `policy approval respond`, `policy deny`, `policy init`, `policy reset`, `create`, `rm`, `env create`, `env rm`, `secret`, `settings set` and `settings unset` ([ADR 0076](../../decisions/0076-docker-sandbox-setup-phase-details.md), decisions 2 and 3). A deny rule matches the words anywhere in the command, so a compound command that contains one, such as `… ; sbx.exe policy rm network --help`, is refused too; reading calls run one per command.

## Installing and updating `sbx`

`sbx` is installed on Windows with winget (`Docker.sbx`). Its release notes are on GitHub, at [docker/sbx-releases](https://github.com/docker/sbx-releases/releases), which `sbx` itself links when an update is available. winget keeps the older versions, so an update can be undone:

```powershell
winget upgrade --id Docker.sbx --exact --source winget              # the update
winget install --id Docker.sbx --exact --version 0.51.0 --force     # back to 0.51.0
```
