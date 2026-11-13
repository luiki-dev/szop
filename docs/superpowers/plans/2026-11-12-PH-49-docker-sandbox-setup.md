# PH-49 Reproducible Docker Sandbox setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementers:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md) before your task.

**Goal:** After a lost sandbox or a lost machine, the owner rebuilds the whole working environment in a Docker Sandbox from the repositories and a few logins, with Claude's memory and the statistics of past sessions intact.

**Architecture:** Two v3 mixins on Docker's Claude Code workload, `sandbox/base` (generic) and `sandbox/szop`, each with an environment file, merged in that order by `sbx env create`/`run`; a host settings script the owner runs; a private configuration repository, `luiki-dev/claude-config`, that holds memory, stripped transcripts, usage logs and the owner's `user/` files, kept by a backup hook on WSL and in the sandbox; a CI job that builds both mixins.

**Tech Stack:** Docker Sandboxes (`sbx`, `0.x`, kit format v3, environment files), Bash, Python 3 (the strip script, `token-usage.py`), Vitest (spawning the scripts), GitHub Actions, git.

**Spec:** [`docs/superpowers/specs/2026-11-12-PH-49-docker-sandbox-setup-design.md`](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md); decisions in [ADR 0076](../../decisions/0076-docker-sandbox-setup-phase-details.md); the list of what to bring in the [proof of concept's record](../../audits/2026-11-08-docker-sandbox-poc.md#task-6-the-decision), "What the setup phase must bring". The criteria are ➖ N/A ([Acceptance criteria](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#acceptance-criteria)); the tests are in its [Tests](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#tests), the docs in its [Documentation](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#documentation); each task below names the docs it updates.

## Order of work

1. [Task 1: Claude's `sbx` rules, the host settings and the probe](#task-1-claudes-sbx-rules-the-host-settings-and-the-probe) — 🛑 stop
2. [Task 2: The strip script and `token-usage.py`'s default](#task-2-the-strip-script-and-token-usagepys-default)
3. [Task 3: The backup hook](#task-3-the-backup-hook)
4. [Task 4: The configuration repository and WSL's memory](#task-4-the-configuration-repository-and-wsls-memory) — 🛑 stop
5. [Task 5: The machine account on Szop's repository](#task-5-the-machine-account-on-szops-repository) — 🛑 stop
6. [Task 6: The base layer and the kits' CI job](#task-6-the-base-layer-and-the-kits-ci-job) — 🛑 stop
7. [Task 7: Szop's layer](#task-7-szops-layer) — 🛑 stop
8. [Task 8: The runbook and the rebuild](#task-8-the-runbook-and-the-rebuild) — 🛑 stop

## Global Constraints

- The branch is `build/ph-49-docker-sandbox-setup`. Scopes: `sandbox` (added in Task 1, with the bug form's Area list), `claude`, `ci`, `adr`, `plan`.
- **Rhythm** ([ADR 0076](../../decisions/0076-docker-sandbox-setup-phase-details.md), decision 1): the execution stops after every task marked 🛑, where the owner acts: the host settings and network policy (Task 1, which also holds the probe the plan branches on), the configuration repository (Task 4), the machine account (Task 5), the sandbox's first builds (Tasks 6 and 7, the owner creates them) and the rebuild (Task 8). Tasks 2 and 3 go on without a stop.
- **Who runs `sbx`** (decisions 2 and 3): Claude, from WSL, runs only `sbx.exe ls`, `version`, `policy ls`, `policy log` and `sbx.exe exec <sandbox> <a script committed on the branch>`, each behind the `ask` rule, announced in chat before each batch. The owner runs every other `sbx` command. Each task's steps say who runs what.
- **Nothing personal in `sandbox/`** (decision 12): no user `settings.json`, global `CLAUDE.md`, memory, `autoMode` text, account names beyond `luiki-dev` repository names, or tokens. `sandbox/base` names nothing of Szop (decision 4).
- **Nothing on WSL changes** except the memory's move, the configuration repository's clone and the backup hook (the condition of PH-48's GO).
- **Never approve** `localhost`, `host.docker.internal`, a private, link-local or metadata address (`169.254.169.254`) in `sbx`'s approval queue.
- Scripts in the sandbox call `curl` with `--fail`: the proxy answers a blocked request with `403`.
- The sandbox's size: 8 CPUs and `8g`; raised only if Task 7's journeys or the production-like environment need it, recorded in the ADR.
- Pin every version: the workload image (`docker.io/docker/sbx-kit-claude`), each tool of Szop's layer at [`setup.md`](../../development/setup.md)'s version, Chrome DevTools MCP, every action by SHA.
- A decision taken in a task, a probe result among them, goes into ADR 0076's "Settled while building" in that task's commit.
- `pnpm check` passes on WSL after every task; `scripts/check-workflows.sh` after Task 6.

## Review Focus

1. **A backup that failed earlier** (no network at the last `SessionEnd`). Expected: the next run pushes the earlier commit too; nothing is left only in the clone. Task 3 tests it.
2. **Two sessions ending at once** (two Claude sessions on one machine). Expected: the second hook prints that a backup is already running and exits 0; the clone is never left mid-rebase. Task 3 tests it with a held lock.
3. **A transcript still being written** (its last line cut off). Expected: the strip script copies the whole lines, skips the cut one without failing, and `token-usage.py` reads the copy. Task 2 tests it.
4. **Credentials next to what is copied** (`~/.claude/.credentials.json`, an `.env`). Expected: never in the configuration repository; the hook copies only named paths. Task 3 tests it.
5. **The first run over the whole WSL history** (865 MB since 2026-09-27) inside a `SessionEnd`. Expected: the next runs rewrite only changed transcripts. Task 2 tests that an unchanged source is not rewritten; Task 4 measures the first run.

---

## File Structure

| File | Responsibility |
|---|---|
| `.claude/settings.json` | The `ask` and `deny` rules for `sbx`; `autoMemoryDirectory` |
| `sandbox/README.md` | What is here, and a pointer to the runbook |
| `sandbox/host/settings.sh` | The host's `sbx` settings and network policy; idempotent; prints what it ends with |
| `sandbox/base/base.yaml`, `base.dockerfile`, `base.sbxenv.yaml` | The generic mixin and its environment file |
| `sandbox/base/files/strip-transcripts.py` | `strip-transcripts.py SRC DEST`: the stripped copy of a projects folder |
| `sandbox/base/files/claude-backup.sh` | `claude-backup.sh start\|end`: the backup hook |
| `sandbox/base/files/check-sandbox.sh` | The isolation checks; exits non-zero naming the failed check |
| `sandbox/base/files/*.test.ts`, `sandbox/base/files/fixtures/` | The strip script's and the hook's tests |
| `sandbox/szop/szop.yaml`, `szop.dockerfile`, `szop.sbxenv.yaml` | Szop's mixin and environment file |
| `sandbox/szop/files/check-szop.sh` | The push hook blocks; `pnpm check` passes |
| `compose.sandbox.yaml` | Publishes the production-like environment on `0.0.0.0`, used only in the sandbox |
| `scripts/token-usage.py`, `scripts/token-usage.test.ts` | The default `--projects` from the repository's root |
| `vitest.config.ts` | A `scripts` project for `scripts/**/*.test.ts` and `sandbox/**/*.test.ts` |
| `.github/workflows/ci.yml` | `changes` gains `sandbox`; a `kits` job; `ci-ok` needs it |
| `docs/development/tools/docker-sandboxes.md`, `docs/operations/docker-sandbox.md` | The tool page and the runbook (new) |

---

### Task 1: Claude's `sbx` rules, the host settings and the probe

🛑 Stop after this task. Claude writes; the owner runs `settings.sh`, decides the groups and creates the probe sandbox.

**Files:**
- Modify: `.claude/settings.json`, `commitlint.config.js`, `.github/ISSUE_TEMPLATE/bug.yml`
- Create: `sandbox/README.md`, `sandbox/host/settings.sh`, `sandbox/base/base.yaml`, `sandbox/base/base.dockerfile`, `sandbox/base/base.sbxenv.yaml`, `docs/development/tools/docker-sandboxes.md`
- Modify: `docs/glossary.md`, `docs/decisions/0076-docker-sandbox-setup-phase-details.md`

**Interfaces:**
- Produces: the three skeleton files of `sandbox/base` that Task 6 extends; the probe's answers in ADR 0076's "Settled while building", which Tasks 6 to 8 follow.

- [x] **Step 1 (Claude): find `sbx.exe`.** `command -v sbx.exe` and `readlink -f` of it (not an `sbx` call). Note the full path for Step 2.
- [x] **Step 2 (Claude): the permission rules in `.claude/settings.json`.** `ask`: `Bash(sbx *)`, `Bash(sbx.exe *)`, `Bash(<full path> *)`. `deny`, each for the three forms and with the `* ` variant the file already uses for `gh` (`Bash(sbx.exe policy allow*)` and `Bash(sbx.exe * policy allow*)`): `policy allow`, `policy approval respond`, `create`, `rm`, `env create`, `env rm`, `secret`, `settings set`. Add the `sandbox` scope to `commitlint.config.js` and to the Area list of `bug.yml`.
- [x] **Step 3 (Claude, the owner approves): the hand check.** Announce, then run `sbx.exe version`: a prompt appears in auto mode; the owner approves. Run `sbx.exe rm does-not-exist`: refused by a deny rule, with no prompt. If the rules did not load, the owner restarts the session and the check repeats.
- [x] **Step 4 (Claude): `sandbox/host/settings.sh`.** Runs from WSL, calls `sbx.exe`; sets the five settings of the spec's [table](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#the-hosts-settings-and-the-network-policy) (`telemetry.disabled true`, `ssh.agentForwardingEnabled false`, `model.server.enabled false`, `env.rememberHostCommands false`, `kit.requireSignature false`); runs `sbx policy init balanced` only when no policy exists; adds deny rules for `http-intake.logs.us5.datadoghq.com`, `mobile.events.data.microsoft.com`, `default.exp-tas.com`, `westus-0.in.applicationinsights.azure.com`, `169.254.169.254` and `metadata.google.internal`, skipping a rule already there; removes the groups listed in a `REMOVED_GROUPS` array at its top (empty until Step 6); ends by printing `sbx settings` and `sbx policy ls`. `set -euo pipefail`; safe to run again.
- [x] **Step 5 (Claude): the questions that need no sandbox.** How `sbx` is installed (`winget.exe list Docker.sbx`); whether an older version can be installed (`winget.exe show Docker.sbx --versions`); where Docker publishes the release notes (Docker's docs, through context7 or a web search); the six groups of `balanced` with what each allows (`sbx.exe policy ls`, announced). Write the groups as a table in the tool page for the owner.
- [x] **Step 6 (the owner): settings and groups.** Runs `sandbox/host/settings.sh`; reads the groups' table and says which to keep; Claude fills `REMOVED_GROUPS` and the owner runs the script again. Claude runs `sbx.exe policy ls` and compares with the decision.
- [x] **Step 7 (Claude): the probe's skeleton.** `base.yaml` (first line `# syntax=docker/sandbox-kit:3`, a mixin on the pinned workload, a `network-policy` capability with `mcp.context7.com` only), `base.dockerfile` (installs `less`, nothing else yet), `base.sbxenv.yaml` (the kit as a local directory, 8 CPUs, `8g`). The kit format comes from Docker's [Kits](https://docs.docker.com/ai/sandboxes/customize) and [Environment files](https://docs.docker.com/ai/sandboxes/configuration/environment-files/) pages; the spec's [Risks](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#risks) name what is unknown. Commit.
- [x] **Step 8 (the owner): the probe.** From WSL: `sbx.exe env create "$(wslpath -w sandbox/base/base.sbxenv.yaml)"` (sandbox name `szop-probe`). In its shell: `less --version`; `curl --fail -sS -o /dev/null https://mcp.context7.com/ && echo allowed`. Claude reads `sbx.exe policy log` (announced). Then the owner runs `sbx rm szop-probe`.
- [x] **Step 9 (Claude): record and branch.** In ADR 0076's "Settled while building": the install method and the way back to an older version; the release notes' URL and host; the groups kept; whether `sbx.exe` read the WSL path, and if not, which of the spec's two ways Tasks 6 to 8 use (a clone on the Windows disk, or `git+https://` mixins at the branch's ref); whether the capability added `mcp.context7.com` to `balanced`, and if not, that every layer's hosts go into `settings.sh`, grouped by layer. Edit this plan's Tasks 6 to 8 where the answer changes a step. The tool page holds the settings, each with what it does, and the groups; the glossary gets kit, mixin, workload and environment file. `sandbox/README.md`: what is here, the runbook's path (written in Task 8).
- [x] **Step 10: commit and push.** `build(sandbox): add the sbx rules, host settings and probe`.

### Task 2: The strip script and `token-usage.py`'s default

Claude only; no stop.

**Files:**
- Create: `sandbox/base/files/strip-transcripts.py`, `sandbox/base/files/strip-transcripts.test.ts`, `sandbox/base/files/fixtures/projects/-home-x-szop/` (a main session `.jsonl`, a subagent `.jsonl` under `<session>/subagents/` with its `.meta.json`), `scripts/token-usage.test.ts`
- Modify: `scripts/token-usage.py:299`, `vitest.config.ts`, `docs/development/testing.md`, `docs/development/working-with-claude.md`

**Interfaces:**
- Produces: `python3 strip-transcripts.py SRC DEST` — mirrors every `*.jsonl` and `*.meta.json` under `SRC` to the same relative path under `DEST`; exit 0; used by Task 3's hook as `strip-transcripts.py ~/.claude/projects "$REPO/transcripts/$ENV"`.

- [x] **Step 1: the fixture.** Lines of each kind `load_calls` meets: `assistant` lines with `type`, `timestamp`, `requestId`, `gitBranch`, `message.id`, `message.model`, `message.usage` (every `USAGE_KEYS` key), and message `content` holding the marker `FIXTURE-SECRET-TEXT`; a `user` line with the marker in its content; a duplicated `requestId`; a `<synthetic>` model line; in the main session a cut last line (`{"type":"assistant","timest`). The `.meta.json` has `description` and another field holding the marker.
- [x] **Step 2: the failing tests** (the `scripts` Vitest project; spawn `python3`; `DEST` in a temp directory):
  - `token-usage.py gives the same report on the copy as on the original`: run `scripts/token-usage.py --projects <fixture>` and `--projects <copy>`, both with `--usage-log /nonexistent`; stdout equal, after replacing each path with a placeholder.
  - `the copy holds none of the message text`: no file under the copy contains `FIXTURE-SECRET-TEXT`.
  - `the copy keeps the folders and file names`: the same relative paths as the fixture.
  - `a cut last line is skipped`: exit 0, the copy has one line fewer than the source.
  - `an unchanged source is not rewritten`: run twice; the copy's mtime is unchanged on the second run; after touching the source with new content, it changes.
  - In `scripts/token-usage.test.ts`, `the default --projects comes from the repository's root`: `HOME` set to a temp directory holding the fixture at `.claude/projects/<the repository root with every non-alphanumeric character replaced by "-">/`; run with no `--projects`, `cwd` the repository; exit 0 and the report names the fixture's session.
- [x] **Step 3: run them; they fail** (`pnpm vitest run --project scripts`): no strip script, and the default is still WSL's folder.
- [x] **Step 4: `strip-transcripts.py`.** Per line: parse, or skip on `ValueError`; write a JSON object with only `type`, `timestamp`, `requestId`, `gitBranch`, and `message` with only `id`, `model`, `usage`, each only when present. `.meta.json` keeps only `description`. A copy is written (to a temp file, then `os.replace`) only when the source's mtime is newer than the copy's; the copy's mtime is set to the source's. A docstring line says the kept fields are those `token-usage.py`'s `load_calls` reads, and a new field there must be kept here.
- [x] **Step 5: `token-usage.py`'s default.** `--projects` defaults to `~/.claude/projects/` plus `re.sub(r'[^A-Za-z0-9]', '-', <git rev-parse --show-toplevel>)`; outside a git repository it `fail`s with a message naming `--projects`. The usage line at the top says so.
- [x] **Step 6: run the tests; they pass**, then `pnpm check`.
- [x] **Step 7: docs.** `testing.md`: the `scripts` project. `working-with-claude.md`, the measuring section: the default `--projects`, and `--projects ~/claude-config/transcripts` for both environments.
- [x] **Step 8: commit and push.** `feat(sandbox): add the transcript strip script and derive token-usage's folder`.

### Task 3: The backup hook

Claude only; no stop.

**Files:**
- Create: `sandbox/base/files/claude-backup.sh`, `sandbox/base/files/claude-backup.test.ts`
- Modify: `docs/development/tools/docker-sandboxes.md`

**Interfaces:**
- Consumes: `strip-transcripts.py SRC DEST` (Task 2), found next to the hook (`$(dirname "$0")`).
- Produces: `claude-backup.sh start|end`, always exit 0. Environment: `CLAUDE_CONFIG_REPO` (default `~/claude-config`), `CLAUDE_BACKUP_ENV` (`wsl` by default; the base layer sets `sandbox`), `CLAUDE_KIT_SETTINGS` (the kit's own settings saved at creation, `~/.claude/kit-settings.json`; Task 6 writes it). Wired as user hooks `SessionStart` → `start`, `SessionEnd` → `end`, `timeout` 120.

- [x] **Step 1: the failing tests** (spawn `bash`; each test has a temp `HOME` with `.claude/projects/` from Task 2's fixture, `.claude/usage-log.csv`, `.claude/.credentials.json`, `.claude/settings.json`; a bare repository as the remote, cloned to `$HOME/claude-config`):
  - `start pulls memory written in the other environment`: a second clone pushes `memory/szop/a.md`; after `start` it is in the first.
  - `end pushes the stripped transcripts and the usage log`: the bare repository's `main` has `transcripts/wsl/-home-x-szop/…` and `usage-log/wsl.csv`.
  - `end on WSL never writes user/`.
  - `end in the sandbox writes user/ without the kit's keys or hooks`: with `CLAUDE_BACKUP_ENV=sandbox`, a kit settings file `{"a":1,"hooks":{…}}` and settings `{"a":1,"model":"x","hooks":{…}}`: `user/settings.json` is `{"model":"x"}`; `user/CLAUDE.md` and `user/statusline-command.sh` copied from `~/.claude/` (the owner's global `CLAUDE.md` is the copy Task 6 installs as `~/.claude/owner-CLAUDE.md`; the test seeds that name).
  - `no credential reaches the repository`: no `.credentials.json`, no file named `.env*` in the bare repository.
  - `with no network it prints one line and exits 0`: the remote set to `/nonexistent.git`; for `start` and `end`, exit 0 and exactly one output line, starting `claude-backup:` and naming the failure.
  - `a backup that failed earlier is pushed by the next`: `end` with no network, then the remote restored, then `end`: both commits on the bare `main`.
  - `a conflict keeps both versions`: both clones change `memory/szop/MEMORY.md` differently; the second `end` exits 0 with one line naming the conflict; the bare repository's `main` holds the first version and a branch `conflict/<env>-<UTC timestamp>` the second; the clone is back on a clean `main`, not mid-rebase.
  - `a second backup running at once exits`: with the hook's lock held by the test (`flock` on `$CLAUDE_CONFIG_REPO/.git/claude-backup.lock`), `end` exits 0 with one line saying a backup is running.
- [x] **Step 2: run them; they fail** (`pnpm vitest run --project scripts`).
- [x] **Step 3: `claude-backup.sh`.** `set -uo pipefail`, no `-e`; every failure goes through one function that prints `claude-backup: <what> did not happen: <why>` and exits 0. `flock -n` on the lock. `start`: `git pull --rebase --quiet`. `end`: strip into `transcripts/$CLAUDE_BACKUP_ENV/`; copy `~/.claude/usage-log.csv` to `usage-log/$CLAUDE_BACKUP_ENV.csv`; in the sandbox only, `user/settings.json` as every top-level key of `~/.claude/settings.json` whose value differs from `$CLAUDE_KIT_SETTINGS`'s, `hooks` excluded (`jq`), plus the two files; `git add -A memory transcripts usage-log user`; commit only if something is staged (`backup(<env>): <UTC timestamp>`); `pull --rebase`; on a conflict, `rebase --abort`, push `HEAD` to `conflict/<env>-<timestamp>`, `reset --hard origin/main`, and print the line; then `push`. Git output stays quiet; only the one line is printed.
- [x] **Step 4: run the tests; they pass**, then `pnpm check` (ShellCheck through lint, if the repository runs it on `*.sh`).
- [x] **Step 5: docs.** The tool page: the hook, what it copies and never copies, the conflict branch and how the owner resolves it.
- [x] **Step 6: commit and push.** `feat(sandbox): add the backup hook for Claude's configuration`.

### Task 4: The configuration repository and WSL's memory

🛑 Stop after this task. The owner creates the repository and installs the hook on WSL; Claude seeds it.

**Files:**
- Modify: `.claude/settings.json` (`autoMemoryDirectory`), `docs/development/setup.md`, `docs/development/working-with-claude.md`, `docs/architecture/threat-model.md`, ADR 0076

**Interfaces:**
- Consumes: `claude-backup.sh`, `strip-transcripts.py` (Tasks 2 and 3).
- Produces: `luiki-dev/claude-config` with the spec's [layout](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#the-configuration-repository), cloned at `~/claude-config` on WSL; Task 6 clones it in the sandbox.

- [x] **Step 1 (Claude): check `autoMemoryDirectory`'s scope** in Claude Code's [settings](https://code.claude.com/docs/en/settings) and [Memory](https://code.claude.com/docs/en/memory) pages (context7). If project settings do not accept it, it goes into the user settings of each environment instead (on WSL by the owner in Step 5, in the sandbox through Szop's layer in Task 7), recorded in the ADR.
- [x] **Step 2 (the owner):** creates the private repository `luiki-dev/claude-config`, empty, default branch `main`. The machine account becomes a collaborator in Task 5.
- [x] **Step 3 (Claude, announced):** clone to `~/claude-config`; copy `~/.claude/projects/-home-lemekk-workspace-szop/memory/` into `memory/szop/`; `~/.claude/settings.json` without `hooks` into `user/settings.json`, `~/.claude/CLAUDE.md` into `user/CLAUDE.md`, `~/.claude/statusline-command.sh` into `user/`; a `README.md` with the layout and the rule that no credential enters it; commit and push. Show the owner the file list before pushing.
- [x] **Step 4 (Claude): `autoMemoryDirectory`** `~/claude-config/memory/szop` in `.claude/settings.json` (or per Step 1).
- [x] **Step 5 (the owner): the hook on WSL.** Copies `sandbox/base/files/claude-backup.sh` and `strip-transcripts.py` into `~/.claude/hooks/`, and adds to `~/.claude/settings.json` the `SessionStart` and `SessionEnd` hooks Claude gives as a snippet. Runs `~/.claude/hooks/claude-backup.sh end` once by hand and times it; Claude reports the size of `transcripts/wsl/`.
- [x] **Step 6 (the owner): a new session on WSL** shows the memory loaded from `~/claude-config/memory/szop` (`/memory`), and its end pushes a backup commit. The old memory folder stays until the owner says it can go.
- [x] **Step 7 (Claude): docs.** `setup.md`: the clone and the hook on WSL, with a pointer to the runbook. `working-with-claude.md`: where memory lives now. `threat-model.md`: the configuration repository, the [trust flow table](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#the-configuration-repository), memory read on WSL, `user/` surviving a rebuild. The ADR: the first run's time and size.
- [x] **Step 8: commit and push.** `build(claude): move Claude's memory into the configuration repository`.

### Task 5: The machine account on Szop's repository

🛑 Stop after this task. The owner changes every setting; Claude writes the docs.

**Files:**
- Modify: `docs/development/github-settings.md`, `docs/architecture/threat-model.md`, `docs/roadmap.md` (PH-49's owner steps, if they differ)

- [ ] **Step 1 (the owner)**, per [OP-143](https://github.com/luiki-dev/szop/issues/428) as settled in PH-48: the machine account a collaborator with write access on `luiki-dev/szop` and `luiki-dev/claude-config`; its classic token with `repo`, `project`, `workflow`, `read:org`, kept in the password manager; the `main` ruleset requires the owner's approval; the `demo` environment's reviewer stays the owner. Claude cannot read rulesets (a deny rule); the owner confirms each item.
- [ ] **Step 2 (Claude): docs.** `github-settings.md`: every setting above with where it lives and why. `threat-model.md`: the machine account as an actor, its reach to `szop-ci-plan` through a workflow in a PR accepted (decision 7).
- [ ] **Step 3: `/phase-tracking`** for OP-143 (settled here), then commit and push. `docs(claude): record the machine account's access to Szop`.

### Task 6: The base layer and the kits' CI job

🛑 Stop after this task. Claude writes and runs the check script; the owner creates and removes the sandbox and gives the logins.

**Files:**
- Modify: `sandbox/base/base.yaml`, `base.dockerfile`, `base.sbxenv.yaml`
- Create: `sandbox/base/files/` (the install hook, `check-sandbox.sh`, `claude-start.sh`, the generic settings fragment, `aws-config`, `sandbox-notes.md`)
- Modify: `.github/workflows/ci.yml`, `docs/development/ci-cd.md`, `docs/development/tools/docker-sandboxes.md`, `docs/architecture/stack-overview.md`, `docs/architecture/threat-model.md`

**Interfaces:**
- Consumes: Task 1's probe answers; `claude-backup.sh` (Task 3); `luiki-dev/claude-config` (Task 4).
- Produces: the environment variables Szop's layer sets: `SANDBOX_PROJECT_DIR` (where Claude starts) and `SANDBOX_MEMORY_DIR` (only if Task 4, Step 1 moved `autoMemoryDirectory` to user settings); `/usr/local/bin/check-sandbox`, `/usr/local/bin/claude-start`.

- [ ] **Step 1: the base layer**, the spec's [list](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#the-base-layer) item by item, apt packages in the descriptor's `lifecycle@1` install hook (a mixin's overlay cannot carry them; ADR 0076, "Settled while building"): Node 24 for the whole system; `jq`, `flock` (`less` is already in the workload); git's `user.name` and noreply `user.email` from environment variables the environment file sets (no account name in the kit); the kit's `~/.claude/settings.json` saved as `~/.claude/kit-settings.json`, then `~/claude-config` cloned, `user/CLAUDE.md` copied to `~/.claude/owner-CLAUDE.md` and imported by one `@` line appended to the kit's `CLAUDE.md`, `user/settings.json` merged in with `jq`, `user/statusline-command.sh` copied to `~/.claude/` and the kit's status line command replaced by it, the backup hook added as `SessionStart`/`SessionEnd` with `CLAUDE_BACKUP_ENV=sandbox`; the three plugins with `claude plugin install`; `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`; the VS Code server's `telemetry.telemetryLevel` `off`; `~/.aws/config` with `claude-readonly` only; `gh auth setup-git`; the hosts every project needs (Anthropic's, GitHub's, the npm registry, the plugins' marketplaces, `mcp.context7.com`; the release notes' `github.com` is already in `balanced`) in the descriptor's `network-policy@1`, which adds them for the sandbox. `claude-start.sh`: `cd "$SANDBOX_PROJECT_DIR"`, `exec claude --permission-mode auto "$@"`, `node` on the `PATH`; the environment file's `entrypoint`/`cmd` (a mixin cannot set the start command) and a `claude` alias in `.bashrc` both use it; bypass mode never. Also from the record's list: `BRAINSTORM_PORT` fixed and the visual companion bound to `0.0.0.0`, the port published, and both told to Claude in `sandbox-notes.md`, imported by a second `@` line.
- [ ] **Step 2: `check-sandbox.sh`**, a `check "<name>" <command>` per check, running all and exiting non-zero with the failed checks' names: no Windows disk (`/mnt/c` absent); the host's and the LAN's ports blocked (`curl --fail` to `host.docker.internal` and the default gateway fails); no SSH agent (`SSH_AUTH_SOCK` unset); only placeholders for credentials (the GitHub token as `gh` sees it is the proxy's placeholder, per PH-48's record); `node` on the `PATH` of a login and a non-login shell.
- [ ] **Step 3: the CI job.** `changes` gains `sandbox` (`^sandbox/|^\.github/workflows/ci\.yml$`); a `kits` job, `needs: changes`, `if` that output, `permissions: contents: read`, `docker/setup-buildx-action` at the SHA the `docker` job uses, then `docker buildx build -f sandbox/base/base.yaml sandbox/base/` and the same for `szop` once it exists (Task 7 adds the line); `ci-ok` needs `kits`. `scripts/check-workflows.sh` passes.
- [ ] **Step 4: commit and push**, so the owner's sandbox and CI build the same commit. `build(sandbox): add the base layer and the kits' CI job`.
- [ ] **Step 5 (the owner): the sandbox.** From WSL, on the branch: `sbx.exe env create` of the base environment file (and an empty `SANDBOX_PROJECT_DIR` for now); `sbx secret set github --sandbox <name>` with the machine account's token; the Claude login.
- [ ] **Step 6 (Claude, announced): `sbx.exe exec <name> check-sandbox`** passes. In the sandbox (the owner's shell): `claude` starts in auto mode with the owner's status line; `gh auth status` shows the machine account; a session's end pushes a backup commit with `user/`. Fix what fails, commit, and the owner recreates the sandbox.
- [ ] **Step 7: docs.** `ci-cd.md`: the `kits` job and the `sandbox` output. The tool page: every file of `sandbox/base`. `stack-overview.md`: the sandbox and its layers. `threat-model.md`: the sandbox as an actor, passwordless `sudo` in a VM whose loss is accepted, host commands in environment files and the owner's review as a boundary. The ADR: what was settled.
- [ ] **Step 8: commit and push.** `docs(sandbox): document the base layer`.

### Task 7: Szop's layer

🛑 Stop after this task. Claude writes and runs the check scripts; the owner recreates the sandbox and does the logins.

**Files:**
- Create: `sandbox/szop/szop.yaml`, `szop.dockerfile`, `szop.sbxenv.yaml`, `sandbox/szop/files/check-szop.sh`, `compose.sandbox.yaml`
- Modify: `.github/workflows/ci.yml` (the `kits` job's second build), `docs/development/tools/docker-sandboxes.md`, `docs/development/scripts.md` (only if a `package.json` script is added)

**Interfaces:**
- Consumes: `SANDBOX_PROJECT_DIR`, `check-sandbox` (Task 6).

- [ ] **Step 1: the layer**, the spec's [list](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#szops-layer): `actionlint`, `zizmor`, `uv`, `terraform`, `tflint`, `trivy` at `setup.md`'s versions; pnpm through Corepack; `graphify`, and the graph built after the clone; Playwright's browsers with `playwright.download.prss.microsoft.com` among the hosts; the clone of `luiki-dev/szop` into `~/workspace/szop`, `pnpm install`, `apps/api/.env` from its example, `pnpm db:up`; `SANDBOX_PROJECT_DIR=~/workspace/szop`; Szop's hosts; the dev server's and the production-like environment's ports in `szop.sbxenv.yaml`; Chrome DevTools MCP pinned to a version and pointed at Playwright's Chromium (`--headless --isolated --executablePath`). `compose.sandbox.yaml` publishes the app on `0.0.0.0`; `compose.yaml` does not change.
- [ ] **Step 2: `check-szop.sh`:** the push hook blocks (`git push origin :refs/heads/x` as a `PreToolUse` input piped to `node .claude/hooks/guard-git-push.ts` exits 2); `pnpm check` passes; exits non-zero naming the failed check.
- [ ] **Step 3: commit and push.** `build(sandbox): add Szop's layer`.
- [ ] **Step 4 (the owner): the sandbox** from both environment files, base first; the secret and the logins as in Task 6.
- [ ] **Step 5 (Claude, announced): `sbx.exe exec`** of `check-sandbox` and `check-szop.sh` pass; `pnpm test:e2e` passes in the sandbox. The owner opens the dev server (`pnpm dev`, the `--host 0.0.0.0` form) and the production-like environment through `compose.sandbox.yaml` from Windows. If the journeys or the production-like environment need more, CPUs and memory are raised and the ADR says so.
- [ ] **Step 6: docs.** The tool page: every file of `sandbox/szop` and `compose.sandbox.yaml`. The ADR: what was settled.
- [ ] **Step 7: commit and push.** `docs(sandbox): document Szop's layer`.

### Task 8: The runbook and the rebuild

🛑 Stop after this task; then `/finish-phase`. Claude writes the runbook; the owner rebuilds from it, timed, and reads the lost machine part with Claude.

**Files:**
- Create: `docs/operations/docker-sandbox.md`
- Modify: `docs/development/tools/docker-sandboxes.md`, `docs/roadmap.md`, ADR 0076

- [ ] **Step 1: the runbook**, its parts from the spec: [working in the sandbox](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#working-in-the-sandbox) from VS Code (the `Include` line checked after every `sbx setup ssh`, `remote.downloadExtensionsLocally`); daily `sbx` use (commands, approvals with the never-approve rule, ports); [the rebuild](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#the-rebuild) and the lost machine; the owner's logins (`aws sso login --use-device-code --profile claude-readonly`, context7); adding a tool; [updating `sbx`](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#updating-sbx) with Task 1's release notes and way back, and "Last version proven"; [going back to WSL](../specs/2026-11-12-PH-49-docker-sandbox-setup-design.md#going-back-to-wsl); checking a sandbox's real disk use before keeping a second. A `## Contents`. Commit and push.
- [ ] **Step 2 (the owner): the rebuild** from the runbook, on a fresh `git pull` of the branch, timed: `sbx rm`, the two `sbx env` commands, the logins, `sbx setup ssh` and its `Include` line.
- [ ] **Step 3 (Claude and the owner): step 4 of the rebuild** in the spec: VS Code opens `~/workspace/szop` with a terminal; `check-sandbox` and `check-szop.sh` pass (Claude, `sbx.exe exec`); the end-to-end journeys pass; Claude starts in auto mode with the memory loaded and the status line shown; asked to `git push origin :refs/heads/x`, it is blocked by the push hook; `gh auth status` shows the machine account; `aws sts get-caller-identity` shows `claude-readonly`; a session's end pushes the backup.
- [ ] **Step 4 (the owner with Claude): the lost machine** part read through, not carried out; corrections made.
- [ ] **Step 5: record.** The runbook: the time, the `sbx` version as the last proven, the date. The ADR: the rebuild's result. The roadmap row and `/phase-tracking` for the phase's end of build.
- [ ] **Step 6: commit and push.** `docs(sandbox): add the sandbox runbook and record the rebuild`.
