# Testing guide

How Szop is tested **now**: the layers, how to run them, how to write each kind of test, and the rules. This guide is the *how*; [ADR 0007](../decisions/0007-testing-strategy.md) is the *why*, with the options that were considered. The tools behind the tests have their own pages: [Vitest](tools/vitest.md), [Testing Library](tools/testing-library.md) and [Mock Service Worker (MSW)](tools/msw.md).

The guide grows as the layers arrive: end-to-end (E2E) journeys in [PH-07](../roadmap.md#ph-07-first-e2e-journey), and property tests and mutation testing in [PH-15](../roadmap.md#ph-15-seed-catalog-read-only).

## Contents

- [The layers today](#the-layers-today)
- [Running the tests](#running-the-tests)
- [Writing an API test](#writing-an-api-test)
  - [Unsafe requests](#unsafe-requests)
  - [Reading the log](#reading-the-log)
  - [Testing a hook before its routes exist](#testing-a-hook-before-its-routes-exist)
  - [Testing the served SPA](#testing-the-served-spa)
- [Writing a database test](#writing-a-database-test)
- [Writing a component test](#writing-a-component-test)
- [Writing a unit test](#writing-a-unit-test)
- [Rules](#rules)
- [Coverage](#coverage)

## The layers today

| Layer | Where its tests live | What they prove | Vitest project |
|---|---|---|---|
| API tests | `apps/api/src/**/*.test.ts`, for example `health/routes.test.ts` | A request through the real app gets the right status, headers and body: they go through `buildApp` and `inject()` | `api` |
| Database tests | `apps/api/src/**/*.test.ts` that call `useTestDatabase()`, for example `test/database.test.ts` | Queries, migrations and cleanup work against the real PostgreSQL | `api` |
| Component tests | `apps/web/src/**/*.test.tsx`, for example `health/health-page.test.tsx` | A page works as a user sees it: the real route table, hook, API client and schema run in a simulated browser ([jsdom](tools/vitest.md#jsdom)) with only the network faked by MSW | `web` |
| Unit tests | next to the code, for example `apps/api/src/config.test.ts` | One function does its job for each kind of input, with no server involved | `api` |
| The push hook | `.claude/hooks/guard-git-push.test.ts` | The hook that guards `git push` blocks what it must and allows the rest ([ADR 0015](../decisions/0015-git-push-guard-hook.md)) | `hooks` |

Layers still to come:

- **E2E journeys**, a real browser against the whole stack, in [PH-07](../roadmap.md#ph-07-first-e2e-journey).
- **Property tests and mutation testing** for the domain rules, in [PH-15](../roadmap.md#ph-15-seed-catalog-read-only).

## Running the tests

All commands run from the repository root. PostgreSQL must be running first for the API tests (`docker compose up -d --wait`, see [Docker Compose and PostgreSQL](tools/docker-compose.md); the `web` project itself needs no database); otherwise the run stops at once with `Cannot reach PostgreSQL … Start it with docker compose up -d.` The tests read the server's address and password from `apps/api/.env`.

```bash
pnpm test                       # every project once, the same tests CI runs (CI adds `--coverage`)
pnpm test:watch                 # stays running and re-runs the tests a change affects, on every save
pnpm test --project api         # one project only: api, web or hooks
pnpm test --project web         # for example, only the component tests
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
const config = testConfig();

describe("GET /api/health", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("answers 200 with the schema version when the database is up", async () => {
    app = buildApp({ config, db: database.db });

    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.json()).toEqual({
      status: "ok",
      database: { status: "up", schemaVersion: "0000_init" },
    });
  });
});
```

Line by line:

- **`testConfig()`** (`apps/api/src/test/config.ts`) gives a whole `Config` built by hand instead of read from the environment, so the test works the same on every machine. `logLevel: "silent"` keeps the log lines out of the test output. `database` is never used, since the test hands `buildApp` a database of its own; `webRoot` names a folder that does not exist, since this test does not serve the SPA ([Testing the served SPA](#testing-the-served-spa) does); and `trustedProxies` is empty, so no proxy is trusted. A test overrides only what it is about, such as `testConfig({ logLevel: "info" })` or `testConfig({ trustedProxies: ["10.0.0.0/16"] })`, so a new setting needs one change in `testConfig`, not one in every test.
- **`useTestDatabase()`** gives the file a real, empty PostgreSQL database ([Writing a database test](#writing-a-database-test)).
- **`buildApp({ config, db })` in each test.** Every test gets a fresh app, so nothing one test does can leak into the next; a test that needs another database, such as one that cannot be reached, passes that instead. `buildApp` is the same function `server.ts` calls in production.
- **`app.close()` in `afterEach`.** It shuts the app down properly, so no test leaves anything running.
- **`app.inject()`.** Fastify handles the request in memory, through the same routing, validation and serialization as a real one, but without opening a port. It is fast, and two tests can never fight over a port.
- **Three assertions.** The status code, the content type and the body are the contract a client sees, so the test checks all three. `toMatch` accepts any `application/json; charset=…` suffix; `toEqual` compares the whole body. The real test also parses the body with the shared `healthSchema`, so the API fails its own test when it drifts from the contract.

Later phases pass more things in through the same `buildApp(deps)`: a recording email sender and a controllable clock ([ADR 0007](../decisions/0007-testing-strategy.md), decision 14). Only the fakes differ from production, never the wiring.

### Unsafe requests

Every POST, PUT, PATCH and DELETE must send `Sec-Fetch-Site: same-origin`, as a browser on Szop's own page does. Without it, the cross-site check answers 403 in its `onRequest` hook, before routing, validation or the handler, so the test would prove the check instead of the route ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decision 1). For a route such as a later `POST /api/lists`:

```ts
const response = await app.inject({
  method: "POST",
  url: "/api/lists",
  headers: { "sec-fetch-site": "same-origin" },
  payload: { name: "Groceries" },
});
```

A body sent as an object goes out as JSON with `Content-Type: application/json`; any other content type gets 415 (decision 3). The check itself is tested in `security/cross-site.test.ts`, the JSON rule in `security/json-only.test.ts`.

### Reading the log

A test that checks what the app logs passes a log of its own. `captureLog()` (`apps/api/src/test/log.ts`) returns a `stream` to hand to `buildApp` as `logStream`, and `lines()`, which returns every line written so far, parsed from JSON. The app must log at `info` or below, since `testConfig()` keeps it silent:

```ts
const log = captureLog();
app = buildApp({
  config: testConfig({ logLevel: "info" }),
  db: database.db,
  logStream: log.stream,
});

await app.inject({ method: "GET", url: "/reset-password?token=s3cret" });

const incoming = log.lines().find((line) => line.msg === "incoming request");
expect(incoming?.req).toMatchObject({ url: "/reset-password?token=[redacted]" });
expect(JSON.stringify(log.lines())).not.toContain("s3cret");
```

Production leaves `logStream` out and logs to standard output ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decision 9). `security/log.test.ts` and `security/client-ip.test.ts` read the log this way.

### Testing a hook before its routes exist

A hook that guards routes, such as the cross-site check, has to be tested before the first real route that needs it exists. The test adds a throwaway route right after `buildApp` and before the first `inject()`, when Fastify still accepts new routes:

```ts
app = buildApp({ config: testConfig(), db: database.db });
app.route({
  method: ["POST", "DELETE"],
  url: "/api/test-body",
  handler: () => ({ ok: true }),
});
```

The route answers 200, so a test sees whether the hook let the request through. Name it `/api/test-…`, so it cannot be mistaken for a real one. Once a real route exists, a test of the hook may use it instead.

### Testing the served SPA

`apps/api/src/web/routes.test.ts` checks how the API serves the built web app: the compressed copies, the cache headers and the fallback to `index.html` ([ADR 0023](../decisions/0023-production-build-and-serving-details.md), decisions 5, 6 and 8). It never depends on running `pnpm build`:

- **`useWebRoot()`** (`apps/api/src/test/web-root.ts`), called at the top of the file, writes a miniature build into a fresh temporary folder before the tests and removes it afterwards: an `index.html` and an `assets/index-abc123.js`, each with a `.br` and a `.gz` copy made by `node:zlib`. The contents are exported as `webRootFiles`, so a test compares a body with the file it came from. Each test passes it to `buildApp` as `testConfig({ webRoot: webRoot.path })`.
- **A compressed body** is checked by decompressing the raw bytes: `response.rawPayload` holds the body as sent, and `brotliDecompressSync(response.rawPayload)` (or `gunzipSync`) turns it back into the file. `response.body` would decode the bytes as text, which garbles compressed data.
- **The request headers decide the encoding,** so each test sets `accept-encoding` as a browser would (`gzip, deflate, br, zstd`), as an older client would (`gzip`) or not at all, and checks `content-encoding`, `cache-control` and `vary`.

## Writing a database test

A database test runs against a real PostgreSQL, so a query, a migration or a cleanup is proven the way production runs it ([ADR 0007](../decisions/0007-testing-strategy.md), decisions 12 and 13).

- **The databases.** Once per run, before any test, `globalSetup` (`apps/api/src/test/global-setup.ts`) drops and recreates `szop_test_template`, migrates it with the same `runMigrations` as production, and copies it to `szop_test_1`, `szop_test_2` and so on, one per possible worker. That takes about 0.6 s on 16 CPUs. Each Vitest worker uses its own copy, so test files run in parallel without touching each other's rows.
- **One test run at a time.** A second run drops and recreates the databases the first is using (`DROP DATABASE … WITH (FORCE)` closes its connections), so the first fails with strange errors. That includes the Vitest extension for VS Code or `pnpm test:watch` running next to `pnpm test`. Watch mode does not run `globalSetup` again when a migration is added, so its template goes stale: restart it after adding a migration.
- **`useTestDatabase()` at the top of the file**, then `database.db` inside the tests. Pass it on to the app with `buildApp({ config, db })`.
- **Empty tables, before each test.** Every table of the `public` schema is emptied before each test (`TRUNCATE … RESTART IDENTITY CASCADE`), so a test starts clean even if the previous one crashed. Drizzle's own record of applied migrations lives in another schema and is kept.
- **A test that creates its own table drops it** in `finally`, as `test/database.test.ts` does, so the table does not leak into the next file that uses the same worker's database.
- **A test that creates its own `Database` closes it** with `db.$client.end()`.
- **Inspecting after a failure.** Nothing is dropped when a run ends, so the databases stay until the next run: `docker compose exec postgres psql -U szop -d szop_test_1`.
- **The development database `szop` is never touched.** Tests only connect to `postgres` (to create the others) and to `szop_test_*`.

## Writing a component test

A component test renders a page in a simulated browser and checks what the user would see. Only the network is faked: the real route table, data hook, API client and schema run. The first one, `apps/web/src/health/health-page.test.tsx`, is the pattern. Its setup helper and its database-down case:

```tsx
function renderApp() {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

it("says the database is down when the API reports it", async () => {
  const databaseDown = {
    status: "error",
    database: { status: "down" },
  } satisfies Health;
  server.use(
    http.get("/api/health", () =>
      HttpResponse.json(databaseDown, { status: 503 }),
    ),
  );

  renderApp();

  expect(await screen.findByText("API: reachable")).toBeInTheDocument();
  expect(screen.getByText("Database: down")).toBeInTheDocument();
});
```

Line by line:

- **The real route table.** `createMemoryRouter(routes)` builds a router from the same `routes` array the app uses, with the address held in memory, so a test runs the real route definitions and not a copy that could drift from them.
- **A fresh `QueryClient` per test.** TanStack Query caches answers in its `QueryClient`; a new one for each test means a cached answer cannot leak into the next.
- **`server.use` sets the state.** The default handler, in `src/test/server.ts`, answers the healthy body. A test that needs another state adds a handler for that test; the setup file drops it afterwards ([MSW](tools/msw.md)). Nothing else is faked: the client, the hook and the schema parse the answer as in production.
- **A handler with a valid body is typed with the shared schema.** The body is written `satisfies Health`, the type from `packages/shared`, so a fake that drifts from the real response fails the type check.
- **Find elements by role and text.** `getByRole("status")` finds the element that announces the page's state; `getByText` finds a line in it. Never by test ID ([Testing Library](tools/testing-library.md)).
- **`findBy` for what appears after a request.** The answer arrives after the first render, so `await screen.findByText(…)` waits for it, where `getByText` would fail at once. Once one `findBy` has passed, the other texts of the same answer are there, and `getBy` is enough. `getByRole("status")` right after `render` finds the element synchronously, so "Checking the API…" can be asserted before the answer.

A relative address such as `/api/health` works as it is; no test resolves it against a host. When the second page's test arrives, move `renderApp` to `src/test/` and share it; the states a test needs come from `server.use`.

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
- **A handler that returns a valid health body is typed with the shared schema** (`satisfies Health`), so a fake that drifts from the contract fails the type check. The two rows of the page's `it.each` that return invalid bodies on purpose are the exception.
- **A request nobody wrote a handler for fails the test**, naming the request, and never reaches a real network. `src/test/setup.ts` records each such request in an `onUnhandledFrame` callback and fails the test in `afterEach`; MSW 3's ready-made `"error"` strategy alone would only print an error and reject the request, which a test expecting the "Can't reach the API" state would not notice. Keep both halves ([MSW](tools/msw.md)).
- **No snapshot tests of markup.** Too easy to "update the snapshot" without reading it.
- **Flaky tests are bugs.** Fix or delete them promptly; never just re-run.
- **Test-driven development (TDD) for domain rules, services and routes**, and every bug fix starts with a failing test that reproduces it ([ADR 0007](../decisions/0007-testing-strategy.md), decision 3).
- **Entry points are checked by hand.** `server.ts` only reads the environment, listens and shuts down. Everything it calls is tested, so what is left untested is a few lines of wiring; the manual checks (it starts and `/api/health` answers, a missing or invalid setting stops it with a message naming the variable, a taken port, Ctrl+C shuts it down gracefully, an edit restarts it) are recorded in the phase's pull request ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 10).

## Coverage

Coverage tells you which lines the tests ran. It is **measured, never gated**: no threshold fails the build, because a threshold rewards tests written to touch lines rather than to check behavior ([ADR 0007](../decisions/0007-testing-strategy.md), decision 19).

- **The terminal table** has one row per file and these columns: `% Stmts` (statements run), `% Branch` (the sides of `if`s and other decisions taken), `% Funcs` (functions called) and `% Lines` (lines run), then `Uncovered Line #s`, the line numbers no test reached.
- **Files no test loads show at 0%.** The root `vitest.config.ts` lists the folders to measure, so `server.ts`, which no test imports, appears at 0% instead of silently missing. That is the honest picture of an entry point checked by hand.
- **Every file gets a row in the terminal table**, fully covered ones included. Vitest hides fully covered files only when it detects that an AI agent is running it, so the table may look shorter in an agent's output. `coverage/coverage-summary.json` lists every measured file, and `coverage/index.html` shows the same numbers, which you can click through down to the line.
- **The test helpers are excluded.** The files in `apps/*/src/test/` are test infrastructure, not app code, so they get no row. `global-setup.ts` would show 0% anyway, since it runs outside the test workers.
- **CI shows the same numbers.** The `test` job runs `pnpm test:coverage` and writes a table of every file, from `coverage-summary.json`, to the job's summary ([CI/CD](ci-cd.md)).
