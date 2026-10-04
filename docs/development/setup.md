# Setup guide

How to get from a clean Windows machine to a Szop checkout whose checks pass. It is steps only: each tool's page, linked from its step, explains what the tool is and why Szop uses it. Szop is developed in Windows Subsystem for Linux (WSL) with Ubuntu ([ADR 0005](../decisions/0005-development-environment.md)); every command below runs in the Ubuntu terminal unless a step says otherwise.

## Contents

- [1. Windows: WSL and Ubuntu](#1-windows-wsl-and-ubuntu)
- [2. git](#2-git)
- [3. nvm and Node](#3-nvm-and-node)
- [4. pnpm](#4-pnpm)
- [5. VS Code](#5-vs-code)
- [6. Clone and install](#6-clone-and-install)
- [7. Check that everything works](#7-check-that-everything-works)
- [8. What the git hooks do](#8-what-the-git-hooks-do)
- [9. Coming later](#9-coming-later)

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
```

`pnpm install` also sets up the git hooks. Pushing over HTTPS needs credentials: run `gh auth login` (GitHub CLI) or set up Git Credential Manager. If it stops with `ERR_PNPM_IGNORED_BUILDS`, a dependency wants to run an install script; see [pnpm](tools/pnpm.md) before allowing it.

## 7. Check that everything works

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
```

Success looks like this:

- `pnpm lint` (ESLint) and `pnpm typecheck` (the TypeScript compiler) print only the command they ran and exit with no errors or warnings.
- `pnpm format:check` (Prettier) lists the files Prettier would change and exits with an error if there are any; when all is well it prints `All matched files use Prettier code style!`.
- `pnpm test` ends with a summary that shows `fail 0` and every test under `pass`.

What each check is, and how it is configured: [TypeScript](tools/typescript.md), [ESLint](tools/eslint.md) and [Prettier](tools/prettier.md). These are the scripts CI runs.

## 8. What the git hooks do

On every commit, a pre-commit hook formats and lints the staged files, and a commit-msg hook checks that the message follows Conventional Commits. See [husky and lint-staged](tools/husky-and-lint-staged.md) and [commitlint](tools/commitlint.md).

## 9. Coming later

- **Docker Desktop and the database**, in [PH-04](../roadmap.md#ph-04-database).
- **Running the app**, in [PH-03](../roadmap.md#ph-03-api-skeleton).

This guide grows with those phases.
