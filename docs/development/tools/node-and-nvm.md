# Node and nvm

Node.js is the JavaScript runtime that runs Szop's API, its development tools and the git push guard hook; nvm (Node Version Manager) installs Node versions and switches between them per user, without `sudo`.

## Why Szop uses it

[ADR 0005](../../decisions/0005-development-environment.md), decision 3: **nvm** with the current long-term-support (LTS, see the [glossary](../../glossary.md)) line, **Node 24**. nvm is the best known and was already installed. The alternatives (fnm, Volta and mise) are faster or manage several tools at once, which gains little here.

## Configuration

- **`.nvmrc`** (repository root) holds `24`: the major version only. `nvm install` and `nvm use` read it and pick the latest 24.x, so a security fix needs no change in the repository. The setup-node action of continuous integration (CI) reads the same file from PH-02 on.
- **`engines.node`** in `package.json` is `>=24.2 <25`: Node 24 from 24.2 on, nothing older or newer. The push hook relies on `import.meta.main`, which Node added in 24.2.0; on an older 24.x the hook would silently allow every push. pnpm enforces it through `engineStrict: true` in `pnpm-workspace.yaml` (see [pnpm](pnpm.md)), so `pnpm install` fails with `Unsupported engine` on another major version.

The two files say the same thing for different readers: `.nvmrc` tells nvm which version to install, `engines` tells pnpm which versions are acceptable.

## Everyday use

```bash
nvm install        # install the version in .nvmrc (the latest 24.x), if missing
nvm use            # switch the current shell to it
node --version     # check: v24.x.y
```

Run `nvm use` in each new shell, or after a new 24.x appears, run `nvm install` again. pnpm is installed per Node version, so after installing a new Node version run `npm install -g pnpm` once more (see [pnpm](pnpm.md)).

Node 24 can run `.ts` files directly by deleting the type annotations before running them (**type stripping**, see the [glossary](../../glossary.md)); it does not check types. The git push guard hook (`.claude/hooks/`) runs this way, with no build step.

## Official documentation

- nvm: <https://github.com/nvm-sh/nvm>
- Node's release schedule: <https://nodejs.org/en/about/previous-releases>
- Node's TypeScript support: <https://nodejs.org/api/typescript.html>
