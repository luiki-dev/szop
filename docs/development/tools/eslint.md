# ESLint

ESLint reads the code without running it and reports bugs and bad patterns. With typescript-eslint it also uses type information, so a **type-aware** rule such as `no-floating-promises` knows that a call returns a promise and flags one nobody awaits.

## Why Szop uses it

- **ESLint and Prettier, rather than Biome:** [ADR 0005](../../decisions/0005-development-environment.md), decision 12. ESLint has the largest rule ecosystem, including type-aware rules and, later, the React Hooks rules; Biome is faster but covers less.
- **`strictTypeChecked`, not `recommendedTypeChecked`, and no `stylisticTypeChecked`:** [ADR 0016](../../decisions/0016-toolchain-details.md). The strict preset catches more real mistakes and suits a new codebase that can follow it from the start. The stylistic preset only argues about taste, and formatting belongs to [Prettier](prettier.md).

## Configuration

**`eslint.config.js`** is a **flat config** (see the [glossary](../../glossary.md)): ESLint's current format, a plain JavaScript array of config blocks that apply in order, the later ones overriding the earlier. `defineConfig` builds the array. The blocks:

- `globalIgnores(["docs/", ".superpowers/"])`: the docs hold no code, and `.superpowers/` holds the brainstorm companion's untracked files.
- `js.configs.recommended`: ESLint's own rules for plain JavaScript mistakes (unused variables, unreachable code).
- `tseslint.configs.strictTypeChecked`: typescript-eslint's strictest preset, with the rules that need type information.
- `projectService: true`: gives those rules their types. Each file is linted with the `tsconfig.json` that includes it, so a file no tsconfig includes is an error. That is why the root `tsconfig.json` lists `*.js` and `.claude/hooks/`.
- The `node:test` exception, only for `.claude/hooks/**/*.test.ts`: `no-floating-promises` stays on, but a call to `test` from `node:test` may go unawaited, because the test runner awaits it itself. It goes away when the tests move to Vitest in PH-03 (OP-062).
- `eslint-config-prettier`, last: turns off the rules that would fight Prettier over formatting.

The React Hooks rules come with `apps/web` in PH-05.

## Everyday use

```bash
pnpm lint                        # eslint .: lint the whole repository
pnpm exec eslint --fix <file>    # also apply the fixes ESLint can make itself
```

A finding ends with the rule's name, for example `@typescript-eslint/no-floating-promises`. Look that name up on the [typescript-eslint rules page](https://typescript-eslint.io/rules/) (or ESLint's [rules page](https://eslint.org/docs/latest/rules/)) to see why it exists and what the usual fix is.

Fix the code rather than silence the rule. As a last resort, disable one rule for one line, with the reason:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the library types this as any
```

## Official documentation

- Configuration files: <https://eslint.org/docs/latest/use/configure/configuration-files>
- Typed linting: <https://typescript-eslint.io/getting-started/typed-linting>
- The strict-type-checked preset: <https://typescript-eslint.io/users/configs#strict-type-checked>
