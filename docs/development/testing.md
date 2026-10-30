# Testing guide

How Szop is tested **now**: the layers, how to run them, how to write each kind of test, and the rules. This guide is the *how*; [ADR 0007](../decisions/0007-testing-strategy.md) is the *why*, with the options that were considered. The tools behind the tests have their own pages: [Vitest](tools/vitest.md), [Testing Library](tools/testing-library.md), [Mock Service Worker (MSW)](tools/msw.md), [Playwright](tools/playwright.md), [fast-check](tools/fast-check.md), [StrykerJS](tools/stryker.md) and [Docker](tools/docker.md).

## Contents

- [The layers today](#the-layers-today)
- [Running the tests](#running-the-tests)
- [Writing an API test](#writing-an-api-test)
  - [Unsafe requests](#unsafe-requests)
  - [Reading the log](#reading-the-log)
  - [Testing a hook before its routes exist](#testing-a-hook-before-its-routes-exist)
  - [Testing the session](#testing-the-session)
  - [Testing the served SPA](#testing-the-served-spa)
- [Writing a database test](#writing-a-database-test)
- [Writing a component test](#writing-a-component-test)
- [Writing a unit test](#writing-a-unit-test)
- [Writing a property test](#writing-a-property-test)
- [Writing an E2E journey](#writing-an-e2e-journey)
  - [The CSP guard](#the-csp-guard)
  - [The accessibility check](#the-accessibility-check)
  - [The token contrast test](#the-token-contrast-test)
  - [Reading a failed run](#reading-a-failed-run)
- [Mutation testing](#mutation-testing)
- [Rules](#rules)
- [Coverage](#coverage)

## The layers today

| Layer | Where its tests live | What they prove | Vitest project |
|---|---|---|---|
| API tests | `apps/api/src/**/*.test.ts`, for example `health/routes.test.ts` | A request through the real app gets the right status, headers and body: they go through `buildApp` and `inject()` | `api` |
| Database tests | `apps/api/src/**/*.test.ts` that call `useTestDatabase()`, for example `test/database.test.ts` | Queries, migrations and cleanup work against the real PostgreSQL | `api` |
| Component tests | `apps/web/src/**/*.test.tsx`, for example `shell/shell.test.tsx` | A page works as a user sees it: the real route table, hook, API client and schema run in a simulated browser ([jsdom](tools/vitest.md#jsdom)) with only the network faked by MSW | `web` |
| Unit tests | next to the code, for example `apps/api/src/config.test.ts` | One function does its job for each kind of input, with no server involved | `api` |
| Seed data tests | `apps/api/src/catalog/seed.test.ts` | The real `seed.yaml` passes every check the API makes at startup (limits, unique names, declared units), and `parseSeed` refuses each kind of broken file with a message naming the entry. They run in `pnpm test`, so a bad edit of the file fails CI before a deploy ([ADR 0050](../decisions/0050-seed-catalog-phase-details.md), decision 3) | `api` |
| Property tests | next to the code, for example `packages/shared/src/catalog.test.ts` | A rule holds for hundreds of generated inputs, such as the category order ([fast-check](tools/fast-check.md)) | `shared` |
| End-to-end (E2E) journeys | `e2e/tests/*.spec.ts`, for example `shell.spec.ts` | A real browser drives the production build through the SPA, the API and PostgreSQL, on three projects (desktop Chromium, desktop Firefox and an emulated phone), checks every page with axe and fails on any Content Security Policy (CSP) violation | ➖ N/A: Playwright |
| The image check | `scripts/check-image.sh` | The container image builds, starts next to PostgreSQL, migrates, runs as the `node` user and serves the SPA at `/` ([ADR 0028](../decisions/0028-container-image-details.md)) | ➖ N/A: a bash script |
| The scale check | `scripts/check-scale.sh` | Two instances of the image start together behind nginx (the `scale` profile): one migrates while the other waits for the lock, and requests reach both. It catches what two instances inside one test process hide, since those share module-level state ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decision 14) | ➖ N/A: a bash script |
| The landing page | `apps/landing/check-demo.test.js` | `checkDemo`, the function behind the footer's dot, says up when the demo answers (whatever the answer), and down when the request fails or outlives its timeout, with a fake `fetch`. The page itself has no browser test: it is checked by hand on `dzwoniec.com` ([PH-34 spec](../superpowers/specs/2026-10-23-PH-34-landing-page-and-demo-status-design.md), decision 9) | `landing` |
| The push hook | `.claude/hooks/guard-git-push.test.ts` | The hook that guards `git push` blocks what it must and allows the rest ([ADR 0015](../decisions/0015-git-push-guard-hook.md)) | `hooks` |
| Mutation testing | `stryker.config.mjs`, run by `pnpm test:mutation`; not part of `pnpm test` or CI | Whether the tests check anything: StrykerJS changes the application code one small way at a time and counts the changes no test notices ([StrykerJS](tools/stryker.md), [ADR 0055](../decisions/0055-mutation-testing-phase-details.md)) | ➖ N/A: runs the projects above |

## Running the tests

All commands run from the repository root. PostgreSQL must be running first for the API tests (`pnpm db:up`, which runs `docker compose up -d --wait`; see [Docker Compose and PostgreSQL](tools/docker-compose.md); the `web` project itself needs no database); otherwise the run stops at once with `Cannot reach PostgreSQL … Start it with docker compose up -d.` The tests read the server's address and password from `apps/api/.env`.

```bash
pnpm test                       # every project once, the same tests CI runs (CI adds `--coverage`)
pnpm test:watch                 # stays running and re-runs the tests a change affects, on every save
pnpm test --project api         # one project only: api, web, shared, landing or hooks
pnpm test --project web         # for example, only the component tests
pnpm test health                # only the files whose path contains "health"
pnpm test:coverage              # every project, plus a coverage report
```

- `pnpm test` ends with Vitest's `Test Files … passed` and `Tests … passed` lines. A failure prints the test's name, the line that failed and, for `expect`, the expected and the received value side by side.
- A filter is a piece of a file path, not a test name: `pnpm test config` runs `config.test.ts`. If it matches nothing, Vitest says `No test files found`.
- `pnpm test:coverage` is defined as `pnpm test --coverage`, so it always runs the same tests as `pnpm test`, with measuring switched on. It prints a table in the terminal and writes `coverage/index.html`, a report you open in a browser. See [Coverage](#coverage).
- In VS Code, the Vitest extension lists every test in the Testing view and runs one from the green arrow next to it. See [VS Code](tools/vscode.md).

```bash
pnpm test:mutation                               # StrykerJS over the application code; needs PostgreSQL
pnpm test:mutation --mutate apps/api/src/config.ts   # one file or several, comma-separated
```

`pnpm test:mutation` is not part of `pnpm test` and no CI job or hook runs it. It takes minutes, not seconds, and writes a report to `reports/mutation/mutation.html` ([how to read it](tools/stryker.md#reading-the-report)).

The E2E journeys are not part of `pnpm test`: they need a browser and a built app, and run by their own command. They need PostgreSQL and `apps/api/.env` like the API tests, and Playwright's browsers installed once ([setup guide](setup.md)).

```bash
pnpm test:e2e                                    # builds the web app, then runs every journey on the three projects
pnpm test:e2e --project=desktop-firefox          # one project: desktop-chromium, desktop-firefox or pixel
pnpm test:e2e tests/shell.spec.ts                # one file
pnpm test:e2e --ui                               # Playwright's UI mode: pick tests, watch them run, step through a trace
pnpm test:e2e:report                             # open the HTML report of the last run
```

- `pnpm test:e2e` is `pnpm build && pnpm --filter @szop/e2e exec playwright test`, so it always tests the code as it is now, and extra arguments reach Playwright. It resets the database `szop_e2e` and starts the API on port 3100 by itself ([Playwright](tools/playwright.md#start-serverts)); a `pnpm start` or `pnpm dev` running at the same time is not touched, and two E2E runs at once would fight over port 3100.
- `pnpm test:e2e:report` does not build or run any tests: it serves the report folder on a local port and prints the address (`Serving HTML report at http://localhost:9323`), opening the browser when it can. Under Windows Subsystem for Linux (WSL), open the printed address in Windows' browser. It keeps running until you press Ctrl+C. With no argument it shows `e2e/playwright-report/`, the last local run; with a folder, such as a report downloaded from CI, it shows that one: `pnpm test:e2e:report ~/Downloads/playwright-report`. The script runs in the `e2e/` folder, so a relative path is resolved from there: give an absolute or `~` path. A folder without a report ends with `No report found at …`.
- A passing run ends with a line such as `6 passed (8.0s)`. A test is shown once per project, as `[desktop-chromium] › tests/shell.spec.ts › …`.
- **In the editor,** the Playwright Test extension runs the same config, but it does not build first: it tests the last build. Run `pnpm build` after every change to `apps/web` or `packages/shared`, or the run tests the old code (and stops with "run `pnpm build` first" when there is no build at all). Changes to the API need no rebuild, since the API runs from source.
- If the run stops before any test with "is already used", something still answers on port 3100. The usual holder is an E2E server left behind by a run that was killed hard, a closed terminal for example (Playwright starts its server in a separate process group, so the signal never reaches it). Killing `start-server.ts` does nothing, since it ignores `SIGINT` and `SIGTERM` by design. Find the listener with `ss -ltnp 'sport = :3100'` and stop that process, normally `node src/server.ts`, the API: `start-server.ts` then exits by itself. A `pnpm start` is a holder only if its `PORT` was set to 3100 (it listens on 3000 by default). If it hangs at the very start with no output on WSL, see [the setup guide](setup.md#the-end-to-end-journeys).

The image check is not part of `pnpm test` either: it needs Docker and builds the container image, which takes a while the first time. It needs Docker Desktop running; it starts PostgreSQL itself if it is stopped, and leaves it running.

```bash
pnpm check:image                                 # build the image, start it next to PostgreSQL, check it, remove it
```

- A passing run ends with `OK: the image starts, migrates, runs as node (uid 1000) and serves the app`.
- A failing run prints a `FAIL:` line, then the app's logs, and exits 1. `the app did not become healthy` means the API did not start or never answered `/api/health`: the logs say why (a missing migrations journal, an unreachable database, an invalid setting). `GET / answered 404, not 200` means the SPA is not where `WEB_ROOT` points. `GET / did not answer within 10 seconds` means the app accepted the request but never replied. `the image's user is 'root', not node` means the Dockerfile's `USER` changed. In every case the `app` container is removed afterwards.
- CI runs the same script in its `docker` job, on an image it built itself ([CI/CD](ci-cd.md#the-jobs)). More on the image and the check: [Docker](tools/docker.md#running-it-the-app-profile-and-the-check).

The scale check runs two instances of the image behind nginx. Like the image check, it needs Docker Desktop and is not part of `pnpm test`.

```bash
pnpm check:scale                                 # build the image, start two behind nginx on a fresh database, check them, remove them
```

- A passing run ends with `OK: two instances (<id>, <id>) behind nginx, each migration recorded once`.
- A failing run prints a `FAIL:` line, then the logs of `app-a`, `app-b` and nginx, and exits 1. `the scale profile did not become healthy` means an instance did not start: its log says why. `nginx reached 1 instance(s), not 2` means requests went to one instance only: an upstream missing from `compose/nginx-scale.conf`, or its shared `zone` gone ([nginx](tools/nginx.md#configuration)). `a migration was recorded twice` means two instances migrated at once: the lock is not taken ([`db/migration-lock.ts`](../../apps/api/src/db/migration-lock.ts)).
- Two instances inside one Vitest process would share the module-level state of the API (its instance ID, for one), so this check runs real containers. What can be proven through the database alone, such as two migrators at once, is a database test instead (`db/migration-lock.test.ts`).

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

### Testing the session

`test/auth.ts` holds `signIn(app)`, which signs in anonymously and returns the `cookie` header for later `inject` calls, and `sameOrigin`, the headers of a request from the app itself. To test a session's lifetime, move its row instead of waiting: `UPDATE sessions SET expires_at = now() + interval '2 days'` makes the next read renew it, and a past `expires_at` or a deleted row makes `request.user` null. A route behind `sessionHook` is tested on a throwaway route, as in [Testing a hook before its routes exist](#testing-a-hook-before-its-routes-exist).

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
- **A test that needs a database of its own** (one never migrated, or one whose `drizzle.__drizzle_migrations` it changes) creates `szop_test_<name>_${VITEST_POOL_ID}` through the `postgres` maintenance database in `beforeEach` and drops it `WITH (FORCE)` in `afterEach`, after closing its pool, as `db/migration-check.test.ts` and `db/migration-lock.test.ts` do. Changing Drizzle's table in the worker's shared copy would break the next file's tests, and the truncation before each test leaves that table alone.
- **Inspecting after a failure.** Nothing is dropped when a run ends, so the databases stay until the next run: `docker compose exec postgres psql -U szop -d szop_test_1`.
- **The development database `szop` is never touched.** Tests only connect to `postgres` (to create the others) and to `szop_test_*`.

## Writing a component test

A component test renders a page, or one component, in a simulated browser and checks what the user would see. Only the network is faked: the real route table, data hook, API client and schema run. `apps/web/src/shell/shell.test.tsx` (the pages in the app shell) and `shell/api-status.test.tsx` (the API's status in the menu) are the pattern. The shell's setup helper, and the status's database-down case:

```tsx
function renderApp(path = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
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

  renderStatus(); // <ApiStatus /> in its own QueryClientProvider

  expect(await screen.findByText("API: reachable")).toBeInTheDocument();
  expect(screen.getByText("Database: down")).toBeInTheDocument();
});
```

Line by line:

- **The real route table.** `createMemoryRouter(routes)` builds a router from the same `routes` array the app uses, with the address held in memory, so a test runs the real route definitions and not a copy that could drift from them.
- **A phone or a desktop, chosen by the test.** jsdom has no `matchMedia`, so `src/test/setup.ts` stubs it before each test with `stubMatchMedia()` from `src/test/match-media.ts`: no query matches, which is a phone in the light scheme. A test that needs a desktop, or the dark scheme, stubs it again (`stubMatchMedia({ [desktopQuery]: true })`), and the stub's `set(query, matches)` changes an answer later and fires the change listeners, as resizing the window or switching the system's scheme would. The shell renders only the drawer or only the sidebar, so a test sees one menu.
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

## Writing a property test

A property test states a rule that must hold for **every** input of some kind, and [fast-check](tools/fast-check.md) tries hundreds of generated inputs against it. Write one when the rule is about a whole input space and a few examples cannot cover it, such as an order ("a parent comes before its children, whatever the tree"). An edge case with one right answer is still an ordinary unit test; the two usually sit side by side, as in `packages/shared/src/catalog.test.ts`.

- **Where they live:** next to the code, in the `shared` project (`pnpm test --project shared`). The arbitrary that generates the input is defined in the test file.
- **One property per `it`.** The criterion's ID is on the `describe` around them, not on each `it`: `it("returns a permutation of its input")` inside a `describe("ORD-2.1, ORD-3.1: …")`.
- **Reading a failure:** the message shows the shrunk `Counterexample`, the smallest input fast-check found that breaks the rule, and a `seed` and `path`. Pass them as `fc.assert`'s last argument to replay the failure, then remove them. Add the counterexample as an example test too. How to read it, with a real output: [fast-check](tools/fast-check.md#reading-a-counterexample).

## Writing an E2E journey

An E2E journey drives a real browser through the whole stack, the way a person would: it opens the production build, which talks to the real API and PostgreSQL. It proves what the lower layers cannot: that the pieces work together, in Chromium, in Firefox and on a phone. It is the most expensive kind of test, so it checks a use case from start to finish and leaves the edge cases to the lower layers ([ADR 0007](../decisions/0007-testing-strategy.md), decision 16). The shell's journey, `e2e/tests/shell.spec.ts`, is the pattern:

```ts
import { expectAccessible } from "../support/accessibility.ts";
import { openMenu } from "../support/menu.ts";
import { expect, test } from "../support/test.ts";

test("the shell shows the menu, the API's status and the pages", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Start" }),
  ).toBeVisible();

  const menu = await openMenu(page, isMobile);
  const status = menu.getByRole("status");
  await expect(status).toContainText("API: ok");
  await expect(status).toContainText("Database: up");
  await expectAccessible(page);
  // … then it follows "Design system" through the menu.
});
```

- **One file per use case,** named `uc-NN-short-name.spec.ts` (`uc-03-shop-in-store.spec.ts`), written in the phase that completes the use case ([ADR 0007](../decisions/0007-testing-strategy.md), decisions 4 and 17). `shell.spec.ts` is the exception: no use case is complete yet, so the journey that proves the SPA, the API and PostgreSQL talk to each other is named after the app shell, whose menu shows the API's status. It replaced the walking skeleton's `health.spec.ts` when the shell replaced the health page ([OP-087](https://github.com/luiki-dev/szop/issues/160)).
- **Reach a page through the menu with `openMenu(page, isMobile)`** from `support/menu.ts`: on the phone project (`isMobile`) it taps ☰ first, since the menu is a drawer there; on the desktop projects the sidebar is always there. It returns the menu's `navigation` locator.
- **Import `test` and `expect` from `../support/test.ts`,** never from `@playwright/test`. The file's `test` is Playwright's with the [CSP guard](#the-csp-guard) added, so every journey is guarded without asking. A journey that imports from `@playwright/test` would run unguarded and still pass, so ESLint refuses it, with a message naming `support/test.ts`.
- **Call `expectAccessible(page)` once the page has settled, on every page the journey visits.** "Settled" means the journey has waited for what the page shows, as the `toContainText` lines above do; scanning earlier would scan a half-drawn screen ([The accessibility check](#the-accessibility-check)).
- **Each test isolates itself.** Playwright gives every test a fresh browser context, a new guest with no cookies and no storage, so tests run in parallel and the database is reset only once per run, when the server starts ([ADR 0007](../decisions/0007-testing-strategy.md), decision 15). A test that needs a user registers one with a unique email, and never depends on data another test left behind.
- **Find elements as a user does,** by role and text, as with Testing Library (`page.getByRole("status")`, `page.getByText(…)`), never by test ID or CSS class. Playwright's `expect(locator)` waits and retries until the condition holds or a timeout passes, so no journey sleeps or polls by hand.
- **Edge cases stay in lower layers.** A journey follows the main path of its use case; an ordering rule, a permission check or a validation message is proven by a unit, API or component test.

The catalog's journey, `e2e/tests/catalog.spec.ts`, is a second pattern: it reads the real `seed.yaml`, so it names "Dairy & eggs", its subcategory "Milk", "Buttermilk" and "Oat milk" (the seed's header comment says to rename them together), opens a category, searches, clears the search and runs axe with a category open. It shows a check that depends on the viewport: on a phone the buttons "Expand all" and "Collapse all" show only an icon, so the test looks at the visibility of the label, not at the button's text (`toHaveText` reads hidden text too).

### The CSP guard

The Content Security Policy (CSP) tells the browser to refuse inline scripts, `<style>` elements and anything not served from Szop's own origin ([Web security](../architecture/architecture.md#web-security)). A page can break the policy without any visible sign: the browser silently drops the blocked style or script, and a test that only reads the page's text still passes. So every journey ends with a check that the browser reported no violation: the guard in `support/test.ts` listens for the browser's own `securitypolicyviolation` events on every page, and fails the test if it received any ([Playwright](tools/playwright.md#supporttestts)).

**What a failure looks like.** The guard's first run caught a real one. Zod 4 tests whether the browser allows `eval` by calling `new Function("")` when it builds a schema, which happens when `@szop/shared` loads, and the CSP, which has no `'unsafe-eval'`, blocked and reported it on every page load. The failure listed the blocked `eval` under the `script-src` directive. Here is the guard's message when a `<style>` element is added to the health page, in Firefox:

```
Error: the browser reported CSP violations

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   Object {
+     "blocked": "inline",
+     "directive": "style-src-elem",
+     "sample": "",
+     "source": "debugger eval code line 311 > eval:2",
+   },
+ ]
```

`directive` is the policy rule that blocked it, `blocked` what was blocked (`inline` for code in the page, `eval`, or an address), and `source` where it came from; for code added with `page.evaluate`, Firefox names its own evaluation, as here.

**What to do.** Find what injected the style or the script, and change that. Never loosen the CSP to make a journey pass, and never turn the guard off: the guard is the tool that keeps the policy honest ([ADR 0013](../decisions/0013-visual-design.md), decision 9). The usual causes are a library that writes `<style>` elements at run time (the reason Base UI runs with `disableStyleElements`) and code that needs `eval`. Setting `element.style` from script is allowed: the policy governs `style` attributes in markup, not changes made through the DOM, so a component may set a color that way.

**Zod and the SPA.** For the `eval` probe above, the SPA switches zod to its **jitless mode**: `apps/web/src/zod-config.ts` calls `z.config({ jitless: true })`, and `main.tsx` imports it before anything else, so it runs before `@szop/shared` builds its schemas. A new entry point that loads `@szop/shared` in the browser must import `zod-config.ts` first, or every journey fails.

**What the guard does not cover.** It guards the test's own context: every page, popup, iframe and navigation in it. A context created with `browser.newContext()` is not covered, and neither are violations inside a web worker. A journey that needs a second user must use a guarded context, which does not exist yet ([OP-088](https://github.com/luiki-dev/szop/issues/162)).

The guard has a test of its own, `csp-guard.spec.ts`, which adds a `<style>` element at run time and expects the guard to report exactly one `style-src-elem` violation. It fails if the guard stops listening or the built app loses its CSP, and it runs on all three projects, which also proves that Firefox reports the event.

### The accessibility check

`expectAccessible(page)` scans the page with axe against the Web Content Accessibility Guidelines (WCAG) 2.2 AA rule sets ([NFR-2](../requirements/NFR-non-functional-requirements.md#nfr-2)), first in light mode and then in dark, and fails with every violation of both ([Playwright](tools/playwright.md#supportaccessibilityts)). Each violation is listed as the color scheme, the rule ID, how many elements break it and their selectors. Here the heading was given a pale gray through `element.style`, which the CSP allows and axe still sees:

```
Error: axe found accessibility violations

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "[light] color-contrast: 1 element(s) — h1",
+   "[dark] color-contrast: 1 element(s) — h1",
+ ]
```

`color-contrast` is axe's rule ID: <https://dequeuniversity.com/rules/axe/> explains each one, what it checks and how to fix it. The two scans appear as the steps `axe (light)` and `axe (dark)` in the HTML report and in the trace; the terminal's `list` output does not print steps.

axe finds only part of the accessibility problems, so a passing check is a floor and not a verdict ([Stack overview](../architecture/stack-overview.md#19-end-to-end-tests-with-playwright-and-axe)). **No axe rule is turned off for all pages.** If a rule has to be skipped on one page, the call says so, `expectAccessible(page, { disableRules: ["…"] })`, with a comment giving the reason.

### The token contrast test

axe checks the contrast of the text it finds on a page, but not the UI parts (the focus ring, input borders, the haul's progress fill), which need 3:1, nor a pair no page shows yet. So `design.spec.ts` checks the design tokens themselves ([ADR 0048](../decisions/0048-design-system-phase-details.md)): on `/design`, in light and then in dark mode, it reads every role's custom property (`--primary`, `--link` …) and computes the WCAG contrast of each pair in its `pairs` table against the pair's minimum, 4.5:1 for text and 3:1 for UI parts ([NFR-2](../requirements/NFR-non-functional-requirements.md#nfr-2)).

- **Why through a canvas:** Tailwind's palette is written in OKLCH, a color space the WCAG formula does not take. `readRoleColors` in `support/contrast.ts` paints each color on a one-pixel canvas in the browser and reads the pixel back as sRGB, so the browser does the conversion and no color library is needed. `contrastRatio` is the WCAG formula.
- **A new role or pair** goes into the `pairs` table in the same change that adds it to `index.css` and to the [visual design's](../architecture/visual-design.md#color) table.
- **A failure** names the pair and the scheme, for example `link on background (light)`, with the ratio it got. Change the role to the next palette step that passes and record it in the visual design; never lower a minimum. Every failing pair is reported at once (`expect.soft`).

### Reading a failed run

A failed test leaves three pieces of evidence, kept for each attempt:

1. **The terminal.** The failure message with the failing line, as above. It is often enough.
2. **The HTML report,** `e2e/playwright-report/`. Open it with `pnpm test:e2e:report`. It lists every test per project, and a failed one shows its error, the steps it took (the `axe (light)` and `axe (dark)` steps are here), a screenshot and the trace.
3. **The trace,** Playwright's recording of the test. Open it from the report by clicking the trace, or open the file `e2e/test-results/<test>/trace.zip` with `pnpm --filter @szop/e2e exec playwright show-trace <file>`. The command runs in `e2e/`, so give the path relative to `e2e/` (`test-results/<test>/trace.zip`) or absolute. The trace viewer shows a timeline of the test's actions; click one to see the page's DOM (the tree of elements) as it was before and after it, the network requests, the browser's console and the source line. Step to the action before the failure to see what the page looked like.

**From CI,** the `e2e` job uploads the HTML report as the `playwright-report` artifact when it fails; see [CI/CD](ci-cd.md#reading-a-failed-e2e-run) for downloading it. A trace can also be dropped on <https://trace.playwright.dev>, which opens it in the browser without uploading it anywhere.

**Flaky and failed.** In CI each failed test is retried once ([ADR 0026](../decisions/0026-first-e2e-journey-details.md), decision 4). A test that fails twice is **failed**. A test that fails and then passes on its retry is **flaky**, and with `failOnFlakyTests` the run fails anyway, because a flaky test is a bug ([Rules](#rules)); the report labels it *Flaky* and holds the trace of the failed attempt. Locally there is no retry: a failure is a failure.

## Mutation testing

Mutation testing judges the tests, not the code: a **mutant** is a small change StrykerJS makes to the code, and a test that fails on it *kills* it. A **survivor** is a mutant every test passed on, so no test checks the behavior it changed. Run `pnpm test:mutation` when a phase adds or changes logic that is mutated ([definition of done](definition-of-done.md), item 2), and deal with every survivor in the code, never only in the PR ([ADR 0055](../decisions/0055-mutation-testing-phase-details.md), decisions 1, 3 and 4).

- **What is mutated:** every source file under `apps/api/src`, `apps/web/src` and `packages/shared/src`, except the tests, `apps/*/src/test/` and the shadcn/ui components.
- **A file opts out** when it holds no logic a test should check (wiring, configuration, plain rendering). Its first line is `// Stryker disable all: <reason>`. An opt-out is never for speed or to hide a weak test.
- **A new wiring file starts with its opt-out,** written with the file, so the report never fills with noise from files nobody means to test.
- **A survivor is dealt with in one of three ways:**
  - *Kill it:* write or tighten a test until the mutant fails it. This is the default.
  - *Accept it:* when the mutant is equivalent (no test could tell it apart from the code), put `// Stryker disable next-line <Mutator>: <reason>` above the line. Name one mutator (a second one gets its own comment line, stacked above), cover one line and give the reason. The comment hides every mutant of that mutator on the line, so put the equivalent expression on a line of its own, and run the file without the comment once to see that only the equivalent mutant survives. Never `all`: a comment that hides only one mutator cannot hide a new, real survivor on the same line later.
    - *Tailwind class names:* jsdom applies no CSS, so a mutant of a class-name string is equivalent for every test. It is accepted line by line with `// Stryker disable next-line StringLiteral: <reason>` (the same rule, one mutator on one line), never for a whole file: strings that carry behaviour (the document title, a message, a label) stay mutated and tested ([ADR 0055](../decisions/0055-mutation-testing-phase-details.md), "Settled while building").
  - *Record it as an open point:* when the fix is larger than a small test change.
- **The PR states the score and what was done;** the reasons live in the code, so the next run shows only new survivors.

## Rules

These follow [ADR 0007](../decisions/0007-testing-strategy.md), decision 16, unless another source is named.

- **Test at the lowest layer that can prove the behavior.** An edge case in a rule gets a unit test; a permission check, an API test; a user journey is the last resort.
- **No `vi.mock` of our own modules.** Replacing a module couples the test to the file structure and hides wiring mistakes. Fakes go in through `buildApp(deps)`.
- **A handler that returns a valid health body is typed with the shared schema** (`satisfies Health`), so a fake that drifts from the contract fails the type check. The two rows of the page's `it.each` that return invalid bodies on purpose are the exception.
- **A request nobody wrote a handler for fails the test**, naming the request, and never reaches a real network. `src/test/setup.ts` records each such request in an `onUnhandledFrame` callback and fails the test in `afterEach`; MSW 3's ready-made `"error"` strategy alone would only print an error and reject the request, which a test expecting the "Can't reach the API" state would not notice. Keep both halves ([MSW](tools/msw.md)).
- **No snapshot tests of markup.** Too easy to "update the snapshot" without reading it.
- **Flaky tests are bugs.** Fix or delete them promptly; never just re-run.
- **Every journey imports `test` and `expect` from `support/test.ts`,** so the CSP guard runs in it. ESLint enforces it.
- **No axe rule is turned off for all pages.** A rule skipped for one page is passed to that one `expectAccessible` call, with a comment saying why.
- **Test-driven development (TDD) for domain rules, services and routes**, and every bug fix starts with a failing test that reproduces it ([ADR 0007](../decisions/0007-testing-strategy.md), decision 3).
- **A test that covers an acceptance criterion starts its name with the criterion's ID and a colon** (`it('APR-1.2: …')`), or lists several (`'APR-1.2, APR-1.3: …'`); a `describe` can carry it for every test inside. A check that is not a test names the ID in a comment at its assertion. `grep -rn 'APR-1.2[:,]'` finds them. A criterion is ✅ only when such a test exists ([ADR 0051](../decisions/0051-acceptance-criteria.md), decision 4).
- **Entry points are checked by hand.** `server.ts` only reads the environment, listens and shuts down. Everything it calls is tested, so what is left untested is a few lines of wiring; the manual checks (it starts and `/api/health` answers, a missing or invalid setting stops it with a message naming the variable, a taken port, Ctrl+C shuts it down gracefully, an edit restarts it) are recorded in the phase's pull request ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 10).

## Coverage

Coverage tells you which lines the tests ran. It is **measured, never gated**: no threshold fails the build, because a threshold rewards tests written to touch lines rather than to check behavior ([ADR 0007](../decisions/0007-testing-strategy.md), decision 19).

- **The terminal table** has one row per file and these columns: `% Stmts` (statements run), `% Branch` (the sides of `if`s and other decisions taken), `% Funcs` (functions called) and `% Lines` (lines run), then `Uncovered Line #s`, the line numbers no test reached.
- **Files no test loads show at 0%.** The root `vitest.config.ts` lists the folders to measure, so `server.ts`, which no test imports, appears at 0% instead of silently missing. That is the honest picture of an entry point checked by hand.
- **Every file gets a row in the terminal table**, fully covered ones included. Vitest hides fully covered files only when it detects that an AI agent is running it, so the table may look shorter in an agent's output. `coverage/coverage-summary.json` lists every measured file, and `coverage/index.html` shows the same numbers, which you can click through down to the line.
- **The test helpers are excluded.** The files in `apps/*/src/test/` are test infrastructure, not app code, so they get no row. `global-setup.ts` would show 0% anyway, since it runs outside the test workers.
- **CI shows the same numbers.** The `test` job runs `pnpm test:coverage` and writes a table of every file, from `coverage-summary.json`, to the job's summary ([CI/CD](ci-cd.md)).
