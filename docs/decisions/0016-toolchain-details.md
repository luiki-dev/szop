# ADR 0016 — Toolchain details

- **Status:** ✅ Accepted
- **Date:** 2026-10-02
- **Refines:** [ADR 0005](0005-development-environment.md), decision 12 (Markdown left out of Prettier); [ADR 0007](0007-testing-strategy.md), decision 18 (`pnpm test` runs Node's test runner until Vitest arrives); [ADR 0009](0009-git-workflow.md), decision 9 (an allow-list of scopes); [ADR 0015](0015-git-push-guard-hook.md), decision 3 (the push hook in TypeScript)

## Context

[ADR 0005](0005-development-environment.md) settled the development environment and left its details to the setup phase, now [PH-01](../roadmap.md#ph-01-monorepo-and-toolchain). Its brainstorm, the [spec](../superpowers/specs/2026-10-02-PH-01-monorepo-and-toolchain-design.md), and a prototype of every configuration settled them. Some refine accepted ADRs; this record holds them all.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | What the workspace holds | Root only; empty shells for `apps/api`, `apps/web` and `packages/shared`; only `packages/shared` | **Root only.** Each package arrives with its first real code (PH-03, PH-05, the first shared code), like `compose.yaml` in PH-04 ([ADR 0014](0014-roadmap.md), decision 7). Shells would be placeholder code rewritten later. |
| 2 | Installing pnpm | `npm install -g pnpm` and pnpm's own version switching; Corepack; pnpm's standalone installer | **`npm install -g pnpm` once per Node version; pnpm then runs the version in `packageManager` by itself** (tried: 11.28.2 and 12.7.0 both ran the pinned 12.8.1). Corepack is still experimental and no longer bundled from Node 25. The standalone installer pipes a script from the internet into the shell. |
| 3 | pnpm's settings | — | **`engineStrict: true` and `allowBuilds: {}` in `pnpm-workspace.yaml`.** Without `engineStrict`, pnpm 12 installed with an unsupported Node. `allowBuilds` is pnpm 12's name for the install-script allowlist ([ADR 0012](0012-security-baseline.md), decision 18): a dependency with a build script must be listed as allowed or denied, or the install fails, and the owner decides. |
| 4 | TypeScript version | 7.0 (the native port); 6.0 | **6.0 (`~6.0.3`), with `@types/node` 24.** typescript-eslint, which type-aware linting needs, supports TypeScript below 6.1 only. Moving to 7 is [OP-064](../open-points.md#op-064). |
| 5 | The push hook's language | TypeScript run by Node's type stripping; JavaScript checked through JSDoc; JavaScript, not type-checked | **TypeScript, run directly by Node 24.** With no packages, it is the only real code, so it is what makes "strict TypeScript" true now. It keeps no build step and no dependencies. ADR 0005, decision 9 turned type stripping down for the API because of workspace imports, which a standalone file does not have. Its entry point uses `import.meta.main`, added in Node 24.2.0, so `engines.node` is `>=24.2 <25`: on an older 24.x the hook would silently allow every push. |
| 6 | Running the hook's tests | `pnpm test` runs `node --test` until Vitest arrives; a permanent `pnpm test:hooks` | **`pnpm test` runs Node's test runner until PH-03 moves the tests into Vitest** ([OP-062](../open-points.md#op-062)). `pnpm test` keeps meaning "every test". Until then, ESLint's `no-floating-promises` allows `node:test`'s `test()`, typescript-eslint's documented setting for it. |
| 7 | ESLint strictness | `strictTypeChecked`; `recommendedTypeChecked`; `strictTypeChecked` with `stylisticTypeChecked` | **`strictTypeChecked`.** Beyond bugs, it flags code that is probably wrong. Loosening later is easy, tightening an existing codebase is not. Style is Prettier's job. |
| 8 | Prettier and Markdown | A one-off reformat of all docs; formatting docs when touched; code only | **Code only: `*.md` is in `.prettierignore`.** On a copy of the docs, Prettier padded every table to its widest cell: the glossary grew from 39 KB to 93 KB, each row of ADR 0011's decision table to 2,583 characters, and an edit to one long cell rewrites the whole table in the diff. Prettier cannot turn table alignment off. A Markdown linter that does not reformat is [OP-063](../open-points.md#op-063). |
| 9 | Prettier options | The defaults; tweaks such as single quotes | **The defaults** (`{}`), Prettier's own advice against debating options. |
| 10 | lint-staged's ESLint glob | The types in use today; every type ESLint lints | **Every type ESLint lints** (`ts`, `tsx`, `mts`, `cts`, `js`, `jsx`, `mjs`, `cjs`), so a phase adding `.tsx` is covered without anyone remembering to extend it. Everything else is formatted by Prettier if it knows the type. ESLint runs with `--no-warn-ignored`: a staged file its config ignores, such as one under `docs/`, would otherwise turn into a warning that `--max-warnings=0` fails. |
| 11 | Commit scopes | An allow-list; any scope | **An allow-list in `commitlint.config.js`; the scope stays optional.** Workspaces and test layers, one feature scope per requirement area, the kinds of docs, and tooling (`infra`, `deps`, `main` for release-please, `claude`). Typos and near-duplicates are rejected; a PR that needs a new scope adds it. ADR 0009's examples already went beyond its listed scopes. |
| 12 | Spec and plan names | `YYYY-MM-DD-<topic>`; with the phase ID | **The phase ID after the date, in uppercase as the project writes its IDs:** `2026-10-02-PH-01-monorepo-and-toolchain-design.md`. All files of a phase are found with `ls *PH-01*`. Nothing in superpowers parses the names. Work outside phases keeps `date-topic`. |

## Consequences

- **The configuration files and tool pages exist:** `docs/development/setup.md` and a page per tool in `docs/development/tools/`, living docs from now on ([ADR 0005](0005-development-environment.md), consequences).
- **Every commit is formatted, linted and checked,** the owner's and Claude's; CI repeats the checks from PH-02.
- **Open points:** [OP-005](../open-points.md#op-005) keeps its PH-04 part; [OP-008](../open-points.md#op-008) and [OP-009](../open-points.md#op-009) are closed; [OP-062](../open-points.md#op-062) gains a PH-03 part; [OP-063](../open-points.md#op-063) (a Markdown linter) and [OP-064](../open-points.md#op-064) (TypeScript 7) are new candidates.
- **The living docs are updated:** the README's "Development" section, `CLAUDE.md`'s documentation list, the glossary, `git-workflow.md` (the scope rule, the hook's path) and `phase-walkthrough.md` (the file names).
