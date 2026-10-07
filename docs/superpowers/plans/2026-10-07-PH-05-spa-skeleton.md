# PH-05 SPA Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pnpm dev` serves a React page that shows the API's status through Vite's proxy: ok with the schema version, reachable with the database down, or unreachable. The page's states are covered by component tests with Testing Library and Mock Service Worker (MSW), and the health response's shape lives in a new `packages/shared`.

**Architecture:** `packages/shared` holds one Zod schema, `healthSchema`, for `/api/health`. `apps/web` is a Vite and React app: `api/client.ts` is the only code that calls `fetch` and parses the answer with the shared schema; `health/use-health.ts` wraps it in TanStack Query; `health/health-page.tsx` renders the four states; `routes.tsx` is the route table that both `app.tsx` (a data router) and the tests build routers from. A new Vitest project, `web`, runs in jsdom with an MSW server that fails any request without a handler.

**Tech Stack:** React 19.3, React Router 8.4 (data router), TanStack Query 5.104, Vite 8.3 with `@vitejs/plugin-react` 6.1, MSW 3.0, `@testing-library/react` 16.3 with `@testing-library/dom` and `@testing-library/jest-dom` 7.0, jsdom 30.1, `eslint-plugin-react-hooks` 7.1, Zod 4.6, Vitest 5.0.3; Node 24, pnpm 12.8.1. These are what npm showed on 2026-10-07; `pnpm add` resolves the current ones.

**Spec:** `docs/superpowers/specs/2026-10-07-PH-05-spa-skeleton-design.md`. Read it before starting; this plan argues from it.

## Contents

- [Global Constraints](#global-constraints)
- [Review Focus](#review-focus)
- [Facts checked, and what is not](#facts-checked-and-what-is-not)
- [Task 1: `packages/shared` and the API test](#task-1-packagesshared-and-the-api-test)
- [Task 2: Scaffold `apps/web`](#task-2-scaffold-appsweb)
- [Task 3: Component test tooling and the first test](#task-3-component-test-tooling-and-the-first-test)
- [Task 4: The other states](#task-4-the-other-states)
- [Task 5: ADR 0021 and the living docs](#task-5-adr-0021-and-the-living-docs)
- [Task 6: Registers and final checks](#task-6-registers-and-final-checks)
- [After tasks 1–6: open the PR](#after-tasks-16-open-the-pr)

## Global Constraints

- Branch `feat/ph-05-spa-skeleton`, already created, holding the spec commit; never commit to `main`; no worktree (`CLAUDE.md`, git workflow). Branch names keep the phase ID.
- **Execution: subagent-driven, with a fresh reviewer per task.** After a task's review passes and it is committed, `git push` the branch and **pause** until the owner has reviewed that task; start the next task only when the owner says so. Tick each task's step boxes (`- [ ]` → `- [x]`) in this plan in the task's own commit.
- **Package versions:** add packages with `pnpm add` (never by editing `package.json`), so the lockfile follows. The spec's list says which package goes where; the resolved versions are what the spec calls "pinned during implementation". `zod` in `packages/shared` must be on the same range as `apps/api`'s (`^4.6.5`).
- **The health body** is `{ status: "ok", database: { status: "up", schemaVersion: string } }` with HTTP 200, or `{ status: "error", database: { status: "down" } }` with HTTP 503 (spec, "The shared health schema"). The page's texts are exactly: `Checking the API…`, `API: ok`, `Database: up`, `Schema version: <version>`, `API: reachable`, `Database: down`, `Can't reach the API`.
- **The proxy target is a constant,** `http://127.0.0.1:3000`, in `apps/web/vite.config.ts` (spec, decision 3). No `.env` for the web package.
- **`retry: false`** on the health query only (spec, decision 5).
- **No styling and no new features:** plain semantic HTML, one route (`/`), no `user-event`, no `build` script, no Playwright (spec, "Out of scope").
- **Imports use `.ts` and `.tsx` extensions.** Tests import `describe`, `it`, `expect` and the hooks from `"vitest"`: no globals. No `vi.mock` of our own modules, no snapshot tests of rendered markup, elements found by role and text ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 16).
- **TDD** for the schema's use in the API test, the client, the hook and the page ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 3): write the test, run it and see it fail for the expected reason, then write the code.
- **`allowBuilds` is the owner's decision:** if `pnpm add` stops with `ERR_PNPM_IGNORED_BUILDS`, stop and show the owner the message and which dependency it names; the expected recommendation is `false` ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18).
- **PostgreSQL must be running** for `pnpm test` (the API's tests use it) and for `pnpm dev`: `docker compose up -d --wait`. `apps/api/.env` must exist (copy `apps/api/.env.example`).
- Every commit passes `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm test`. The pre-commit hook formats staged files; Markdown is never formatted by Prettier.
- Commit messages follow Conventional Commits with ADR 0009's nine types and the `scope-enum` list (`web`, `shared`, `api`, `adr`, `plan`, `deps` …). **Every commit ends with these trailers, naming the model that actually wrote the commit** (the implementer's own model, which the controller names in the dispatch prompt), not the orchestrating model:
  ```
  Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01SvSdyVt6Zrc4hPZorpt2m4
  ```
- Docs follow `CLAUDE.md`'s writing style: niche acronyms spelled out on first use and added to the glossary; status icons before their word; requirements linked, never plain IDs; a `## Contents` section in documents over about 100 lines; an ADR that refines, extends or completes another is noted in three places.
- Never merge a PR, never run `gh workflow run`, never delete a remote branch; do not work around `.claude/settings.json` or the push hook.

## Review Focus

Inputs a person will meet that the spec does not spell out; each has its test or check in the owning task.

1. **The API answers 200 with something that is not JSON** (a proxy's HTML error page, a captive portal): the page must say `Can't reach the API`, not stay on `Checking the API…` or show a blank. Test: Task 4, `it.each`, third row.
2. **The API drifts from the schema** (a body without `schemaVersion`, a renamed field): the page must say `Can't reach the API` and never render `undefined`. Test: Task 4, `it.each`, second row; and Task 1's assertion fails the API's own test first.
3. **A proxy or gateway answers 500 or 502 with a body that looks healthy:** only 200 and 503 count as answers. Test: Task 4, `it.each`, first row (a 500 carrying a valid healthy body, which a client without the status check would accept).
4. **The API or database comes back after a failure:** the page must leave `Can't reach the API` for the real status when the query refetches (the tab regaining focus does it), not stay stuck on the error. Test: Task 4, "recovers when the API comes back".
5. **A path other than `/`** (a typed `/lists/1`, a stale bookmark): React Router's default error screen shows, since the table has one route. Accepted until the first feature phases (spec, "Out of scope"); checked by hand once in Task 4, step 8, and written down in ADR 0021's consequences. A hanging API leaves `Checking the API…` until the request ends, since there is no request timeout yet: [OP-040](../../open-points.md#op-040) adds timeouts with the first change the SPA sends.

## Facts checked, and what is not

Checked on 2026-10-07 against the published packages: React Router 8.4.0 exports `createBrowserRouter`, `createMemoryRouter` and `RouterProvider`, ships a `dom-export` entry (so `react-router/dom` exists), and needs React `>=19.2.7` and Node `>=22.22`; Vitest 5.0.3 accepts Vite `^6.4 || ^7 || ^8`; `@vitejs/plugin-react` 6.1.2 needs Vite `^8`.

**Not checked, because the shell and network tools were unavailable while this plan was written; each is a step below that runs the thing first and says what to do if it differs:**

- MSW 3's API (`http`, `HttpResponse`, `setupServer` from `msw/node`, `server.listen({ onUnhandledRequest })`). The code below is MSW 2's; if 3 differs, adapt to its documentation, keep the behavior, and record the difference in ADR 0021.
- The `@testing-library/jest-dom/vitest` entry point, and whether `@testing-library/react` still needs `@testing-library/dom` as a peer.
- The React Hooks plugin's flat preset name (`reactHooks.configs.flat.recommended` below).
- A relative `fetch("/api/health")` under jsdom (spec, "To verify"): Task 3, step 6.
- Whether any new dependency has an install script.
- `moduleResolution: "bundler"` resolving `@szop/shared`'s `exports` that point at a `.ts` file, from `apps/web` and from `apps/api` (`nodenext`).

---

### Task 1: `packages/shared` and the API test

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/health.ts`, `packages/shared/src/index.ts`
- Modify: `apps/api/package.json` (through `pnpm add`), `apps/api/src/health/routes.test.ts`, `vitest.config.ts`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `@szop/shared` exporting `healthSchema` (a Zod discriminated union on `status`) and `type Health`; later tasks import them as `import { healthSchema, type Health } from "@szop/shared"`.

- [x] **Step 1: Write the failing test**

In `apps/api/src/health/routes.test.ts`, add the import as the first line:

```ts
import { healthSchema } from "@szop/shared";
```

In the first test (`answers 200 …`), after the existing `expect(response.json()).toEqual({ … });` add:

```ts
    // The schema accepts the real body and drops nothing from it: a field
    // the API adds without the schema would fail here.
    const body: unknown = response.json();
    expect(healthSchema.parse(body)).toEqual(body);
```

In the second test (`answers 503 …`), inside the `try`, after its `toEqual` add the same three lines (`const body…` and the `expect`).

- [x] **Step 2: Run it and see it fail**

```bash
docker compose up -d --wait
test -f apps/api/.env || cp apps/api/.env.example apps/api/.env
pnpm test
```

Expected: the `api` project's `routes.test.ts` fails to load with an error that `@szop/shared` cannot be resolved; the other tests pass.

- [x] **Step 3: Create the package**

`packages/shared/package.json` (no dependencies yet; `pnpm add` writes them):

```json
{
  "name": "@szop/shared",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

`packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "types": []
  },
  "include": ["src"]
}
```

`packages/shared/src/health.ts`:

```ts
import { z } from "zod";

// The body of GET /api/health: 200 when the database is up, 503 when it is
// down (ADR 0020, decision 5). The schema says nothing about the HTTP status;
// that stays the client's concern. schemaVersion is the latest migration's
// name, or "unknown" when the database holds one this code does not know.
export const healthSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    database: z.object({
      status: z.literal("up"),
      schemaVersion: z.string(),
    }),
  }),
  z.object({
    status: z.literal("error"),
    database: z.object({ status: z.literal("down") }),
  }),
]);

export type Health = z.infer<typeof healthSchema>;
```

`packages/shared/src/index.ts`:

```ts
export { healthSchema, type Health } from "./health.ts";
```

Then add the dependencies:

```bash
pnpm --filter @szop/shared add zod@^4.6.5
pnpm --filter @szop/api add -D @szop/shared --workspace
```

Expected: both succeed; `apps/api/package.json` lists `"@szop/shared": "workspace:*"` under `devDependencies`. If pnpm stops on an ignored build script, stop and show the owner.

- [x] **Step 4: Run the tests, the type check and the lint**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm format:check
```

Expected: all pass, with `routes.test.ts` green. `pnpm typecheck` runs `tsc` in `packages/shared` too. If TypeScript cannot resolve `@szop/shared` from `apps/api` (`nodenext`), report it with the exact error before changing anything: the fix belongs in the spec's decision 7, not in a workaround.

- [x] **Step 5: Show that the test catches drift**

Temporarily change `schemaVersion: z.string()` in `health.ts` to `z.number()`, run `pnpm test --project api`, and see `routes.test.ts`'s first test fail on the parse. Revert the change (`git diff packages/shared` is empty again).

- [x] **Step 6: Measure the package in coverage**

In the root `vitest.config.ts`, change the coverage `include` to:

```ts
      include: [
        "apps/*/src/**/*.{ts,tsx}",
        "packages/*/src/**/*.ts",
        ".claude/hooks/**/*.ts",
      ],
```

Run `pnpm test:coverage` and check that the table lists `packages/shared/src/health.ts`.

- [x] **Step 7: Tick this task's boxes and commit**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add packages/shared apps/api/package.json apps/api/src/health/routes.test.ts vitest.config.ts pnpm-lock.yaml docs/superpowers/plans/2026-10-07-PH-05-spa-skeleton.md
git commit -F - <<'EOF'
feat(shared): add the health response schema

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SvSdyVt6Zrc4hPZorpt2m4
EOF
```

---

### Task 2: Scaffold `apps/web`

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/app.tsx`, `apps/web/src/routes.tsx`, `apps/web/src/health/health-page.tsx`
- Modify: `eslint.config.js`, `package.json` and `pnpm-lock.yaml` (through `pnpm add`), `pnpm-workspace.yaml` (a comment)

**Interfaces:**
- Consumes: `@szop/shared` (Task 1), not yet used in code.
- Produces: `routes: RouteObject[]` from `src/routes.tsx` (one route, `/`, rendering `<HealthPage />`); `HealthPage()` from `src/health/health-page.tsx` (a placeholder here); `App()` from `src/app.tsx`. Tasks 3 and 4 build on these names.

- [ ] **Step 1: Create the package and add its dependencies**

`apps/web/package.json`:

```json
{
  "name": "@szop/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit"
  }
}
```

```bash
pnpm --filter @szop/web add react react-dom react-router @tanstack/react-query
pnpm --filter @szop/web add @szop/shared --workspace
pnpm --filter @szop/web add -D vite @vitejs/plugin-react @types/react @types/react-dom
pnpm add -Dw eslint-plugin-react-hooks
```

Expected: all succeed. If pnpm stops on an ignored build script, stop and show the owner. Check `apps/web/package.json` lists the packages under `dependencies` and `devDependencies` as in the spec.

- [ ] **Step 2: Configuration files**

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["es2024", "dom", "dom.iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

`apps/web/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The API's address from apps/api/.env.example. A constant, not a
      // setting: it only exists in development, since the API serves the SPA
      // itself in production (ADR 0021, decision 3).
      "/api": "http://127.0.0.1:3000",
    },
  },
});
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Szop</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Source files**

`apps/web/src/health/health-page.tsx` (a placeholder; Task 3 replaces it):

```tsx
export function HealthPage() {
  return <h1>Szop</h1>;
}
```

`apps/web/src/routes.tsx`:

```tsx
import type { RouteObject } from "react-router";
import { HealthPage } from "./health/health-page.tsx";

// One table, used by the app and by the tests, so tests run the real routes.
export const routes: RouteObject[] = [{ path: "/", element: <HealthPage /> }];
```

`apps/web/src/app.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { routes } from "./routes.tsx";

const queryClient = new QueryClient();
const router = createBrowserRouter(routes);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

`apps/web/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";

const root = document.getElementById("root");
if (!root) {
  throw new Error("index.html has no #root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

If `react-router/dom` does not export `RouterProvider` in the installed version, import it from `react-router` instead and note it for ADR 0021.

- [ ] **Step 4: The React Hooks lint rules**

In `eslint.config.js`, add the import next to the others (`import reactHooks from "eslint-plugin-react-hooks";`) and, after the `languageOptions` block and before `prettier`, this block:

```js
  // The rules of hooks for the SPA (ADR 0005, decision 12).
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
  },
```

If the plugin has no `configs.flat.recommended`, use the flat preset its README names, and record which one in ADR 0021.

- [ ] **Step 5: The workspace comment**

In `pnpm-workspace.yaml`, replace the comment above `packages:` with:

```yaml
# The workspace packages: apps/api since PH-03, apps/web and packages/shared
# since PH-05.
```

- [ ] **Step 6: Checks**

```bash
pnpm lint && pnpm format:check && pnpm typecheck
```

Expected: all pass. If `apps/web` cannot resolve `@szop/shared` under `moduleResolution: "bundler"` (a `.ts` target in `exports`), report the exact error before changing anything.

- [ ] **Step 7: Run it**

Start `pnpm dev` in the background (PostgreSQL up, `apps/api/.env` present); wait for Vite's `Local:` line, then use the URL it prints (5173 unless taken):

```bash
curl -s http://127.0.0.1:5173/ | grep -c 'id="root"'
curl -s -w ' %{http_code}\n' http://127.0.0.1:5173/api/health
```

Expected: `1`; and the API's health body with `200`, through Vite's proxy. Stop `pnpm dev` afterwards.

- [ ] **Step 8: Tick this task's boxes and commit**

```bash
git add apps/web eslint.config.js package.json pnpm-lock.yaml pnpm-workspace.yaml docs/superpowers/plans/2026-10-07-PH-05-spa-skeleton.md
git commit -F - <<'EOF'
feat(web): scaffold the SPA with Vite and the API proxy

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SvSdyVt6Zrc4hPZorpt2m4
EOF
```

---

### Task 3: Component test tooling and the first test

**Files:**
- Create: `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`, `apps/web/src/test/server.ts`, `apps/web/src/api/client.ts`, `apps/web/src/health/use-health.ts`, `apps/web/src/health/health-page.test.tsx`
- Modify: `apps/web/src/health/health-page.tsx`, `vitest.config.ts`, `apps/web/package.json` and `pnpm-lock.yaml` (through `pnpm add`)

**Interfaces:**
- Consumes: `routes` (Task 2), `healthSchema` and `Health` (Task 1).
- Produces: `server` and `healthyBody` from `src/test/server.ts` (the MSW server with a default `GET /api/health` handler answering `healthyBody`; `healthyBody` is `{ status: "ok", database: { status: "up", schemaVersion: "0000_init" } } satisfies Health`); `getHealth(): Promise<Health>` from `src/api/client.ts`; `useHealth()` from `src/health/use-health.ts` returning TanStack Query's `UseQueryResult<Health>`; the `web` Vitest project.

- [ ] **Step 1: Add the test dependencies**

```bash
pnpm --filter @szop/web add -D msw @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom
```

Expected: succeeds. `@testing-library/dom` is a peer of the React package; if pnpm reports it is not needed, drop it. If pnpm stops on an ignored build script, stop and show the owner.

- [ ] **Step 2: The `web` project**

`apps/web/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

// The web project of the root vitest.config.ts. jsdom is a simulated browser
// in Node (ADR 0007, decision 9).
export default defineProject({
  plugins: [react()],
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
```

In the root `vitest.config.ts`, add `"apps/web/vitest.config.ts"` to `projects`, after `"apps/api/vitest.config.ts"`.

`apps/web/src/test/server.ts`:

```ts
import type { Health } from "@szop/shared";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const healthyBody = {
  status: "ok",
  database: { status: "up", schemaVersion: "0000_init" },
} satisfies Health;

// The handlers every test starts with; a test overrides one with server.use().
export const server = setupServer(
  http.get("/api/health", () => HttpResponse.json(healthyBody)),
);
```

`apps/web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server.ts";

// A request nobody wrote a handler for fails the test instead of reaching a
// real network.
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

// Without Vitest globals, Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
```

If MSW 3's names differ from these (`http`, `HttpResponse`, `setupServer`, `listen`, `resetHandlers`, `close`), follow its documentation and keep the behavior; if `@testing-library/jest-dom/vitest` does not exist, use the entry its README names for Vitest. Record either difference for ADR 0021.

- [ ] **Step 3: Write the failing test**

`apps/web/src/health/health-page.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { routes } from "../routes.tsx";
import { healthyBody } from "../test/server.ts";

// The real route table and the real client, hook and schema; only the
// network is faked (ADR 0007, decision 10). A fresh QueryClient per test, so
// a cached answer cannot leak into the next test.
function renderApp() {
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("HealthPage", () => {
  it("shows the schema version once the API and the database answer", async () => {
    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("Checking the API…");
    expect(await screen.findByText("API: ok")).toBeInTheDocument();
    expect(screen.getByText("Database: up")).toBeInTheDocument();
    expect(
      screen.getByText(`Schema version: ${healthyBody.database.schemaVersion}`),
    ).toBeInTheDocument();
  });
});
```

If the status element is not there at the first synchronous `getByRole` (the router rendering a tick late), replace that line with `expect(await screen.findByText("Checking the API…")).toBeInTheDocument();` and say so in the task's report.

- [ ] **Step 4: Run it and see it fail**

```bash
pnpm test --project web
```

Expected: the `web` project runs, and the test fails because the placeholder page has no `role="status"` element (not because of a setup error: if it fails with a configuration, import or MSW error, fix that first, as it is part of this step).

- [ ] **Step 5: Write the minimal code to pass**

`apps/web/src/api/client.ts`:

```ts
import { healthSchema, type Health } from "@szop/shared";

// The only code that calls fetch; components never do.
export async function getHealth(): Promise<Health> {
  const response = await fetch("/api/health");
  return healthSchema.parse(await response.json());
}
```

`apps/web/src/health/use-health.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../api/client.ts";

// No retries: this page exists to show a failure, and TanStack Query's default
// of three retries would hide it behind "Checking the API…" for about seven
// seconds (ADR 0021, decision 5).
export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: getHealth, retry: false });
}
```

`apps/web/src/health/health-page.tsx` (the minimal version: only the in-flight and ok states; Task 4 adds the rest):

```tsx
import { useHealth } from "./use-health.ts";

function Status({ query }: { query: ReturnType<typeof useHealth> }) {
  if (query.isPending) {
    return <p>Checking the API…</p>;
  }
  if (query.data?.status === "ok") {
    return (
      <>
        <p>API: ok</p>
        <p>Database: up</p>
        <p>Schema version: {query.data.database.schemaVersion}</p>
      </>
    );
  }
  return null;
}

export function HealthPage() {
  const query = useHealth();

  return (
    <main>
      <h1>Szop</h1>
      <div role="status">
        <Status query={query} />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Run it and see it pass; settle the relative URL**

```bash
pnpm test --project web
```

Expected: PASS. If the test fails because `fetch` rejects `/api/health` as an invalid URL (Node's `fetch` takes no relative URLs, and jsdom provides none), apply this fallback and only then: in `client.ts`, call `fetch(new URL("/api/health", window.location.origin))`, run again, and record in ADR 0021 that the client resolves the path against the page's origin so the tests' Node `fetch` accepts it. If it passes as written, record that MSW's interceptor resolves relative URLs against jsdom's `location`.

- [ ] **Step 7: Check it in the real app**

Start `pnpm dev` in the background with PostgreSQL up. Open the Vite address with the Chrome DevTools MCP (`chrome-devtools-win`, see the user's `CLAUDE.md`), take a snapshot, and expect `API: ok`, `Database: up` and `Schema version: 0000_init` in the page. If the browser tool is unavailable, say so and leave this check to the owner. Stop `pnpm dev` afterwards.

- [ ] **Step 8: Checks, tick boxes and commit**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage
```

Expected: all pass; the coverage table lists `apps/web/src/` files. Then:

```bash
git add apps/web packages vitest.config.ts pnpm-lock.yaml docs/superpowers/plans/2026-10-07-PH-05-spa-skeleton.md
git commit -F - <<'EOF'
feat(web): show the API's status on the page

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SvSdyVt6Zrc4hPZorpt2m4
EOF
```

---

### Task 4: The other states

**Files:**
- Modify: `apps/web/src/health/health-page.test.tsx`, `apps/web/src/health/health-page.tsx`, `apps/web/src/api/client.ts`

**Interfaces:**
- Consumes: everything from Task 3.
- Produces: the finished page and client; `renderApp()` in the test file now returns `{ queryClient }`.

- [ ] **Step 1: Write the failing tests**

In `health-page.test.tsx`, extend the imports (`import type { Health } from "@szop/shared";`, `import { http, HttpResponse } from "msw";`, and `server` next to `healthyBody`), change `renderApp` to return the client, and add the tests inside the `describe`:

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
```

```tsx
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

  it("says it cannot reach the API when the request fails", async () => {
    server.use(http.get("/api/health", () => HttpResponse.error()));

    renderApp();

    expect(await screen.findByText("Can't reach the API")).toBeInTheDocument();
  });

  it.each([
    [
      "a status other than 200 or 503",
      () => HttpResponse.json(healthyBody, { status: 500 }),
    ],
    [
      "a body that does not match the schema",
      () => HttpResponse.json({ status: "ok", database: { status: "up" } }),
    ],
    [
      "a body that is not JSON",
      () => new HttpResponse("<html>Bad gateway</html>", { status: 200 }),
    ],
  ])("says it cannot reach the API for %s", async (_name, respond) => {
    server.use(http.get("/api/health", respond));

    renderApp();

    expect(await screen.findByText("Can't reach the API")).toBeInTheDocument();
  });

  it("recovers when the API comes back", async () => {
    server.use(http.get("/api/health", () => HttpResponse.error()));
    const { queryClient } = renderApp();
    expect(await screen.findByText("Can't reach the API")).toBeInTheDocument();

    // Handlers added later win, so the next request gets the healthy answer;
    // refetching is what the tab regaining focus does.
    server.use(http.get("/api/health", () => HttpResponse.json(healthyBody)));
    await queryClient.refetchQueries({ queryKey: ["health"] });

    expect(await screen.findByText("API: ok")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them and see them fail**

```bash
pnpm test --project web
```

Expected: the first test still passes and the six new ones fail. Five of them find no text, because the minimal page renders nothing for those states: the database-down test (no `API: reachable`), the unreachable test, the schema-mismatch and not-JSON rows, and the recovery test (no `Can't reach the API`). The 500 row fails differently: the minimal client accepts the healthy body despite the status, so the page shows `API: ok` instead of the error. None of them may fail on a setup error.

- [ ] **Step 3: Write the code to pass**

`apps/web/src/api/client.ts`:

```ts
import { healthSchema, type Health } from "@szop/shared";

// The only code that calls fetch; components never do. A 200 and a 503 both
// carry a health body: the 503 says the database is down, which is an answer,
// not a failure of the request. Anything else, or a body that does not match
// the schema, is an error.
export async function getHealth(): Promise<Health> {
  const response = await fetch("/api/health");
  if (response.status !== 200 && response.status !== 503) {
    throw new Error(`GET /api/health answered ${String(response.status)}`);
  }
  return healthSchema.parse(await response.json());
}
```

(keep the relative-URL fallback from Task 3, step 6, if it was needed).

In `health-page.tsx`, replace `Status` with:

```tsx
function Status({ query }: { query: ReturnType<typeof useHealth> }) {
  if (query.isPending) {
    return <p>Checking the API…</p>;
  }
  if (query.isError) {
    return <p>Can't reach the API</p>;
  }
  if (query.data.status === "ok") {
    return (
      <>
        <p>API: ok</p>
        <p>Database: up</p>
        <p>Schema version: {query.data.database.schemaVersion}</p>
      </>
    );
  }
  return (
    <>
      <p>API: reachable</p>
      <p>Database: down</p>
    </>
  );
}
```

- [ ] **Step 4: Run them and see them pass**

```bash
pnpm test --project web
```

Expected: all seven `web` tests pass: the ok test, the database-down test, the unreachable test, the three unexpected-response rows and the recovery test.

- [ ] **Step 5: Check that the tests guard the behavior**

Temporarily delete the status check in `client.ts` (the `if (response.status …)` block) and run the tests: the 500 row must fail. Revert it. Then temporarily delete `retry: false` from `use-health.ts` and run the tests: the error-state tests must fail, because the default retries keep the page on `Checking the API…` longer than `findByText` waits. Revert that too, and check with `git diff` that both files are as committed.

- [ ] **Step 6: Check the real states by hand**

With `pnpm dev` running in the background and the Chrome DevTools MCP on the Vite address:

```bash
docker compose stop
# reload the page; wait a few seconds (the database connection times out)
docker compose start && docker compose up -d --wait
```

Expected: first `API: ok` and `Schema version: 0000_init`; with PostgreSQL stopped, after a reload, `API: reachable` and `Database: down`; once it is back and the page reloads, `API: ok` again. Then stop the API only (stop the `pnpm dev` process and start the Vite server alone with `pnpm --filter @szop/web dev`), reload, and expect `Can't reach the API`. Record the observed texts for the PR's *How it was tested*. If the browser tool is unavailable, leave this check to the owner and say so.

- [ ] **Step 7: Check the proxy's answer when the API is down**

With the API stopped and Vite running, `curl -s -w ' %{http_code}\n' http://127.0.0.1:5173/api/health` and record the status and body: the client must treat it as an error (not 200 or 503), which the manual check above confirms. If the proxy answered 503 or 200 with a parseable body, report it: the page would then misreport the state.

- [ ] **Step 8: Check an unknown path by hand**

With Vite running, open `http://127.0.0.1:5173/nowhere`: expect React Router's default error screen (404). This is accepted (Review Focus, item 5); note the exact text seen in the report.

- [ ] **Step 9: Checks, tick boxes and commit**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage
git add apps/web docs/superpowers/plans/2026-10-07-PH-05-spa-skeleton.md
git commit -F - <<'EOF'
feat(web): show every state of the API's health

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SvSdyVt6Zrc4hPZorpt2m4
EOF
```

---

### Task 5: ADR 0021 and the living docs

**Files:**
- Create: `docs/decisions/0021-spa-skeleton-details.md`, `docs/development/tools/vite.md`, `docs/development/tools/testing-library.md`, `docs/development/tools/msw.md`
- Modify: `docs/decisions/0002-technical-architecture.md`, `docs/decisions/0005-development-environment.md`, `docs/decisions/0007-testing-strategy.md` (status lines and decision cells), `docs/development/tools/vitest.md`, `docs/development/testing.md`, `docs/development/setup.md`, `docs/architecture/architecture.md`, `docs/architecture/stack-overview.md`, `docs/glossary.md`, `README.md`

**Interfaces:**
- Consumes: the finished code and what Tasks 1 to 4 reported (the relative-URL outcome, the plugin and preset names, any `allowBuilds` entry, any MSW 3 difference).
- Produces: the records the PR links to.

- [ ] **Step 1: Write ADR 0021**

`docs/decisions/0021-spa-skeleton-details.md`, in the shape of [ADR 0020](../../decisions/0020-database-details.md) (read it first):

- Title `# ADR 0021 — SPA skeleton details`; `- **Status:** ✅ Accepted`; `- **Date:** 2026-10-07`;
- `- **Refines:** [ADR 0005](0005-development-environment.md), decisions 8 and 10 (the first consumer of packages/shared, see decision 1; the proxy's target, see decision 3); [ADR 0007](0007-testing-strategy.md), decision 10 (how the typed MSW handlers are set up, see decisions 1 and 7)`;
- `- **Completes:** [ADR 0002](0002-technical-architecture.md), decision 10 (React Router's mode, see decision 4)`.
- `## Context`: [PH-05](../roadmap.md#ph-05-spa-skeleton) brought the single-page application (SPA); the ADRs above set its direction; its brainstorm and the [spec](../superpowers/specs/2026-10-07-PH-05-spa-skeleton-design.md) settled the details.
- `## Decisions`: the spec's decisions 1 to 5 and 7 to 9, copied with their wording, renumbered 1 to 8 (the spec's decision 6, the tool pages' scope, is a scope rule and stays in the spec), with links rewritten from `../../decisions/X` to `X` and from `../../` to `../`. Add what the implementation settled, in the cells of the decisions it touches: the relative-URL outcome (Task 3, step 6) in decision 7; the React plugin's use in the `web` project and the React Hooks preset used (Tasks 2 and 3) in decision 7 or a decision 9 of their own; any `allowBuilds` entry the owner decided; any MSW 3 difference.
- `## Consequences`: `packages/shared` exists and is consumed from source by `apps/web` and, in a test, by `apps/api`; `pnpm test` runs three projects; a path other than `/` shows React Router's default error screen until the first feature phases; a hanging API leaves the page on `Checking the API…` until timeouts arrive with [OP-040](../open-points.md#op-040); the open points closed, moved and added (Task 6); the living docs and tool pages.

- [ ] **Step 2: Note the cross-references in the earlier ADRs**

In the three places `CLAUDE.md` asks for (ADR 0021's header is step 1). Read each file's existing status line and notes first, and add in the same style:

- ADR 0002, status line: append `; decision 10 completed by [ADR 0021](0021-spa-skeleton-details.md) (React Router's data router)`. Decision 10's cell, at the bottom after any notes: `<br>🧩 **Completed by [ADR 0021](0021-spa-skeleton-details.md), decision 4:** the data router (createBrowserRouter with RouterProvider), one route table shared by the app and the tests; its loader feature stays unused, since TanStack Query fetches data.`
- ADR 0005, status line: append `; decisions 8 and 10 refined by [ADR 0021](0021-spa-skeleton-details.md) (the first consumer of packages/shared; the proxy's target)`. Decision 8's cell: `<br>✏️ **Refined by [ADR 0021](0021-spa-skeleton-details.md), decision 1:** packages/shared is created in PH-05 with the health response schema, used by apps/web and, in a test, by apps/api.` Decision 10's cell: `<br>✏️ **Refined by [ADR 0021](0021-spa-skeleton-details.md), decision 3:** the proxy's target is a constant in apps/web/vite.config.ts, not a setting.`
- ADR 0007, status line: append `; decision 10 refined by [ADR 0021](0021-spa-skeleton-details.md) (how the typed MSW handlers are set up)`. Decision 10's cell: `<br>✏️ **Refined by [ADR 0021](0021-spa-skeleton-details.md), decisions 1 and 7:** the shared health schema types the handlers; the server fails a request without a handler, and every test renders the real route table with a fresh QueryClient.`

(code formatting in the real cells.)

- [ ] **Step 3: Write the three tool pages and update Vitest's**

Read `docs/development/tools/vitest.md` and `drizzle.md` first, and write each page in their format (what it is, why Szop uses it with the ADR links, the configuration explained, everyday use, links to the official documentation), about 40 to 50 lines each:

- `vite.md`: what Vite is (the dev server with instant reload, and later the production build); why (ADR 0002, ADR 0005); `apps/web/vite.config.ts` explained line by line (the React plugin, `server.proxy` and why one origin, why the target is a constant); `index.html` as the entry; `pnpm dev` and what it starts; that the production build is [PH-06](../../roadmap.md#ph-06-production-build-and-web-baseline).
- `testing-library.md`: what it is (renders components and finds elements the way a user does); why (ADR 0007, decisions 9, 10); `@testing-library/react`, `@testing-library/dom` (its peer) and `@testing-library/jest-dom` (matchers such as `toBeInTheDocument`) and what each does; the query order (`getByRole`, then label and text; never test IDs), `getBy` vs `findBy` (waits) vs `queryBy`; why `cleanup` is called in the setup file (no globals); that `user-event` joins with the first interaction ([OP-080](../../open-points.md#op-080)).
- `msw.md`: what Mock Service Worker (MSW) is (fakes the network so the real client runs); why (ADR 0007, decision 10); `src/test/server.ts` and `setup.ts` explained (`onUnhandledRequest: "error"`, `resetHandlers`, `server.use` for one test); that handlers are typed with the shared schema; MSW also has a browser mode, which Szop does not use.
- `vitest.md`: add the `web` project (jsdom, `setupFiles`, the React plugin) to *Configuration*, and replace "the web app's tests will use a browser-like environment instead" with what is true now; a short *jsdom* paragraph (a simulated browser in Node: no layout, so no sizes; fast; the E2E journeys cover real browsers).

- [ ] **Step 4: Update the testing guide and the setup guide**

`docs/development/testing.md`: read it first; then: *The layers today* gains component tests (what they cover: a page with its hook, client and schema, the network faked); *Running the tests* gains `pnpm test --project web`; a new section *Writing a component test* with the test of Task 3 as the example, covering the real route table, the fresh `QueryClient`, finding by role and text, `server.use` for a state, `findBy` for what appears after a request, and that a handler is typed with `satisfies Health`; *Rules* gains: a handler that returns a body is typed with the shared schema, and `onUnhandledRequest: "error"` stays on. Keep `## Contents` in sync.

`docs/development/setup.md`: read the section that runs the API; at its end add how to see the page: with PostgreSQL running, `pnpm dev` starts the API and Vite together; open the address Vite prints (`http://localhost:5173`); what each text means (`API: ok` and the schema version; `API: reachable` with `Database: down`: start PostgreSQL; `Can't reach the API`: the API is not running or `PORT` in `apps/api/.env` is not 3000, since the proxy's target is that constant). Keep `## Contents` in sync.

- [ ] **Step 5: Update the architecture, the stack overview, the glossary and the README**

`docs/architecture/architecture.md`: in 1, the monorepo layout notes that `packages/shared` exists since PH-05 and holds the health schema; in 3, *Code structure*, name `api/client.ts`, the `health` folder (page, hook, test), `routes.tsx` and `test/` as built, and the proxy's target; *Routes* notes that only `/` exists.

`docs/architecture/stack-overview.md`: read its `## Contents` and sections 7 and 8; add `## 17. The single-page application: React, React Router and TanStack Query` after section 16, and list it in the contents. It explains, for a learner: what a component, a hook and rendering are (React); the data router and why its `loader` is unused (React Router); a query, its key, caching, refetch on focus and why `retry` is off on the health query (TanStack Query); how the dev proxy keeps one origin; MSW in one paragraph; and the path of one request from the page through the proxy and the API to PostgreSQL. Section 8 (*The shared package and Zod*) gains its first real schema and how both sides use it.

`docs/glossary.md`: under `## Terms`, alphabetically, where missing (look each up first): **DOM** (Document Object Model, the browser's tree of the page's elements), **jsdom** (a simulated browser in Node, used by component tests), **Mock Service Worker (MSW)** (fakes network requests in tests), **Proxy (development)** (Vite's dev server forwards `/api` requests to the API, so the browser sees one origin), **Query key** (the name TanStack Query caches an answer under). Under `## Acronyms`: **MSW**, **DOM**, if the section lists acronyms.

`README.md`, *Development*: one sentence that `pnpm dev` now opens the page's address (Vite's `http://localhost:5173`), next to the existing text.

- [ ] **Step 6: Verify links and contents**

```bash
for f in docs/decisions/0021-spa-skeleton-details.md docs/decisions/000{2,5,7}-*.md docs/architecture/architecture.md docs/architecture/stack-overview.md docs/development/*.md docs/development/tools/*.md docs/glossary.md README.md; do
  grep -oE '\]\([^)#]+' "$f" | sed 's/](//' | grep -v '^http' | sort -u | while read -r l; do [ -e "$(dirname "$f")/$l" ] || echo "BROKEN in $f: $l"; done
done; echo "link check done"
```

Expected: `link check done` with no `BROKEN` line. Check by eye that every changed document's `## Contents` lists its `##` and `###` headings, and that requirements are linked, never plain IDs.

- [ ] **Step 7: Tick this task's boxes and commit**

```bash
git add docs/decisions docs/development docs/architecture docs/glossary.md README.md docs/superpowers/plans/2026-10-07-PH-05-spa-skeleton.md
git commit -F - <<'EOF'
docs(adr): add ADR 0021 and update the living docs for PH-05

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SvSdyVt6Zrc4hPZorpt2m4
EOF
```

---

### Task 6: Registers and final checks

**Files:**
- Modify: `docs/open-points.md`, `docs/roadmap.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the state the PR is opened from.

- [ ] **Step 1: Update the open points**

In `docs/open-points.md`:

- **OP-010:** the PH-05 part gets `✅ Done (link)`: until the PR exists, link the branch `https://github.com/luiki-dev/szop/tree/feat/ph-05-spa-skeleton`; status stays `⬜ Open` (the PH-07 and PH-15 parts remain). Move the entry from the `### PH-05 SPA skeleton` group to `### PH-07 First E2E journey`, and drop it from PH-07's `Also:` line, since the entry now sits there; PH-15's `Also:` line keeps it.
- **OP-012:** the same: the PH-05 part ✅, moved to `### PH-07 First E2E journey`, dropped from PH-07's `Also:` line.
- **OP-007:** add a line: `**Since PH-05:** packages/shared exists and is consumed from source by apps/web and, in a test, by apps/api; the API's production build still has to include it.` Status unchanged.
- **OP-067:** it does not depend on this phase: move it unchanged to `### PH-06 Production build and web baseline`, with the line `- **Moved from PH-05:** it does not depend on that phase.` Before moving, ask the owner whether a Dependabot PR has appeared since 2026-10-05; if one has, report that, and the owner decides whether the point can be closed or settled in part.
- New, under `### PH-15 Seed catalog, read-only` (next to OP-071): `#### OP-079` **Serialize the API's responses through the shared schemas.** The health route sends its body as written; the first route that needs response serialization (Fastify's schema compiler with `fastify-type-provider-zod`, or an explicit parse) validates the response against the `packages/shared` schema, so the contract is enforced in the API, not only checked by a test. Source: [PH-05 spec](superpowers/specs/2026-10-07-PH-05-spa-skeleton-design.md#out-of-scope). Status: ⬜ Open.
- New, under `### PH-17 List items`: `#### OP-080` **Add `@testing-library/user-event`** with the first component test that clicks or types ([ADR 0007](decisions/0007-testing-strategy.md), decision 10 names it with `jest-dom`; nothing in PH-05 interacts). Source: [PH-05 spec](superpowers/specs/2026-10-07-PH-05-spa-skeleton-design.md#out-of-scope). Status: ⬜ Open.
- Check that PH-05's group now holds only its heading and its roadmap link, as PH-03's and PH-04's do.

- [ ] **Step 2: Update the roadmap**

In `docs/roadmap.md`: the PH-05 row's Plan column links `superpowers/plans/2026-10-07-PH-05-spa-skeleton.md` (the plan commit may already have set it; check). PH-05's *Delivers* gains `packages/shared` with the health response schema, used by the web client, the MSW handlers and the API's health test ([ADR 0021](decisions/0021-spa-skeleton-details.md)). The row stays `🚧 In progress`; the README diagram stays at ◐ until the PR sets ✅.

- [ ] **Step 3: Walk through the definition of done**

Read `docs/development/definition-of-done.md` and note each item's state for the PR. Expected: item 1 (tests) ✅; item 2 ➖ N/A: no domain rules in `packages/shared`; item 3 after CI; item 4 ➖ N/A: no demo environment until PH-12; item 5 ➖ N/A: no `infra/base`; items 6–10 ✅; item 11: read it (the page is the first UI, unstyled) and decide, with the reason, whether it is ✅ or ➖ N/A.

- [ ] **Step 4: Final checks and a self-review of the diff**

```bash
docker compose up -d --wait
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage
git diff main --stat
```

Expected: all pass; `pnpm test:coverage` shows three projects' worth of files (api, web, hooks) and `packages/shared`. Read the whole diff against the spec's success criteria one by one and list any gap.

- [ ] **Step 5: Links check and commit**

Run the link check of Task 5, step 6, over `docs/open-points.md` and `docs/roadmap.md` too. Then:

```bash
git add docs/open-points.md docs/roadmap.md docs/superpowers/plans/2026-10-07-PH-05-spa-skeleton.md
git commit -F - <<'EOF'
docs(roadmap): update the open points for PH-05

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SvSdyVt6Zrc4hPZorpt2m4
EOF
```

---

## After tasks 1–6: open the PR

Only when the owner says so, after reviewing Task 6.

1. Run every check once more, with PostgreSQL running: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage`.
2. Open the PR with `gh pr create`: title `feat(web): add the SPA skeleton`; the body fills `.github/pull_request_template.md`, with *How it was tested* holding the outputs recorded in Task 3, step 7, and Task 4, steps 6 to 8; the definition of done as walked through in Task 6, step 3.
3. Then, in one commit (`docs(roadmap): mark PH-05 done`): the PR link in PH-05's roadmap row and in the open points that pointed at the branch; the row set to `✅ Done`; the README diagram's PH-05 marker `◐` → `●`, with the road travelled ending at PH-05 ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)). Push.
4. Check that CI is green: the `test` job runs the `web` project, the job summary's coverage table lists its files, and `ci-ok` passes. Link the run in the PR.
5. Stop. The owner reviews and merges.
