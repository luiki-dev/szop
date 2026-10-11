# PH-07 First E2E journey — design

- **Phase:** [PH-07](../../roadmap.md#ph-07-first-e2e-journey)
- **Date:** 2026-10-11
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-010](../../open-points.md#op-010) (PH-07 part, then on to PH-15); [OP-012](../../open-points.md#op-012) (its last part); [OP-057](../../open-points.md#op-057); [OP-067](../../open-points.md#op-067) moved to [PH-08](../../roadmap.md#ph-08-container-image); new [OP-087](../../open-points.md#op-087)

A real browser drives the production build for the first time. Playwright starts the API against its own database, opens the health page on desktop Chromium, desktop Firefox and an emulated phone, checks it with axe in light and dark mode, and fails if the browser reports any Content Security Policy (CSP) violation. CI runs the suite on every code PR and keeps the report of a failed run. The direction was settled by [ADR 0007](../../decisions/0007-testing-strategy.md) (decisions 4, 5, 6, 11, 15, 17, 18 and 21), [ADR 0010](../../decisions/0010-ci-cd.md) (decisions 7 and 9) and [ADR 0013](../../decisions/0013-visual-design.md) (decisions 2, 3 and 9). This spec holds the details those left to the phase, as agreed in the brainstorm. They are recorded in ADR 0026, which also refines ADR 0010, decision 9: the browsers are not cached ([decision 5](#decisions-taken-in-the-brainstorm)).

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Layout](#layout)
  - [Scripts](#scripts)
  - [The Playwright config](#the-playwright-config)
  - [Starting the server](#starting-the-server)
  - [The CSP guard](#the-csp-guard)
  - [The accessibility check](#the-accessibility-check)
  - [The journeys](#the-journeys)
  - [Lint and types](#lint-and-types)
  - [The e2e job in CI](#the-e2e-job-in-ci)
  - [Dependencies](#dependencies)
- [Documentation and records](#documentation-and-records)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: a Playwright journey drives the production build on a phone and on desktop Chromium and Firefox, scans every page with axe in light and dark mode, and fails on any CSP violation. CI keeps the report and traces of a failed run.

The phase is done when:

- `pnpm test:e2e` builds the app, resets `szop_e2e`, starts the API on port 3100 and passes on the `desktop-chromium`, `desktop-firefox` and `pixel` projects, locally on WSL and in CI;
- the health journey sees "API: ok" and "Database: up" on `/`, and axe finds no violation of the `wcag2a`, `wcag2aa`, `wcag21aa` and `wcag22aa` rule sets in light or in dark mode;
- the CSP guard's own test catches a `<style>` element added to the page, on all three projects;
- ESLint refuses a journey that imports from `@playwright/test` instead of `support/test.ts`;
- the `e2e` job runs on every code PR, `ci-ok` needs it, and when it fails the HTML report, with the traces and screenshots of the failed tests, is kept as an artifact for 14 days;
- after a passing run, a failed run and a run stopped with Ctrl+C, nothing is left listening on port 3100;
- the docs and records listed under [Documentation and records](#documentation-and-records) are updated.

## Out of scope

- **Journeys for use cases.** No use case is complete yet; each phase that completes one adds its journey ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 4).
- **Reading emails in tests**, decided by the phase that delivers [ACC-2](../../requirements/functional-requirements.md#acc-2) (ADR 0007, decision 15).
- **Running the suite against the container image**, one of the two options of [OP-032](../../open-points.md#op-032), left to PH-08.
- **Dark styles.** The health page has none yet, so both color schemes see the same page; the design system arrives in [PH-14](../../roadmap.md#ph-14-app-shell-and-design-system).
- **A WebKit project, visual regression and Lighthouse CI**, left out by ADR 0007, decisions 5, 6 and 23, and ADR 0013, decisions 1 and 23.
- **How the GitHub tracking trial ends** ([OP-086](../../open-points.md#op-086)). It stays in the PH-08 group and is taken as an ADR-only PR right after PH-07 merges, so the review includes this phase.

## Decisions taken in the brainstorm

| # | Topic | Options considered | Decision |
|---|---|---|---|
| 1 | Open points outside E2E | Keep them in PH-07; move them | **[OP-067](../../open-points.md#op-067) moves to PH-08** with the same "does not depend on that phase" note: GitHub shows no Dependabot PR yet, so PH-07 cannot close it. [OP-086](../../open-points.md#op-086) is a process decision, a second concept for the phase; it stays in the PH-08 group and is taken as an ADR-only PR after PH-07 merges. |
| 2 | What `pnpm test:e2e` runs against | The script builds first; Playwright's `webServer` builds, then starts; the developer builds by hand | **The script builds first:** `pnpm build`, then `playwright test`. It always tests the code as it is, and CI runs the same script. A build inside `webServer` counts against the server's timeout and hides its errors; building by hand makes a stale `dist/` easy to test. **The server runs on its own port, 3100, and starts fresh every run** (`reuseExistingServer: false`), so a running `pnpm start` on 3000, with the development database, is never tested by mistake. |
| 3 | How axe scans light and dark | A helper scanning both schemes; six projects (three, each in both schemes); an automatic scan after every navigation | **A helper, `expectAccessible(page)`,** called by the journey on every page it reaches, scans in light, then in dark. Six projects double every run for what is almost always a contrast problem, which the helper catches. An automatic scan cannot tell when a single-page application (SPA) has finished rendering a screen, so it would scan half-loaded pages. |
| 4 | Retries | None; two in CI (Playwright's default); one in CI with flaky tests failing the job | **One retry in CI, with `failOnFlakyTests: true`; none locally.** The check stays red for a flaky test, as ADR 0007, decision 16 wants, and the report labels each failure *flaky* (passed on its retry) or *failed* (failed twice), with a trace of each attempt. Two retries turn the check green and hide the flakiness. |
| 5 | Playwright's browsers in CI | Cached, as ADR 0010, decision 9 said; installed every run; Playwright's container image | **Installed every run, not cached:** `playwright install --with-deps chromium firefox`. Restoring the cache takes about as long as the download, and the system libraries come from `apt`, which cannot be cached; Playwright's CI documentation advises the same. The container image's tag must match `@playwright/test` exactly, and `docker compose up --wait` ([ADR 0020](../../decisions/0020-database-details.md), decision 6) is awkward inside a container job. The install step's time is noted in the PR; if it dominates the job, the cache or the image comes back. **Refines ADR 0010, decision 9.** |
| 6 | Server and database | One start script reading `apps/api/.env`; a separate `e2e/.env` with a reset step in the script; importing the API's test helpers | **One start script, `e2e/start-server.ts`:** it resets `szop_e2e`, then starts the API with the settings of `apps/api/.env` and the E2E overrides merged in one visible expression, `{ ...process.env, ...fileEnv, ...overrides }`, rather than through `--env-file`, whose precedence rule (the environment wins over the file) is invisible in the code. Being one script, the reset always comes before the start, whether the run starts from the command line, the editor or CI. A second `.env` would drift from the first; importing from `apps/api/src/test/` would couple `e2e/` to another package's private test folder. |
| 7 | The CSP guard | The `securitypolicyviolation` event; console messages; a report endpoint on the API | **The event, collected by a wrapper of Playwright's `context` fixture** and checked after every test. It is standard and fires in Chromium and Firefox alike. Firefox writes its CSP messages to the browser's own console, which Playwright may not see; a report endpoint adds a route to the API for the tests' sake. **ESLint bans importing from `@playwright/test` in `e2e/tests/`**, since a journey that bypasses `support/test.ts` would run unguarded and still pass. |
| 8 | The first journey's name and lifetime | `health.spec.ts`; `uc-01-…` | **`health.spec.ts`,** named after the page: no use case is complete, and the `uc-NN-…` files of ADR 0007, decision 17 are for use cases. It stays until the health page itself is replaced, tracked as [OP-087](../../open-points.md#op-087) for PH-14. |
| 9 | What CI keeps of a failed run | The HTML report; the report and `test-results/` | **The HTML report only.** Playwright copies each failed test's trace and screenshot into it, so it is the one thing needed to read a failure. |

## Design

### Layout

```
e2e/
  package.json          @szop/e2e, private, ESM
  tsconfig.json         extends tsconfig.base.json, like the other packages
  playwright.config.ts
  start-server.ts       resets szop_e2e, starts the API
  support/
    test.ts             test and expect: Playwright's, extended with the CSP guard
    accessibility.ts    expectAccessible(page)
  tests/
    health.spec.ts      the first journey
    csp-guard.spec.ts   the guard catches an injected <style>
```

`pnpm-workspace.yaml` lists `e2e` next to `apps/*` and `packages/*`. Vitest's projects are listed one by one in the root `vitest.config.ts`, so the specs in `e2e/` are never picked up by `pnpm test`. `.gitignore` gains `e2e/playwright-report/` and `e2e/test-results/`.

### Scripts

- **Root:** `"test:e2e": "pnpm build && pnpm --filter @szop/e2e exec playwright test"`. Arguments pass through to Playwright: `pnpm test:e2e --project=desktop-firefox`, `pnpm test:e2e --ui`.
- **`e2e`:** `"typecheck": "tsc --noEmit"`, so the root `pnpm typecheck` covers it through `pnpm -r typecheck`.

### The Playwright config

| Setting | Value | Why |
|---|---|---|
| `testDir` | `tests` | `support/` holds no tests |
| `projects` | `desktop-chromium` (`devices["Desktop Chrome"]`), `desktop-firefox` (`devices["Desktop Firefox"]`), `pixel` (`devices["Pixel 7"]`) | ADR 0007, decision 5; ADR 0013, decision 2 |
| `webServer` | `command: "node start-server.ts"`, `url: "http://127.0.0.1:3100/api/health"`, `reuseExistingServer: false`, `stdout: "pipe"`, `gracefulShutdown: { signal: "SIGTERM", timeout: 5000 }` | [Decisions 2 and 6](#decisions-taken-in-the-brainstorm); the server's warnings and errors show in the run's output; the API shuts down as it always does |
| `use.baseURL` | `http://127.0.0.1:3100` | Journeys say `page.goto("/")` |
| `use.trace`, `use.screenshot` | `retain-on-failure`, `only-on-failure`; no video | Evidence from every attempt of a failed test |
| `retries`, `failOnFlakyTests` | `1` and `true` when `CI` is set; `0` and `false` otherwise | [Decision 4](#decisions-taken-in-the-brainstorm) |
| `forbidOnly` | `true` when `CI` is set | A forgotten `test.only` cannot pass CI while running one test |
| `fullyParallel` | `true` | Each test isolates itself in a fresh browser context (ADR 0007, decision 15) |
| `reporter` | locally `list` and `html` with `open: "never"`; in CI `github` and `html` with `open: "never"` | `github` puts failures on the PR as annotations; the HTML report is what CI uploads |

The port is written once, as a constant in the config, and passed to `start-server.ts` through the environment (`E2E_PORT`), so the two never disagree.

### Starting the server

`e2e/start-server.ts` runs these steps in order and stops at the first problem with a message saying what to do:

1. **Check the build.** If `apps/web/dist/index.html` is missing, exit with "run `pnpm build` first (`pnpm test:e2e` does it for you)". The API would start without it and answer 404 on every page, a puzzling failure; this matters for runs from the VS Code extension, which do not build.
2. **Read the settings** of `apps/api/.env` with Node's `parseEnv`. A missing file is reported with "copy `apps/api/.env.example` to `apps/api/.env`".
3. **Reset the database.** Connect with `pg` to the maintenance database `postgres` on the server the settings name, never to the development database. If PostgreSQL cannot be reached, say "start it with `docker compose up -d`". Run `DROP DATABASE IF EXISTS szop_e2e WITH (FORCE)`, then `CREATE DATABASE szop_e2e`. `FORCE` closes connections a crashed run left. Nothing is dropped afterwards, so the data of a failed run can be inspected.
4. **Start the API** as a child process: `node src/server.ts`, run from `apps/api`, with the environment

   ```ts
   { ...process.env, ...fileEnv, ...overrides }
   ```

   where `fileEnv` is what step 2 read and `overrides` are `DATABASE_NAME=szop_e2e`, `HOST=127.0.0.1`, `PORT` (from `E2E_PORT`), `LOG_LEVEL=warn` and `WEB_ROOT` (the absolute path of `apps/web/dist`). The order of the spread is the rule: the shell's variables (`PATH` and the like), then the API's `.env`, then the E2E overrides above both. The API is not changed: it reads `process.env` as always. It migrates the empty database before it listens, so when `/api/health` answers, Playwright's readiness wait has also covered the migrations.
5. **Wait for the API, without relaying signals.** Playwright stops its server by signalling the whole process group, so the API receives the `SIGTERM` itself and shuts down as it always does: it finishes requests in flight and closes its pool. The script catches `SIGINT` and `SIGTERM` only so that it is not killed first, and does not pass them on: a relayed second signal would reach the API after `server.ts`'s `process.once` handler is used up and kill it mid-shutdown (found while planning, see the plan's checked facts). The script exits with the API's exit code, so a failed start shows as the server exiting early, after its `startup failed` log line. If Playwright's grace period runs out, it kills the whole group, the API included.

What a developer sees when something is wrong:

| Case | Result |
|---|---|
| Port 3100 already in use | If it answers `/api/health` (a `pnpm start` on that port, say), Playwright refuses to start, saying the URL is already used, because `reuseExistingServer` is `false`; otherwise the API cannot listen, logs `startup failed` and the run stops |
| PostgreSQL is down | Step 3's message; no test runs |
| A migration fails | The API logs `startup failed` and exits 1; Playwright reports that the server exited early |

### The CSP guard

`support/test.ts` extends Playwright's `test` with one fixture, wraps another, and re-exports `expect`:

- **`cspViolations`**, a list of reports. Each report holds the violation's `effectiveDirective`, `blockedURI`, `sourceFile:lineNumber` and `sample`.
- **`context`, wrapped**, so every test that imports this `test` is guarded without asking for it. Playwright creates `page` from `context`, so the guard is in place before the first page opens; a separate automatic fixture would have no such ordering. Before handing the context on, it exposes a binding (`context.exposeBinding`) and adds an init script (`context.addInitScript`) that listens for `securitypolicyviolation` on `document` and calls the binding with the report. Being on the context, it covers every page and every navigation. After the test body, it makes one round trip to each open page, so a report sent in the test's last moment has arrived, then asserts that `cspViolations` is empty. The failure message lists each violation.

`bypassCSP` keeps its default, `false`.

### The accessibility check

`support/accessibility.ts` exports `expectAccessible(page)`:

1. For `light`, then `dark`, each in a `test.step` named `axe (light)` and `axe (dark)`: `page.emulateMedia({ colorScheme })`, then `new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()`.
2. Back to `light`, the projects' default.
3. One assertion over both schemes' violations, each listed as `[dark] color-contrast: 2 elements — main > p` (scheme, rule ID, how many elements, their selectors), so one failure shows every problem.

No rule is turned off globally. If a rule ever has to be skipped, it is done in that one call (an `options` argument passing axe's `disableRules`), with a comment saying why.

### The journeys

- **`tests/health.spec.ts`:** `page.goto("/")`; expect the `status` region to contain "API: ok" and "Database: up"; `expectAccessible(page)`. The CSP guard covers it.
- **`tests/csp-guard.spec.ts`:** `page.goto("/")`; add a `<style>` element with `page.evaluate`; `expect.poll` until `cspViolations` holds exactly one report, with the directive `style-src-elem`; empty the list, so the guard's own check passes. It proves both that the guard detects violations and that the built app is served with its CSP: if either breaks, it fails. It runs on all three projects, which also proves that Firefox reports the event.

### Lint and types

- **ESLint:** the root config gains a block for `e2e/tests/**/*.ts` with `no-restricted-imports`, refusing `@playwright/test` with the message "Import test and expect from ../support/test.ts, which adds the CSP guard". `support/` and the config import from `@playwright/test` as they must.
- **TypeScript:** `e2e/tsconfig.json` extends `tsconfig.base.json` with `noEmit`, `erasableSyntaxOnly`, `allowImportingTsExtensions` and `types: ["node"]`, and includes every `.ts` file in `e2e/`. `start-server.ts` runs under Node's type stripping like the API, so it uses only erasable syntax; Playwright loads its own TypeScript files.

### The e2e job in CI

A job in `ci.yml`, next to `test` and `build`:

```yaml
e2e:
  name: e2e
  needs: changes
  if: needs.changes.outputs.code == 'true'
  runs-on: ubuntu-24.04
  timeout-minutes: 15
  permissions:
    contents: read
  steps:
    - uses: actions/checkout@<SHA> # with persist-credentials: false
    - uses: ./.github/actions/setup
    - run: cp apps/api/.env.example apps/api/.env
    - run: docker compose up -d --wait
    - name: Install Playwright's browsers
      run: pnpm --filter @szop/e2e exec playwright install --with-deps chromium firefox
    - run: pnpm test:e2e
    - if: failure()
      uses: actions/upload-artifact@<SHA> # pinned to a full SHA, like every action
      with:
        name: playwright-report
        path: e2e/playwright-report/
        retention-days: 14
```

- The browsers are not cached ([decision 5](#decisions-taken-in-the-brainstorm)).
- `ci-ok` adds `e2e` to its `needs`, so it becomes required without changing GitHub's settings, as `build` did in PH-06a.
- The report is uploaded only when the job fails (ADR 0010, decision 9).

### Dependencies

`e2e/package.json`'s `devDependencies`: `@playwright/test`, `@axe-core/playwright`, `pg`, `@types/pg` and `@types/node`, each at its latest version a week old or more, like Dependabot's cooldown. Playwright downloads its browsers with its own command, not through an install script, so `allowBuilds` in `pnpm-workspace.yaml` is unchanged; if pnpm reports a build script, the owner decides it as [ADR 0012](../../decisions/0012-security-baseline.md), decision 18 says. Dependabot's npm entry already covers the workspace from `/`.

## Documentation and records

- **ADR 0026 "First E2E journey details"**, with the decisions above. It **refines** [ADR 0010](../../decisions/0010-ci-cd.md), decision 9 (the browsers are installed every run, not cached) and [ADR 0007](../../decisions/0007-testing-strategy.md), decision 15 (the reset once per run is done by `start-server.ts`, and the E2E server's port), with the notes in all three places: the new ADR's header, the earlier ADRs' status lines, and a line at the bottom of each decision's cell.
- **`docs/development/testing.md`:** "The layers today" with the E2E layer; running the suite (command line, a single project, the UI mode, the editor, which needs a build first); writing a journey (import from `support/test.ts`, call `expectAccessible` once a page has settled, isolate through fresh contexts, never share state between tests); the CSP guard and what to do when it fires; reading a failed run's report and trace; the rule that no axe rule is turned off globally.
- **`docs/development/tools/playwright.md`:** what Playwright and axe are, why they were chosen, and the config explained setting by setting.
- **`docs/development/setup.md`:** installing the browsers with `--with-deps` (the owner step) and the Playwright Test extension; the "comes later" line about Playwright removed.
- **`docs/development/ci-cd.md`:** the `e2e` job, the browsers' install, and how to download and read the report of a failed run.
- **`docs/architecture/stack-overview.md`:** what an E2E test is, how Playwright drives a browser and what axe checks.
- **`docs/architecture/architecture.md`:** the `e2e/` line in the layout gets its parts (the start script, the guard, the helper).
- **`docs/glossary.md`:** any acronym new to the docs.
- **`.vscode/extensions.json`:** `ms-playwright.playwright` (ADR 0007, decision 21).
- **GitHub first, then the docs** ([ADR 0024](../../decisions/0024-github-project-tracking.md)):
  - [#36](https://github.com/luiki-dev/szop/issues/36) is 🚧 In progress, with its owner step [#159](https://github.com/luiki-dev/szop/issues/159) (installing the browsers with their system libraries); its Spec and Plan fields set as they are committed. The roadmap's PH-07 row and **Owner steps** follow, with the README's diagram.
  - [OP-010](../../open-points.md#op-010): the PH-07 part ✅ done; re-parented to PH-15, ⬜ Backlog.
  - [OP-012](../../open-points.md#op-012) and [OP-057](../../open-points.md#op-057): closed by the PR.
  - [OP-067](../../open-points.md#op-067): re-parented to PH-08, with "Moved from PH-07: it does not depend on that phase."
  - [OP-087](../../open-points.md#op-087) ([#160](https://github.com/luiki-dev/szop/issues/160)), under PH-14: replace the health journey when the health page goes.

## Tasks

1. **The package and the first journey.** `e2e/` with its `package.json`, `tsconfig.json`, `playwright.config.ts` and `start-server.ts`; the workspace entry, the root script, `.gitignore`; `tests/health.spec.ts` with plain `@playwright/test` for now. `pnpm test:e2e` passes on the three projects, and the shutdown checks hold.
2. **The CSP guard.** `support/test.ts`, `tests/csp-guard.spec.ts`, the journey switched to `support/test.ts`, and the ESLint rule.
3. **The accessibility check.** `support/accessibility.ts`, called by the journey.
4. **The `e2e` job in CI**, with the artifact and `ci-ok`'s `needs`.
5. **The guides.** `testing.md`, `tools/playwright.md`, `setup.md`, `ci-cd.md`, `stack-overview.md`, `architecture.md`, the glossary and `.vscode/extensions.json`.
6. **The records.** ADR 0026 and the notes in ADR 0007 and ADR 0010; GitHub, then the roadmap, the README's diagram and the register.

## To verify during implementation

- `failOnFlakyTests` exists in the installed Playwright, and a test that passes on its retry fails the run while the report labels it flaky. Check once, with a test made to fail on its first attempt, not committed.
- `webServer.gracefulShutdown` stops the API through its process group, with one `SIGTERM`: nothing listens on 3100 after a passing run, a failed run and Ctrl+C.
- Firefox fires `securitypolicyviolation` for the injected `<style>`, with `effectiveDirective` `style-src-elem` as in Chromium; if it reports another directive name, the guard's test accepts both, with a comment.
- The guard's final check runs while the test's pages are still open, so the round trip reaches them. If the `context` fixture's teardown comes too late for that, the round trip and the check move to an automatic fixture that depends on `page`, and the setup stays on `context`.
- `page.evaluate` is not exempt from the CSP in either browser: the injected element is blocked and reported.
- The device is named `Pixel 7` in the installed Playwright's device list.
- The health page passes axe's four rule sets as it is. If it does not, the fix goes in `apps/web`, not in a disabled rule.
- The extension's ID is `ms-playwright.playwright`.
- The install step's time in CI, for the PR description ([decision 5](#decisions-taken-in-the-brainstorm)).
