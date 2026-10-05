# PH-03 API skeleton — design

- **Phase:** [PH-03](../../roadmap.md#ph-03-api-skeleton)
- **Date:** 2026-10-05
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-010](../../open-points.md#op-010) (PH-03 part), [OP-012](../../open-points.md#op-012) (PH-03 part), [OP-013](../../open-points.md#op-013) (PH-03 part), [OP-062](../../open-points.md#op-062) (PH-03 part), [OP-065](../../open-points.md#op-065); [OP-067](../../open-points.md#op-067) waits for the owner's Dependabot check

The Fastify API exists: `pnpm dev` starts it, `GET /api/health` answers, and the first API test passes locally and in CI. The direction was settled by [ADR 0002](../../decisions/0002-technical-architecture.md) (Fastify, Zod), [ADR 0005](../../decisions/0005-development-environment.md) (tsx, pnpm workspaces), [ADR 0007](../../decisions/0007-testing-strategy.md) (Vitest, `buildApp(deps)`, API tests through `inject()`) and the [architecture](../../architecture/architecture.md) (configuration validated by Zod, pino logging). This spec holds the details those left to the phase, as agreed in the brainstorm.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Layout of `apps/api`](#layout-of-appsapi)
  - [Configuration](#configuration)
  - [Startup and shutdown](#startup-and-shutdown)
  - [`buildApp(deps)`](#buildappdeps)
  - [Health](#health)
  - [Vitest](#vitest)
  - [Tests written in this phase](#tests-written-in-this-phase)
  - [Tooling changes](#tooling-changes)
- [Documentation and records](#documentation-and-records)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: the Fastify API starts with `pnpm dev`, `GET /api/health` answers, and the first API test passes locally and in CI.

The phase is done when:

- after copying `apps/api/.env.example` to `apps/api/.env`, `pnpm dev` starts the API, `curl http://127.0.0.1:3000/api/health` returns `200 {"status":"ok"}`, and the request appears in the terminal as pretty-printed log lines;
- a missing or invalid setting in `.env` stops startup with a message naming the variable, without its value;
- Ctrl+C closes the server cleanly, and editing a file under `apps/api/src/` restarts it;
- `pnpm test` runs Vitest with two projects, `api` and `hooks`, and every test passes: the health route's API test, the configuration's unit tests and the push hook's tests, moved from `node:test`;
- `pnpm lint`, `pnpm format:check` and `pnpm typecheck` pass, with `typecheck` covering the root and `apps/api`;
- on the PH-03 PR, CI's `test` job runs Vitest with coverage, the coverage table appears in the run's job summary, and `ci-ok` is green;
- `testing.md`, the tool pages, `setup.md`, the architecture, the stack overview and `CLAUDE.md` describe all of the above.

## Out of scope

- **The database**, its check in `/api/health` and the first test against it: PH-04.
- **A production build and a `start` script**: PH-06, which also decides between `tsc` and a bundler.
- **The web baseline** (`@fastify/helmet`, the `Origin` check, `TRUSTED_PROXY_HOPS`, the log's URL serializer): PH-06 ([OP-053](../../open-points.md#op-053)).
- **`packages/shared` and `fastify-type-provider-zod`**: with the first shared schema or the first route with input.
- **The JSON error shape and a not-found handler** ([architecture, Errors](../../architecture/architecture.md#errors)): unknown routes get Fastify's default 404 body until the first route that can fail (new OP-071, PH-15).
- **Quietening the health route's request logs**, which the load balancer will call every few seconds: PH-12 (new OP-072).

## Decisions taken in the brainstorm

Each refines an accepted ADR or fills a detail it left open; ADR 0019 records them.

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Assembling the app | A `buildApp(deps)` factory passing dependencies to plugins as options; fastify-cli with `@fastify/autoload`; a factory hanging dependencies on the instance as decorators | **A plain factory, dependencies as plugin options.** `buildApp` creates Fastify, registers each feature's routes as a plugin with the dependencies it needs, and returns the app without listening. All wiring is visible in one file, which is the explicit style [ADR 0002](../../decisions/0002-technical-architecture.md) chose Fastify for and the shape [ADR 0007](../../decisions/0007-testing-strategy.md), decision 14 assumes. Autoload discovers plugins by folder name: less code, but invisible wiring and tests tied to folder conventions. Decorators are idiomatic Fastify but a service locator in disguise: every route can reach every dependency, and each needs TypeScript module augmentation. They stay available for what is truly per request, such as the session user. |
| 2 | Where configuration comes from | Defaults only for settings safe in every environment, `.env` later; `.env` from the first setting, no defaults; defaults for every local value | **No defaults: every setting is required, and locally `apps/api/.env` provides them**, loaded by Node's built-in `--env-file` (no dotenv package). A committed `.env.example` lists each setting with a comment; `.env` is git-ignored. A forgotten setting in any environment stops startup instead of silently falling back to a development value. Safe defaults would spare the setup step for three harmless settings, but would mean two rules, and defaults for everything would let a forgotten `DATABASE_URL` in AWS point at a wrong database. |
| 3 | Logs in development | The app always writes JSON and the `dev` script pipes it through pino-pretty; a setting switching pino-pretty on as a transport; raw JSON everywhere | **Pipe through pino-pretty.** The app's code and configuration are the same everywhere; only the `dev` script formats, and pino-pretty is a devDependency the app never imports. A transport setting would put a development-only formatter into the app's code; raw JSON is honest but hard to read. |
| 4 | Type checking the workspaces | Each package's own `typecheck` script, chained from the root; TypeScript project references with `tsc -b` | **Per package, chained:** the root runs `tsc --noEmit && pnpm -r typecheck`. Each package has its own `tsconfig.json` extending `tsconfig.base.json`, so `apps/web` can add DOM types and JSX in PH-05. Plain and visible, like ADR 0005's "pnpm workspaces alone", and CI's command stays the same. Project references bring incremental builds in dependency order, but need `composite` and declaration output even for checking only: ceremony for three packages. |
| 5 | Vitest's projects | One root config listing a config per package and inline projects; every project inline in the root config | **A root `vitest.config.ts` listing `apps/api/vitest.config.ts` and an inline `hooks` project.** A package keeps its own config because `apps/web`'s will need Vite's React plugin; the push hook is not a package, so its project is inline. No globals: tests import `describe`, `it` and `expect` from `vitest`, explicit and typed with nothing in the tsconfig. |
| 6 | Import specifiers | `.ts` extensions; `.js` extensions | **`.ts` extensions** (`./app.ts`), as the push hook already does. tsx, Vitest and Node all run them, and PH-06 stays free to build with `tsc` (`rewriteRelativeImportExtensions`) or a bundler. `.js` extensions pointing at `.ts` files are the older convention and confusing to read. |
| 7 | Package names | `@szop/api`, `@szop/web`, `@szop/shared`; bare `api`, `web`, `shared` | **`@szop/…`.** A scope cannot clash with a package on the npm registry, and it is what pnpm's `--filter` examples and most monorepos use. |
| 8 | Graceful shutdown | Hand-written signal handlers; `close-with-grace` | **Hand-written:** on SIGINT or SIGTERM, `await app.close()`, then exit. About eight lines, no dependency. Requests in flight finish, which matters for tsx's restarts now and for ECS stopping a task later. |
| 9 | Health without a database | `200 {"status":"ok"}` now, the database check in PH-04; wait for PH-04 | **Now, without the database.** The route proves the skeleton; PH-04 adds the check ([OP-013](../../open-points.md#op-013)). |
| 10 | Testing the entry point | Checked by hand; a test spawning the server | **By hand.** `server.ts` only reads the environment, listens and shuts down; everything it calls is tested. A spawning test would be slow and fragile for little gain. `testing.md` states the rule: entry points are checked by hand, the logic they call is tested. |

## Design

### Layout of `apps/api`

```
apps/api/
  package.json          "@szop/api", private, ESM; scripts: dev, typecheck
  tsconfig.json         extends ../../tsconfig.base.json
  vitest.config.ts      the "api" project
  .env.example          HOST, PORT, LOG_LEVEL, each with a comment (committed)
  .env                  the developer's copy (git-ignored)
  src/
    server.ts           entry point; the only file that reads process.env
    app.ts              buildApp(deps)
    config.ts           Zod schema and loadConfig(env)
    config.test.ts
    health/
      routes.ts         healthRoutes plugin
      routes.test.ts
```

- **Runtime dependencies:** `fastify` and `zod`. **devDependencies:** `tsx`, `pino-pretty` and `@types/node`. Vitest is a root devDependency, since the root config runs every project. Versions are pinned during implementation (today Fastify 5.12, Zod 4.6, tsx 4.23, Vitest 5.0).
- **The API's `dev` script:** `tsx watch --env-file=.env src/server.ts | pino-pretty`.
- **The root `dev` script:** `pnpm -r --parallel dev`. It starts the API today and picks up `apps/web` in PH-05 without a change.

### Configuration

`config.ts` holds a Zod schema of the environment and `loadConfig(env)`.

| Variable | Rule | Becomes |
|---|---|---|
| `HOST` | a non-empty string | `host` |
| `PORT` | an integer from 1 to 65535, coerced from the string | `port` |
| `LOG_LEVEL` | one of pino's levels: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` | `logLevel` |

- **Every variable is required; none has a default** (decision 2).
- **Unknown variables are ignored**: the environment holds many.
- **`loadConfig(env)`** returns the typed `Config` (`{ host, port, logLevel }`), or throws one error listing every invalid variable by name with what is wrong. **The error never contains a value**, so the same code stays safe when secrets arrive.
- **`.env.example`** holds the local values: `HOST=127.0.0.1` (the API is not reachable from the network), `PORT=3000`, `LOG_LEVEL=info`.

### Startup and shutdown

`server.ts`:

1. `loadConfig(process.env)`. On failure, the error's message goes to standard error and the process exits with code 1, before any logger exists.
2. `const app = buildApp({ config })`, then `await app.listen({ host: config.host, port: config.port })`. Fastify logs the address.
3. On SIGINT or SIGTERM, `await app.close()`, which lets requests in flight finish, then exit (decision 8).

### `buildApp(deps)`

`app.ts` exports `AppDeps` and `buildApp(deps: AppDeps): FastifyInstance`.

- **`AppDeps` is `{ config: Config }`** in this phase. PH-04 adds the database client, later phases the email sender and the clock ([architecture](../../architecture/architecture.md)).
- **It creates Fastify with `logger: { level: config.logLevel }`** and registers `healthRoutes` with `{ prefix: "/api" }`. It does not listen.
- **Request logging is Fastify's default:** an "incoming request" line (method, URL, remote address and port) and a "request completed" line (status code, response time), each with a server-generated request ID. Fastify 5 does not take a request ID from a client header by default. No headers are logged, so there is nothing to redact yet.

### Health

`health/routes.ts` is a Fastify plugin registering `GET /health`, which answers `200` with `{ "status": "ok" }`. Mounted under `/api`, it is `GET /api/health`.

### Vitest

- **Root `vitest.config.ts`:** `test.projects` lists `apps/api/vitest.config.ts` and an inline project `hooks` (`.claude/hooks/**/*.test.ts`, Node environment).
- **`apps/api/vitest.config.ts`:** project `api`, Node environment, `src/**/*.test.ts`.
- **Root scripts** ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 18):

| Script | Command | Notes |
|---|---|---|
| `test` | `vitest run` | Every project. |
| `test:watch` | `vitest` | |
| `test:coverage` | `vitest run --coverage` | `@vitest/coverage-v8`, measured and not gated (decision 19), into a git-ignored `coverage/`. CI's `test` job runs this one. |

`test:e2e` and `test:mutation` arrive with Playwright (PH-07) and StrykerJS (PH-15).

- **The push hook's tests** move from `node:test` and `node:assert` to Vitest's `test` and `expect`, with the same cases ([OP-062](../../open-points.md#op-062)).

### Tests written in this phase

Written first and seen failing, then made to pass ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 3).

- **`health/routes.test.ts`, the first API test** ([OP-012](../../open-points.md#op-012)): builds the app with `buildApp({ config })` and a literal test config with `logLevel: "silent"`; `app.inject({ method: "GET", url: "/api/health" })` returns 200, a JSON content type and `{ status: "ok" }`; the app is closed after each test.
- **`config.test.ts`, unit tests:**
  - a valid environment gives the typed config, with `port` a number;
  - each missing variable is named in the error;
  - `PORT` values `abc`, `0` and `70000`, and an unknown `LOG_LEVEL`, are rejected;
  - the error does not contain the invalid value (a distinctive value, checked to be absent);
  - unknown variables are ignored.
- **Checked by hand** (decision 10): `pnpm dev` starts and `/api/health` answers; a missing setting stops startup with its name; Ctrl+C shuts down cleanly; an edit restarts the server.

### Tooling changes

- **`eslint.config.js`:** `tsconfigRootDir: import.meta.dirname` next to `projectService` ([OP-065](../../open-points.md#op-065)); the `node:test` exception removed ([OP-062](../../open-points.md#op-062)).
- **Root `package.json`:** `dev`, `typecheck` chained (decision 4), the three `test` scripts; Vitest and `@vitest/coverage-v8` as devDependencies.
- **Root `tsconfig.json`:** `include` gains `*.ts`, so `vitest.config.ts` is checked and linted.
- **`.gitignore`:** `.env` and `coverage/`. **`.prettierignore`:** `coverage/`.
- **`.vscode/extensions.json`:** the Vitest extension, `vitest.explorer` ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 21).
- **`pnpm-workspace.yaml`:** the comment updated now that `apps/api` exists. tsx depends on esbuild, whose install script pnpm 12 refuses until `allowBuilds` lists it ([ADR 0016](../../decisions/0016-toolchain-details.md), decision 3). The owner decides; the expected recommendation is `esbuild: false`, since the binary comes from an optional platform package and the script only verifies it. The failure and the evidence are shown before anything is listed.
- **`ci.yml`:** the `test` job runs `pnpm test:coverage` instead of `pnpm test` and writes the coverage table to the job summary, never gated, as [ADR 0010](../../decisions/0010-ci-cd.md), decision 7 asks. Before committing, actionlint and zizmor run at CI's pinned versions, as in PH-02.
- **Unchanged:** `dependabot.yml` (the `npm` entry at `/` covers workspaces), `commitlint.config.js` (`api` is an allowed scope), `lint-staged.config.js`.

## Documentation and records

- **ADR 0019, "API skeleton details":** the decisions above, plus the `allowBuilds` entry. Refines [ADR 0005](../../decisions/0005-development-environment.md), decision 9 (tsx with `--env-file` and the pino-pretty pipe); completes [ADR 0016](../../decisions/0016-toolchain-details.md), decision 6 (Node's test runner retires) and [ADR 0007](../../decisions/0007-testing-strategy.md), decision 8 (how the projects are laid out). Noted in ADR 0019's header, the earlier ADRs' status lines and their decisions' cells, as `CLAUDE.md` asks.
- **`docs/development/testing.md`** (new, [ADR 0007](../../decisions/0007-testing-strategy.md), decision 22): the layers that exist today (API tests, unit tests, the push hook's tests), how to run them, how to write an API test with `buildApp` and `inject()`, the rules of decision 16, "entry points are checked by hand", and coverage.
- **Tool pages** in `docs/development/tools/`: `vitest.md`, `tsx.md`, `pino-pretty.md`, in the format of [ADR 0005](../../decisions/0005-development-environment.md), decision 15.
- **`setup.md`:** copy `.env.example`, run `pnpm dev`, check `/api/health`.
- **`CLAUDE.md`:** a pointer to `testing.md` for whoever writes code ([OP-010](../../open-points.md#op-010)), and `testing.md` in the documentation list.
- **Architecture:** in Cross-cutting, the configuration rule (required, no defaults, `.env` locally), startup and shutdown, and `buildApp`'s wiring through plugin options; in the monorepo layout, the `@szop/` names and `.ts` imports.
- **Stack overview:** Fastify (plugins, encapsulation, `inject()`), pino, Zod for configuration, Vitest, tsx.
- **`ci-cd.md`:** the `test` job runs Vitest with coverage, and where to find the coverage table.
- **Glossary:** new terms as they appear (such as SIGTERM, encapsulation).
- **README:** the "Development" section gains `pnpm dev` and `pnpm test`.
- **Open points:** the PH-03 parts of [OP-010](../../open-points.md#op-010), [OP-012](../../open-points.md#op-012) and [OP-013](../../open-points.md#op-013) ✅, each entry moved to its next phase's group; [OP-062](../../open-points.md#op-062) and [OP-065](../../open-points.md#op-065) closed; [OP-067](../../open-points.md#op-067) moved to PH-04 unless the owner's Dependabot check happens first; new **OP-071** (PH-15): the JSON error shape and the not-found handler; new **OP-072** (PH-12): quieten the health route's request logs.
- **Roadmap and README diagram:** the PH-03 row 🚧 with the spec, plan and PR links as they land, ✅ before the merge, in the same commits ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)).

## Tasks

One commit per task.

1. **Scaffold `apps/api`:** its `package.json` and `tsconfig.json`, the chained `typecheck`, `tsconfigRootDir`, the ignores, the `pnpm-workspace.yaml` comment. *Verify:* `pnpm install` (with the owner's `allowBuilds` decision if tsx's esbuild asks for one), `pnpm lint`, `pnpm typecheck` pass.
2. **Vitest:** the root and `api` configs, the `test` scripts, the push hook's tests moved to Vitest, the ESLint exception removed, the editor extension, the `test` job with coverage in its summary. *Verify:* `pnpm test` runs the `hooks` project green; a deliberately broken assertion turns it red; `pnpm lint` passes without the exception; `pnpm test:coverage` prints the table; actionlint and zizmor are clean.
3. **Configuration (TDD):** `config.ts` and `config.test.ts`. *Verify:* the tests failed before the code existed and pass after.
4. **`buildApp` and `GET /api/health` (TDD):** `app.ts`, `health/routes.ts`, the first API test. *Verify:* as task 3.
5. **Running it:** `server.ts`, the `dev` scripts, `.env.example`, pino-pretty. *Verify:* the checks by hand in [Tests written in this phase](#tests-written-in-this-phase).
6. **Testing guide and tool pages:** `testing.md`, `vitest.md`, `tsx.md`, `pino-pretty.md`, `setup.md`, `CLAUDE.md`. *Verify:* links resolve; contents lists in sync.
7. **Records and registers:** ADR 0019 with its cross-references, the architecture, the stack overview, `ci-cd.md`, the glossary, the README, the open points and the roadmap. *Verify:* links resolve; the definition of done is walked through.

## To verify during implementation

- **Writing coverage to the job summary** (task 2): Vitest's own GitHub Actions reporter if it can, otherwise a short step turning `coverage-summary.json` into a Markdown table; the summary shows on the PR's first run.
- **Vitest 5's `test.projects`** accepts a path to a package's config file next to an inline project, and `vitest run` names both projects in its output (task 2).
- **`pnpm -r typecheck`** runs only the packages, not the root again (task 1); otherwise the root script would call itself.
- **tsx passes `--env-file`** to Node in watch mode, and re-reads `.env` on a restart (task 5).
- **Ctrl+C with the pino-pretty pipe:** both processes stop, and the shutdown's last log lines still appear (task 5).
- **typescript-eslint's `projectService`** finds `apps/api/tsconfig.json` for files under `apps/api/` with `tsconfigRootDir` set (task 1).
- **Zod 4's error for a missing or invalid variable** contains no value, including for `z.coerce.number()` and `z.enum()`; if it does, `loadConfig` builds its own message from the issue paths (task 3).
