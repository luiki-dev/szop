# PH-06a Production build and serving — design

- **Phase:** [PH-06a](../../roadmap.md#ph-06a-production-build-and-serving)
- **Date:** 2026-10-08
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-007](../../open-points.md#op-007), [OP-013](../../open-points.md#op-013) (PH-06a part), [OP-058](../../open-points.md#op-058), [OP-059](../../open-points.md#op-059), [OP-078](../../open-points.md#op-078) (PH-06a part); new OP-084 for PH-08; [OP-053](../../open-points.md#op-053) and [OP-067](../../open-points.md#op-067) moved to [PH-06b](../../roadmap.md#ph-06b-web-security-baseline)

The API serves the built single-page application (SPA) on its own port, the way it will in production: `pnpm build` writes the SPA with Brotli and gzip copies of every file, `pnpm start` runs the API, and the browser gets compressed, correctly cached files and a working reload on any client-side route. CI builds the SPA on every code PR and fails when the JavaScript of the first screen grows past 200 KB. The direction was settled by [ADR 0005](../../decisions/0005-development-environment.md) (`packages/shared` from source), [ADR 0008](../../decisions/0008-hosting.md) (the API serves the SPA with `@fastify/static`), [ADR 0013](../../decisions/0013-visual-design.md), decisions 4 and 5 (the performance budget, compression and caching) and [NFR-3](../../requirements/functional-requirements.md#nfr-3). This spec holds the details those left to the phase, as agreed in the brainstorm.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Layout](#layout)
  - [Running the API in production](#running-the-api-in-production)
  - [The WEB_ROOT setting](#the-web_root-setting)
  - [Serving the SPA](#serving-the-spa)
  - [The web build](#the-web-build)
  - [The first-screen budget](#the-first-screen-budget)
  - [Generated files](#generated-files)
  - [Tests](#tests)
  - [CI](#ci)
  - [Dependencies](#dependencies)
- [Documentation and records](#documentation-and-records)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: `pnpm build` and `pnpm start` serve the SPA from the API on one port, compressed and cached, and CI fails a build whose first screen needs more than 200 KB of JavaScript.

The phase is done when:

- `pnpm build` writes `apps/web/dist/` with a `.br` and a `.gz` copy next to every text file, and prints the first screen's JavaScript size against the 200 KB budget;
- with PostgreSQL running and `apps/api/.env` in place, `pnpm start` runs the API with Node itself (no tsx), and `http://localhost:3000` shows the health page with the database's status;
- checked by hand in Chrome's DevTools: `index.html` and the JavaScript arrive with `Content-Encoding: br`; `/assets/*` has `Cache-Control: public, max-age=31536000, immutable`; `/` has `no-cache`; reloading a client-side path such as `/some/route` still loads the app; `/api/nope` answers a JSON 404;
- checked by hand once: with the budget lowered to 50 KB, `pnpm build` fails with a message naming the size and the limit; restored afterwards;
- `pnpm test` passes, including the new API tests for serving the SPA and the `WEB_ROOT` setting;
- `pnpm lint`, `pnpm format:check` and `pnpm typecheck` pass, and ESLint and Prettier skip `dist/`;
- on the PR, CI's new `build` job runs, `ci-ok` waits for it and is green;
- ADR 0023, the architecture, the stack overview, the threat model, the setup and CI guides, the testing guide, the tool pages, the glossary, the roadmap, the README diagram and the open points describe all of the above.

The demo check of the [definition of done](../../development/definition-of-done.md) is ➖ N/A: nothing deploys until [PH-12](../../roadmap.md#ph-12-first-deploy).

## Out of scope

- **Security headers and request checks:** `@fastify/helmet` with the Content Security Policy (CSP), HTTP Strict Transport Security (HSTS) and `Referrer-Policy`, the `Sec-Fetch-Site` check, JSON-only bodies, `TRUSTED_PROXY_HOPS` and tokens stripped from logged URLs are [PH-06b](../../roadmap.md#ph-06b-web-security-baseline) ([OP-053](../../open-points.md#op-053)).
- **The container image:** [PH-08](../../roadmap.md#ph-08-container-image), which must copy `drizzle/` and keep the symlinked workspace (new OP-084).
- **Playwright against the production build:** [PH-07](../../roadmap.md#ph-07-first-e2e-journey).
- **Lighthouse and the Core Web Vitals:** measured during the demo check from [PH-12](../../roadmap.md#ph-12-first-deploy) on ([ADR 0013](../../decisions/0013-visual-design.md), decision 4).
- **Splitting the SPA into lazily loaded routes, a favicon, a web manifest:** the app shell and later feature phases. The budget already measures only what the first screen needs, so lazy routes will not count against it.
- **Sharing the build between CI jobs** (the PH-07 `e2e` job builds again on its own runner): when the duplicated time matters.

## Decisions taken in the brainstorm

ADR 0023 records decisions 1 to 8; decision 9 is a scope rule and stays in this spec and on the roadmap.

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | How the API runs in production ([OP-007](../../open-points.md#op-007), [OP-078](../../open-points.md#op-078)) | Node's type stripping, no build; `tsc` writing JavaScript to `dist/`; a bundler (esbuild, tsdown) writing one `dist/server.js`; tsx in production | **Node's type stripping, no build: `node src/server.ts`.** Type stripping is stable since Node 24.12 and replaces each type annotation with spaces, so lines and columns, and the stack traces, stay exact without source maps. The code already follows its rules (`erasableSyntaxOnly`, `.ts` import specifiers, no path aliases), and a probe ran `apps/api/src/app.ts` and `@szop/shared` with Node 24.21: pnpm links `@szop/shared` as a symlink, Node resolves it to `packages/shared/src/`, which is outside `node_modules`, where Node refuses to strip types. So `shared` runs from source as [ADR 0005](../../decisions/0005-development-environment.md), decision 8 intended, the migrations folder stays where `migrate.ts` finds it, and tests and production run the same files. Costs: `engines` rises to `>=24.12`; types are not checked at run time, which the `typecheck` job already does; the image ships `.ts` files; and PH-08 must keep the symlinked workspace, since copying `shared` into `node_modules` (as `pnpm deploy` does) would stop the API from starting (OP-084). `tsc` is the long-standing standard, but `shared` would need its own build and export conditions, `dist/` can go stale, and production would run other files than the tests. A bundler moves every module to `dist/server.js`, which breaks the `../../drizzle` path ([OP-078](../../open-points.md#op-078)) and fights packages such as pino's worker-thread transports, for a gain that matters in browsers, not on a server. tsx in production would ship a development tool and esbuild's binary to do what Node now does itself. |
| 2 | Where the API finds the built SPA | A required `WEB_ROOT` setting; a path fixed relative to the code; an optional setting | **A required `WEB_ROOT` setting,** validated at startup like every other one ([ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 2), resolved to an absolute path against the working directory so `.env.example` can say `../web/dist` on every machine. Tests pass their own folder through the `Config`. **A folder that does not exist does not stop startup:** in `pnpm dev` nobody has built yet and Vite serves the SPA itself; `@fastify/static` logs `"root" path "…" must exist` and the API's own routes keep working. A fixed path would tie the API silently to the monorepo's layout and fail as quiet 404s. An optional setting breaks the no-defaults rule: an image that forgot it would run happily and serve no app. |
| 3 | Who writes the Brotli and gzip copies | A script of our own after `vite build`; an inline Vite plugin; a plugin package | **An inline Vite plugin, `precompress()`, in `vite.config.ts`.** It runs in `closeBundle`, after Vite has written `dist/`, and writes a `.br` (Brotli, quality 11) and a `.gz` (gzip, level 9) copy of every text file with `node:zlib`. Being part of the build, a plain `vite build` cannot skip it. A separate script would be easier to unit-test but can be skipped; a plugin package adds a dependency for about 20 lines. |
| 4 | How the 200 KB budget is enforced ([OP-059](../../open-points.md#op-059)) | An inline Vite plugin that fails the build; a script reading Vite's manifest; size-limit | **An inline Vite plugin, `firstScreenBudget()`, that fails the build.** In `writeBundle` it starts from the entry chunk, follows static `imports` (not `dynamicImports`, which load later), compresses each chunk's code with Brotli in memory and adds up the sizes; it always prints the total and throws above the limit. **Measured in Brotli,** the encoding browsers download from Szop, as Lighthouse's transfer size does. It uses Vite's own module graph, so "first screen" means exactly the code the first page loads, and a local build warns before CI does. A manifest script would rebuild that graph outside Vite and put the manifest into `dist/`; size-limit configures files by glob, which counts lazy chunks too. |
| 5 | Cache headers ([OP-058](../../open-points.md#op-058)) | — | **Files under `/assets/`,** where Vite writes everything with a content hash in its name: **`Cache-Control: public, max-age=31536000, immutable`.** **Everything else,** `index.html`, the fallback and any file from `public/` without a hash: **`Cache-Control: no-cache`,** which lets the browser keep a copy but makes it ask first; the ETag `@fastify/static` sends turns that question into a `304 Not Modified`. Completes [ADR 0013](../../decisions/0013-visual-design.md), decision 5. |
| 6 | What answers a path that is not a file | Everything gets `index.html`; only requests that accept HTML get it; rules by path | **Rules by path:** a path under `/api/` gets Fastify's JSON 404, so a mistyped API call never comes back as a page with status 200; a path whose last segment has a file extension (`/assets/old-chunk.js`) gets a 404, so a chunk requested after a deploy fails clearly instead of arriving as HTML with a confusing type error; any other GET or HEAD gets `index.html` with status 200 and `no-cache`, and React Router renders the route; other methods get a 404. Rules by path are easy to test and do not depend on headers a client may or may not send. |
| 7 | Where the build runs in CI | A `build` job of its own; a step in the `test` job; wait for the `e2e` job of PH-07 | **A `build` job of its own,** skipped when only Markdown changed, like the others, and in `ci-ok`'s `needs`, so a PR over budget cannot merge without any change to GitHub's settings. It needs no database and runs in parallel with the other jobs. A step in `test` would mix two concerns in one job; waiting for PH-07 would leave the budget unenforced. Extends [ADR 0010](../../decisions/0010-ci-cd.md), decision 7. |
| 8 | How the API tests get the SPA's files | Committed fixture files with committed `.br` and `.gz` copies; a fixture written by the test | **A fixture written by the test** into a temporary folder: an `index.html` and an `assets/index-abc123.js`, each with copies compressed by `node:zlib`. No binary files in git, and Prettier formatting the HTML cannot make the copies drift from it. The tests do not depend on running the real build. |
| 9 | Size of the phase | One phase as on the roadmap; a split | **Split** ([ADR 0014](../../decisions/0014-roadmap.md), decision 6): PH-06 held about ten tasks and two new concepts, the production build and the web security baseline. **PH-06 is retired;** this phase, PH-06a, builds and serves the SPA; PH-06b adds the security baseline next, so its CSP is tested against the SPA as it is really served. Recorded on the roadmap in this phase's PR. |

## Design

### Layout

```
apps/api/
  package.json            + "start"; + @fastify/static
  .env.example            + WEB_ROOT=../web/dist
  src/config.ts           + WEB_ROOT → config.webRoot (absolute)
  src/config.test.ts      + WEB_ROOT cases
  src/app.ts              registers webRoutes after the API's routes
  src/web/
    routes.ts             @fastify/static, cache headers, the fallback
    routes.test.ts        the serving tests
  src/test/web-root.ts    writes the fixture web root into a temporary folder
apps/web/
  package.json            + "build"
  vite.config.ts          + precompress() and firstScreenBudget()
package.json              + "build", "start"; engines >=24.12 <25
.github/workflows/ci.yml  + the build job; ci-ok needs it
.gitignore, .prettierignore, eslint.config.js   + dist/
```

### Running the API in production

- **`apps/api/package.json`** gains `"start": "node --env-file=.env src/server.ts"`. Node strips the types as it loads each file; nothing is written to disk. The logs stay JSON, as in production, without `pino-pretty`. The image of [PH-08](../../roadmap.md#ph-08-container-image) runs `node src/server.ts`, with ECS supplying the variables.
- **The root `package.json`** gains `"build": "pnpm -r build"` (only `apps/web` has one for now) and `"start": "pnpm --filter @szop/api start"`, and `engines.node` becomes `">=24.12 <25"`, the first version with stable type stripping. `.nvmrc` stays `24`, which installs the latest 24.x.
- **`dev` is unchanged:** tsx keeps its watch mode for development ([ADR 0005](../../decisions/0005-development-environment.md), decision 9).
- `@szop/shared` stays a devDependency of the API: no runtime code imports it yet. The first route that does moves it to `dependencies`.

### The WEB_ROOT setting

- **`config.ts`:** `WEB_ROOT: z.string().min(1)`, returned as `webRoot: path.resolve(WEB_ROOT)`, an absolute path resolved against the working directory (`apps/api` when run through pnpm). Like every setting it is required; a missing or empty value stops startup with the existing message.
- **`.env.example`:** `WEB_ROOT=../web/dist`, with a comment: the folder `pnpm build` writes; when it does not exist, as in `pnpm dev`, the API logs a warning and serves its own routes only.
- **Existing tests:** `Config` gains `webRoot`; the literal config in `health/routes.test.ts` gets a folder that does not exist, since it does not test serving (the warning is silent at `logLevel: "silent"`).

### Serving the SPA

`src/web/routes.ts` exports `webRoutes`, a plugin registered in `buildApp` after `healthRoutes`, with `root: config.webRoot`:

- **`@fastify/static`** with `root`, `preCompressed: true` and `wildcard: false`. Without the wildcard, the plugin declares one GET and HEAD route per file found at startup, so every other path reaches the not-found handler below. With `preCompressed`, it picks `file.br` or `file.gz` by the request's `Accept-Encoding` and falls back to the plain file, and sets `Vary: Accept-Encoding` itself.
- **Cache headers** in `setHeaders` (decision 5): `public, max-age=31536000, immutable` for paths under `/assets/`; `no-cache` for every other file.
- **The fallback** in `setNotFoundHandler` (decision 6), in this order:
  1. a URL starting with `/api/`: Fastify's default JSON 404;
  2. a last path segment containing a dot: the same 404;
  3. GET or HEAD: `reply.sendFile("index.html")` with `Cache-Control: no-cache`, which goes through the same compressed-file lookup;
  4. any other method: the same 404.
- **Files are found at startup:** a build made while the API runs is served after a restart, which is how deploys work anyway.

### The web build

`apps/web/package.json` gains `"build": "vite build"`. `vite.config.ts` gains two plain functions returning plugins, both with `apply: "build"` so the development server never runs them:

- **`precompress()`** (decision 3): in `closeBundle`, it walks the output folder and, for each file ending in `.html`, `.js`, `.css`, `.svg`, `.json`, `.txt` or `.webmanifest`, writes `<file>.br` with Brotli at quality 11 and `<file>.gz` with gzip at level 9. Images and fonts are compressed already and are skipped. Compressing once at build time is why the strongest, slowest settings are affordable.

### The first-screen budget

- **`firstScreenBudget(200 * 1024)`** (decision 4): in `writeBundle`, it takes the chunk marked `isEntry`, then follows each chunk's `imports` recursively, visiting each chunk once. For each, it compresses `chunk.code` with Brotli at quality 11 in memory and adds the sizes. It prints one line, for example `first-screen JavaScript: 94.1 KB Brotli of 200 KB (3 chunks)`, and throws an `Error` naming the size and the limit when the total exceeds it, which makes `vite build` exit with an error. It measures on its own instead of reading `precompress()`'s files, so neither plugin depends on the other's timing.
- **200 KB means 200 × 1024 bytes,** as [NFR-3](../../requirements/functional-requirements.md#nfr-3) and Lighthouse count kilobytes.
- **The plugins have no unit tests:** they live in the config file, which Vitest does not load. The CI `build` job runs them on every code PR, and the one-time check with a 50 KB limit (in [Goal and success criteria](#goal-and-success-criteria)) proves the failure path. If they grow, they move to a tested module.

### Generated files

`dist/` is new, so it is kept out of the tools: `.gitignore` gains `dist/`, `.prettierignore` gains `dist/`, and `eslint.config.js` gains a global ignore for `**/dist/` (ESLint would otherwise lint the built bundle).

### Tests

- **`src/test/web-root.ts`** exports a helper that writes a fixture web root into a fresh temporary folder (`fs.mkdtemp` under the OS temp directory) and removes it afterwards, with Vitest's `beforeAll` and `afterAll`, in the style of `useTestDatabase()`: `index.html` and `assets/index-abc123.js`, each with a `.br` and a `.gz` copy made by `node:zlib`.
- **`src/web/routes.test.ts`**, through `inject()` and with no database (a database that is never queried is passed to `buildApp`):
  1. `GET /` with `Accept-Encoding: br` answers 200, `Content-Encoding: br`, `Content-Type: text/html`, `Cache-Control: no-cache` and `Vary` including `Accept-Encoding`, and the body decompresses to the fixture's HTML;
  2. `GET /assets/index-abc123.js` with `Accept-Encoding: gzip` answers gzip with the `immutable` header; without `Accept-Encoding`, the plain file;
  3. `GET /some/route` answers the HTML of `index.html` with `no-cache`; `HEAD /some/route` answers 200 too;
  4. `GET /api/nope` answers a JSON 404; `GET /assets/missing.js` answers 404; `POST /some/route` answers 404;
  5. `GET /api/health` still reaches its route, with the plugin registered (one regression check, with the test database).
- **`config.test.ts`:** a missing `WEB_ROOT` is reported like the other settings; a relative `WEB_ROOT` becomes an absolute path.
- Written test first, seen failing, as [testing.md](../../development/testing.md) asks.

### CI

`ci.yml` gains a **`build`** job (decision 7): `needs: changes`, `if: needs.changes.outputs.code == 'true'`, `ubuntu-24.04`, `timeout-minutes: 10`, `contents: read`, checkout without persisted credentials, `./.github/actions/setup`, then `pnpm build`. `ci-ok`'s `needs` gains `build`. No GitHub setting changes: `ci-ok` stays the only required check.

### Dependencies

- **`apps/api` dependencies:** `@fastify/static`, version 10 (10.1.5 today), whose `fastify` peer range is `^5.1.0`. Its dependencies are expected to have no install scripts; if pnpm stops on one, the evidence goes to the owner first ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18).
- **Nothing else:** compression and the budget use `node:zlib`.

## Documentation and records

- **ADR 0023, "Production build and serving details":** decisions 1 to 8 above. It refines [ADR 0005](../../decisions/0005-development-environment.md), decisions 8 and 9 (how `shared` reaches production; tsx is for development only); [ADR 0007](../../decisions/0007-testing-strategy.md), decision 15 ("the compiled API" becomes the API run by type stripping); extends [ADR 0010](../../decisions/0010-ci-cd.md), decision 7 (the `build` job); completes [ADR 0013](../../decisions/0013-visual-design.md), decisions 4 and 5 (how the budget is measured and enforced, which files are cached how); revisits [ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 6, which kept a `tsc` build open. Noted in ADR 0023's header, the earlier ADRs' status lines and their decisions' cells, as `CLAUDE.md` asks.
- **Architecture:** the API serves the SPA (the plugin, the cache rules, the fallback) and runs by type stripping in production.
- **Stack overview:** type stripping in production next to tsx in development (the paragraph that says Node's stripping has rough edges is corrected); precompression; fingerprinted files and immutable caching; the SPA fallback.
- **Threat model:** the static files become an entry point: `@fastify/static` refuses paths that leave `WEB_ROOT`, lists no folders and serves no dotfiles; files are found at startup.
- **Setup guide:** `pnpm build` and `pnpm start`, and what `WEB_ROOT` is; the Node version note (`>=24.12`).
- **CI guide (`ci-cd.md`):** the `build` job and how to read a failed budget.
- **Testing guide:** the fixture web root and the serving tests.
- **Tool pages:** `vite.md` (the build script and the two plugins; the "no build script yet" line goes), `node-and-nvm.md` (`>=24.12` and why), `tsx.md` (development only; production uses Node).
- **Glossary:** Brotli, precompression, fingerprinting (content hash), SPA fallback, ETag, as they appear.
- **Open points:** [OP-007](../../open-points.md#op-007), [OP-058](../../open-points.md#op-058) and [OP-059](../../open-points.md#op-059) ✅ closed; the PH-06a parts of [OP-013](../../open-points.md#op-013) and [OP-078](../../open-points.md#op-078) ✅ done, both moved to [PH-08](../../roadmap.md#ph-08-container-image)'s group, and [OP-078](../../open-points.md#op-078)'s text updated (no compiled module: the running files are the source files; PH-08 copies `drizzle/` and tests or catches the missing journal); new **OP-084** (PH-08): the image keeps the symlinked workspace, because Node refuses to strip types under `node_modules`. [OP-053](../../open-points.md#op-053) and [OP-067](../../open-points.md#op-067) were moved to PH-06b in this phase's first commit.
- **Roadmap and README diagram:** the split (PH-06 retired, PH-06a and PH-06b added) and PH-06a's row 🚧 with the spec link in this spec's commit; the plan and PR links as they land; ✅ before the merge, in the same commits as the README's diagram ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)).

## Tasks

One commit per task; the spec's own commit also records the split and sets the roadmap row to 🚧.

1. **The API runs by type stripping:** `engines`, the API's and the root's `start` scripts. *Verify:* `pnpm install` passes the engine check; `pnpm start` starts the API with Node and `curl localhost:3000/api/health` answers; `pnpm lint` and `pnpm typecheck` pass.
2. **The `WEB_ROOT` setting (TDD):** `config.ts`, `.env.example`, `Config` in the existing tests. *Verify:* the new config tests failed first and pass; `pnpm test` passes.
3. **Serving the SPA (TDD):** `@fastify/static`, the fixture helper, `web/routes.ts` and its tests, registered in `buildApp`. *Verify:* each test failed first and passes; `pnpm test`, `pnpm lint` and `pnpm typecheck` pass.
4. **The web build with precompression:** the `build` scripts, `precompress()`, the ignores for `dist/`. *Verify:* `pnpm build` writes `.br` and `.gz` copies; `pnpm start` then serves the app at `http://localhost:3000`; `pnpm lint` and `pnpm format:check` pass with `dist/` present.
5. **The first-screen budget:** `firstScreenBudget()`. *Verify:* `pnpm build` prints the size; with the limit at 50 KB it fails with the size and the limit; restored.
6. **The `build` job in CI:** `ci.yml` and `ci-cd.md`. *Verify:* actionlint and zizmor pass locally if available, otherwise in CI on the pushed branch; the job runs and `ci-ok` needs it.
7. **Docs, registers and final checks:** ADR 0023 with its cross-references, the living docs, the guides, the tool pages, the glossary, the open points, the roadmap and README diagram; the end-to-end check in Chrome; the definition of done walked through, every check run once more, a self-review of the diff. *Verify:* links resolve; contents lists in sync; `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:coverage` and `pnpm build` pass.

## To verify during implementation

- **`wildcard: false` with HEAD** (task 3): that `@fastify/static` also declares HEAD routes for each file under Fastify 5, and that the not-found handler sees HEAD requests for client-side paths.
- **`sendFile` from the not-found handler** (task 3): that `reply.sendFile("index.html")` picks the `.br` copy and that `setHeaders` runs for it; if not, the handler sets `Cache-Control` itself.
- **A missing `WEB_ROOT` folder** (task 3): that the API still starts, with the warning, and that the fallback then answers a 404 rather than a 500; `@fastify/static`'s source logs a warning, which the test confirms.
- **The chunk fields under Vite 8 and Rolldown** (task 5): `isEntry`, `imports` and `code` on the output chunks passed to `writeBundle`.
- **`closeBundle` and the output folder** (task 4): that the hook runs after every file, including those copied from `public/`, is written, and how it reads the configured output folder (`configResolved`).
- **`path.resolve` in `config.ts`** (task 2): `loadConfig` stays free of other side effects; resolving against `process.cwd()` is the one dependency on the environment, and the test sets its expectation from `process.cwd()` too.
- **Install scripts** (task 3): whether pnpm refuses any of `@fastify/static`'s dependencies.
