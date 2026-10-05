# Setup guide

How to get from a clean Windows machine to a Szop checkout whose checks pass. It is steps only: each tool's page, linked from its step, explains what the tool is and why Szop uses it. Szop is developed in Windows Subsystem for Linux (WSL) with Ubuntu ([ADR 0005](../decisions/0005-development-environment.md)); every command below runs in the Ubuntu terminal unless a step says otherwise.

## Contents

- [1. Windows: WSL and Ubuntu](#1-windows-wsl-and-ubuntu)
- [2. git](#2-git)
- [3. nvm and Node](#3-nvm-and-node)
- [4. pnpm](#4-pnpm)
- [5. VS Code](#5-vs-code)
- [6. Clone and install](#6-clone-and-install)
- [7. Docker Desktop and the database](#7-docker-desktop-and-the-database)
- [8. Check that everything works](#8-check-that-everything-works)
- [9. Run the API](#9-run-the-api)
- [10. What the git hooks do](#10-what-the-git-hooks-do)
- [11. Coming later](#11-coming-later)

## 1. Windows: WSL and Ubuntu

In **PowerShell run as administrator** (Windows terminal, not Ubuntu):

```powershell
wsl --install -d Ubuntu
```

Restart Windows when asked, then open "Ubuntu" from the Start menu and create the Linux user it asks for. Microsoft's guide: <https://learn.microsoft.com/windows/wsl/install>.

## 2. git

```bash
sudo apt update && sudo apt install -y git
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global core.autocrlf false
```

`core.autocrlf false` because the repository's `.gitattributes` already handles line endings: line feed (LF) everywhere.

## 3. nvm and Node

Install nvm with the command in its README, which always shows the current version: <https://github.com/nvm-sh/nvm#installing-and-updating>. Then open a new terminal, so nvm is loaded, and install Node:

```bash
nvm install 24
```

The repository's `.nvmrc` holds `24` (the latest 24.x satisfies `engines.node`), so once the repository is cloned (step 6), a plain `nvm install` and `nvm use` in it read the file and pick the same version. The tool page, [Node and nvm](tools/node-and-nvm.md), explains the two files.

## 4. pnpm

```bash
npm install -g pnpm
```

Run it once per Node version. In the repository, pnpm switches to the version pinned in `package.json` by itself. More in [pnpm](tools/pnpm.md).

## 5. VS Code

1. Install VS Code on Windows (not in Ubuntu): <https://code.visualstudio.com/>.
2. Install its "WSL" extension.
3. In the Ubuntu terminal, inside the repository (after step 6), run `code .`. VS Code opens the folder from WSL.
4. Accept the prompt to install the recommended extensions.

More in [VS Code](tools/vscode.md).

## 6. Clone and install

Clone into the Linux file system (your home directory, for example `~/workspace`), not under `/mnt/c`, which is slow.

```bash
mkdir -p ~/workspace && cd ~/workspace
git clone https://github.com/luiki-dev/szop.git
cd szop
nvm use
pnpm install
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env` is the API's local configuration. Every variable in it is required (the API refuses to start without one), and `.env.example` documents each. `.env` is git-ignored and never committed.

`pnpm install` also sets up the git hooks. Pushing over HTTPS needs credentials: run `gh auth login` (GitHub CLI) or set up Git Credential Manager. If it stops with `ERR_PNPM_IGNORED_BUILDS`, a dependency wants to run an install script; see [pnpm](tools/pnpm.md) before allowing it.

## 7. Docker Desktop and the database

Install Docker Desktop for Windows (not in Ubuntu): <https://docs.docker.com/desktop/setup/install/windows-install/>. In *Settings → Resources → WSL integration*, turn it on for the Ubuntu distribution, and keep Docker Desktop running. Then, from the repository root:

```bash
docker compose up -d --wait
```

It downloads the PostgreSQL image the first time, starts the database and ends with `Container szop-postgres-1 Healthy`. The database keeps running across restarts of Docker Desktop until `docker compose stop`, and its data survives `docker compose down`. Details, and how to open `psql`, are in [Docker Compose and PostgreSQL](tools/docker-compose.md).

## 8. Check that everything works

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
```

Success looks like this:

- `pnpm lint` (ESLint) and `pnpm typecheck` (the TypeScript compiler) print only the command they ran and exit with no errors or warnings.
- `pnpm format:check` (Prettier) lists the files Prettier would change and exits with an error if there are any; when all is well it prints `All matched files use Prettier code style!`.
- `pnpm test` (Vitest) ends with the lines `Test Files … passed` and `Tests … passed`, with no `failed` in between.

What each check is, and how it is configured: [TypeScript](tools/typescript.md), [ESLint](tools/eslint.md), [Prettier](tools/prettier.md) and [Vitest](tools/vitest.md). CI runs the same scripts, except that it runs `pnpm test:coverage`, which is `pnpm test --coverage`: the same tests, plus coverage.

## 9. Run the API

```bash
pnpm dev
```

In a second terminal:

```bash
curl http://127.0.0.1:3000/api/health
```

It answers `{"status":"ok"}`. In the first terminal the log shows a `Server listening at http://127.0.0.1:3000` line, then two lines for the request: `incoming request` and `request completed`, with the status code and the time it took.

- **Ctrl+C** stops the API; its log says `shutting down` and pnpm prints `Done`.
- **Editing a file** under `apps/api/src` restarts it by itself.
- **If it does not start**, `pnpm dev` keeps running and waits for a change after printing the error; fix the cause and save, or press Ctrl+C. `Invalid configuration` followed by variable names means `.env` is wrong: compare it with `.env.example`. `node: .env: not found` means step 6's `cp` was skipped, and a `startup failed` line with `EADDRINUSE` means something else already uses the port, which is `PORT` in `.env`.

More in [tsx](tools/tsx.md) (what restarts the API), [pino-pretty](tools/pino-pretty.md) (what makes the log readable) and the [testing guide](testing.md).

## 10. What the git hooks do

On every commit, a pre-commit hook formats and lints the staged files, and a commit-msg hook checks that the message follows Conventional Commits. See [husky and lint-staged](tools/husky-and-lint-staged.md) and [commitlint](tools/commitlint.md).

## 11. Coming later

- **The web app**, in [PH-05](../roadmap.md#ph-05-spa-skeleton).

This guide grows with those phases.
