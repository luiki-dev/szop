# PH-01 Monorepo and toolchain — design

- **Phase:** [PH-01](../../roadmap.md#ph-01-monorepo-and-toolchain)
- **Date:** 2026-10-02
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-005](../../open-points.md#op-005) (PH-01 part), [OP-008](../../open-points.md#op-008), [OP-009](../../open-points.md#op-009), [OP-062](../../open-points.md#op-062) (PH-01 part)

The repository becomes a pnpm workspace in strict TypeScript, with linting, formatting and commit message checks running on every commit. The direction was settled by [ADR 0005](../../decisions/0005-development-environment.md) (the development environment), [ADR 0009](../../decisions/0009-git-workflow.md), decision 16 (commitlint) and [ADR 0012](../../decisions/0012-security-baseline.md), decision 18 (pnpm's install scripts). This spec holds the details those ADRs left to the setup phase, as agreed in the brainstorm.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Layout, Node and pnpm](#layout-node-and-pnpm)
  - [TypeScript](#typescript)
  - [ESLint](#eslint)
  - [Prettier](#prettier)
  - [VS Code](#vs-code)
  - [Git hooks](#git-hooks)
  - [commitlint](#commitlint)
  - [The push hook](#the-push-hook)
- [Documentation and records](#documentation-and-records)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: the repository is a pnpm workspace in strict TypeScript. `pnpm lint` and `pnpm typecheck` pass, staged files are formatted and linted on every commit, and a commit message that does not follow Conventional Commits is rejected.

The phase is done when, on a fresh clone with Node 24 and pnpm installed as `setup.md` says:

- `pnpm install` succeeds, runs no dependency install scripts, and sets up the git hooks;
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm exec prettier --check .` pass;
- a deliberate type error fails `pnpm typecheck`, and a floating promise fails `pnpm lint`;
- a commit of a badly formatted file is formatted by the pre-commit hook, and a commit with a lint error is blocked;
- commitlint rejects `foo: bar` and `feat(aip): x`, and accepts a valid message and a merge commit;
- the Claude Code push hook still refuses `git push -h :x` and `git push -uf -h`;
- `setup.md`, the tool pages and the README's "Development" section describe all of the above.

## Out of scope

- `compose.yaml`, `.env` and `.env.example`: PH-04, with the database ([ADR 0014](../../decisions/0014-roadmap.md), decision 7).
- Any workspace package (`apps/api`, `apps/web`, `packages/shared`): each arrives with its first real code, in PH-03, PH-05 and the first phase that shares code.
- Vitest and the rest of the test tooling: PH-03 onwards.
- The React Hooks ESLint rules: PH-05. The Tailwind CSS Prettier plugin and editor extension: PH-14.
- CI: PH-02.
- Docker Desktop and "run the app" in `setup.md`: PH-04 and PH-03, when there is something to run.

## Decisions taken in the brainstorm

Each refines an accepted ADR or fills a detail it left open; ADR 0016 records them.

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | What the workspace holds | Root only; empty shells for all three packages; only `packages/shared` | **Root only.** Packages arrive with their first real code, like `compose.yaml`; shells would be placeholder code rewritten by PH-03 and PH-05. Until then `pnpm -r` has nothing to run across. |
| 2 | Installing pnpm | `npm install -g pnpm` and pnpm's own version switching; Corepack; pnpm's standalone installer | **`npm install -g pnpm` once per Node version; pnpm then switches itself to the version in `packageManager`.** It uses tools already installed. Corepack is still experimental and is no longer bundled from Node 25, so it would break at the next Node upgrade. The standalone installer pipes a script from the internet into the shell. |
| 3 | The push hook's language | TypeScript run by Node's type stripping; JavaScript checked through JSDoc (`checkJs`); JavaScript, not type-checked | **TypeScript (`guard-git-push.ts`), run directly by Node 24.** With a root-only workspace it is the only real code, so it is what makes "strict TypeScript" true in this phase. It keeps no build step and no dependencies. ADR 0005, decision 9 turned type stripping down for the API because of workspace imports and path resolution, which a standalone file does not have. Refines [ADR 0015](../../decisions/0015-git-push-guard-hook.md), decision 3. |
| 4 | Running the hook's tests | `pnpm test` runs `node --test` until Vitest arrives; a permanent `pnpm test:hooks` | **`pnpm test` runs `node --test` until PH-03, which moves the tests into a Vitest project.** `pnpm test` keeps meaning "every test" ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 18) and CI runs one command. |
| 5 | ESLint strictness | `strictTypeChecked`; `recommendedTypeChecked`; `strictTypeChecked` plus `stylisticTypeChecked` | **`strictTypeChecked`.** Beyond bugs, it flags code that is probably wrong (unnecessary conditions, non-null assertions). Loosening later is easy; tightening an existing codebase is not. Style is Prettier's job. |
| 6 | Commit scopes | An allow-list (`scope-enum`); any scope | **An allow-list; the scope stays optional.** Typos and near-duplicates are rejected, and the changelog groups cleanly. The list covers the workspaces, the requirement areas, the doc types and the tooling (see [commitlint](#commitlint)); a PR that needs a new scope adds it. Refines [ADR 0009](../../decisions/0009-git-workflow.md), decision 9, whose own examples already went beyond its listed scopes. |
| 7 | Markdown and Prettier | A one-off reformat of all docs; formatting docs only when touched; code only | **Code only: `.prettierignore` excludes `*.md`.** A trial on a copy of the docs showed Prettier pads every table to its widest cell: the glossary grows from 39 KB to 93 KB, each row of ADR 0011's decision table becomes 2,583 characters, and an edit to one long cell rewrites the whole table in the diff. Prettier has no option to turn table alignment off. A Markdown linter that checks without reformatting becomes a candidate (OP-063). Refines [ADR 0005](../../decisions/0005-development-environment.md), decision 12. |
| 8 | Prettier options | Prettier's defaults; a few tweaks such as single quotes | **The defaults** (`{}`), Prettier's own advice. |
| 9 | Spec and plan file names | `YYYY-MM-DD-<topic>`; with the phase ID after the date | **The phase ID after the date, in uppercase as the project writes its IDs:** `2026-10-02-PH-01-monorepo-and-toolchain-design.md`. All files of a phase are found with `ls *PH-01*`, and the date still sorts them. Nothing in superpowers parses the names: the plan refers to its spec by path. Work outside phases keeps `date-topic`. |

## Design

### Layout, Node and pnpm

At the end of the phase the repository root holds:

```
package.json            scripts, engines, packageManager
pnpm-workspace.yaml     packages (apps/*, packages/*) and pnpm settings
pnpm-lock.yaml
.nvmrc                  24
.gitattributes          LF line endings
.gitignore              + node_modules/
tsconfig.base.json      strict ESM base, extended by every package later
tsconfig.json           the root's own files
eslint.config.js
.prettierrc.json        {}
.prettierignore
lint-staged.config.js
commitlint.config.js
.husky/                 pre-commit, commit-msg
.vscode/                extensions.json, settings.json
.claude/hooks/          guard-git-push.ts, guard-git-push.test.ts
```

- **`package.json`:** `"private": true`, `"type": "module"`, `engines.node` `>=24.2 <25`, `packageManager` with the exact pnpm version (the latest 12.x when the task runs). Scripts:
  - `lint`: `eslint .`
  - `typecheck`: `tsc --noEmit` (the workspace packages join it as they arrive)
  - `format`: `prettier --write .`
  - `test`: `node --test ".claude/hooks/*.test.ts"` until PH-03
  - `prepare`: `husky`
- **`pnpm-workspace.yaml`:** `packages: [apps/*, packages/*]`; `engineStrict: true`, so installing with the wrong Node fails; no dependency is allowed to run install scripts (an empty allowlist, [ADR 0012](../../decisions/0012-security-baseline.md), decision 18).
- **`.nvmrc`:** `24`, the major only, matching `engines`. `nvm install` and `nvm use` pick the latest Node 24, and CI's setup-node reads the same file in PH-02.
- **`.gitattributes`:** `* text=auto eol=lf`, and `binary` for images.
- **`.gitignore`:** adds `node_modules/` and any cache the tools write (ESLint, TypeScript), if used.
- **pnpm on a machine:** `npm install -g pnpm` once per Node version; pnpm then reads `packageManager` and runs exactly that version.

### TypeScript

Dependencies: `typescript`, `@types/node`.

- **`tsconfig.base.json`:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`, `module` and `moduleResolution` `NodeNext`, `target` and `lib` `ES2024`, `skipLibCheck`. `apps/web` switches to `Bundler` resolution in PH-05. `exactOptionalPropertyTypes` is left out: often noisy with libraries, and easy to turn on later.
- **`tsconfig.json` (root):** extends the base; `noEmit`, `erasableSyntaxOnly` (only syntax Node can strip), `allowImportingTsExtensions` (Node needs `./guard-git-push.ts` written out), `allowJs` and `checkJs`. It includes the root `*.js` configs and `.claude/hooks/**/*.ts`.

### ESLint

Dependencies: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`.

One flat `eslint.config.js` at the root: `js.configs.recommended`, `tseslint.configs.strictTypeChecked` with `parserOptions.projectService` (each file is linted with its own tsconfig), and `eslint-config-prettier` last, turning off the rules that would fight Prettier. It ignores `node_modules/` and `docs/`.

### Prettier

Dependency: `prettier`.

- **`.prettierrc.json`:** `{}`, the defaults: double quotes, 80 columns, trailing commas.
- **`.prettierignore`:** `*.md`, the HTML mockups in `docs/architecture/visual-design/` (hand-made design artifacts), `pnpm-lock.yaml`.

### VS Code

- **`.vscode/extensions.json`:** recommends ESLint (`dbaeumer.vscode-eslint`), Prettier (`esbenp.prettier-vscode`) and Container Tools (`ms-azuretools.vscode-containers`).
- **`.vscode/settings.json`:** Prettier as the default formatter, format on save, ESLint fixes on save, and the workspace's TypeScript (`typescript.tsdk`) with the prompt to use it.

### Git hooks

Dependencies: `husky`, `lint-staged`.

- **`.husky/pre-commit`:** `pnpm exec lint-staged`. **`.husky/commit-msg`:** `pnpm exec commitlint --edit "$1"`. `pnpm install` installs them through the `prepare` script. They run for every commit, the owner's and Claude's.
- **`lint-staged.config.js`**, on staged files only:
  - `*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`: `eslint --fix --max-warnings=0`, then `prettier --write`. The glob is every type ESLint lints, so a phase adding `.tsx` is covered without anyone remembering to extend it.
  - every other file: `prettier --write --ignore-unknown`, which honours `.prettierignore` (Markdown is skipped) and skips types Prettier does not know.
- Type checks and tests stay out of the hooks ([ADR 0005](../../decisions/0005-development-environment.md), decision 13); they belong to CI.

### commitlint

Dependencies: `@commitlint/cli`, `@commitlint/config-conventional`.

`commitlint.config.js` extends the preset, and:

- turns off `body-max-line-length` and `footer-max-line-length` ([OP-009](../../open-points.md#op-009)): Dependabot's bodies and our `Claude-Session` trailer hold long links;
- limits `type-enum` to the nine types of [ADR 0009](../../decisions/0009-git-workflow.md), decision 9: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`;
- sets `scope-enum` to this list (the scope stays optional):
  - **workspaces:** `web`, `api`, `shared`
  - **features, one per requirement area:** `accounts`, `lists`, `items`, `ordering`, `categories`, `catalog`, `units`, `templates`, `sharing`, `sync`, `limits`, `connectivity`
  - **docs:** `adr`, `spec`, `plan`, `requirements`, `audit`, `roadmap`
  - **tooling:** `infra`, `deps` (Dependabot), `main` (release-please's `chore(main): release …`), `claude` (`.claude/`)

Merge commits ("Merge branch 'main' into …") are ignored by commitlint's defaults.

### The push hook

[OP-062](../../open-points.md#op-062), PH-01 part.

- `guard-git-push.mjs` becomes `guard-git-push.ts` and its test `guard-git-push.test.ts`, with types added. The behavior does not change.
- `.claude/settings.json` runs `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/guard-git-push.ts`.
- It is linted under `strictTypeChecked`, formatted by Prettier, type-checked by `pnpm typecheck` and tested by `pnpm test`.
- **It imports only `node:` modules**, so it works before `pnpm install`, on a fresh clone.

## Documentation and records

- **`docs/development/setup.md`:** from a clean Windows machine to passing checks: WSL and Ubuntu, git, nvm and Node, pnpm, VS Code with the WSL extension, then clone, `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`. It links to the tool pages instead of explaining inline.
- **`docs/development/tools/`:** one page per tool, in the format of ADR 0005, decision 15 (what it is, why it was chosen, its configuration files explained, a starting point, the official docs): `node-and-nvm.md`, `pnpm.md`, `typescript.md`, `eslint.md`, `prettier.md`, `husky-and-lint-staged.md`, `commitlint.md`, `vscode.md`. Each is written in its tool's task.
- **README:** a short "Development" section pointing to `docs/development/` ([OP-008](../../open-points.md#op-008)), and the documentation list.
- **`CLAUDE.md`:** the documentation list gains `setup.md` and `tools/`.
- **Glossary:** new terms (such as type stripping, flat config, lint-staged).
- **`phase-walkthrough.md`:** spec and plan names with the phase ID (decision 9).
- **`git-workflow.md`:** the hooks and the scope list point to the configs.
- **ADR 0015:** escape the `|` in decision 1's table (`\|`): it splits the cell on GitHub. A mechanical fix.
- **ADR 0016, "Toolchain details":** the decisions above, refining ADR 0005, decision 12; ADR 0007, decision 18; ADR 0009, decision 9; ADR 0015, decision 3. The status lines of those ADRs get a pointer.
- **Open points:** OP-005's PH-01 part ✅, the entry moves to PH-04; OP-008 and OP-009 closed; OP-062's PH-01 part ✅ and a PH-03 part added (the tests move to Vitest); a new **OP-063** under Candidates: a Markdown linter (markdownlint) that checks the docs without reformatting tables.
- **Roadmap:** the PH-01 row gets 🚧 with the spec, plan and PR links when the PR opens, and ✅ before the merge.

## Tasks

One commit per task. From task 5, the hooks check every commit of the phase.

1. **Root workspace:** `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.gitattributes`, `.gitignore`; the Node and pnpm tool pages. *Verify:* `pnpm install` succeeds; pnpm switched to the pinned version; the install-script setting's name confirmed for pnpm 12; installing with another Node major is refused.
2. **TypeScript and the hook in `.ts`:** the tsconfigs, the rename, the settings command; the TypeScript page. *Verify:* `pnpm typecheck` and `pnpm test` pass; a deliberate type error fails; the live push probes are still refused.
3. **ESLint:** the config, fixing what it reports; the ESLint page. *Verify:* `pnpm lint` passes; a deliberate floating promise fails.
4. **Prettier:** the config and ignore file, the code formatted; the Prettier page. *Verify:* `prettier --check .` passes; no `.md` file changed.
5. **husky and lint-staged:** the hooks page. *Verify:* a staged, badly formatted file is formatted on commit; a lint error blocks the commit.
6. **commitlint:** its page. *Verify:* `foo: bar` and `feat(aip): x` are rejected; a valid message and a merge commit pass.
7. **VS Code:** the settings and its page. *Verify:* by the owner, in the editor.
8. **Wrap-up:** `setup.md`, the README, `CLAUDE.md`, ADR 0016, the glossary, the walkthrough, ADR 0015's fix, the open points, the roadmap. *Verify:* links resolve; the definition of done is walked through.

## To verify during implementation

- **pnpm's version switching:** that `packageManager` makes a globally installed pnpm run the pinned version (task 1). If it does not, `setup.md` installs the pinned version directly and ADR 0016 says so.
- **The install-script setting:** its name and form in pnpm 12 (`onlyBuiltDependencies` in pnpm 10; it may have changed), and that an empty allowlist blocks every install script (task 1).
- **Type-aware linting of the `.js` configs:** whether `projectService` picks them up through the root tsconfig, or they need typescript-eslint's `allowDefaultProject` or `disableTypeChecked` (task 3).
