# TypeScript

TypeScript adds static types to JavaScript, and Szop writes all its code in it, in strict mode. Its compiler, `tsc`, only **checks** the types; other tools run the code: tsx, Vite or Node's own type stripping, which removes the types and runs what is left.

## Why Szop uses it

- **Strict TypeScript, ES modules (ESM) everywhere, one shared base config:** [ADR 0005](../../decisions/0005-development-environment.md), decisions 7 to 9. Types catch a whole class of mistakes before the code runs, and a shared base keeps every package equally strict. Neither tsx nor Node checks types, so checking is a separate `tsc --noEmit` script (`pnpm typecheck`).
- **Version 6.0, not 7:** typescript-eslint, which the linting in [ESLint](eslint.md) relies on, supports TypeScript up to 6.0; 7 (the native port) is not supported yet. The version is pinned to `~6.0.3` until it is. See [ADR 0016](../../decisions/0016-toolchain-details.md) and [OP-064](../../open-points.md#op-064).

## Configuration

**`tsconfig.base.json`** holds the settings every package extends, the root included:

- `strict`: switches on all of TypeScript's strict checks (`null` and `undefined` are separate types, no implicit `any`, and more).
- `noUncheckedIndexedAccess`: reading `arr[0]` or `record[key]` gives `T | undefined`, because the item may not exist, so you must handle that case.
- `noImplicitOverride`: a method that overrides a parent's must say `override`, so renaming the parent method cannot silently break it.
- `noFallthroughCasesInSwitch`: a non-empty `switch` case must end in `break`, `return`, `throw` or `continue`, so a forgotten one is an error.
- `verbatimModuleSyntax`: imports and exports are kept as written; a type-only import must say `import type`. This is what lets tools that strip types work file by file.
- `isolatedModules`: forbids what cannot be compiled one file at a time, again for tools that work file by file.
- `module` and `moduleResolution` are `nodenext`: modules work the way current Node resolves them, so what `tsc` accepts is what Node runs.
- `target` and `lib` are `es2024`: the JavaScript language level the code may use, matching Node 24.
- `skipLibCheck`: skips type-checking every `.d.ts` file, which in practice means the type declarations that dependencies ship. It is faster, and a mistake inside a dependency is not ours to fix.

`exactOptionalPropertyTypes` is off on purpose: it makes `x?: string` mean "absent, but never `undefined`", which clashes with many libraries' types and adds friction for little gain.

**`tsconfig.json`** is the root's own configuration; it extends the base and adds:

- `noEmit`: `tsc` only checks and writes no files.
- `erasableSyntaxOnly`: forbids TypeScript syntax that Node's type stripping cannot remove (enums, parameter properties, namespaces), so every `.ts` file runs directly.
- `allowImportingTsExtensions`: lets a file import `./guard-git-push.ts` by its real name (see below).
- `allowJs` and `checkJs`: the root's `.js` configuration files are type-checked too.
- `types: ["node"]`: only Node's types (`@types/node`) are global, not every `@types/*` package that happens to be installed.
- `include`: the root's `*.js` and `*.ts` files (such as `vitest.config.ts`) and everything under `.claude/hooks/`.

**`apps/api/tsconfig.json`**: each package has a `tsconfig.json` of its own that extends the base, so a package can add what only it needs. The API's:

- `noEmit`, `erasableSyntaxOnly`, `allowImportingTsExtensions`: the same three as the root's, for the same reasons. The API is run by [tsx](tsx.md) and tested by [Vitest](vitest.md), so nothing is compiled into files.
- `types: ["node"]`: only Node's types are global.
- `include: ["src", "vitest.config.ts"]`: the API's source, its tests (they sit in `src`) and its Vitest config. Nothing outside the package.

Why each package has its own file: `apps/web` will add browser (DOM) types and JSX in PH-05, which the API must not see.

## Everyday use

```bash
pnpm typecheck       # check the root, then every package: tsc --noEmit && pnpm -r typecheck
node file.ts         # run a single .ts file; Node strips the types
```

`pnpm typecheck` chains two commands: `tsc --noEmit` checks the root's own files, then `pnpm -r typecheck` runs each package's `typecheck` script (`tsc --noEmit` in the package's folder, with the package's `tsconfig.json`). If the first fails, the second does not run ([ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 4).

Imports name the `.ts` file (`import { findViolation } from "./guard-git-push.ts"`, `import { buildApp } from "./app.ts"`), in every package ([ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 6), because Node loads exactly the file named and does not try other extensions. `allowImportingTsExtensions` makes `tsc` accept those `.ts` names, and `verbatimModuleSyntax` keeps type-only imports explicit (`import type`), which Node's type stripping needs.

The push hook, `.claude/hooks/guard-git-push.ts`, is run this way: Node 24 strips its types, so it needs no build step and no dependencies.

## Official documentation

- tsconfig reference: <https://www.typescriptlang.org/tsconfig/>
- Modules reference (`nodenext`): <https://www.typescriptlang.org/docs/handbook/modules/reference.html>
- Node's type stripping: <https://nodejs.org/api/typescript.html>
