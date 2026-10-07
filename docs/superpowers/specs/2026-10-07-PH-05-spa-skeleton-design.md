# PH-05 SPA skeleton — design

- **Phase:** [PH-05](../../roadmap.md#ph-05-spa-skeleton)
- **Date:** 2026-10-07
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-010](../../open-points.md#op-010) (PH-05 part), [OP-012](../../open-points.md#op-012) (PH-05 part), [OP-007](../../open-points.md#op-007) (a note only); new [OP-079](../../open-points.md#op-079) and [OP-080](../../open-points.md#op-080); [OP-067](../../open-points.md#op-067) is not tied to this phase

The single-page application (SPA) exists: `pnpm dev` serves a page that shows the API's status through Vite's proxy, so the slice runs from the SPA through the API to the database. The direction was settled by [ADR 0002](../../decisions/0002-technical-architecture.md) (React, React Router, TanStack Query), [ADR 0005](../../decisions/0005-development-environment.md) (Vite's proxy, `packages/shared` consumed from source), [ADR 0007](../../decisions/0007-testing-strategy.md) (Vitest, jsdom, Testing Library and Mock Service Worker (MSW)) and the [architecture](../../architecture/architecture.md) (feature folders, data hooks, one API client). This spec holds the details those left to the phase, as agreed in the brainstorm.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Layout](#layout)
  - [The shared health schema](#the-shared-health-schema)
  - [Data flow and the page](#data-flow-and-the-page)
  - [Vite and the proxy](#vite-and-the-proxy)
  - [TypeScript and ESLint](#typescript-and-eslint)
  - [Vitest and the component tests](#vitest-and-the-component-tests)
  - [Dependencies and install scripts](#dependencies-and-install-scripts)
  - [CI](#ci)
- [Documentation and records](#documentation-and-records)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: `pnpm dev` serves a page showing the API's status through Vite's proxy, so the slice runs from the SPA through the API to the database.

The phase is done when:

- with PostgreSQL running (`docker compose up -d`) and `apps/api/.env` in place, `pnpm dev` serves the page on Vite's port, and it shows "API: ok", "Database: up" and the schema version;
- checked by hand: with PostgreSQL stopped, reloading the page shows "API: reachable" and "Database: down"; with the API stopped, it shows "Can't reach the API";
- `pnpm test` runs three Vitest projects, `api`, `web` and `hooks`, and every test passes: the API's health test also checks its real responses against the shared schema, and four component tests cover the page's states (in flight and ok together, database down, unreachable) and a response it cannot parse;
- `pnpm lint`, `pnpm format:check` and `pnpm typecheck` pass, with `typecheck` covering the root, `apps/api`, `apps/web` and `packages/shared`;
- on the PH-05 PR, CI's `test` job runs the `web` project, the coverage table lists its files, and `ci-ok` is green;
- the testing guide, the tool pages, the architecture, the stack overview, the setup guide, ADR 0021, the roadmap, the README diagram and the open points describe all of the above.

The demo check of the [definition of done](../../development/definition-of-done.md) is ➖ N/A: nothing deploys until [PH-12](../../roadmap.md#ph-12-first-deploy).

## Out of scope

- **Styling:** Tailwind CSS, shadcn/ui, the design tokens and the app shell are [PH-14](../../roadmap.md#ph-14-app-shell-and-design-system) ([ADR 0014](../../decisions/0014-roadmap.md), decision 9). The page stays plain semantic HTML.
- **A production build, a `build` script and serving the SPA from the API:** [PH-06](../../roadmap.md#ph-06-production-build-and-web-baseline), which also decides how the API's build includes `packages/shared` ([OP-007](../../open-points.md#op-007)).
- **Playwright, axe and the first E2E journey:** [PH-07](../../roadmap.md#ph-07-first-e2e-journey).
- **The API serializing its responses through the shared schema:** with the first route that needs response serialization (new [OP-079](../../open-points.md#op-079)). Here the API's code does not change; its test checks the response against the schema.
- **`@testing-library/user-event`:** nothing in this phase clicks or types. It joins with the first interaction (new [OP-080](../../open-points.md#op-080)).
- **More than one route, a not-found route and error boundaries:** the first feature phases. The route table has one route, `/`.
- **Authentication, an error shape for the client and everything else in the [frontend architecture](../../architecture/architecture.md#3-frontend-appsweb) that has no screen yet.**

## Decisions taken in the brainstorm

Each refines an accepted ADR or fills a detail it left open; ADR 0021 records them.

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Where the health response's shape lives | `packages/shared` now, used by the web client, the MSW handlers and the API's test; a schema in `apps/web` only, with `packages/shared` arriving in PH-15 | **`packages/shared` now,** holding one Zod schema for `/api/health`. The contract is then really shared: the API's test fails when the API drifts from it, and the typed MSW handlers fail when a fake drifts ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 10). It also tries the wiring of [ADR 0005](../../decisions/0005-development-environment.md), decision 8 (a package consumed from source by tsx, Vite and Vitest) while the app is tiny. The price is one more workspace package. A schema in `apps/web` alone would be smaller, but nothing would tie it to the API's response, so the type safety would cover the web against itself only. |
| 2 | What the page shows | Three states, with a 503 body treated as data; the happy path only, with any other response shown as "API unavailable" | **Four states:** in flight, ok, reachable with the database down, and unreachable. The client parses both the 200 and the 503 body with the shared schema, so the page tells which hop broke: the browser to the API, or the API to the database. This is what the health route was designed to show ([ADR 0020](../../decisions/0020-database-details.md), decision 11), and it gives the first component tests real cases. The happy path alone would hide a database outage behind the same message as a dead API. |
| 3 | Where the proxy finds the API | A constant in `vite.config.ts`; a required `apps/web/.env` setting; Vite reading `apps/api/.env` | **A constant, `http://127.0.0.1:3000`,** with a comment pointing to `apps/api/.env.example`. [ADR 0005](../../decisions/0005-development-environment.md), decision 11 says the SPA needs almost no configuration, and [ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 2's no-defaults rule guards deployments from a silently wrong value, which a development-only constant that never ships cannot cause. PH-06 serves the SPA from the API on one origin, so the proxy does not exist in production. If someone changes `PORT`, the page shows "Can't reach the API", a visible symptom. A second `.env` would add a setup step for one value that is the same on every machine, and Vite reading the API's file would couple two packages. |
| 4 | React Router's mode | The data router (`createBrowserRouter` with `RouterProvider`); the declarative `<BrowserRouter>` | **The data router.** The routes are one array, so the nesting the app needs later (the app shell of PH-14 around every page, `/lists/:id` beneath it) is `children`. Tests build the same table with `createMemoryRouter`, so they run the real route definitions. Its `loader` feature stays unused, because TanStack Query owns data fetching ([ADR 0002](../../decisions/0002-technical-architecture.md), decision 11), and the docs say so. The declarative style is smaller, but it is the older form and tests would wrap components in a `<MemoryRouter>` that can drift from the real routes. |
| 5 | Retries of the health query | TanStack Query's default of three retries with growing delays; `retry: false` on this query | **`retry: false`** on `useHealth`. The default would show a spinner for about seven seconds before reporting an error, which suits most data and hides the failure on a page whose whole job is to show it. Later queries keep the default. |
| 6 | Where the tool pages stop | A page per tool, runtime libraries included; pages for development tooling only, with the runtime stack in the stack overview | **Pages for Vite, Testing Library and MSW,** and a jsdom section in the Vitest page. [ADR 0005](../../decisions/0005-development-environment.md), decision 15 puts the runtime stack in `stack-overview.md`, so React, React Router and TanStack Query get sections there, next to the existing ones on frontend state and the shared package. Six new pages would also push the phase past its budget. |
| 7 | TypeScript module settings of the web package | The base's `nodenext`; `esnext` with `moduleResolution: "bundler"` | **`bundler` for `apps/web`.** Vite is the bundler, and this is the setup its documentation uses. It resolves `@szop/shared` through its `package.json` and lets the `vite/client` types and later asset imports work. The API keeps `nodenext`; the `.ts` import specifiers of [ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 6 stay everywhere. |
| 8 | How component tests are set up | A shared `QueryClient` and mocked client module; a fresh `QueryClient` per test and MSW at the network | **MSW at the network, a fresh `QueryClient` per test,** the real route table through `createMemoryRouter`, elements found by role and text. The real client, hook and schema run unchanged ([ADR 0007](../../decisions/0007-testing-strategy.md), decisions 10 and 16). MSW's server reports any request without a handler as an error, so a request nobody planned for fails the test. Handlers are typed with the shared schema. |
| 9 | Install scripts of new dependencies | Allow them as they appear; deny them unless something breaks | **Deny them unless something breaks** ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18, as for esbuild in [ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 11). pnpm 12 fails the install when a dependency with an install script is not listed in `allowBuilds`; the owner decides each entry, with the evidence shown first. |

## Design

### Layout

```
packages/shared/
  package.json            "@szop/shared", private, ESM; "exports" points at src/index.ts
  tsconfig.json           extends ../../tsconfig.base.json
  src/index.ts            re-exports
  src/health.ts           the health response schema and its type
apps/web/
  package.json            "@szop/web", private, ESM; scripts: dev, typecheck
  index.html              Vite's entry; loads src/main.tsx
  vite.config.ts          the React plugin and the /api proxy
  vitest.config.ts        the "web" project: jsdom, setup file
  tsconfig.json           extends the base; DOM, JSX, bundler resolution
  src/main.tsx            mounts <App />
  src/app.tsx             QueryClientProvider and RouterProvider
  src/routes.tsx          the route table: "/" shows the health page
  src/api/client.ts       getHealth(): the only code that calls fetch
  src/health/
    use-health.ts         the useHealth hook (TanStack Query)
    health-page.tsx       the page
    health-page.test.tsx  the component tests
  src/test/
    setup.ts              jest-dom matchers, MSW server lifecycle
    server.ts             the MSW server and its default handler
```

The root `package.json` gains `eslint-plugin-react-hooks` and nothing else the scripts need: `dev`, `typecheck` and `test` already run every package.

### The shared health schema

`packages/shared/src/health.ts` exports `healthSchema`, a Zod discriminated union on `status`, and `type Health = z.infer<typeof healthSchema>`:

| Body | Shape |
|---|---|
| Healthy (HTTP 200) | `{ status: "ok", database: { status: "up", schemaVersion: string } }` |
| Database down (HTTP 503) | `{ status: "error", database: { status: "down" } }` |

`schemaVersion` is a string because it is the latest migration's name, such as `0000_init`, or `"unknown"` when the database holds a migration the code does not know ([ADR 0020](../../decisions/0020-database-details.md)). The schema validates the body only; the HTTP status stays the client's concern.

`packages/shared` is consumed from source: `package.json` points `exports` at `src/index.ts`, and imports keep their `.ts` extension ([ADR 0005](../../decisions/0005-development-environment.md), decision 8; [ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 6). Its only dependency is `zod`, the same major as the API's.

`apps/api` gets `@szop/shared` as a devDependency, because only `health/routes.test.ts` imports it for now. That test gains one assertion per existing case: the real body parses with `healthSchema`. The route's code does not change.

### Data flow and the page

- **`api/client.ts`** exports `getHealth(): Promise<Health>`. It calls `fetch("/api/health")`. A response with status 200 or 503 has its JSON body parsed with `healthSchema`, and the result is returned. Any other status, a network failure or a body that does not match the schema is thrown as an error. It is the only module that calls `fetch`; components never do ([architecture](../../architecture/architecture.md#3-frontend-appsweb)).
- **`health/use-health.ts`** exports `useHealth()`: `useQuery` with the key `["health"]`, `getHealth` as the function and `retry: false` (decision 5). Refetching when the window regains focus stays on, so returning to the tab refreshes the status.
- **`health/health-page.tsx`** renders one `role="status"` element, so a screen reader announces a change, in plain semantic HTML under an `<h1>` "Szop":

| Query state | Text |
|---|---|
| Pending | "Checking the API…" |
| Success, `status: "ok"` | "API: ok", "Database: up", "Schema version: …" |
| Success, `status: "error"` | "API: reachable", "Database: down" |
| Error | "Can't reach the API" |

- **`routes.tsx`** exports the route table (`[{ path: "/", element: <HealthPage /> }]`), so the app and the tests build routers from the same array.
- **`app.tsx`** creates one `QueryClient` and renders `QueryClientProvider` around `RouterProvider` with `createBrowserRouter(routes)`; `main.tsx` mounts it with `createRoot`.

### Vite and the proxy

`vite.config.ts` registers `@vitejs/plugin-react` and `server.proxy`, forwarding `/api` to `http://127.0.0.1:3000` (decision 3). Vite's default port, 5173, stays. `pnpm dev` at the root already runs every package's `dev` script in parallel, so the API and Vite start together; the developer opens the Vite address only, which keeps one origin for the browser ([ADR 0005](../../decisions/0005-development-environment.md), decision 10).

### TypeScript and ESLint

- **`apps/web/tsconfig.json`** extends the base and sets `lib` to include `dom` and `dom.iterable`, `jsx: "react-jsx"`, `module: "esnext"`, `moduleResolution: "bundler"` (decision 7), `noEmit`, `allowImportingTsExtensions`, and the `vite/client` types. Like the API's, it includes `src` and the config files.
- **`packages/shared/tsconfig.json`** extends the base with `noEmit`, `allowImportingTsExtensions` and no extra types.
- **The root `typecheck`** (`tsc --noEmit && pnpm -r typecheck`) covers both new packages through their own `typecheck` scripts.
- **`eslint.config.js`** gains the React Hooks plugin's recommended rules for `apps/web/**/*.{ts,tsx}` ([ADR 0005](../../decisions/0005-development-environment.md), decision 12). Nothing else is added.

### Vitest and the component tests

- **Root `vitest.config.ts`:** `projects` gains `apps/web/vitest.config.ts`, and the coverage `include` gains `apps/*/src/**/*.tsx` and `packages/*/src/**/*.ts`. The exclusion of test infrastructure (`apps/*/src/test/**`) already covers `apps/web/src/test/`.
- **`apps/web/vitest.config.ts`:** `defineProject` with `name: "web"`, `environment: "jsdom"`, `include: ["src/**/*.test.{ts,tsx}"]` and `setupFiles: ["src/test/setup.ts"]`. Still no globals: tests import `describe`, `it` and `expect` from `vitest`. Whether the project needs the React plugin or the `jsx` setting is enough is verified while building.
- **`src/test/setup.ts`:** registers the `@testing-library/jest-dom` matchers, starts the MSW server with `onUnhandledRequest: "error"` before all tests, resets its handlers after each test and closes it after all, and unmounts rendered trees after each test.
- **`src/test/server.ts`:** `setupServer` with one default handler, `GET /api/health` answering the healthy body, built with `HttpResponse.json<Health>(…)`, so the response is typed by the shared schema.
- **`health/health-page.test.tsx`,** the first component test ([OP-012](../../open-points.md#op-012)), written first and seen failing. Each test renders the real route table through `createMemoryRouter(routes)` and `RouterProvider`, inside a `QueryClientProvider` with a fresh `QueryClient`, and finds elements by role and text:
  - **ok:** with the default handler, "Checking the API…" shows first, then "API: ok", "Database: up" and the schema version;
  - **database down:** a handler returning 503 with the outage body shows "API: reachable" and "Database: down";
  - **unreachable:** a handler returning `HttpResponse.error()` shows "Can't reach the API";
  - **unexpected response:** a handler returning 200 with a body that fails the schema, or a 500, shows "Can't reach the API" as well, so the page never trusts a body it cannot parse.

  The "in flight" text is asserted in the ok test, before the answer arrives.

### Dependencies and install scripts

Versions are pinned during implementation; today's are React 19.3, React Router 8.4, TanStack Query 5.104, Vite 8.3, `@vitejs/plugin-react` 6.1, MSW 3.0, Testing Library's React package 16.3 and `jest-dom` 7.0, jsdom 30.1, and `eslint-plugin-react-hooks` 7.1.

- **`apps/web` dependencies:** `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `@szop/shared` (`workspace:*`).
- **`apps/web` devDependencies:** `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `msw`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- **`packages/shared` dependencies:** `zod`.
- **`apps/api` devDependencies:** `@szop/shared` (`workspace:*`).
- **Root devDependencies:** `eslint-plugin-react-hooks`.
- **Install scripts (decision 9):** if the install stops on a dependency's install script, the evidence is shown to the owner and the entry goes into `allowBuilds` in `pnpm-workspace.yaml` with a comment, `false` unless something breaks without it. The comment at the top of that file, which says `apps/web` arrives in PH-05, is updated.

### CI

`ci.yml` needs no change: its `test` job runs `pnpm test:coverage`, which now includes the `web` project, and the web tests need no environment file. The change detection, `lint` and `typecheck` jobs cover the new packages by running the root scripts. Unchanged as well: `dependabot.yml` (the `npm` entry at `/` reads every workspace), `commitlint.config.js` (`web` and `shared` are allowed scopes) and `lint-staged.config.js` (it already covers `.tsx`).

## Documentation and records

- **ADR 0021, "SPA skeleton details":** decisions 1 to 5 and 7 to 9 above (decision 6 is a scope rule and stays in this spec). Refines [ADR 0005](../../decisions/0005-development-environment.md), decisions 8 and 10 (the first consumer of `packages/shared`; the proxy's target) and [ADR 0007](../../decisions/0007-testing-strategy.md), decision 10 (how the typed MSW handlers are set up); completes [ADR 0002](../../decisions/0002-technical-architecture.md), decision 10 (React Router's mode). Noted in ADR 0021's header, the earlier ADRs' status lines and their decisions' cells, as `CLAUDE.md` asks.
- **Tool pages** in `docs/development/tools/`: `vite.md`, `testing-library.md` and `msw.md`, in the format of [ADR 0005](../../decisions/0005-development-environment.md), decision 15. `vitest.md` gains the `web` project and jsdom (the sentence saying the web tests "will use a browser-like environment" becomes fact).
- **`docs/development/testing.md`:** the layers today gain component tests; a section "Writing a component test" (MSW handlers, the fresh `QueryClient`, finding by role); the rule that a handler is typed with the shared schema; the new `web` project in "Running the tests".
- **`docs/development/setup.md`:** the app now has a page: after `pnpm dev`, open Vite's address; what each state of the page means.
- **Architecture:** the monorepo layout notes that `packages/shared` exists; the frontend's code structure names `api/client.ts`, the `health` folder and `routes.tsx` as built; the proxy target.
- **Stack overview:** sections for React, React Router (data router and why `loader` is unused), TanStack Query (query keys, the retry default) and MSW; the shared package section gains its first schema.
- **Glossary:** new terms as they appear (such as DOM, jsdom, MSW, proxy).
- **README:** the "Development" section mentions the page.
- **Open points:** the PH-05 parts of [OP-010](../../open-points.md#op-010) and [OP-012](../../open-points.md#op-012) ✅, each entry moved to its next phase's group; [OP-007](../../open-points.md#op-007) gains a note that `packages/shared` exists; new **OP-079** (PH-15, with [OP-071](../../open-points.md#op-071)): the API serializes its responses through the shared schemas; new **OP-080** (PH-17, the first phase with forms and clicks): `@testing-library/user-event` joins with the first interaction.
- **Roadmap and README diagram:** the PH-05 row 🚧 with the spec link now, the plan and PR links as they land, ✅ before the merge, in the same commits as the README's diagram ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)).

## Tasks

One commit per task; the spec's own commit also sets the roadmap row to 🚧.

1. **`packages/shared` (TDD):** the package, `health.ts`, the API test's new assertions seen failing first. *Verify:* `pnpm install`, `pnpm test`, `pnpm typecheck` and `pnpm lint` pass.
2. **Scaffold `apps/web`:** `package.json`, `tsconfig.json`, `vite.config.ts` with the proxy, `index.html`, `main.tsx`, `app.tsx`, `routes.tsx` and a placeholder page, the React Hooks lint rules. *Verify:* `pnpm dev` serves the placeholder through Vite; `pnpm lint` and `pnpm typecheck` pass.
3. **Component test tooling and the first test (TDD):** the `web` Vitest project, the setup file, the MSW server, then the client, the hook and the page, driven by the ok test. *Verify:* the test failed before the code and passes after; `pnpm dev` shows the real status.
4. **The other states (TDD):** database down, unreachable and unexpected response, each test first. *Verify:* as task 3, plus the by-hand checks of [Goal and success criteria](#goal-and-success-criteria).
5. **Docs:** ADR 0021 with its cross-references, the three tool pages, `vitest.md`, `testing.md`, `setup.md`, the architecture, the stack overview and the glossary. *Verify:* links resolve; contents lists in sync.
6. **Registers and final checks:** the open points, the roadmap and README diagram, the definition of done walked through, every check run once more, a self-review of the diff. *Verify:* `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:coverage` pass.

## To verify during implementation

- **A relative `fetch` URL under jsdom** (task 3): Node's `fetch` rejects relative URLs and jsdom provides none. Either the client resolves `/api/health` against `location.origin` or the test setup does; the cleaner one is chosen and recorded in ADR 0021.
- **Install scripts** (task 1 and 2): which new dependencies, if any, pnpm refuses.
- **MSW 3's API** (task 3): `http`, `HttpResponse`, `setupServer` and `onUnhandledRequest` against what the docs show for version 2.
- **The React plugin in Vitest** (task 3): whether the `web` project needs `@vitejs/plugin-react` or `jsx: "react-jsx"` in the tsconfig is enough for Vite 8's transform.
- **The React Hooks plugin's flat-config preset** (task 2): its exact name in version 7.
- **What Vite's proxy answers when the API is down** (task 4): the status and body, to confirm the client throws and the page shows "Can't reach the API".
- **`moduleResolution: "bundler"` with `@szop/shared`** (task 1 and 2): that `exports` pointing at a `.ts` file type-checks in `apps/web`, in `apps/api` (`nodenext`) and in Vitest.
- **`RouterProvider`'s import path** in React Router 8 for the DOM build (task 2).
