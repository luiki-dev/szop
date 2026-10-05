# Testing guide

How Szop is tested **now**: the layers, how to run them, how to write each kind of test, and the rules. This guide is the *how*; [ADR 0007](../decisions/0007-testing-strategy.md) is the *why*, with the options that were considered. The tool behind the tests has its own page: [Vitest](tools/vitest.md).

The guide grows as the layers arrive: the database in [PH-04](../roadmap.md#ph-04-database), components in [PH-05](../roadmap.md#ph-05-spa-skeleton), end-to-end (E2E) journeys in [PH-07](../roadmap.md#ph-07-first-e2e-journey), and property tests and mutation testing in [PH-15](../roadmap.md#ph-15-seed-catalog-read-only).

## Contents

- [The layers today](#the-layers-today)
- [Running the tests](#running-the-tests)
- [Writing an API test](#writing-an-api-test)
- [Writing a unit test](#writing-a-unit-test)
- [Rules](#rules)
- [Coverage](#coverage)

## The layers today

| Layer | Where its tests live | What they prove | Vitest project |
|---|---|---|---|
| API tests | `apps/api/src/**/*.test.ts`, for example `health/routes.test.ts` | A request through the real app gets the right status, headers and body: they go through `buildApp` and `inject()` | `api` |
| Unit tests | next to the code, for example `apps/api/src/config.test.ts` | One function does its job for each kind of input, with no server involved | `api` |
| The push hook | `.claude/hooks/guard-git-push.test.ts` | The hook that guards `git push` blocks what it must and allows the rest ([ADR 0015](../decisions/0015-git-push-guard-hook.md)) | `hooks` |

Layers still to come:

- **Database tests**, with a real database, in [PH-04](../roadmap.md#ph-04-database).
- **Component tests** for the web app, in [PH-05](../roadmap.md#ph-05-spa-skeleton).
- **E2E journeys**, a real browser against the whole stack, in [PH-07](../roadmap.md#ph-07-first-e2e-journey).
- **Property tests and mutation testing** for the domain rules, in [PH-15](../roadmap.md#ph-15-seed-catalog-read-only).

## Running the tests

All commands run from the repository root.

```bash
pnpm test                       # every project once, the same tests CI runs (CI adds `--coverage`)
pnpm test:watch                 # stays running and re-runs the tests a change affects, on every save
pnpm test --project api         # one project only: api or hooks
pnpm test health                # only the files whose path contains "health"
pnpm test:coverage              # every project, plus a coverage report
```

- `pnpm test` ends with Vitest's `Test Files … passed` and `Tests … passed` lines. A failure prints the test's name, the line that failed and, for `expect`, the expected and the received value side by side.
- A filter is a piece of a file path, not a test name: `pnpm test config` runs `config.test.ts`. If it matches nothing, Vitest says `No test files found`.
- `pnpm test:coverage` is defined as `pnpm test --coverage`, so it always runs the same tests as `pnpm test`, with measuring switched on. It prints a table in the terminal and writes `coverage/index.html`, a report you open in a browser. See [Coverage](#coverage).
- In VS Code, the Vitest extension lists every test in the Testing view and runs one from the green arrow next to it. See [VS Code](tools/vscode.md).

## Writing an API test

An API test sends an HTTP request to the app and checks the answer. The health test, `apps/api/src/health/routes.test.ts`, is the pattern every later route test follows:

```ts
const config: Config = { host: "127.0.0.1", port: 3000, logLevel: "silent" };

describe("GET /api/health", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp({ config });
  });

  afterEach(async () => {
    await app.close();
  });

  it("answers 200 with status ok", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
```

Line by line:

- **A literal `Config`.** The test builds the settings by hand instead of reading the environment, so it works the same on every machine. `logLevel: "silent"` keeps the log lines out of the test output.
- **`buildApp({ config })` in `beforeEach`.** Every test gets a fresh app, so nothing one test does can leak into the next. `buildApp` is the same function `server.ts` calls in production.
- **`app.close()` in `afterEach`.** It shuts the app down properly, so no test leaves anything running.
- **`app.inject()`.** Fastify handles the request in memory, through the same routing, validation and serialization as a real one, but without opening a port. It is fast, and two tests can never fight over a port.
- **Three assertions.** The status code, the content type and the body are the contract a client sees, so the test checks all three. `toMatch` accepts any `application/json; charset=…` suffix; `toEqual` compares the whole body.

Later phases pass more things in through the same `buildApp(deps)`: a test database, a recording email sender and a controllable clock ([ADR 0007](../decisions/0007-testing-strategy.md), decision 14). Only the fakes differ from production, never the wiring.

## Writing a unit test

A unit test lives next to the code it tests and has the same name with `.test.ts`: `config.ts` and `config.test.ts`.

- **Import what you use from `vitest`**: `import { describe, expect, it } from "vitest"`. Szop does not turn on Vitest's globals, so every name a test uses is visible in its imports, and TypeScript and ESLint know where each comes from.
- **`describe` groups, `it` states one behavior** in a sentence that reads as a specification: `it("rejects an empty HOST instead of treating it as missing", …)`.
- **`it.each` runs one test over a table of inputs**, which keeps a list of cases short. `config.test.ts` uses it to check that each variable is reported when missing, and that each bad `PORT` is rejected:

  ```ts
  it.each(["abc", "0", "70000", "3000.5", ""])("rejects PORT=%j", (port) => {
    expect(errorFor({ ...valid, PORT: port })).toMatch(/PORT: (?!missing)/);
  });
  ```

  `%j` puts each value in the test's name as JSON, so a failure tells you which input broke.

## Rules

These follow [ADR 0007](../decisions/0007-testing-strategy.md), decision 16, unless another source is named.

- **Test at the lowest layer that can prove the behavior.** An edge case in a rule gets a unit test; a permission check, an API test; a user journey is the last resort.
- **No `vi.mock` of our own modules.** Replacing a module couples the test to the file structure and hides wiring mistakes. Fakes go in through `buildApp(deps)`.
- **No snapshot tests of markup.** Too easy to "update the snapshot" without reading it.
- **Flaky tests are bugs.** Fix or delete them promptly; never just re-run.
- **Test-driven development (TDD) for domain rules, services and routes**, and every bug fix starts with a failing test that reproduces it ([ADR 0007](../decisions/0007-testing-strategy.md), decision 3).
- **Entry points are checked by hand.** `server.ts` only reads the environment, listens and shuts down. Everything it calls is tested, so what is left untested is a few lines of wiring; the manual checks (it starts and `/api/health` answers, a missing or invalid setting stops it with a message naming the variable, a taken port, Ctrl+C shuts it down gracefully, an edit restarts it) are recorded in the phase's pull request ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 10).

## Coverage

Coverage tells you which lines the tests ran. It is **measured, never gated**: no threshold fails the build, because a threshold rewards tests written to touch lines rather than to check behavior ([ADR 0007](../decisions/0007-testing-strategy.md), decision 19).

- **The terminal table** has one row per file and these columns: `% Stmts` (statements run), `% Branch` (the sides of `if`s and other decisions taken), `% Funcs` (functions called) and `% Lines` (lines run), then `Uncovered Line #s`, the line numbers no test reached.
- **Files no test loads show at 0%.** The root `vitest.config.ts` lists the folders to measure, so `server.ts`, which no test imports, appears at 0% instead of silently missing. That is the honest picture of an entry point checked by hand.
- **Every file gets a row in the terminal table**, fully covered ones included. Vitest hides fully covered files only when it detects that an AI agent is running it, so the table may look shorter in an agent's output. The same numbers are in `coverage/index.html`, which you can click through down to the line, and in CI's table.
- **CI shows the same numbers.** The `test` job runs `pnpm test:coverage` and writes a table of every file to the job's summary ([CI/CD](ci-cd.md)).
