# Playwright

Playwright is a library that drives real browsers from code: it opens Chromium or Firefox, goes to an address, clicks, types and reads what is on the page, the way a person would. It also comes with a test runner (`@playwright/test`) that finds the test files, runs them in parallel, retries, and writes a report. In Szop it runs the end-to-end (E2E) journeys: a real browser opens the production build, which talks to the real API and PostgreSQL.

axe (the library is called axe-core; `@axe-core/playwright` plugs it into Playwright) is a rule engine that checks a rendered page against the Web Content Accessibility Guidelines (WCAG): it finds images without text alternatives, form fields without labels, text that is too faint against its background, and so on. Szop runs it on every page a journey visits.

## Contents

- [Why Szop uses it](#why-szop-uses-it)
- [Configuration](#configuration)
  - [`e2e/package.json` and `e2e/tsconfig.json`](#e2epackagejson-and-e2etsconfigjson)
  - [`playwright.config.ts`](#playwrightconfigts)
  - [`start-server.ts`](#start-serverts)
  - [`support/test.ts`](#supporttestts)
  - [`support/accessibility.ts`](#supportaccessibilityts)
  - [The ESLint rule](#the-eslint-rule)
- [Editor](#editor)
- [Browsers](#browsers)
- [Everyday use](#everyday-use)
- [Official documentation](#official-documentation)

## Why Szop uses it

- **Playwright, not Cypress:** [ADR 0007](../../decisions/0007-testing-strategy.md), decision 11. Playwright runs Chromium, Firefox and WebKit, emulates phones, runs tests in parallel for free and has a trace viewer for debugging failures; Cypress is Chromium-first and puts parallel runs behind a paid service. Playwright is a library first, so the Content Security Policy (CSP) guard below is ordinary code.
- **Three projects:** [ADR 0007](../../decisions/0007-testing-strategy.md), decision 5, extended by [ADR 0013](../../decisions/0013-visual-design.md), decision 2. A **project** is one browser setup that every test runs under: `desktop-chromium`, `desktop-firefox` (Firefox is the only supported browser with an engine of its own) and `pixel`, an emulated Pixel 7 phone on Chromium, because the in-store scenario ([UC-3](../../requirements/functional-requirements.md#uc-3-shop-in-a-store)) happens on a phone. A WebKit project can join if Safari-specific bugs appear.
- **axe's rule sets:** [ADR 0013](../../decisions/0013-visual-design.md), decision 3. Szop targets WCAG 2.2 level AA ([NFR-2](../../requirements/functional-requirements.md#nfr-2)), so axe runs with the `wcag2a`, `wcag2aa`, `wcag21aa` and `wcag22aa` rule sets, in light and in dark mode.
- **The details of this phase:** [ADR 0026](../../decisions/0026-first-e2e-journey-details.md): the port, the helper that scans both color schemes, the retry policy, the browsers not cached in CI, the start script and the CSP guard.

## Configuration

Everything is in the `e2e/` folder, its own workspace package, `@szop/e2e` ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 17). The root `vitest.config.ts` lists its projects one by one, so `pnpm test` never picks up the specs in `e2e/`.

### `e2e/package.json` and `e2e/tsconfig.json`

**`e2e/package.json`** is private and uses ES modules (ESM, `"type": "module"`). Its `typecheck` script is `tsc --noEmit`, which the root `pnpm typecheck` reaches through `pnpm -r`. Its `devDependencies`:

- `@playwright/test`: the library and its test runner. The version is exact, because the browsers it downloads are tied to it ([Browsers](#browsers)).
- `@axe-core/playwright`: axe for Playwright. The code imports it by name, `import { AxeBuilder } from "@axe-core/playwright"`; under the repository's module resolution (`nodenext`), the default import is typed as the whole module and is not constructable.
- `pg` and `@types/pg`: `start-server.ts` resets the database with them.
- `@types/node`: Node's types, at the version `apps/api` uses.

**`e2e/tsconfig.json`** extends `tsconfig.base.json`, like the other packages, with `noEmit`, `erasableSyntaxOnly` (so `start-server.ts` also runs under Node's type stripping, like the API), `allowImportingTsExtensions` (imports keep their `.ts` extension) and `types: ["node"]`. It adds `dom` to `lib` for one reason: a function passed to `page.evaluate` or `addInitScript` is serialized, sent to the browser and run there, so it uses `document` and `window`, which only the `dom` types describe. It includes every `.ts` file in `e2e/`.

### `playwright.config.ts`

| Setting | Value | What it does |
|---|---|---|
| `testDir` | `tests` | Where the tests are. `support/` holds helpers, not tests |
| `fullyParallel` | `true` | Tests, even those in one file, run at the same time in several workers. Each test starts in a fresh browser context, so none depends on another |
| `forbidOnly` | `true` when the `CI` variable is set | A forgotten `test.only` fails CI instead of passing while running one test |
| `retries` | `1` in CI, `0` otherwise | Runs a failed test once more, which tells a flaky test from a broken one |
| `failOnFlakyTests` | `true` in CI | A test that fails and then passes on its retry still fails the run |
| `reporter` | locally `list` and `html`; in CI `github` and `html` | `list` prints one line per test. `github` puts failures on the PR as annotations. `html` writes the report in `e2e/playwright-report/` (`open: "never"` stops it from opening a browser by itself), which CI uploads |
| `use.baseURL` | `http://127.0.0.1:3100` | Journeys say `page.goto("/")` |
| `use.trace`, `use.screenshot` | `retain-on-failure`, `only-on-failure` | Every attempt of a test is traced and kept only if the test fails, together with a screenshot. No video |
| `projects` | `desktop-chromium` (`devices["Desktop Chrome"]`), `desktop-firefox` (`devices["Desktop Firefox"]`), `pixel` (`devices["Pixel 7"]`) | Playwright's device list sets the viewport, user agent and touch support of each |
| `webServer.command` | `node start-server.ts` | What Playwright starts before the tests and stops after them |
| `webServer.url` | `http://127.0.0.1:3100/api/health` | Playwright polls it, and starts the tests when it answers. The API migrates its database before it listens, so the answer also means the migrations are done |
| `webServer.env` | `E2E_PORT` | The port, written once in the config as the constant `port`, handed on so the two never disagree |
| `webServer.reuseExistingServer` | `false` | A fresh server every run. Port 3100, not 3000, so a running `pnpm start` with the development database is never tested by mistake |
| `webServer.stdout` | `"pipe"` | The API's output (it logs at `warn`) is shown in the run's output |
| `webServer.gracefulShutdown` | `{ signal: "SIGTERM", timeout: 5000 }` | Playwright stops the server with `SIGTERM`, as AWS's Elastic Container Service (ECS) stops the API in production, and kills it only after 5 seconds |

**What happens when something else holds port 3100.** Before starting the server, Playwright requests `webServer.url`. If something answers with a status from 200 to 403, Playwright stops with `<url> is already used`, because `reuseExistingServer` is `false`. If anything else holds the port, a server that answers 404, say, Playwright starts the server anyway, and the API fails to listen: it logs `startup failed` with `EADDRINUSE` and exits, and the run stops. Either way, no test runs against the wrong server. The usual holder of port 3100 is an E2E server left behind by a run killed hard (a closed terminal, say: Playwright starts its server in a separate process group), and `start-server.ts` ignores `SIGINT` and `SIGTERM` by design, so killing it does nothing. Find the listener with `ss -ltnp 'sport = :3100'` and stop that process, normally `node src/server.ts`, the API; `start-server.ts` then exits by itself. A `pnpm start` holds the port only if its `PORT` was set to 3100 (it listens on 3000 by default).

### `start-server.ts`

Playwright runs this script (`node start-server.ts`, from the `e2e/` folder; Node strips the types itself). In order, stopping at the first problem with a message that says what to do:

1. **Checks the build.** If `apps/web/dist/index.html` is missing, it stops with "run `pnpm build` first". The API would start without it and answer 404 on every page, which is a puzzling failure. This matters when the tests run from the editor, which does not build ([Editor](#editor)).
2. **Checks the port.** If `E2E_PORT` is not set, it stops with "run the suite with `pnpm test:e2e`": Playwright hands the port over through the environment, so a bare `node start-server.ts` has none.
3. **Reads `apps/api/.env`** with Node's `parseEnv`, for the database server's address and password. A missing file stops it with "copy `apps/api/.env.example` to `apps/api/.env`".
4. **Resets the database.** It connects with `pg` to the maintenance database `postgres`, never to the development one, then runs `DROP DATABASE IF EXISTS szop_e2e WITH (FORCE)` and `CREATE DATABASE szop_e2e`. `FORCE` closes the connections a crashed run left. Nothing is dropped afterwards, so the data of a failed run can be looked at. If PostgreSQL cannot be reached, it says to start it with `docker compose up -d`.
5. **Starts the API** as a child process, `node src/server.ts` run in `apps/api`, with the environment `{ ...process.env, ...fileEnv, ...overrides }`. The order is the rule: the shell's variables (such as `PATH`), then the API's `.env`, then the E2E settings over both: `DATABASE_NAME=szop_e2e`, `HOST=127.0.0.1`, `PORT` from `E2E_PORT`, `LOG_LEVEL=warn` and `WEB_ROOT`, the built SPA. The API is unchanged: it reads `process.env` as always.
6. **Waits for the API and exits with its exit code.** A failed start therefore shows as the server exiting early, after its `startup failed` line.

**Why it never passes signals on.** To stop its server, Playwright signals the whole process group, not just the script, so the API receives `SIGTERM` itself and shuts down as it always does: it finishes the requests in flight and closes its connections. The script catches `SIGINT` and `SIGTERM` only so that it is not killed first, and it ends when the API does. Passing the signal on would send the API a second one, and the API's handler (registered with `process.once`) is used up by the first: the second signal would kill it in the middle of its shutdown.

### `support/test.ts`

Exports `test` and `expect`, which are Playwright's, extended with the **CSP guard**. A **fixture** is something Playwright prepares for a test and hands to it by name (`page` is one); `test.extend` adds or wraps them. The file:

- adds the fixture `cspViolations`, a list of reports, each holding the blocked directive, the blocked address, the source's file and line, and a sample of the code;
- wraps the `context` fixture. Playwright creates `page` from `context`, so the wrapper is in place before the first page opens. It exposes a function to the page (`exposeBinding`) and adds a script that runs in every page before its own scripts (`addInitScript`); the script listens for the browser's `securitypolicyviolation` event and reports each one through the exposed function. Being on the context, it covers every page and every navigation of the test, but not a context a journey creates with `browser.newContext()` or a web worker ([OP-088](https://github.com/luiki-dev/szop/issues/162));
- after the test body, makes one round trip to each open page, so a report sent in the test's last moment has arrived, and asserts that `cspViolations` is empty.

The event is standard and fires in Chromium and Firefox alike. Firefox writes its CSP messages to the browser's own console, which Playwright may not see, and a report endpoint on the API would add a route for the tests' sake ([ADR 0026](../../decisions/0026-first-e2e-journey-details.md), decision 7). `bypassCSP`, which would switch the policy off for the page, keeps its default, `false`.

### `support/accessibility.ts`

Exports `expectAccessible(page)`. For `light`, then `dark`, each as a `test.step` (named `axe (light)` and `axe (dark)`), it calls `page.emulateMedia({ colorScheme })`, waits for every running animation to finish (switching the scheme starts color transitions, such as Button's `transition-colors`, and a scan mid-way reads colors of neither scheme; it failed that way on CI's slower runners), and scans with `new AxeBuilder({ page }).withTags([...]).analyze()`, using the four WCAG tags. It then returns the page to light, the projects' default, and makes one assertion over both schemes' violations, each listed as scheme, rule ID, number of elements and their selectors, so one failure shows every problem.

The helper is called by the journey, on every page it reaches, and not run automatically after every navigation, because an automatic scan cannot tell when a single-page application has finished drawing a screen and would scan half-loaded pages. It is one run with two color schemes, not six projects (three browsers, each in both schemes), which would double every run for what is almost always a contrast problem ([ADR 0026](../../decisions/0026-first-e2e-journey-details.md), decision 3).

No rule is turned off for all pages. The helper takes `{ disableRules: [...] }` for the rare case where one rule must be skipped on one page; that call carries a comment saying why.

### The ESLint rule

`eslint.config.js` has a block for `e2e/tests/**/*.ts` with `no-restricted-imports`: a journey may not import from `@playwright/test`. A journey that did would run without the CSP guard and still pass, so lint refuses it, with a message pointing to `../support/test.ts`. `support/` and the config import from `@playwright/test` as they must.

## Editor

The **Playwright Test** extension for VS Code (`ms-playwright.playwright`, in `.vscode/extensions.json`) lists the tests in the Testing view, runs one from the arrow beside it, can show the browser while it runs and records new tests. It reads the same `playwright.config.ts`, so it starts the same server on port 3100. It does not build first, so it tests the last build: run `pnpm build` after every change to `apps/web` or `packages/shared` (changes to the API need no rebuild, since it runs from source), or the run tests the old code, and `start-server.ts` stops with "run `pnpm build` first" when there is no build at all. It also needs PostgreSQL running. A run from the extension and a run from `pnpm test:e2e` use the same port, so run only one at a time.

## Browsers

Playwright downloads its own builds of Chromium and Firefox, not the ones installed on the machine, so a test runs against a browser version known to work with the library. They go to `~/.cache/ms-playwright/` and are shared by every project on the machine. The versions follow `@playwright/test`: a new Playwright version needs `playwright install` again.

```bash
pnpm --filter @szop/e2e exec playwright install --with-deps chromium firefox
```

`--with-deps` also installs the system libraries the browsers need, through `apt`, which needs `sudo`: it asks for the password. Without it, a browser can fail to start with a message naming a missing library. Where the libraries are already installed, the browsers launch without it. CI runs the same command on every run and does not cache the browsers ([CI/CD](../ci-cd.md)).

## Everyday use

```bash
pnpm test:e2e                                          # build, then every journey on the three projects
pnpm test:e2e --project=desktop-firefox                # one project
pnpm test:e2e:report                                   # open the last run's HTML report
```

`pnpm test:e2e` is `pnpm build && pnpm --filter @szop/e2e exec playwright test`, so extra arguments reach Playwright. `pnpm test:e2e:report` is `pnpm --filter @szop/e2e exec playwright show-report`: it does not build or run tests, it serves the report folder on a local port and prints the address (opening the browser when it can; under Windows Subsystem for Linux (WSL), open the printed address in Windows' browser), until Ctrl+C. Given a folder, such as a report downloaded from CI, it shows that one; the script runs in `e2e/`, so a relative path is resolved from there, and an absolute or `~` path is the safe choice. More, including the UI mode and reading a failed run: [Testing guide](../testing.md#running-the-tests).

## Official documentation

- Playwright, getting started: <https://playwright.dev/docs/intro>
- Test configuration (`webServer`, `projects`, `retries`): <https://playwright.dev/docs/test-configuration>
- Fixtures: <https://playwright.dev/docs/test-fixtures>
- Trace viewer: <https://playwright.dev/docs/trace-viewer>
- Accessibility testing with axe: <https://playwright.dev/docs/accessibility-testing>
- Playwright in CI: <https://playwright.dev/docs/ci>
- axe-core's rules: <https://dequeuniversity.com/rules/axe/>
