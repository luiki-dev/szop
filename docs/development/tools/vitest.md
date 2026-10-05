# Vitest

Vitest is the test runner: it finds the test files, runs them and reports which tests passed, and it can measure which lines the tests ran. It is built on Vite (the build tool the web app will use) and runs TypeScript and ES modules (ESM) as they are, with no setup. In Szop it runs every test: the API's and the push hook's.

## Why Szop uses it

- **Vitest, not Jest:** [ADR 0007](../../decisions/0007-testing-strategy.md), decisions 8 and 18. Vitest shares Vite's configuration, so API and component tests (PH-05) use one tool, and it handles ESM and TypeScript natively; Jest's ESM support is still awkward. One root config defines a project per package.
- **Node's own test runner first, Vitest from PH-03:** [ADR 0016](../../decisions/0016-toolchain-details.md), decision 6. The push hook's tests ran on `node --test` while the repository had no packages. PH-03 brings the first package, so they moved into Vitest and `pnpm test` still means "every test".
- **V8 coverage, measured and not gated:** [ADR 0007](../../decisions/0007-testing-strategy.md), decision 19. See [Coverage](../testing.md#coverage).

## Configuration

**`vitest.config.ts`** at the root is the config Vitest reads:

- `test.projects`: the list of projects. A **project** is a group of tests with its own settings, shown by name in the output. There are two: `apps/api/vitest.config.ts`, a file of its own, and `hooks`, written inline because it needs only three settings.
- `name`: the project's name, for `--project` and for the output.
- `environment: "node"`: tests run in plain Node. The web app's tests will use a browser-like environment instead.
- `include`: the files that count as this project's tests, by glob (a path pattern).
- `test.coverage.provider: "v8"`: measure coverage with the engine built into Node, which needs no code rewriting.
- `test.coverage.include`: the files to measure: `apps/*/src/**/*.ts` and `.claude/hooks/**/*.ts`. Listing them, instead of measuring only what tests load, makes a file no test touches show at 0%.
- `test.coverage.reporter`: the outputs. `text` is the terminal table, `html` the report in `coverage/index.html`, and `json-summary` the file CI turns into its job summary.

**`apps/api/vitest.config.ts`** is the `api` project: `defineProject` with `name: "api"`, `environment: "node"` and `include: ["src/**/*.test.ts"]`, which is relative to `apps/api`. A new package adds a `vitest.config.ts` of its own and lists it in the root's `projects`. Coverage is set once, at the root, because it spans the projects.

**`coverage/`** holds the generated report. It is git-ignored, and [ESLint](eslint.md) and [Prettier](prettier.md) skip it.

## Everyday use

```bash
pnpm test                    # run everything once; this is what CI runs
pnpm test:watch              # stay running, re-run what a change affects
pnpm test --project api      # only the api project
pnpm test health             # only files whose path contains "health"
pnpm test:coverage           # run everything and measure coverage
```

- **Watch mode keys:** press `a` to re-run all tests, `f` to re-run only the failed ones, and `q` to quit. `h` shows the rest.
- **VS Code:** the Vitest extension (`vitest.explorer`) adds the Testing view, which lists every test, runs or debugs one from the arrow next to it in the gutter, and shows its failure inline. See [VS Code](vscode.md).
- **Reading a failure:** Vitest prints the test's name, the line of the failed `expect` and a diff: the expected value against the received one, with the differing parts marked.
- **`No test files found`:** the filter matched no file path, or the file's name does not end in `.test.ts`. Vitest also prints the filters and `include` patterns it used, so compare them with the path.

How to write the tests: [Testing guide](../testing.md).

## Official documentation

- Getting started: <https://vitest.dev/guide/>
- Test projects: <https://vitest.dev/guide/projects>
- Coverage: <https://vitest.dev/guide/coverage>
- The CLI: <https://vitest.dev/guide/cli>
