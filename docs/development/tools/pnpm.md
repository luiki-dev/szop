# pnpm

pnpm is Szop's package manager: it installs the dependencies and runs scripts across the workspace, and it is strict about **phantom dependencies** (see the [glossary](../../glossary.md)): a package can import only what it declares.

## Why Szop uses it

- **pnpm workspaces, no task runner:** [ADR 0005](../../decisions/0005-development-environment.md), decisions 5 and 6. pnpm is strict, fast, saves disk space and has first-class workspaces. Turborepo and Nx would add caching that three packages do not need.
- **How it is installed:** [ADR 0016](../../decisions/0016-toolchain-details.md). Run `npm install -g pnpm` once per Node version; pnpm then reads `packageManager` and runs exactly that version. It uses tools already installed. Corepack (Node's bundled version switcher) is still experimental and is no longer bundled from Node 25, so it would break at the next Node upgrade. pnpm's standalone installer pipes a script from the internet into the shell.

## Configuration

**`packageManager`** in the root `package.json` is `pnpm@12.8.1`, the exact version every developer and CI use.

**`pnpm-workspace.yaml`:**

- `packages`: where the workspace's packages live (`apps/*` and `packages/*`). None exist yet; they arrive with their first real code.
- `engineStrict: true`: installing with a Node version outside `engines` fails instead of warning (see [Node and nvm](node-and-nvm.md)).
- `allowBuilds: {}`: the dependencies allowed to run install scripts. Empty means none ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18). When a dependency wants to run a build script, the install fails with `ERR_PNPM_IGNORED_BUILDS`. The owner then decides whether to allow it (`true`) or not (`false`); do not run `pnpm approve-builds` without asking.

**`pnpm-lock.yaml`** records the exact version of every dependency. It is committed and never edited by hand. It also records the pinned pnpm version.

## Everyday use

```bash
pnpm install              # install everything the lockfile lists
pnpm add -D -w <pkg>      # add a dev dependency to the workspace root
pnpm <script>             # run a script from package.json, for example pnpm lint
pnpm exec <bin>           # run a binary installed in the project
pnpm -r <script>          # once packages exist: run a script in every package
pnpm --filter <pkg> <script>   # once packages exist: run it in one package
```

`-w` is required to add to the workspace root; without it pnpm refuses, so a dependency does not land in the root by accident.

When "Already up to date" is printed, pnpm skips lifecycle scripts and the engine check. To force a full install, run `rm -rf node_modules && pnpm install`.

`npm install -g pnpm` may print `npm warn install-scripts 1 package has install scripts not yet covered by allowScripts: pnpm`. That is expected and harmless: pnpm works without those scripts, so there is nothing to allow.

## Official documentation

- Why pnpm: <https://pnpm.io/motivation>
- Workspaces: <https://pnpm.io/workspaces>
- Settings: <https://pnpm.io/settings>
- `pnpm approve-builds`: <https://pnpm.io/cli/approve-builds>
