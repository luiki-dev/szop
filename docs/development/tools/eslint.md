# ESLint

ESLint reads the code without running it and reports bugs and bad patterns. With typescript-eslint it also uses type information, so a **type-aware** rule such as `no-floating-promises` knows that a call returns a promise and flags one nobody awaits.

## Why Szop uses it

- **ESLint and Prettier, rather than Biome:** [ADR 0005](../../decisions/0005-development-environment.md), decision 12. ESLint and Prettier are what most projects and tutorials use, which fits the learning goal. ESLint also has the largest rule ecosystem, including type-aware rules and the React Hooks rules (used since PH-05); Biome is faster but has a smaller ecosystem.
- **`strictTypeChecked`, not `recommendedTypeChecked`, and no `stylisticTypeChecked`:** [ADR 0016](../../decisions/0016-toolchain-details.md). The strict preset catches more real mistakes and suits a new codebase that can follow it from the start. The stylistic preset only argues about taste, and formatting belongs to [Prettier](prettier.md).

## Configuration

**`eslint.config.js`** is a **flat config** (see the [glossary](../../glossary.md)): ESLint's current format, a plain JavaScript array of config blocks that apply in order, the later ones overriding the earlier. `defineConfig` builds the array. The blocks:

- `globalIgnores(["docs/", ".superpowers/", "coverage/"])`: the docs hold no code, `.superpowers/` holds the brainstorm companion's untracked files, and `coverage/` holds the generated coverage report, whose JavaScript is not ours to lint.
- `js.configs.recommended`: ESLint's own rules for plain JavaScript mistakes (unused variables, unreachable code).
- `tseslint.configs.strictTypeChecked`: typescript-eslint's strictest preset, with the rules that need type information.
- `projectService: true`: gives those rules their types. Each file is linted with the `tsconfig.json` that includes it, so a file no tsconfig includes is an error. That is why the root `tsconfig.json` lists `*.js`, `*.ts` and `.claude/hooks/`, and each package's lists its own files.
- `tsconfigRootDir: import.meta.dirname`: the folder the `tsconfig.json` lookup starts from, the folder of `eslint.config.js`. With several tsconfigs (the root's and each package's), typescript-eslint must be told where to look them up from; otherwise it starts from whatever folder the command was run in.
- `eslint-config-prettier`, last: turns off the rules that would fight Prettier over formatting.

There is no exception for the test runner any more: the `node:test` one, which let `test()` go unawaited, left with the hook's tests when they moved to Vitest in PH-03 ([OP-062](../../open-points.md#op-062)); Vitest's `it` needs none.

The React Hooks rules are the plugin's `reactHooks.configs.flat.recommended` preset, applied to `apps/web/**/*.{ts,tsx}` only ([ADR 0021](../../decisions/0021-spa-skeleton-details.md), decision 9).

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
