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
- [9. Run the API and the page](#9-run-the-api-and-the-page)
  - [Run the production build](#run-the-production-build)
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

Szop needs Node 24.12 or later, the first version whose type stripping is stable, since the API runs its TypeScript files with Node itself in production (`engines.node` is `>=24.12 <25`). The repository's `.nvmrc` holds `24` (the latest 24.x satisfies `engines.node`), so once the repository is cloned (step 6), a plain `nvm install` and `nvm use` in it read the file and pick the same version. The tool page, [Node and nvm](tools/node-and-nvm.md), explains the two files.

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

## 9. Run the API and the page

PostgreSQL must be running first (section 7). Then one command starts both the API and the web app's dev server (Vite):

```bash
pnpm dev
```

In a second terminal:

```bash
curl http://127.0.0.1:3000/api/health
```

It answers `{"status":"ok","database":{"status":"up","schemaVersion":"0000_init"}}`. In the first terminal the log first shows `migrations applied` with the schema version, then a `Server listening at http://127.0.0.1:3000` line, then two lines for the request: `incoming request` and `request completed`, with the status code and the time it took. Vite's own output, with a `Local: http://localhost:5173/` line, is in the same terminal.

- **Ctrl+C** stops both the API and Vite; the API's log says `shutting down` and pnpm prints `Done`.
- **Editing a file** under `apps/api/src` restarts it by itself.
- **With the database stopped** while the API runs, `/api/health` answers `503` with `"down"`; it recovers by itself once the database is back.
- **If it does not start**, `pnpm dev` keeps running and waits for a change after printing the error; fix the cause and save, or press Ctrl+C. `Invalid configuration` followed by variable names means `.env` is wrong: compare it with `.env.example`. `node: .env: not found` means step 6's `cp` was skipped, a `startup failed` line with `EADDRINUSE` means something else already uses the port, which is `PORT` in `.env`, and a `startup failed` line with `ECONNREFUSED` means the database is not running: start it with `docker compose up -d --wait`. `Invalid configuration` naming `DATABASE_…` variables means `.env` predates the database: copy the database block from `.env.example`.

**The page.** The same `pnpm dev` also starts Vite, which serves the web app. With PostgreSQL running, open the address Vite prints, `http://localhost:5173`, in a browser. Open that one, not the API's: Vite forwards the page's `/api` requests to the API, so the browser sees a single address. The page's heading is "Szop", and its status line says:

- **`API: ok`, `Database: up` and `Schema version: 0000_init`:** the whole chain works, from the page through the API to PostgreSQL.
- **`API: reachable` and `Database: down`:** the API answers, but cannot reach PostgreSQL. Start it with `docker compose up -d --wait`; the next time the browser tab regains focus (or on a reload) the page updates.
- **`Can't reach the API`:** the page got no usable answer. Either the API is not running (Vite's proxy then answers `502` with an empty body, which the page treats as a failure), or `PORT` in `apps/api/.env` is not 3000: the proxy's target is the constant `http://127.0.0.1:3000` in `apps/web/vite.config.ts`, not a setting.
- **`Checking the API…`** shows briefly while the request is in flight.

Any other address, such as `/nowhere`, shows React Router's default error screen: only `/` exists so far.

More in [Vite](tools/vite.md) (the dev server and the proxy), [tsx](tools/tsx.md) (what restarts the API), [pino-pretty](tools/pino-pretty.md) (what makes the log readable) and the [testing guide](testing.md).

### Run the production build

`pnpm dev` is for working on the code. To run the app the way it runs in production, build the web app and let the API serve it, with PostgreSQL running (section 7):

```bash
pnpm build
pnpm start
```

- **`pnpm build`** runs Vite's production build, which writes the web app to `apps/web/dist/`, with a `.br` and a `.gz` copy next to every text file, and prints a line such as `first-screen JavaScript: 109.8 KB Brotli of 200.0 KB (1 chunks)`. It fails when that size passes 200 KB ([Vite](tools/vite.md) explains both).
- **`pnpm start`** runs the API with Node itself, `node --env-file=.env src/server.ts`, not tsx: no watch mode, and the log stays JSON, as in production. Stop it with Ctrl+C.
- **Open `http://localhost:3000`,** the API's own address: it serves the page and `/api` on one port, as in production, with no Vite in between. The page shows the same status line as in development.

The API finds the build through `WEB_ROOT` in `apps/api/.env`, the folder `pnpm build` writes, given relative to `apps/api`: `WEB_ROOT=../web/dist`. **An `.env` copied before this setting existed lacks it,** and the API then stops with `Invalid configuration` naming `WEB_ROOT`: add the line `WEB_ROOT=../web/dist` from `.env.example`. Until the first `pnpm build`, the folder does not exist, and `pnpm dev` logs a warning about it at startup; that is harmless, since in development Vite serves the page. A new build is picked up when the API restarts.

## 10. What the git hooks do

On every commit, a pre-commit hook formats and lints the staged files, and a commit-msg hook checks that the message follows Conventional Commits. See [husky and lint-staged](tools/husky-and-lint-staged.md) and [commitlint](tools/commitlint.md).

## 11. Coming later

- **Playwright** and the first end-to-end journey, in [PH-07](../roadmap.md#ph-07-first-e2e-journey).

This guide grows with those phases.
