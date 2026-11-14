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
- [Adding a tool](#adding-a-tool)
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
| `check-sandbox` | It prints `all passed`: no Windows disk, the host's and the LAN's ports blocked, no SSH agent, only placeholders for the credentials, Node 24 on the `PATH`, the libraries VS Code's server needs, git's pager |
| `check-szop` | It prints `all passed`: the push hook blocks a branch deletion and `pnpm check` passes |
| `pnpm test:e2e` | The end-to-end journeys pass |
| `claude` | Claude starts in `~/workspace/szop` in auto mode, with the owner's status line; `/memory` shows `~/claude-config/memory/szop` |
| In Claude: *run `git push origin :refs/heads/x`* | Blocked by `.claude/hooks/guard-git-push.ts` |
| `gh auth status` | Logged in as `luiki-dev-claude` |
| `aws sts get-caller-identity --profile claude-readonly` | An `AWSReservedSSO_ClaudeReadOnly_…` role |
| End Claude's session (`/exit`) | A `backup(sandbox)` commit in `luiki-dev/claude-config` |
| On Windows: `sbx stop szop`, then VS Code connects to `szop.sbx` again; if it cannot, `sbx exec szop true` first | The sandbox starts without the environment files, and `claude` in VS Code's terminal starts as above |

If one fails: fix it on a branch, merge, and rebuild from [step 1](#1-before).

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

`sbx env create` publishes the ports of the environment files on Windows' `localhost`: 61935 (superpowers' visual companion), 5173 (the dev server), 8443 and 8082 (the production-like environment). In the sandbox:

```bash
pnpm --filter @szop/api dev                         # terminal 1
pnpm --filter @szop/web dev --host 0.0.0.0          # terminal 2, then http://localhost:5173 on Windows
COMPOSE_FILE=compose.yaml:compose.sandbox.yaml pnpm check:prodlike --keep    # then https://localhost:8443
```

Another port for a while, such as a report's server: WSL `sbx.exe ports szop --publish 9000:9000`, PowerShell `sbx ports szop --publish 9000:9000`; `--unpublish 9000:9000` takes it away, `sbx ports szop` lists them. A service in the sandbox must listen on `0.0.0.0` for its port to reach Windows.

### Network approvals

A host outside the policy is refused and waits in the approval queue. WSL `sbx.exe policy approval ls`, PowerShell `sbx policy approval ls`; `sbx policy log` shows what was allowed and denied.

- **Dismiss, don't allow, these known requests:** `140.82.121.*:22`, git over SSH to GitHub, which Claude Code tries during `claude-setup` and at its start before it goes over HTTPS, which works; `main.vscode-cdn.net` and Microsoft's telemetry, from VS Code's server, which works without them; `d-…awsapps.com`, the browser opening of `aws sso login`, whose link opens on Windows anyway.
- **⚠️ Don't** approve `localhost`, `host.docker.internal`, a private (`10.*`, `172.16–31.*`, `192.168.*`), link-local or metadata address (`169.254.169.254`, `metadata.google.internal`): the network policy is what keeps the host and the LAN out of the sandbox.
- A host a layer needs for good goes in that layer's descriptor (`network-policy@1` in `sandbox/<layer>/<layer>.yaml`) through a PR, not an approval.

## Adding a tool

A tool tried by hand in a sandbox is lost with it. To keep one:

1. On a branch, add it to the right layer: `sandbox/base/` if any project needs it, `sandbox/szop/` if only Szop does. A tool is a self-contained release downloaded in the Dockerfile's build stage, its version pinned and its checksum checked, as the others there; a setup step that needs the token, the network or Docker goes in the layer's setup script (`sandbox/szop/files/szop-setup.sh`). The tool page's [base layer](../development/tools/docker-sandboxes.md#the-base-layer) section has the rules.
2. Its download hosts, if not in `balanced`, go in the layer's descriptor.
3. The PR's `kits` job builds the layers; after the merge, `git pull` on the host and [rebuild](#the-lost-sandbox-the-rebuild).

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
| _to be recorded by PH-49's rebuild_ | | |

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

1. **WSL and the repository:** the [setup guide](../development/setup.md), sections 1 to 6: WSL and Ubuntu, git, Node, pnpm, VS Code, and Szop cloned to `~/workspace/szop`, on `main`. The other sections are for working on WSL and are needed only for the fallback.
2. **`sbx`**, in PowerShell, and the Docker sign-in it asks for:

   ```powershell
   winget install --id Docker.sbx --exact --source winget
   sbx login
   ```

   Then the host's settings and the network policy, as in [Updating sbx](#updating-sbx), step 4.
3. **VS Code's remote:** the OpenSSH client (Windows' optional feature, in PowerShell as administrator: `Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0`), the Remote-SSH extension (`ms-vscode-remote.remote-ssh`), and `"remote.downloadExtensionsLocally": true` in VS Code's user settings.
4. **The logins** come at the rebuild: the Claude login when `sbx env create` asks, and the machine account's token from the password manager.
5. **[The rebuild](#the-lost-sandbox-the-rebuild)**, from step 3.
6. **For the fallback on WSL**, only if needed: the configuration repository cloned and the hook copied ([setup guide, section 14](../development/setup.md#14-claude-codes-configuration-backup)), then `user/` reviewed and copied as in [Going back to WSL](#going-back-to-wsl), step 2.
