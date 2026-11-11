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
| **GO** The push hook again, once Node 24 is installed and with no credentials yet: ask Claude to run `git push origin :refs/heads/poc` | `Blocked by .claude/hooks/guard-git-push.ts` | ➖ N/A | ➖ N/A | ✅ Blocked with the hook's message, but only with Claude started by hand in `~/workspace/szop` after `unset NPM_CONFIG_PREFIX` and `nvm use`. Started by a plain `sbx run`, Claude opens in `~/workspace`, so the project's settings, deny rules and hooks don't load at all: `sbx run --name szop-poc -w szop` (relative to `~/workspace`, or absolute) opens it in the repository; and the kit sets `NPM_CONFIG_PREFIX`, which stops nvm in `.bashrc`, so neither the hooks nor Claude's Bash tool find `node` |
| **GO** `pnpm install` | Works | 0.017 s | 0.026 s | ✅ Needs `unset NPM_CONFIG_PREFIX` and `nvm use` first; the second run has nothing to do, so the times show only that |
| **GO** `pnpm check` | Passes | 51.3 s | 48.1 s | ✅ Once `apps/api/.env` is copied and the database is up (setup.md, steps 6 and 7); without them Vitest crashes while printing the real error (`code.charCodeAt is not a function`) |
| **GO** `pnpm db:up` | The database starts in the sandbox's Docker | ➖ N/A | ➖ N/A | ✅ `postgres:18.6` pulled with no host to approve; `szop-postgres-1 Healthy` |
| **GO** `pnpm test:e2e` (the browsers: setup.md) | Passes | 98.5 s | 87.9 s | ✅ 136 passed, 17 skipped in both. `playwright install --with-deps` needed `playwright.download.prss.microsoft.com` approved; `apt` ran through `sudo` with no password asked |
| **GO** `pnpm test:mutation` | Finishes; note the score against WSL's | 39 min 21 s; score 87.37 (covered 90.83), 327 survived, 8 timeouts | 28 min 47 s; score 88.96 (covered 92.48), 268 survived, 3 timeouts | ✅ Finishes. The scores differ on the same code and the same `.env` keys, run one after the other, so something in the run is not deterministic; not caused by the sandbox as far as these numbers show. Comparing the two reports could tell which mutants differ (Task 4 opens a report from the sandbox on Windows) |
| **GO** `pnpm check:image`, with **no change to the Dockerfile** ([certificates](https://docs.docker.com/ai/sandboxes/troubleshooting/) may break downloads in a build) | Passes | 6.2 s | 4.0 s | ✅ Passes with the Dockerfile unchanged and no host to approve; the proxy's TLS did not break the build's downloads. The times are of a second run, from the layer cache |
| **GO** `pnpm check:prodlike` | Passes | 22.5 s | 19.7 s | ✅ Passes with nothing installed: `openssl` is in the kit's image |
| `pnpm check:workflows`, `pnpm check:infra`, `pnpm check:scan` | Note what is missing | ➖ N/A | ➖ N/A | ✅ Noted, none installed: `actionlint` (and so probably `zizmor` and `uv` after it), `terraform` (`check:infra` stops at `terraform fmt`, so `tflint` is unchecked) and `trivy`; setup.md, steps 8 and 9 |

Also note:

| What | Value |
|---|---|
| The sandbox's CPU and memory (`nproc`, `free -h`), and how to change them | 16 CPUs (all the host's), 15 GiB of memory, no swap. `sbx create --cpus <n> --memory <8g>`; the memory defaults to half the host's, clamped to 512 MiB–32 GiB |
| `df -h` in the sandbox against the defaults of 20 GB and 10 GB for Docker | `/`: 20 GB, 3.1 GB used after Task 3. `docker system df`: 1.4 GB of images, 1.2 GB of volumes, 2.4 GB of build cache (1.8 GB reclaimable) |
| The real size of `%LOCALAPPDATA%\DockerSandboxes` on Windows | 31.9 GB, the files' sum by `Get-ChildItem` (their apparent size: if the disk images are sparse, less is used on disk; not checked) |
| The same with a second sandbox created, then stopped | 63.3 GB, the same way, so about 31 GB for an empty sandbox. The second sandbox's Claude was logged in with no `/login`, and `/usage` showed the same subscription: the global `anthropic` secret reaches every sandbox |
| The hosts this task needed, from `sbx policy log` | Allowed by hand: `playwright.download.prss.microsoft.com`. Asked for and dismissed: `mcp.context7.com` (the repository's `.mcp.json`) and `http-intake.logs.us5.datadoghq.com` (probably Claude Code's telemetry or error reports, not confirmed). The rest, `postgres:18.6` included, was on `balanced`'s list |

## Task 4: Access from the host

```powershell
sbx ports szop-poc --publish 5173:5173
```

Keep the host's port the same as the sandbox's, so that the app's origins don't change. Compose publishes on `127.0.0.1` in the sandbox, while `sbx ports` needs the service on all interfaces: if that blocks the prodlike environment, look for a way around it inside the sandbox before touching `compose.yaml`.

| Check | Expected | Result |
|---|---|---|
| **GO** The dev server with `--host 0.0.0.0` in Firefox and Chrome on Windows | Szop opens and works | ✅ Opens and works in both, with no host to approve. `sbx ports` publishes on the host's `127.0.0.1` only. The flag goes without `--`: `pnpm --filter @szop/web dev --host 0.0.0.0`; with `-- --host` pnpm passes the `--` on and Vite ignores the flag (`Network: use --host to expose`), so nothing reaches the port |
| **GO** Firefox on Android: `adb reverse tcp:5173 tcp:5173` on Windows | Szop opens and works | ✅ Opens and works: the phone's `localhost:5173` reaches Windows' through `adb reverse`, and `sbx ports` takes it on to the sandbox |
| **GO** The prodlike environment (`pnpm check:prodlike --keep`) in a Windows browser | Szop opens over HTTPS | ✅ Opens and works at `https://localhost:8443` after the certificate warning, with `compose.yaml` unchanged and no host to approve. Compose publishes on the sandbox's `127.0.0.1`, so `socat TCP-LISTEN:8443,bind=172.17.0.1,fork,reuseaddr TCP:127.0.0.1:8443` in the sandbox forwards from the address `sbx ports` reaches, then `sbx ports szop-poc --publish 8443:8443` on Windows |
| The prodlike environment on Android | Note what it takes | ✅ Opens and works: `adb reverse tcp:8443 tcp:8443` on Windows, on top of the forwarder and the published port above, then the certificate warning accepted once in Firefox |
| VS Code: `sbx setup ssh`, then Remote-SSH to `szop-poc.sbx` (needs the OpenSSH client) | Opens the clone, with a terminal | ✅ Opens `/home/agent/workspace/szop` as `agent`, with a terminal, once `~/.ssh/config` is fixed by hand: `sbx setup ssh` wrote its `Include` with both paths in one pair of quotes, so OpenSSH skipped it and `szop-poc.sbx` did not resolve. The included `Host *.sbx` runs `sbx.exe ssh proxy %n` with `IdentityAgent none` and `IdentityFile /dev/null`: no key or agent of Windows reaches the sandbox. It warns that Claude Desktop needs `sh` on the PATH; not needed for VS Code |
| The hosts VS Code's server needed | Note them | ✅ None: connecting and installing an extension worked with every request dismissed; the extension came through VS Code's fallback of downloading on Windows (`remote.downloadExtensionsLocally`). Asked for and dismissed: telemetry (`mobile.events.data.microsoft.com`, `default.exp-tas.com`, `westus-0.in.applicationinsights.azure.com`, `http-intake.logs.us5.datadoghq.com`), `main.vscode-cdn.net`, the Marketplace (`ms-ossdata.gallery.vsassets.io`, `ms-ossdata.gallerycdn.vsassets.io`), `mcp.context7.com`, and the cloud metadata service (`169.254.169.254`, `metadata.google.internal`), which is never approved. `sbx policy approval respond` takes one ID; a PowerShell loop over `sbx policy approval ls` dismisses them all |
| Chrome DevTools MCP in the sandbox: a headless screenshot of Szop | Works **in the VM**; a stdio server through sbx's gateway would run on the host, which is not wanted | ✅ Works in the VM: `claude mcp add chrome-devtools --scope local -- npx -y chrome-devtools-mcp@latest --headless --isolated --executablePath <Playwright's Chromium>`, with Claude started by hand after `nvm use`; the screenshot of the dev server, checked in VS Code, shows Szop with the API and the database up. Chromium asked for `clients2.google.com`, `accounts.google.com` and `edgedl.me.gvt1.com`, all dismissed with no effect on the screenshot |
| A Playwright report or a Stryker report in a Windows browser | Note how | ✅ Stryker's report opens at `http://localhost:9000/mutation.html`: `python3 -m http.server 9000 --bind 0.0.0.0 -d reports/mutation` in the sandbox, `sbx ports szop-poc --publish 9000:9000` on Windows, no host to approve. Playwright writes no HTML report in this repository. The two runs' reports were not compared, the owner's choice, so why Task 3's scores differ stays open |

## Task 5: Credentials and the workflow

**GitHub.** Prepare with the owner's account outside the sandbox: a machine account ([one free one is allowed](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)) and its classic token (`repo`, `project`, `workflow`, and `read:org`, which `gh project` needs to resolve a user's project); a test repository owned by the owner, the account as a collaborator, a ruleset on `main` as Szop's plus a required approval, and an environment with the owner as its reviewer; and a test project under the owner, with the account as a collaborator.

```powershell
sbx secret set github    # paste the machine account's token
```

Run these in a shell in the sandbox rather than through Claude, so that GitHub is what answers, not the deny rules.

| Check | Expected | Result |
|---|---|---|
| `env \| grep -i -E 'gh\|github\|token'` | A placeholder at most, never the token | ✅ Only `GH_TOKEN=gho_sbxproxymanaged000…`, a placeholder. The secret is scoped to the sandbox (`sbx secret set github --sandbox szop-poc`; secrets are global by default). `gh api user` answers `luiki-dev-claude`, and `gh auth status` shows the scopes `project`, `repo`, `workflow`, with a warning that `read:org` is missing |
| `gh issue create`, `gh pr create`, `git push` on a branch | Work | ✅ All work through the proxy on the test repository, with `gh auth setup-git` as git's credential helper and the account's `user.name` and noreply `user.email` set in the clone. A direct `git push origin HEAD:main` is refused by the ruleset |
| **GO** `gh project item-edit` on the test project | Works; this is what stopped the earlier token | ✅ `item-add` and `item-edit` set Status to Done on the test project. Every `gh project` command first failed with `unknown owner type`: without the scope `read:org`, `gh` cannot tell whether the owner is a user or an organisation. A direct `gh api graphql` query of `user(login: "luiki-dev") { projectV2(number: 4) }` worked without it, so the token's access was never the problem; `read:org` was added to the token, whose value stays the same |
| **GO** `gh pr merge` on a green PR of its own | Refused by GitHub | ✅ Refused: `gh pr review --approve` on its own PR, `gh pr merge --merge` (the ruleset's required approval) and `gh pr merge --merge --admin`; the PR stays open |
| **GO** Change the environment's protection, or a ruleset | Refused by GitHub | ✅ Refused: `PUT` of the `demo` environment with no reviewers, `DELETE` of the environment and `DELETE` of the ruleset; both stay unchanged in the browser |
| **GO** Approve a waiting deployment | Refused by GitHub | ✅ Refused: with the `inside` job waiting, `pending_deployments` lists `demo` with `current_user_can_approve: false`, and the `POST` approving it answers `422 No pending deployment requests to approve or reject`, a misleading message for a non-reviewer; the job keeps waiting until the owner rejects it |
| The owner approves and merges the same PR | Works; note the extra step | ✅ Works. The extra step is a review: Files changed → Submit review → Approve → Submit review, then the merge |
| A workflow on a branch, naming the protected environment | Waits for the reviewer and gets no secret | ✅ A workflow pushed by the account on a branch (`on: push`) runs; its job in `demo` waits for the owner, and a job outside the environment sees `POC_SECRET` as empty (`false`). Pushing a workflow file needs the scope `workflow`. A plain `run: echo "… : ${{ … }}"` breaks the YAML; `run: \|` fixed it |
| What a branch or PR workflow could still reach, against Szop's roles (`szop-ci-plan` reads the Terraform states) | Note it for the machine account's open point | ✅ Read from `infra/base/ci_roles.tf` and [GitHub's settings](../development/github-settings.md#environments), not tried on Szop. **`szop-ci-plan` stays reachable with no review:** its trust matches any `pull_request` run of the repository, so an account with Write can push a branch with its own workflow, open a PR, and read the infrastructure and the Terraform states. `szop-ci-deploy` through `demo` needs the owner's approval of the run, which the account cannot give (above); `demo-teardown` and `release` are pinned to `main`, which takes an approved PR. Szop keeps no repository secrets, only the roles' ARNs as variables, and *Allow GitHub Actions to create and approve pull requests* is off, so a workflow's `GITHUB_TOKEN` cannot approve the account's PR either. The same holds today for any session with the owner's token |

**AWS.** Copy only the `claude-readonly` profile to `~/.aws/config` in the sandbox, then `aws sso login --profile claude-readonly --no-browser`.

| Check | Expected | Result |
|---|---|---|
| The login, and the hosts it needed | Works | ✅ `aws sso login --use-device-code`, the code approved in a Windows browser as Claude's user; no host to approve. The AWS CLI was installed from `awscli.amazonaws.com`, on `balanced`'s list. The CLI's attempt to open the browser was blocked (`browser-open` to the portal's host in `sbx policy log`) and did not matter. The SSO cache in `~/.aws/sso/cache` holds two files (`600`), the tokens ADR 0075 expects in the sandbox |
| **GO** `grep profile ~/.aws/config` | Only `claude-readonly` | ✅ Only `[profile claude-readonly]`, written from the runbook's block |
| `aws sts get-caller-identity` | The read-only role | ✅ `assumed-role/AWSReservedSSO_ClaudeReadOnly_…/claude` |
| **GO** `aws s3 mb s3://szop-poc-must-fail` | Access denied | ✅ `AccessDenied`: no identity-based policy allows `s3:CreateBucket` |
| **GO** `aws ssm get-parameter --name <any> --with-decryption` | Access denied | ✅ `AccessDeniedException` with an explicit deny, on an existing parameter (`/szop/better-auth-secret`, found by `describe-parameters`, which the role may list) |

**The workflow.**

| Check | Expected | Result |
|---|---|---|
| **GO** Install the plugins in the sandbox (superpowers first) | They load | ✅ `claude plugin install` of `superpowers` and `typescript-lsp` (`claude-plugins-official`) and `ponytail` (its own marketplace): all enabled in `/plugin`. Plugins synced from claude.ai arrive by themselves with the subscription's login: `andrej-karpathy-skills@synced` loads in the sandbox though it is disabled on WSL, and `superpowers@synced` gives way to the installed one of the same name |
| The global `CLAUDE.md` copied in (the current one is an `@` link to `/mnt/c`) | Claude reads it | ✅ The kit's own `~/.claude/CLAUDE.md` kept; the owner's file pasted into `~/.claude/owner-CLAUDE.md` without the WSL section, and imported by a line `@~/.claude/owner-CLAUDE.md` appended to the kit's. Claude names its rules |
| The memory: which directory the new path uses, and copying it | Claude reads it | ✅ `~/.claude/projects/-home-agent-workspace-szop/memory`, from the clone's path; the 14 files dragged from `\\wsl$` in VS Code's explorer over Remote-SSH. Claude answers from them |
| The status line | Note what it takes | ✅ `~/.claude/statusline-command.sh` (needs only `git` and `python3`) copied to `/home/agent/.claude/` through VS Code, and `statusLine` added to the kit's `~/.claude/settings.json` by a Python snippet. The kit's own value was `{'type': 'command', 'command': '/usr/local/bin/sbx-claude-hook claude-status'}`, replaced. Looks fine to the owner |
| **GO** A small real job from brainstorm to a commit, say the fix of [#424](https://github.com/luiki-dev/szop/issues/424), not pushed to Szop | Skills, hooks and the graph work | ⬜ |
| superpowers' visual companion (the brainstorm's mockups) in a Windows browser: its server started with `--host 0.0.0.0 --url-host localhost` and a fixed `BRAINSTORM_PORT`, published by `sbx ports` | The mockup opens from the URL with its key | ⬜ |
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

- Node 24 on the PATH of the process that starts Claude, before it starts: the hooks run `node`, and without it the push hook lets everything through (Task 3). The kit sets `NPM_CONFIG_PREFIX`, which stops nvm, so either reconcile the two or bring Node another way.
- Claude started in the repository (`sbx run -w szop`), or the project's settings, deny rules and hooks don't load.
- `apps/api/.env` and the database up before the first `pnpm check`, as on WSL.
- A pager: the image has no `less`, so `git log` fails until `GIT_PAGER=cat` or `core.pager` is set.
- The tools `pnpm check:workflows`, `check:infra` and `check:scan` need: `actionlint`, `zizmor`, `uv`, `terraform`, `tflint`, `trivy`; and Playwright's browsers, which need `playwright.download.prss.microsoft.com` allowed.
- The status line: copy the script and set `statusLine` in the kit's `settings.json`, replacing the kit's `sbx-claude-hook claude-status`.
- Claude's settings and memory brought into a fresh sandbox by the setup script (`settings.json`, the status line, the global `CLAUDE.md`, the memory directory), copied by hand in Task 5. Their source is not decided yet; the owner also wants a backup of them wherever Claude works, WSL and the sandbox alike. Left for later.
- Claude's permission mode: the owner wants auto mode, not bypass permissions (`--dangerously-skip-permissions`). With auto mode set in the settings, Claude started by `sbx run` still does not start in it, while `claude` started from the sandbox's bash does (Task 5). So start Claude by hand, as Node and the hooks already require, or find how the kit's start can be changed.
- A decision on `mcp.context7.com` (the repository's `.mcp.json`) and on Claude Code's telemetry host `http-intake.logs.us5.datadoghq.com`, both dismissed in Task 3.
- Consider narrowing the allow list: `balanced` has 195 rules in 6 removable groups, broad ones among them, so it does not stop data leaving.
- Settings to decide: `model.server.enabled` is true and nothing needs it; `env.rememberHostCommands` stays false, since environments can run commands on the host; `sandbox.fuse` true and `kit.requireSignature` false.
- The agent has `sudo` with no password: acceptable in a VM whose loss is accepted, but note it.
- The global `anthropic` secret reaches every sandbox (Task 3, a second sandbox).
- Disk: about 31 GB per sandbox by the files' apparent size; check what a sandbox really takes on disk before keeping more than one.
- The machine account's `user.name` and `user.email` for commits: `.gitconfig` has neither.
- The repository's `.mcp.json` brings context7, which in the sandbox asks to sign in and needs `mcp.context7.com` allowed: decide both together (Task 5).
- Which plugins come synced from claude.ai: they reach every sandbox with the login, whatever is enabled on WSL (Task 5).
- The AWS CLI and the `claude-readonly` block in `~/.aws/config`, from the runbook, with `aws sso login --use-device-code` as Claude's user: the CLI cannot open a Windows browser (Task 5).
- The machine account's classic token with `read:org` besides `repo`, `project` and `workflow`, or every `gh project` command fails with `unknown owner type`; and `gh auth setup-git` so that `git push` goes through the proxy (Task 5).
- Read the kit's own `~/.claude/CLAUDE.md` (about 20 KB) and `settings.json` before copying the global `CLAUDE.md` over them.
- Under `--dangerously-skip-permissions`, Claude ran reads and a `git push --dry-run` beyond what it was asked: only the deny rules and hooks set the limit.
- The dev server started with `--host 0.0.0.0` (without `--` after the script's name), or `sbx ports` has nothing to forward (Task 4).
- A way to reach Compose's ports, which publish on `127.0.0.1`, such as the `socat` forwarder bound to the sandbox's `172.17.0.1` (Task 4).
- `sbx setup ssh` writes a broken `Include` into `~/.ssh/config`: fix it by hand, and check it again after every `sbx setup ssh` (Task 4).
- VS Code needs no host allowed: keep it so, with `remote.downloadExtensionsLocally` set to `true` if the fallback ever stops (Task 4).
- The visual companion's server bound to `0.0.0.0` on a fixed port (`BRAINSTORM_PORT`), that port published once, and both told to Claude in the global `CLAUDE.md`: by default it binds `127.0.0.1` on a random port, and `xdg-open` only prints the URL (Task 4).
- Chrome DevTools MCP pinned to a version and pointed at a Chromium in the VM; the PoC used `@latest` and Playwright's (Task 4).
- The owner's deny rule for `mobile.events.data.microsoft.com:443` does not stop the host: it keeps adding entries to `sbx policy log` (Task 5). Whether it still reaches the approval queue is not noted.
- Telemetry requests come back after being dismissed (`http-intake.logs.us5.datadoghq.com`, `mobile.events.data.microsoft.com` with the same IDs through Task 4): decide a deny rule or turning the telemetry off, so the queue shows only what matters (Task 4).
- A guide to `sbx` for daily use: the commands, approvals, ports, recreating a sandbox (the owner's request in Task 3).
