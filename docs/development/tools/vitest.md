# Vitest

Vitest is the test runner: it finds the test files, runs them and reports which tests passed, and it can measure which lines the tests ran. It is built on Vite (the build tool the web app uses, see [Vite](vite.md)) and runs TypeScript and ES modules (ESM) as they are, with no setup. In Szop it runs every test: the API's, the web app's and the push hook's.

## Why Szop uses it

- **Vitest, not Jest:** [ADR 0007](../../decisions/0007-testing-strategy.md), decisions 8 and 18. Vitest shares Vite's configuration, so API and component tests (PH-05) use one tool, and it handles ESM and TypeScript natively; Jest's ESM support is still awkward. One root config defines a project per package.
- **Node's own test runner first, Vitest from PH-03:** [ADR 0016](../../decisions/0016-toolchain-details.md), decision 6. The push hook's tests ran on `node --test` while the repository had no packages. PH-03 brings the first package, so they moved into Vitest and `pnpm test` still means "every test".
- **V8 coverage, measured and not gated:** [ADR 0007](../../decisions/0007-testing-strategy.md), decision 19. See [Coverage](../testing.md#coverage).

## Configuration

**`vitest.config.ts`** at the root is the config Vitest reads:

- `test.projects`: the list of projects. A **project** is a group of tests with its own settings, shown by name in the output. There are three: `apps/api/vitest.config.ts` and `apps/web/vitest.config.ts`, files of their own, and `hooks`, written inline because it needs only three settings.
- `name`: the project's name, for `--project` and for the output.
- `environment: "node"`: tests run in plain Node. The `web` project uses `jsdom` instead, a simulated browser (see [jsdom](#jsdom)).
- `include`: the files that count as this project's tests, by glob (a path pattern).
- `test.coverage.provider: "v8"`: measure coverage with the engine built into Node, which needs no code rewriting.
- `test.coverage.include`: the files to measure: `apps/*/src/**/*.{ts,tsx}`, `packages/*/src/**/*.ts` and `.claude/hooks/**/*.ts`. Listing them, instead of measuring only what tests load, makes a file no test touches show at 0%.
- `test.coverage.reporter`: the outputs. `text` is the terminal table, `html` the report in `coverage/index.html`, and `json-summary` the file CI turns into its job summary.

**`apps/api/vitest.config.ts`** is the `api` project: `defineProject` with `name: "api"`, `environment: "node"` and `include: ["src/**/*.test.ts"]`, which is relative to `apps/api`. A new package adds a `vitest.config.ts` of its own and lists it in the root's `projects`. Coverage is set once, at the root, because it spans the projects.

**`apps/web/vitest.config.ts`** is the `web` project: `defineProject` with `name: "web"`, `environment: "jsdom"`, `include: ["src/**/*.test.{ts,tsx}"]` and `setupFiles: ["src/test/setup.ts"]`. A **setup file** runs before each test file; this one registers the `jest-dom` matchers, runs the [MSW](msw.md) server and cleans up after each test ([Testing Library](testing-library.md)). The project also lists `@vitejs/plugin-react`, the same plugin as `vite.config.ts`, so `.tsx` files compile as in the app; whether the tests would work without it was not tried. There are still no globals: tests import `describe`, `it` and `expect` from `vitest`.

**`coverage/`** holds the generated report. It is git-ignored, and [ESLint](eslint.md) and [Prettier](prettier.md) skip it.

### jsdom

jsdom is a simulated browser written in JavaScript that runs inside Node: it provides `document`, elements and events, so a component can be rendered and queried without opening a browser. It is fast, and it is what Testing Library's documentation assumes ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 9). It has no layout engine, so nothing has a size or a position: a test cannot check that something is visible on screen or fits, only that it is in the document. The end-to-end (E2E) journeys, which will run in real browsers, cover that ([PH-07](../../roadmap.md#ph-07-first-e2e-journey)).

## Everyday use

```bash
pnpm test                    # run everything once; the same tests CI runs (CI adds `--coverage`)
pnpm test:watch              # stay running, re-run what a change affects
pnpm test --project web      # only the web project (api and hooks work the same)
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
- Test environments (jsdom): <https://vitest.dev/guide/environment>
