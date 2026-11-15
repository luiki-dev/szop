# PH-49 Reproducible Docker Sandbox setup: design

## Contents

- [Goal](#goal)
- [Decisions](#decisions)
- [The design](#the-design)
  - [Who runs what](#who-runs-what)
  - [The layout](#the-layout)
  - [The base layer](#the-base-layer)
  - [Szop's layer](#szops-layer)
  - [Starting a sandbox](#starting-a-sandbox)
  - [Working in the sandbox](#working-in-the-sandbox)
  - [The host's settings and the network policy](#the-hosts-settings-and-the-network-policy)
  - [The machine account](#the-machine-account)
  - [The configuration repository](#the-configuration-repository)
  - [The backup hook](#the-backup-hook)
  - [Moving WSL's memory](#moving-wsls-memory)
  - [Going back to WSL](#going-back-to-wsl)
  - [`token-usage.py`](#token-usagepy)
  - [Claude's `sbx` calls](#claudes-sbx-calls)
  - [The kits in CI](#the-kits-in-ci)
  - [Updating `sbx`](#updating-sbx)
  - [The rebuild](#the-rebuild)
- [Acceptance criteria](#acceptance-criteria)
- [Tests](#tests)
- [Documentation](#documentation)
- [Demo check](#demo-check)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

After a lost sandbox or a lost machine, the owner rebuilds the whole working environment in a Docker Sandbox from what is in the repositories and a few logins, with Claude's memory and the statistics of past sessions intact ([PH-49](../../roadmap.md#ph-49-reproducible-docker-sandbox-setup)).

## Decisions

[ADR 0076](../../decisions/0076-docker-sandbox-setup-phase-details.md#decisions).

## The design

Everything the [proof of concept's record](../../audits/2026-11-08-docker-sandbox-poc.md#task-6-the-decision) lists under "What the setup phase must bring" is built here, unless [Out of scope](#out-of-scope) says otherwise. The sections below say where each item lives; the record holds the reasons found in PH-48.

### Who runs what

Decisions 2, 3 and 13. After this phase Claude works only in the sandbox; WSL keeps its setup as the fallback and the way back, and Claude is not started there. While the phase is built, Claude runs on WSL, and every task of the plan names who runs each `sbx` command in it.

| Who | What |
|---|---|
| **Claude, from WSL** | Writes everything in `sandbox/`, the hook and the scripts; runs `sbx.exe` only to read (`ls`, `policy ls`, `policy log`) and `sbx.exe exec` of a script committed on the branch, each call approved through the `ask` rule |
| **The owner** | Creates and removes sandboxes; runs the host settings script and decides the network policy's groups; creates the machine account's settings and the configuration repository; every login; the final rebuild; reading the lost machine runbook |

### The layout

```text
sandbox/
├── README.md                 # what is here, and a pointer to the runbook
├── base/                     # names nothing of Szop (decision 4)
│   ├── base.yaml             # mixin descriptor (# syntax=docker/sandbox-kit:3)
│   ├── base.dockerfile
│   ├── base.sbxenv.yaml
│   └── files/ …              # generic defaults, the hook, the strip script, the check script
├── szop/
│   ├── szop.yaml
│   ├── szop.dockerfile
│   ├── szop.sbxenv.yaml
│   └── files/ …
└── host/
    └── settings.sh           # the host's sbx settings and network policy, run by the owner
```

Each layer is a v3 mixin on Docker's Claude Code workload (`docker.io/docker/sbx-kit-claude`, its version pinned). The two environment files are passed in order, `base` first, so Szop's file adds to the base and overrides it where both set a value. **Nothing personal goes in `sandbox/`** (decision 12): the owner's user `settings.json`, global `CLAUDE.md` and memory come from the configuration repository at creation.

**A tool added later**, such as lazydocker for the sandbox's Docker engine, is a line in the right layer's Dockerfile, through a PR; the next rebuild has it. A tool tried by hand in a sandbox in the meantime is lost with it unless it reaches the Dockerfile.

### The base layer

What any project worked on with Claude Code in a sandbox needs:

- **Node 24 for the whole system**, not through nvm, on the `PATH` of every process that can start Claude, so the hooks always find `node` (the kit's `NPM_CONFIG_PREFIX` stops nvm). Without `node` the push hook lets everything through.
- **A pager** (`less`) and git's identity: the machine account's `user.name` and its noreply `user.email` ([The machine account](#the-machine-account)).
- **Claude Code's setup:** the kit's own `~/.claude/settings.json` and `~/.claude/CLAUDE.md` kept (the record found the kit's `CLAUDE.md` is about 20 KB and holds the sandbox's own guidance); the owner's global `CLAUDE.md` copied from the configuration repository's `user/` and imported by one `@` line appended to the kit's; the owner's settings from `user/settings.json` merged in (the status line, plugins, `autoMode`, models), the kit's status line command replaced by `statusline-command.sh`; the plugins installed with `claude plugin install` (`superpowers` and `typescript-lsp` from `claude-plugins-official`, `ponytail` from its marketplace).
- **Telemetry off at the source:** `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` in the sandbox's environment and `telemetry.telemetryLevel` `off` in the VS Code server's settings (decision 8).
- **AWS:** `~/.aws/config` with the `claude-readonly` profile only; the owner signs in with `aws sso login --profile claude-readonly` after creation. Its credentials enter the sandbox, which is acceptable for a read-only role ([ADR 0075](../../decisions/0075-docker-sandbox-poc-phase-details.md), decision 7).
- **GitHub:** `gh` and git use the machine account's token, which the owner gives `sbx` at each creation with `sbx secret set github --sandbox <name>`, scoped to that sandbox, as in PH-48; the proxy injects it and the sandbox sees only a placeholder. The token is kept in the owner's password manager, nowhere on disk. `gh auth setup-git` makes `git push` go through the proxy. The owner's token never enters a sandbox.
- **The backup hook, the strip script and the check script** ([The backup hook](#the-backup-hook), [Updating `sbx`](#updating-sbx)), and the configuration repository cloned to `~/claude-config` at creation.
- **The network hosts every project needs** in the descriptor's `network-policy` capability: Anthropic's, GitHub's, the npm registry, the plugins' marketplaces, `mcp.context7.com`.
- **The sandbox's size:** `sandboxOptions.cpus` and `memory` set, starting at 8 CPUs and `8g` _(Claude's call)_, instead of all 16 CPUs and half the memory (15 GiB) that PH-48's checks passed with; raised if the end-to-end journeys or the production-like environment need it.

### Szop's layer

- **The tools of `pnpm check:*`:** `actionlint`, `zizmor`, `uv`, `terraform`, `tflint`, `trivy`, the versions those of [`setup.md`](../../development/setup.md); pnpm through Corepack at the version `package.json` names; `graphify`, so the project's graphify rule applies in the sandbox too.
- **Playwright's browsers**, with `playwright.download.prss.microsoft.com` among the layer's hosts.
- **The repository:** `git clone` of `luiki-dev/szop` into `~/workspace/szop` at creation, no mount ([ADR 0075](../../decisions/0075-docker-sandbox-poc-phase-details.md), decision 4); then `pnpm install`, `apps/api/.env` from its example and the database up, so the first `pnpm check` passes.
- **Reaching Szop from Windows:** the dev server started with `--host 0.0.0.0`, and for the production-like environment a Compose override used only in the sandbox (`compose.sandbox.yaml`) that publishes on `0.0.0.0`, with `compose.yaml` unchanged; the ports in `szop.sbxenv.yaml`.
- **Szop's hosts** in the descriptor's `network-policy` capability.

### Starting a sandbox

From Szop's `main` on the host, with the environment files outside any sandbox (the environment files' rule; decisions 6 and 14). The copy is the existing WSL checkout, `~/workspace/szop`, kept on `main` and updated by the owner with `git pull` after a merge; no work is done in it (decision 13). `sbx.exe` gets its paths through `wslpath -w` (`\\wsl.localhost\…`). If `sbx.exe` cannot read such a path, the copy is a clone on the Windows disk instead; the first `sbx` task checks it.

```bash
sbx env create sandbox/base/base.sbxenv.yaml sandbox/szop/szop.sbxenv.yaml
sbx env run   sandbox/base/base.sbxenv.yaml sandbox/szop/szop.sbxenv.yaml
```

**The safe start is the default one.** PH-48 found that Claude started by `sbx run` loaded neither the project's settings nor the hooks, and ignored auto mode, while Claude started by hand in the repository loaded them all. Here the workload's start command (`entrypoint` and `cmd`) starts Claude in `~/workspace/szop`, in auto mode, with `node` on its `PATH`, so the user settings and their hooks (the backup), the project's settings and hooks, and `autoMemoryDirectory` all load. A `claude` typed in the sandbox's shell does the same, through an alias. Bypass mode (`--dangerously-skip-permissions`) is never the default.

The host's copy is of `main`, never of a branch: a branch written in a sandbox and not yet reviewed could change what the environment files run on the host. While this phase is built, the checkout is on its branch, written on WSL.

### Working in the sandbox

Decision 15. The owner works in the sandbox through VS Code's Remote-SSH, as in PH-48:

- On Windows: the OpenSSH client and VS Code's Remote-SSH extension.
- `sbx setup ssh` adds the sandbox's host (`<name>.sbx`) to `~/.ssh/config` through an `Include` line. In PH-48 it wrote both paths in one pair of quotes and OpenSSH skipped it, so the runbook says to check the line, and fix it by hand, after every `sbx setup ssh`.
- In VS Code's user settings: `remote.downloadExtensionsLocally` `true`, so extensions are downloaded on Windows and the sandbox needs no host for VS Code; the server's `telemetry.telemetryLevel` `off` comes from the base layer.
- VS Code opens `~/workspace/szop` in the sandbox, and Claude runs in its terminal.

Work not pushed from a sandbox is lost with it, so every branch is pushed before any step that could break the sandbox, an update of `sbx` among them.

### The host's settings and the network policy

`sandbox/host/settings.sh`, run by the owner from WSL (it calls `sbx.exe`). Each setting with what it does (decision 8):

| Setting | Value | What it does, and why this value |
|---|---|---|
| `telemetry.disabled` | `true` | Stops `sbx` sending usage data to Docker; nothing in Szop needs it |
| `ssh.agentForwardingEnabled` | `false` | Would let the sandbox use the host's SSH keys through the agent; the sandbox must not reach the owner's keys |
| `model.server.enabled` | `false` | Runs a local model server for sandboxes; nothing uses it, so it is one less service listening |
| `env.rememberHostCommands` | `false` | When `true`, an environment file's host commands are approved once and then run unasked until they change; `false` asks at every run, so a changed file cannot slip a command past the owner |
| `kit.requireSignature` | `false` | When `true`, only signed kits load; Szop's kits are local directories and unsigned, so `true` would refuse them |
| network policy | `balanced`, groups reviewed | `sbx policy init balanced`, then the owner keeps or removes each of its six groups, listed by the plan's task with what each allows |

Telemetry hosts that still try to connect get an explicit deny rule. Narrowing the policy further waits for [OP-144](https://github.com/luiki-dev/szop/issues/430), which collects `sbx policy log` over a whole phase. The rule of PH-48 stays: never approve `localhost`, `host.docker.internal` or a private address in the approval queue.

The script is safe to run again, and it prints the settings it ends with.

### The machine account

[OP-143](https://github.com/luiki-dev/szop/issues/428), settled on a test repository in PH-48, applied to Szop's here by the owner: the account as a collaborator with write access on `luiki-dev/szop` and on the configuration repository; its classic token with `repo`, `project`, `workflow` and `read:org`; the `main` ruleset requiring the owner's approval, so the account cannot merge; the `demo` environment's reviewer stays the owner. Its reach to `szop-ci-plan` through a workflow in a PR is accepted (decision 7) and recorded in the threat model. [`github-settings.md`](../../development/github-settings.md) records every setting.

### The configuration repository

A private repository, `luiki-dev/claude-config` _(the name is Claude's call)_, created by the owner, with the machine account as a collaborator:

```text
memory/szop/             # autoMemoryDirectory of Szop, from every environment
transcripts/wsl/         # stripped copies, in Claude Code's own layout
transcripts/sandbox/
usage-log/wsl.csv        # ~/.claude/usage-log.csv of each environment
usage-log/sandbox.csv
user/settings.json       # the owner's user settings, the global CLAUDE.md, the status line: written by the sandbox, seeded once from WSL
user/CLAUDE.md
user/statusline-command.sh
```

It holds no credential: `~/.claude/.credentials.json`, tokens and `.env` files never enter it.

**Which way trust flows** (decision 11):

| From → to | What | How |
|---|---|---|
| sandbox → repository | memory, transcripts, usage log, `user/` | the hook; the sandbox is where the configuration changes, so it owns `user/` |
| WSL → repository | memory, transcripts, usage log | the hook; never `user/`, so a session on WSL cannot put an older version back |
| repository → sandbox | memory, `user/` | at creation; memory at every session start |
| repository → WSL | memory | at every session start |
| repository → WSL | `user/` | only by the owner, after reading the diff ([Going back to WSL](#going-back-to-wsl)) |

A compromised sandbox can change `user/`, and the next sandbox takes it, so a planted setting or hook survives a rebuild, inside the VM. The repository's history shows every change, and the project's deny rules and push hook stay in Szop behind review; the threat model records it.

Hook scripts never come from the repository: in the sandbox the kit installs them, on WSL they are copied once from `sandbox/base/files/` into `~/.claude/hooks/` by the owner.

`autoMemoryDirectory` is set in Szop's committed `.claude/settings.json` to `~/claude-config/memory/szop`, the same path in every environment: Claude Code expands `~`, as its own example of the setting shows ([Memory](https://code.claude.com/docs/en/memory)).

### The backup hook

User-level hooks, the same script on WSL and in the sandbox:

- **`SessionStart`:** `git pull --rebase` in `~/claude-config`, so a session sees memory written in the other environment.
- **`SessionEnd`:** the strip script writes the stripped transcripts of this environment, the usage log is copied, in the sandbox only `user/` is refreshed (the owner's part of the settings, not the kit's); then commit and push.

A failure (no network, a conflict) never blocks or ends a session: the hook prints one line saying the backup did not happen and why, and the next run tries again. No memory file is ever lost to a conflict: memory is one fact per file, so a conflict keeps both versions for the owner to resolve. `MEMORY.md`, the index, is the likely place for one.

**The strip script** (Python, as `token-usage.py`) copies each transcript `.jsonl` keeping only the fields `token-usage.py` reads (its `load_calls`): `type`, `timestamp`, `requestId`, `gitBranch`, `message.id`, `message.model` and the whole `message.usage` object; and the subagents' `.meta.json` `description`. Folders and file names stay as Claude Code writes them, under the environment's folder (`transcripts/wsl/-home-lemekk-workspace-szop/…`), and the session comes from the file's path, so `token-usage.py --projects` reads the copy as it reads the original. If `token-usage.py` starts reading another field, the strip script keeps it too; the test below catches a field missed. Every other field, the content of every message and tool result among them, is dropped. It rewrites a copy only when its source changed. Its first run on WSL takes the whole history since 2026-09-27.

### Moving WSL's memory

The one change to WSL (the condition of PH-48's GO). In order: copy `~/.claude/projects/-home-lemekk-workspace-szop/memory/` into the clone's `memory/szop/`, and WSL's user settings, global `CLAUDE.md` and status line into `user/`, which seeds the first sandbox, and push; the setting lands; a new session on WSL shows the memory loaded from the new place; the old folder stays until the owner says it can go.

### Going back to WSL

Decision 13: when `sbx` breaks, or the sandbox is given up, work moves back to WSL with the sandbox's last state, all through the configuration repository after the sandbox's last session has pushed it:

- **Memory:** by itself, at the first session's start.
- **Settings, global `CLAUDE.md`, status line:** the owner reads the diff of `user/` against `~/.claude/`, then copies it.
- **Usage log and statistics:** `usage-log/sandbox.csv` and `transcripts/sandbox/` are read by `token-usage.py --projects ~/claude-config/transcripts`.
- **Sessions:** a sandbox's session cannot be resumed on WSL; only the stripped copy of its transcript is there (decision 10). The work itself goes on from the pushed branches and the handoff files.

The runbook holds these steps.

### `token-usage.py`

Its default `--projects` comes from the current repository's root, encoded as Claude Code names its folders (`/home/lemekk/workspace/szop` → `-home-lemekk-workspace-szop`), instead of the WSL path written in it, so it works in the sandbox unchanged. For statistics of both environments, `--projects ~/claude-config/transcripts` reads all the stripped copies. It stays in Szop ([OP-146](https://github.com/luiki-dev/szop/issues/437)).

### Claude's `sbx` calls

Needed while Claude runs on WSL, this phase's build; Claude in the sandbox cannot reach `sbx.exe`. In `.claude/settings.json`: an `ask` rule for every call of `sbx.exe`, by its name and its full Windows path, and `deny` rules for `sbx.exe policy allow`, `policy approval respond`, `create`, `rm`, `env create`, `env rm`, `secret` and `settings set`, by both forms (decision 3). Checked by hand: a reading call asks in auto mode; a denied one is refused.

### The kits in CI

A job builds both mixins as the kit docs build them, `docker buildx build -f sandbox/<layer>/<layer>.yaml sandbox/<layer>/` (the descriptor's first line selects the kit build frontend), when `sandbox/` changes, through the existing change detection, and `ci-ok` requires it. It proves the Dockerfiles and descriptors build, not that a sandbox starts: only the rebuild proves that.

### Updating `sbx`

Decision 16. `sbx` is at `0.x`, so an update follows a procedure in the runbook:

1. **Review, with Claude in the sandbox:** Claude reads Docker's release notes between the installed and the new version and says what touches Szop's setup: the kit format, the environment files' schema, the settings, the network policy and security. Its verdict: update, wait, or change the kits first through a PR. The release notes' host is in the base layer's hosts.
2. **Before:** every branch pushed; the sandbox's session ended and the backup's last commit seen in the configuration repository; the installed version (`sbx version`) and the way back to it written down.
3. **The update:** run by the owner.
4. **After:** the owner runs `settings.sh` again and compares `sbx policy ls` with the list before; Claude runs the check script in the sandbox: the isolation checks of PH-48 that hold inside it (no Windows disk, the host's and the LAN's ports blocked, no SSH agent, only placeholders for credentials), the push hook blocks, `pnpm check` passes. For an update that needs a new sandbox, the rebuild follows.
5. **The record:** the runbook's last version proven, and the date.
6. **If it breaks:** back to the written-down version, or, if that is not possible, work moves to WSL ([Going back to WSL](#going-back-to-wsl)).

Where Docker publishes the release notes, and whether an older version can be installed again, the plan's first `sbx` task checks.

### The rebuild

Decision 9. The lost sandbox, done by the owner from the runbook and timed:

1. `sbx rm` of the existing sandbox.
2. The two `sbx env` commands from a fresh copy of `main`.
3. The logins: Claude, the machine account's token (`sbx secret set github --sandbox <name>`), `aws sso login --profile claude-readonly`, context7; `sbx setup ssh` and its `Include` line checked.
4. In the sandbox: VS Code opens `~/workspace/szop` over Remote-SSH, with a terminal; the check script passes; `pnpm check` passes; the end-to-end journeys pass; Claude starts in the repository in auto mode with the memory loaded and the status line shown; asked to `git push origin :refs/heads/x`, it is blocked by the push hook; `gh auth status` shows the machine account; `aws sts get-caller-identity` shows `claude-readonly`; a session's end pushes the backup.

The lost machine: a runbook in `docs/operations/` from a clean Windows to step 1, read through with the owner and not carried out: WSL and `setup.md`'s first steps, `sbx`, Szop's checkout on `main`, VS Code with Remote-SSH, the machine account's token from the owner's password manager; for the fallback, the configuration repository with `user/` reviewed and copied into `~/.claude/` and the hook copied.

## Acceptance criteria

➖ N/A: the phase delivers no requirement of [the requirements](../../requirements/functional-requirements.md); it changes how Szop is worked on, not what it does.

## Tests

- **The strip script:** run on a fixture of transcripts (a main session and a subagent with its `.meta.json`), `token-usage.py` gives the same output on the copy as on the original; the copy holds none of the fixture's message text.
- **`token-usage.py`'s default:** a test that the default `--projects` is derived from the repository's root.
- **The hook:** with no network, it prints its line and exits 0; a conflict keeps both versions.
- **The permission rules:** checked by hand, as above.
- **The check script:** run at the rebuild; a failing check makes it exit non-zero and name the check.
- **The kits:** the CI job.
- **The sandbox as a whole:** the rebuild's step 4.

The existing suites run unchanged, on WSL and, at the rebuild, in the sandbox.

## Documentation

- `docs/development/tools/docker-sandboxes.md` (new): `sbx`, kits and environment files, why they were chosen, every setting of the table above and every file of `sandbox/`.
- `docs/operations/docker-sandbox.md` (new): the runbook: working in the sandbox from VS Code, the lost sandbox and the lost machine, the owner's logins, adding a tool, updating `sbx` with the last version proven, going back to WSL.
- `docs/architecture/stack-overview.md`: the sandbox and its layers, for learning.
- `docs/architecture/threat-model.md`: the sandbox and the machine account as actors, the trust flow table, the accepted risks (the plan role, memory read on WSL, `user/` surviving a rebuild, host commands in environment files).
- `docs/development/setup.md`: the configuration repository's clone and the hook on WSL, and a pointer to the runbook.
- `docs/development/working-with-claude.md`: where memory lives now, statistics from the configuration repository.
- `docs/development/github-settings.md`: the machine account's access and the ruleset's approval.
- `docs/development/ci-cd.md`: the kits' job.
- `docs/development/scripts.md`: any script added to a `package.json`.
- `docs/glossary.md`: kit, mixin, workload, environment file.
- `docs/roadmap.md`: the phase's row and owner steps.

## Demo check

➖ N/A: no behavior of Szop changes. The rebuild is the phase's own hand check, a task of the plan.

Checked by hand: none.

## Risks

- **`sbx` is at `0.x`:** the kit spec, the environment files' schema or the CLI may change. The pinned workload version and the CI build show a break early; the runbook says which version was last proven.
- **Not checked yet:** where Docker publishes `sbx`'s release notes, whether an older version can be installed again, and that `sbx.exe` reads the environment files and a local mixin directory from a WSL path, and how kits' `network-policy` capabilities combine with the host's `balanced` policy. The plan's first `sbx` task checks both, and the plan branches on the answer: a path it cannot read → a clone on the Windows disk, or the mixins named as `git+https://` sources at the phase branch's ref while it is built and at `main`'s after; capabilities that do not add to the host's policy → every layer's hosts go into `settings.sh` instead, grouped by layer.
- **A poisoned memory:** a compromised sandbox can write memory that Claude on WSL reads. Accepted while WSL is the fallback; the threat model records it.
- **The owner's review as a boundary:** a PR that changes an environment file or a kit's hooks changes what runs on the host or as root.
- **A planted `user/`:** a compromised sandbox can change the owner's settings that the next sandbox takes; accepted, inside the VM, with the repository's history to read.
- **Unpushed work:** a sandbox lost or broken by an update takes its unpushed branches with it; the runbook pushes them first.
- **A forgotten backup:** a sandbox lost before a session's end loses that session's memory; the hook makes it at most one session.

## Out of scope

- The evaluation over a full phase ([OP-144](https://github.com/luiki-dev/szop/issues/430)) and narrowing the policy beyond the six groups.
- Moving the base layer to a repository of its own ([OP-146](https://github.com/luiki-dev/szop/issues/437)).
- An archive of whole transcripts.
- Carrying out the lost machine.
- Taking `szop-ci-plan` away from the machine account.
- Tools not in the record's list, lazydocker among them; each is added later as above.

## Left to the builder

- The kits' internals: which commands go in a Dockerfile and which in an install hook, and the versions pinned.
- How the owner's settings merge with the kit's (`jq`, or a settings scope Claude Code offers).
- Raising the sandbox's CPUs and memory.
- The hook's exact messages, and how a conflict is shown.
- How the hook takes the owner's part out of the sandbox's merged `settings.json` for `user/`.
- The check script's checks beyond those named, and how it reaches the host's ports.
- Whether a new commitlint scope (such as `sandbox`) is needed; if so, it is added with the bug form's Area list (ADR 0058, decision 2).
