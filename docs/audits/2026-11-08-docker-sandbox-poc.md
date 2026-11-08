# Docker Sandbox proof of concept

The steps of [PH-48](../roadmap.md#ph-48-docker-sandbox-proof-of-concept) and their results. The owner runs them by hand and fills in the Result columns; the reasons and the conditions for a GO are in [ADR 0075](../decisions/0075-docker-sandbox-poc-phase-details.md).

**The commands come from Docker's docs and have not been run yet.** `sbx` changes fast, so when one fails, check `sbx <command> --help` and note the difference here.

Results: ⬜ not run, ✅ as expected, ❌ not as expected. A ❌ on a line marked **GO** is a NO-GO unless a fix is found within the limit of two to three evenings.

## Contents

- [Before you start](#before-you-start)
- [Task 1: Start](#task-1-start)
- [Task 2: Isolation](#task-2-isolation)
- [Task 3: The project in the sandbox](#task-3-the-project-in-the-sandbox)
- [Task 4: Access from the host](#task-4-access-from-the-host)
- [Task 5: Credentials and the workflow](#task-5-credentials-and-the-workflow)
- [Task 6: The decision](#task-6-the-decision)

## Before you start

- **No credential enters the sandbox before Task 5.** Szop's repository is public, so cloning needs none, and Tasks 2 to 4 have nothing to lose.
- **Never put the owner's token or the profile `szop` in a sandbox**, not even for a quick try.
- **Don't run `sbx prune`, `sbx rm` or `sbx reset`** while the sandbox holds something you want to keep.
- **Times:** measure each one on WSL too, on the same commit, and on the second run of a command, so that a download doesn't count.

## Task 1: Start

In PowerShell on Windows. The first command needs an elevated prompt and a restart.

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All
winget install -h Docker.sbx
sbx login
sbx settings set ssh.agentForwardingEnabled false
sbx settings set telemetry.disabled true
sbx daemon restart
sbx policy init        # choose balanced
sbx policy ls
sbx create --name szop-poc claude
sbx run --name szop-poc
```

| Check | Expected | Result |
|---|---|---|
| Hypervisor Platform on Windows 11 Home | The feature turns on | ✅ |
| WSL and Docker Desktop afterwards: `wsl -l -v`, and `pnpm db:up` in WSL | Both work as before; this is the fallback | ✅ |
| The Claude kit loads ([its page](https://hub.docker.com/r/sbx/claude) warns of a name clash) | Claude Code starts | ✅ |
| `/login` with the subscription | Works | ✅ |
| `claude --version` on day one, against WSL's | Note both | ✅ WSL: 2.1.319; sbx: 2.1.319 |
| `claude update`, then stop and start the sandbox | The newer version stays; note the hosts it needed | ✅ Update passed and used "downloads.claude.ai:443" which was allowed |
| Where `/login` keeps its token: `ls -la ~/.claude*`, **without printing the contents** | Note it: a real token in the VM is a risk that ADR 0075 should record | ✅ ~/.claude/.credentials.json (600), accessToken is the placeholder sk-ant-oat01-proxy-managed, refreshToken has the same length: no real token on the VM's disk. The proxy manages the real one, so code in the sandbox could still use the subscription through it. |

## Task 2: Isolation

In a shell in the sandbox (`sbx exec -it szop-poc bash`), except where noted. Each ❌ here is a NO-GO, so look at the output rather than only the exit code.

| Check | Expected | Result |
|---|---|---|
| **GO** `mount`, `ls /mnt /media`, `ls /run/sandbox` | No Windows disk or folder | ✅ |
| **GO** `find / -iname '*OneDrive*' -o -iname '*Proton Drive*' -o -iname 'Dysk Google*' 2>/dev/null` | Nothing | ✅ |
| **GO** Start a server on Windows (`python -m http.server 9999`), then `curl -m 5 http://host.docker.internal:9999` | Blocked | ✅ |
| **GO** The same at Windows' LAN address and at the router's | Blocked | ✅ |
| **GO** `curl -m 5 http://host.docker.internal:2375`, and any Docker Desktop port you find | Blocked | ✅ |
| **GO** `docker run -d --name poc-marker nginx`, then `docker ps` on Windows and in WSL | The marker shows only in the sandbox | ✅ |
| `echo $SSH_AUTH_SOCK`, `ssh-add -L` | No agent | ✅ |
| `env`, `ls -la ~` | No credential of the owner | ✅ env: GH_TOKEN is a placeholder containing sbxproxymanaged. gh api user returns 401 Bad credentials, and sbx secret ls lists only anthropic (global, OAuth), with no github secret. ~: no .aws, .ssh, .config, .git-credentials, .netrc, .npmrc or Docker config.json; .claude holds only placeholders; .gitconfig holds no credentials or identity. |
| A clipboard write from the sandbox | Note whether it reaches Windows and if anything turns it off | ✅ Noted: the sandbox wrote poc-clipboard-test to the Windows clipboard via OSC 52, even with clipboard.textCopy at its default of false. Not a concern for the owner. |
| Opening a URL in the Windows browser, with `browser.enabled` at its default of `true`: `xdg-open https://example.com`, and a direct `POST` to `gateway.docker.internal:3128/_sbx/browser-open` as the `xdg-open` script makes | Note whether a tab opens by itself | ✅ No tab opens, from a shell or the Claude session: `xdg-open` only prints the URL, and the `POST` gets `403`. Tested only with `example.com`, with `SBX_HOST_SESSION_ID` unset |
| A host off the allow list: `curl -m 5 https://example.com` | Note how a block looks and how approving works | ✅ The proxy answers `403 Forbidden` with the text `Approval required for example.com:443`, so `curl` exits with 0: a script without `--fail` may not notice, and `sbx policy log` is the place to look. The request waits in `sbx policy approval ls`; `sbx policy approval respond <id> --option allow` takes effect at once (`200`) and leaves a rule on that sandbox only, removed with `sbx policy rm network --sandbox szop-poc --resource example.com:443`. No one-time option: only allow and dismiss. Attempts on the host and on private addresses wait in the same queue: never approve them (ADR 0075, "Settled while building"). `balanced` allows 195 network rules, broad ones among them (`**.amazonaws.com`, `**.blob.core.windows.net`, `github.com`), so it does not stop data leaving the sandbox |

Then clone the repository (Task 3's first commands) and, **with no credentials in the sandbox yet**, ask Claude to run these. Nothing can reach GitHub, so only the guard's answer matters.

| Check | Expected | Result |
|---|---|---|
| **GO** `gh pr merge 1` | Refused by the deny rule, under `--dangerously-skip-permissions` too | ✅ `Permission to use Bash with command gh pr merge 1 has been denied`. From a plain shell no guard applies: GitHub answers `401` |
| **GO** `git push --force origin HEAD:refs/heads/poc` | Refused by the deny rule or the push hook | ✅ Refused by the deny rule; the hook's message did not appear, so this does not test the hook |
| **GO** `git push origin :refs/heads/poc`, which the deny rules don't match | Refused by the push hook | ❌ Before Node is installed the hook lets it through: `node: command not found`, and only exit code 2 blocks. Git stopped only for lack of credentials. Tested again in Task 3 |

## Task 3: The project in the sandbox

In a shell in the sandbox.

```bash
git clone https://github.com/luiki-dev/szop.git
cd szop
# Node 24 and pnpm as in docs/development/setup.md, sections 3 and 4
pnpm install
```

| Check | Expected | WSL | Sandbox | Result |
|---|---|---|---|---|
| **GO** The push hook again, once Node 24 is installed and with no credentials yet: ask Claude to run `git push origin :refs/heads/poc` | `Blocked by .claude/hooks/guard-git-push.ts` | ➖ N/A | ➖ N/A | ⬜ |
| **GO** `pnpm install` | Works | | | ⬜ |
| **GO** `pnpm check` | Passes | | | ⬜ |
| **GO** `pnpm db:up` | The database starts in the sandbox's Docker | ➖ N/A | ➖ N/A | ⬜ |
| **GO** `pnpm test:e2e` (the browsers: setup.md) | Passes | | | ⬜ |
| **GO** `pnpm test:mutation` | Finishes; note the score against WSL's | | | ⬜ |
| **GO** `pnpm check:image`, with **no change to the Dockerfile** ([certificates](https://docs.docker.com/ai/sandboxes/troubleshooting/) may break downloads in a build) | Passes | | | ⬜ |
| **GO** `pnpm check:prodlike` | Passes | | | ⬜ |
| `pnpm check:workflows`, `pnpm check:infra`, `pnpm check:scan` | Note what is missing | | | ⬜ |

Also note:

| What | Value |
|---|---|
| The sandbox's CPU and memory (`nproc`, `free -h`), and how to change them | |
| `df -h` in the sandbox against the defaults of 20 GB and 10 GB for Docker | |
| The real size of `%LOCALAPPDATA%\DockerSandboxes` on Windows | |
| The same with a second sandbox created, then stopped | |
| The hosts this task needed, from `sbx policy log` | |

## Task 4: Access from the host

```powershell
sbx ports szop-poc --publish 5173:5173
```

Keep the host's port the same as the sandbox's, so that the app's origins don't change. Compose publishes on `127.0.0.1` in the sandbox, while `sbx ports` needs the service on all interfaces: if that blocks the prodlike environment, look for a way around it inside the sandbox before touching `compose.yaml`.

| Check | Expected | Result |
|---|---|---|
| **GO** The dev server with `--host 0.0.0.0` in Firefox and Chrome on Windows | Szop opens and works | ⬜ |
| **GO** Firefox on Android: `adb reverse tcp:5173 tcp:5173` on Windows | Szop opens and works | ⬜ |
| **GO** The prodlike environment (`pnpm check:prodlike --keep`) in a Windows browser | Szop opens over HTTPS | ⬜ |
| The prodlike environment on Android | Note what it takes | ⬜ |
| VS Code: `sbx setup ssh`, then Remote-SSH to `szop-poc.sbx` (needs the OpenSSH client) | Opens the clone, with a terminal | ⬜ |
| The hosts VS Code's server needed | Note them | ⬜ |
| Chrome DevTools MCP in the sandbox: a headless screenshot of Szop | Works **in the VM**; a stdio server through sbx's gateway would run on the host, which is not wanted | ⬜ |
| A Playwright report or a Stryker report in a Windows browser | Note how | ⬜ |

## Task 5: Credentials and the workflow

**GitHub.** Prepare with the owner's account outside the sandbox: a machine account ([one free one is allowed](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)) and its classic token (`repo`, `project`, `workflow`); a test repository owned by the owner, the account as a collaborator, a ruleset on `main` as Szop's plus a required approval, and an environment with the owner as its reviewer; and a test project under the owner, with the account as a collaborator.

```powershell
sbx secret set github    # paste the machine account's token
```

Run these in a shell in the sandbox rather than through Claude, so that GitHub is what answers, not the deny rules.

| Check | Expected | Result |
|---|---|---|
| `env \| grep -i -E 'gh\|github\|token'` | A placeholder at most, never the token | ⬜ |
| `gh issue create`, `gh pr create`, `git push` on a branch | Work | ⬜ |
| **GO** `gh project item-edit` on the test project | Works; this is what stopped the earlier token | ⬜ |
| **GO** `gh pr merge` on a green PR of its own | Refused by GitHub | ⬜ |
| **GO** Change the environment's protection, or a ruleset | Refused by GitHub | ⬜ |
| **GO** Approve a waiting deployment | Refused by GitHub | ⬜ |
| The owner approves and merges the same PR | Works; note the extra step | ⬜ |
| A workflow on a branch, naming the protected environment | Waits for the reviewer and gets no secret | ⬜ |
| What a branch or PR workflow could still reach, against Szop's roles (`szop-ci-plan` reads the Terraform states) | Note it for the machine account's open point | ⬜ |

**AWS.** Copy only the `claude-readonly` profile to `~/.aws/config` in the sandbox, then `aws sso login --profile claude-readonly --no-browser`.

| Check | Expected | Result |
|---|---|---|
| The login, and the hosts it needed | Works | ⬜ |
| **GO** `grep profile ~/.aws/config` | Only `claude-readonly` | ⬜ |
| `aws sts get-caller-identity` | The read-only role | ⬜ |
| **GO** `aws s3 mb s3://szop-poc-must-fail` | Access denied | ⬜ |
| **GO** `aws ssm get-parameter --name <any> --with-decryption` | Access denied | ⬜ |

**The workflow.**

| Check | Expected | Result |
|---|---|---|
| **GO** Install the plugins in the sandbox (superpowers first) | They load | ⬜ |
| The global `CLAUDE.md` copied in (the current one is an `@` link to `/mnt/c`) | Claude reads it | ⬜ |
| The memory: which directory the new path uses, and copying it | Claude reads it | ⬜ |
| The status line | Note what it takes | ⬜ |
| **GO** A small real job from brainstorm to a commit, say the fix of [#424](https://github.com/luiki-dev/szop/issues/424), not pushed to Szop | Skills, hooks and the graph work | ⬜ |
| `python3 scripts/token-usage.py` on that session | Reads the sandbox's transcripts | ⬜ |
| `sbx stop`, `sbx run --name szop-poc`, then `claude -c` | The session comes back | ⬜ |
| The number of hosts allowed by hand in that job, and how it felt | Note it; this is judged, not measured against a limit | ⬜ |

## Task 6: The decision

| Condition ([ADR 0075](../decisions/0075-docker-sandbox-poc-phase-details.md), decision 8) | Result | Notes |
|---|---|---|
| 1. Sees neither Windows nor the cloud files, reaches neither the host nor its Docker | ⬜ | |
| 2. Only `claude-readonly`, which can change nothing on AWS | ⬜ | |
| 3. The machine account works on a project, and cannot merge, change a protection or approve a deployment | ⬜ | |
| 4. Tests, end-to-end, StrykerJS, Compose and `docker build`, with the production Dockerfile unchanged | ⬜ | |
| 5. Szop in Firefox and Chrome on Windows, and in Firefox on Android | ⬜ | |
| 6. Plugins, deny rules, the push hook and Claude Code's updates | ⬜ | |

**How it felt, in the owner's words:**

**The decision:** ⬜ GO or NO-GO, recorded in ADR 0075's "Settled while building".

**What the setup phase must bring** (from every note above):
