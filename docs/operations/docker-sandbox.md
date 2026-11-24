# Docker Sandbox runbook

How to build, use, update and give up the Docker Sandbox that Claude Code works on Szop in ([ADR 0076](../decisions/0076-docker-sandbox-setup-phase-details.md)). What each file in `sandbox/` does and why is on the tool page, [Docker Sandboxes](../development/tools/docker-sandboxes.md); this runbook holds only the steps.

**Who runs what.** The owner runs every command here. Claude in the sandbox cannot reach `sbx`. A step marked **⚠️ Don't** is a mistake that is hard to undo; read it before the step.

**WSL or PowerShell.** `sbx` is one Windows program. Every command is given twice: for WSL, where it is `sbx.exe` and a file's path goes through `wslpath -w`, and for PowerShell, where it is `sbx` with paths relative to the checkout after `Set-Location`. Both forms assume the host's checkout of Szop at `~/workspace/szop` on WSL, on `main` and up to date (`git pull`) ([ADR 0076](../decisions/0076-docker-sandbox-setup-phase-details.md), decision 14). `<user>` is the Linux user name on WSL.

## Contents

- [The lost sandbox: the rebuild](#the-lost-sandbox-the-rebuild)
  - [1. Before](#1-before)
  - [2. Remove the old sandbox](#2-remove-the-old-sandbox)
  - [3. Create the sandbox](#3-create-the-sandbox)
  - [4. The logins and the setup](#4-the-logins-and-the-setup)
  - [5. VS Code](#5-vs-code)
  - [6. The checks](#6-the-checks)
- [Working in the sandbox](#working-in-the-sandbox)
  - [Starting and stopping](#starting-and-stopping)
  - [VS Code and Claude](#vs-code-and-claude)
  - [Ports](#ports)
  - [Network approvals](#network-approvals)
- [Changing the sandbox's definition](#changing-the-sandboxs-definition)
  - [What goes where](#what-goes-where)
  - [The procedure](#the-procedure)
- [Updating sbx](#updating-sbx)
  - [Last version proven](#last-version-proven)
- [Going back to WSL](#going-back-to-wsl)
- [A second sandbox and the disk](#a-second-sandbox-and-the-disk)
- [The lost machine](#the-lost-machine)

## The lost sandbox: the rebuild

Also the way to start over after an update of `sbx` that needs a new sandbox, or after a change to `sandbox/` merged to `main`.

### 1. Before

- **Every branch is pushed** from the old sandbox, if it is still there: work not pushed is lost with it.
- **The backup is pushed:** end Claude's last session in the old sandbox (`/exit`), then check that `luiki-dev/claude-config` has its `backup(sandbox)` commit. A session not ended loses its memory.
- **The host's checkout is on `main` and up to date.** On WSL:

  ```bash
  cd ~/workspace/szop && git switch main && git pull
  ```

### 2. Remove the old sandbox

WSL:

```bash
sbx.exe ls
sbx.exe rm szop
```

PowerShell:

```powershell
sbx ls
sbx rm szop
```

### 3. Create the sandbox

First check that `sbx` holds the Claude login, the global `anthropic` secret that every sandbox gets. If it is missing, `sbx env create` asks for it.

WSL:

```bash
cd ~/workspace/szop
sbx.exe secret ls
sbx.exe env create --name szop "$(wslpath -w sandbox/base/base.sbxenv.yaml)" "$(wslpath -w sandbox/szop/szop.sbxenv.yaml)"
```

PowerShell:

```powershell
Set-Location \\wsl.localhost\Ubuntu\home\<user>\workspace\szop
sbx secret ls
sbx env create --name szop sandbox\base\base.sbxenv.yaml sandbox\szop\szop.sbxenv.yaml
```

- The base file comes first and Szop's second: later files add to earlier ones and win where both set a value.
- **`--name szop` on every `sbx env` command** for this sandbox. Without it the sandbox is named `sbx-kit-claude-base`, and a later `sbx env` command without it addresses another sandbox.
- `sbx env create` shows the environment's plan and asks for approval, every time (`env.rememberHostCommands` is `false`). Read it: a host command you don't expect means a changed environment file.

### 4. The logins and the setup

**The machine account's token**, from the password manager, scoped to this sandbox only (secrets are global by default):

WSL:

```bash
sbx.exe secret set github --sandbox szop    # paste the token of luiki-dev-claude
```

PowerShell:

```powershell
sbx secret set github --sandbox szop        # paste the token of luiki-dev-claude
```

**A shell in the sandbox:**

WSL:

```bash
sbx.exe exec -it szop bash
```

PowerShell:

```powershell
sbx exec -it szop bash
```

**In that shell:**

```bash
claude-setup                                                     # clones claude-config and Szop, installs everything
aws sso login --use-device-code --profile claude-readonly        # open the link on Windows, sign in as the read-only user
```

`claude-setup` is safe to run again if it stops halfway. Its last part, Szop's setup, starts the database and installs Playwright's browsers, which takes a few minutes.

**context7:** start `claude` (the next section), run `/mcp`, choose `context7` and sign in from the link it gives.

### 5. VS Code

On Windows, once per rebuild:

WSL:

```bash
sbx.exe setup ssh
```

PowerShell:

```powershell
sbx setup ssh
```

**Then check the `Include` line** it wrote at the top of Windows' SSH configuration, the file `C:\Users\<windows user>\.ssh\config`. Open it:

WSL:

```bash
nano "/mnt/c/Users/<windows user>/.ssh/config"
```

PowerShell:

```powershell
notepad $env:USERPROFILE\.ssh\config
```

In PH-48 the line held two paths inside one pair of quotes, `Include "<path 1> <path 2>"`, and OpenSSH skipped it, so `szop.sbx` did not resolve. Fix it by hand so that each path has its own quotes, `Include "<path 1>" "<path 2>"`, and save. Check it after every `sbx setup ssh`.

Then in VS Code: **Remote-SSH: Connect to Host…** → `szop.sbx` → **Open Folder** `/home/agent/workspace/szop`, and open a terminal (`` Ctrl+` ``).

### 6. The checks

In VS Code's terminal in the sandbox:

| Check | Passes when |
|---|---|
| `check-sandbox` | It prints `all passed`: no Windows disk, the host's and the LAN's ports blocked, no SSH agent, only placeholders for the credentials, Node 24 on the `PATH`, the libraries VS Code's server needs, bash as the login shell, git's pager, the time zone of `base.sbxenv.yaml` as glibc and Node see it |
| `check-szop` | It prints `all passed`: the push hook blocks a branch deletion and `pnpm check` passes |
| `pnpm test:e2e` | The end-to-end journeys pass |
| `claude` | Claude starts in `~/workspace/szop` in auto mode, with the owner's status line; asked *which directory is your auto-memory in?*, it names `/home/agent/claude-config/memory/szop` (`/memory` does not show the path, and its *Open auto-memory folder* opens nothing without a desktop) |
| In Claude: *run `git push origin :refs/heads/x`* | Blocked by `.claude/hooks/guard-git-push.ts` |
| `gh auth status` | Logged in as `luiki-dev-claude` |
| `aws sts get-caller-identity --profile claude-readonly` | An `AWSReservedSSO_ClaudeReadOnly_…` role |
| End Claude's session (`/exit`) | A `backup(sandbox)` commit in `luiki-dev/claude-config` |
| On Windows: `sbx stop szop`, then VS Code connects to `szop.sbx` again; if it cannot, `sbx exec szop true` first | The sandbox starts without the environment files, and `claude` in VS Code's terminal starts as above |

If one fails: fix it on a branch as in [Changing the sandbox's definition](#changing-the-sandboxs-definition), merge, and rebuild from [step 1](#1-before).

## Working in the sandbox

### Starting and stopping

**Which sandboxes exist and run:** WSL `sbx.exe ls`, PowerShell `sbx ls`.

There are three ways to start working. Each ends with Claude started by `claude-start`, in `~/workspace/szop`, in auto mode, with the project's settings, deny rules and hooks loaded.

**1. Straight into Claude, in a Windows terminal.** `sbx env run` starts the sandbox if it is stopped and opens Claude in the terminal it was run from. It reads the start command from the environment files, so it needs their paths, from the host's checkout:

WSL:

```bash
cd ~/workspace/szop
sbx.exe env run --name szop "$(wslpath -w sandbox/base/base.sbxenv.yaml)" "$(wslpath -w sandbox/szop/szop.sbxenv.yaml)"
```

PowerShell:

```powershell
Set-Location \\wsl.localhost\Ubuntu\home\<user>\workspace\szop
sbx env run --name szop sandbox\base\base.sbxenv.yaml sandbox\szop\szop.sbxenv.yaml
```

Leaving Claude (`/exit`) leaves the sandbox running.

**2. VS Code, then Claude in its terminal.** The usual way: VS Code's Remote-SSH connects to `szop.sbx` ([step 5](#5-vs-code)), and `claude` typed in its terminal is an alias of `claude-start`. No environment file is needed. A stopped sandbox needs nothing first: connecting to `szop.sbx` starts it (checked at PH-49's rebuild).

**3. A shell, then Claude.** A bash in the sandbox, in the Windows terminal, for work without VS Code:

WSL:

```bash
sbx.exe exec -it szop bash
```

PowerShell:

```powershell
sbx exec -it szop bash
```

Then `claude` in it, as in way 2.

In ways 2 and 3, `claude -c` continues the last session.

**⚠️ Don't** start it with `sbx run --name szop`: a plain `sbx run` ignores the environment file's start command, so Claude starts outside the repository, without the project's settings, deny rules and hooks ([ADR 0075](../decisions/0075-docker-sandbox-poc-phase-details.md), "Settled while building").

**Stopping.** End Claude's session first (`/exit`), so the backup is pushed, then WSL `sbx.exe stop szop`, PowerShell `sbx stop szop`. The database comes back with the sandbox (`restart: unless-stopped`).

### VS Code and Claude

- In VS Code's user settings on Windows, `remote.downloadExtensionsLocally` is `true`: extensions are downloaded on Windows, so the sandbox needs no host for VS Code.
- Push every branch before anything that could break the sandbox, an update of `sbx` among them.

### Ports

`sbx env create` publishes the ports of the environment files on Windows' `localhost`: 61935 (superpowers' visual companion), 5173 (the dev server), 8443 and 8082 (the production-like environment), 8025 ([Mailpit](../development/tools/mailpit.md)'s web UI). In the sandbox:

```bash
pnpm --filter @szop/api dev                         # terminal 1
pnpm --filter @szop/web dev --host 0.0.0.0          # terminal 2, then http://localhost:5173 on Windows
COMPOSE_FILE=compose.yaml:compose.sandbox.yaml pnpm check:prodlike --keep    # then https://localhost:8443
COMPOSE_FILE=compose.yaml:compose.sandbox.yaml pnpm db:up    # then http://localhost:8025 (Mailpit's UI)
```

Another port for a while, such as a report's server: WSL `sbx.exe ports szop --publish 9000:9000`, PowerShell `sbx ports szop --publish 9000:9000`; `--unpublish 9000:9000` takes it away, `sbx ports szop` lists them. A service in the sandbox must listen on `0.0.0.0` for its port to reach Windows.

### Network approvals

A host outside the policy is refused and waits in the approval queue. WSL `sbx.exe policy approval ls`, PowerShell `sbx policy approval ls`; `sbx policy log` shows what was allowed and denied.

- **Dismiss, don't allow, these known requests:** `140.82.121.*:22`, git over SSH to GitHub, which Claude Code tries during `claude-setup` and at its start before it goes over HTTPS, which works; `main.vscode-cdn.net` and Microsoft's telemetry, from VS Code's server, which works without them; `d-…awsapps.com`, the browser opening of `aws sso login`, whose link opens on Windows anyway.
- **⚠️ Don't** approve `localhost`, `host.docker.internal`, a private (`10.*`, `172.16–31.*`, `192.168.*`), link-local or metadata address (`169.254.169.254`, `metadata.google.internal`): the network policy is what keeps the host and the LAN out of the sandbox.
- A host a layer needs for good goes in that layer's descriptor (`network-policy@1` in `sandbox/<layer>/<layer>.yaml`) through a PR, not an approval.

## Changing the sandbox's definition

A change made by hand in a sandbox is lost with it. To keep one, change the files in `sandbox/` on a branch and prove it on a separate test sandbox, `szop-try`, built from that branch. The everyday sandbox `szop` stays as it is until the merge.

### What goes where

Put each change in the right layer: `sandbox/base/` if any project needs it, `sandbox/szop/` if only Szop does. The tool page's [base layer](../development/tools/docker-sandboxes.md#the-base-layer) section has the rules.

| Change | Where |
|---|---|
| A new tool | The layer's Dockerfile, in the build stage: a self-contained release, its version pinned and its checksum checked, as the others there. Its download hosts, if not in `balanced`, go in the layer's descriptor |
| A port published for good | `ports` in the layer's environment file (`sandbox/<layer>/<layer>.sbxenv.yaml`). For a while only, `sbx ports` ([Ports](#ports)) needs no change |
| A network host the layer needs | `network-policy@1` in the layer's descriptor (`sandbox/<layer>/<layer>.yaml`) |
| A setting the kit already sets | Claude's settings and hooks of the base layer: `sandbox/base/files/settings-fragment.json`; a system file (`/etc/bash.bashrc`, apt's sources): the descriptor's install hook; git's configuration and the plugins: `claude-setup.sh` |
| A new step or script | A file in `sandbox/<layer>/files/`, copied in by the layer's Dockerfile; a step that needs the token, the network or Docker in the layer's setup script (`claude-setup.sh`, `szop-setup.sh`) |
| A new check | `check-sandbox.sh` if it holds for any project, `check-szop.sh` if only for Szop, and a row in [The checks](#6-the-checks) if it is checked by hand |

Raise the layer's `version` in its descriptor with every change. The owner's own settings, `CLAUDE.md`, status line and themes are not in the kit: they live in `luiki-dev/claude-config`'s `user/`, change in the sandbox and travel with the backup, with no rebuild.

### The procedure

1. **The branch.** Make the change on a branch, push it, and open the PR. Its `kits` job builds the layers. Trying it by hand in `szop` first is fine; it is lost at the next rebuild.
2. **Free the host for the test sandbox.** Both sandboxes publish the same ports on Windows' `localhost` (61935, 5173, 8443, 8082, 8025), and each takes 12 CPUs and `12g` of memory, so `szop` is stopped first. In `szop`: push every branch, end Claude's session (`/exit`) so its backup is pushed, then stop it:

   WSL:

   ```bash
   sbx.exe stop szop
   ```

   PowerShell:

   ```powershell
   sbx stop szop
   ```

   Check the disk too: a sandbox takes up to about 31 GB ([A second sandbox and the disk](#a-second-sandbox-and-the-disk)).
3. **The branch's files on the host.** Switch the host's checkout to the branch for the test; step 8 brings it back to `main`, which every rebuild and `sbx env run` read:

   ```bash
   cd ~/workspace/szop && git fetch && git switch <branch>
   ```

   After a fix on the branch: `git pull`. When the checkout is busy (a Claude session on WSL works in it), take a second folder instead, a git worktree, and use `~/workspace/szop-try` in place of `~/workspace/szop` up to step 8: `git worktree add --detach ~/workspace/szop-try origin/<branch>`; after a fix, `git fetch && git checkout --detach origin/<branch>` in it; at the end, `git worktree remove ~/workspace/szop-try` from `~/workspace/szop`.
4. **Create the test sandbox** from the checkout, as in [step 3 of the rebuild](#3-create-the-sandbox) but named `szop-try`:

   WSL:

   ```bash
   cd ~/workspace/szop
   sbx.exe env create --name szop-try "$(wslpath -w sandbox/base/base.sbxenv.yaml)" "$(wslpath -w sandbox/szop/szop.sbxenv.yaml)"
   ```

   PowerShell:

   ```powershell
   Set-Location \\wsl.localhost\Ubuntu\home\<user>\workspace\szop
   sbx env create --name szop-try sandbox\base\base.sbxenv.yaml sandbox\szop\szop.sbxenv.yaml
   ```

   Read the plan it shows: the host commands must be the ones the branch's diff adds, and no others.
5. **The token and the setup**, as in [step 4 of the rebuild](#4-the-logins-and-the-setup), with `szop-try` in place of `szop`: `sbx secret set github --sandbox szop-try`, then `sbx exec -it szop-try bash` and `claude-setup` in it. `claude-setup` clones Szop's `main`; when the change touches files in Szop's repository too (such as `compose.sandbox.yaml`), `git switch <branch>` in `~/workspace/szop` inside the sandbox. The AWS and context7 logins only if a check below needs them.
6. **The checks**, from [The checks](#6-the-checks): always `check-sandbox` and `check-szop`, then the rows the change touches; after a change to the lifecycle hooks, the settings or `claude-setup`, all of them. A row that needs VS Code needs `sbx setup ssh` first, the `Include` line checked as in [step 5 of the rebuild](#5-vs-code), and the host `szop-try.sbx`. The test sandbox's sessions are backed up and counted like `szop`'s: a short Claude session for the checks is fine, real work is not.
7. **If one fails:** fix it on the branch and push. Then remove the test sandbox (step 8's first command) and go back to step 3, so the proof is a sandbox built from the branch, not one patched by hand.
8. **When all pass:** remove the test sandbox and bring the host's checkout back to `main`:

   WSL:

   ```bash
   sbx.exe rm szop-try
   cd ~/workspace/szop && git switch main
   ```

   PowerShell:

   ```powershell
   sbx rm szop-try
   wsl.exe bash -c "cd ~/workspace/szop && git switch main"
   ```

   `szop` starts again when VS Code connects to `szop.sbx` ([Starting and stopping](#starting-and-stopping)).
9. **After the merge:** `git pull` on the host's checkout, then bring `szop` to the new definition in one of two ways:
   - **[Rebuild](#the-lost-sandbox-the-rebuild)**, the default.
   - **By hand, when the change is small** (a port: `sbx ports szop --publish`; a file or a line of a script: the same edit in the sandbox, with `sudo` where it is the system's). The test sandbox has proved the definition, and the next rebuild takes it anyway. A change to the workload's version, the network policy or the lifecycle hooks always means a rebuild.

## Updating sbx

`sbx` is at `0.x`, so an update can change the kit format, the environment files or the settings ([ADR 0076](../decisions/0076-docker-sandbox-setup-phase-details.md), decision 16).

1. **Review.** Ask Claude in the sandbox to read the release notes at [docker/sbx-releases](https://github.com/docker/sbx-releases/releases) between the installed version and the new one, and say what touches Szop's setup: the kit format, the environment files' schema, the settings, the network policy and security. Its verdict: update, wait, or change the kits first through a PR.
2. **Before:** every branch pushed; Claude's session ended and the `backup(sandbox)` commit seen in `luiki-dev/claude-config`; the installed version written down (`sbx version`).
3. **The update**, in PowerShell:

   ```powershell
   sbx version
   winget upgrade --id Docker.sbx --exact --source winget
   ```

4. **After:** run the host's settings again, and compare `sbx policy ls` with the list before.

   ```bash
   bash sandbox/host/settings.sh                  # WSL
   ```

   ```powershell
   Set-Location \\wsl.localhost\Ubuntu\home\<user>\workspace\szop
   wsl.exe bash sandbox/host/settings.sh          # PowerShell
   ```

   Then start the sandbox and run `check-sandbox` and `check-szop` in it. If the release needs a new sandbox, [rebuild](#the-lost-sandbox-the-rebuild).
5. **Record** the version and the date in [Last version proven](#last-version-proven), through a PR.
6. **If it breaks:** back to the version written down, in PowerShell, then the settings script again:

   ```powershell
   winget install --id Docker.sbx --exact --version <version> --force
   ```

   If that does not help, work moves to WSL ([Going back to WSL](#going-back-to-wsl)).

### Last version proven

| `sbx` | Date | What proved it |
|---|---|---|
| 0.51.0 | 2026-11-14 | PH-49's rebuild from this runbook: steps 2 to 5 in 7 minutes, and every check in [The checks](#6-the-checks) passed |

## Going back to WSL

When `sbx` breaks and cannot be rolled back, or the sandbox is given up ([ADR 0076](../decisions/0076-docker-sandbox-setup-phase-details.md), decision 13). First, if the sandbox still runs: push every branch and end Claude's session, so its last backup is in `luiki-dev/claude-config`. Then on WSL:

1. **Memory:** nothing to do. The first session's start pulls `~/claude-config`, where the memory lives.
2. **Settings, global `CLAUDE.md`, status line:** the sandbox owns `user/`, so read what changed before taking it:

   ```bash
   cd ~/claude-config && git pull
   diff user/settings.json ~/.claude/settings.json
   diff user/CLAUDE.md /mnt/c/Users/<windows user>/CLAUDE.md
   diff user/statusline-command.sh ~/.claude/statusline-command.sh
   diff -r user/themes ~/.claude/themes
   ```

   Copy what you accept by hand. Keep WSL's own `hooks` in `settings.json` (`user/` holds none), and WSL's `~/.claude/CLAUDE.md`, which imports the file on the Windows disk.
3. **The hook scripts:** if `sandbox/base/files/claude-backup.sh` or `strip-transcripts.py` changed since they were copied, copy them again ([setup guide, section 14](../development/setup.md#14-claude-codes-configuration-backup)).
4. **Statistics:** both environments' stripped transcripts are in the clone:

   ```bash
   python3 scripts/token-usage.py --projects ~/claude-config/transcripts --usage-log ~/claude-config/usage-log/sandbox.csv
   ```

5. **Sessions:** a sandbox's session cannot be resumed on WSL; only its stripped copy is there. The work goes on from the pushed branches and the handoff files (`/session-handoff resume <branch>`).

## A second sandbox and the disk

PH-48 measured about 31 GB in `%LOCALAPPDATA%\DockerSandboxes` per sandbox, by the files' apparent size; the disk images may be sparse and take less. Before keeping a second sandbox, measure what one really takes: in PowerShell, note the free space, create the second, and compare.

```powershell
(Get-PSDrive C).Free / 1GB
```

## The lost machine

From a clean Windows machine to [the rebuild](#the-lost-sandbox-the-rebuild). Read through once, not carried out ([ADR 0076](../decisions/0076-docker-sandbox-setup-phase-details.md), decision 9).

1. **WSL and the repository:** the [setup guide](../development/setup.md), sections 1, 2 and 5 (WSL and Ubuntu, git, VS Code), then Szop cloned to `~/workspace/szop`, on `main`. The host only reads the checkout (the environment files and `settings.sh`) and commits nothing, so it needs no Node, `pnpm install` or git hooks:

   ```bash
   mkdir -p ~/workspace && cd ~/workspace && git clone https://github.com/luiki-dev/szop.git
   ```
2. **`sbx`**, in PowerShell, and the Docker sign-in it asks for:

   ```powershell
   winget install --id Docker.sbx --exact --source winget
   sbx login
   ```

   Then the host's settings and the network policy, as in [Updating sbx](#updating-sbx), step 4.
3. **VS Code's remote:** the OpenSSH client (Windows' optional feature, in PowerShell as administrator: `Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0`), the Remote-SSH extension (`ms-vscode-remote.remote-ssh`), and `"remote.downloadExtensionsLocally": true` in VS Code's user settings.
4. **The logins** come at the rebuild: the Claude login when `sbx env create` asks, and the machine account's token from the password manager.
5. **[The rebuild](#the-lost-sandbox-the-rebuild)**, from step 3.
6. **For the fallback on WSL**, only if needed: the setup guide's other sections, from [3](../development/setup.md#3-nvm-and-node) (Node, pnpm, the rest of section 6, the database and the tools), the configuration repository cloned and the hook copied ([setup guide, section 14](../development/setup.md#14-claude-codes-configuration-backup)), then `user/` reviewed and copied as in [Going back to WSL](#going-back-to-wsl), step 2.
