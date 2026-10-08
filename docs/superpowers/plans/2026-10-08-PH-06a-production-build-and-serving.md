# PH-06a Production Build and Serving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pnpm build` writes the SPA with Brotli and gzip copies and fails above 200 KB of first-screen JavaScript; `pnpm start` runs the API with Node itself and serves that SPA on its own port, compressed, cached by path, with `index.html` for client-side routes; CI builds on every code PR.

**Architecture:** The API runs as `node src/server.ts` (Node's type stripping, no build step). A new required setting, `WEB_ROOT`, points at the built SPA; a new Fastify plugin, `apps/api/src/web/routes.ts`, serves it with `@fastify/static` (`preCompressed`, `wildcard: false`, `setHeaders` for `Cache-Control`) and a not-found handler that answers `index.html` for page paths and a JSON 404 for everything else. `apps/web/vite.config.ts` gains two inline plugins: `precompress()` writes `.br` and `.gz` copies after the build, and `firstScreenBudget()` sums the Brotli size of the entry chunk and its static imports and throws above the limit. A `build` job in CI runs `pnpm build` and `ci-ok` waits for it.

**Tech Stack:** Node 24.21 (type stripping stable since 24.12), Fastify 5.12, `@fastify/static` 10.1.5, Vite 8.3 (Rolldown), `node:zlib`, Vitest 5.0.3, pnpm 12.8.1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-08-PH-06a-production-build-and-serving-design.md`. Read it before starting; this plan argues from it.

## Contents

- [Global Constraints](#global-constraints)
- [Review Focus](#review-focus)
- [Facts checked, and what is not](#facts-checked-and-what-is-not)
- [Task 1: The API runs by type stripping](#task-1-the-api-runs-by-type-stripping)
- [Task 2: The WEB_ROOT setting](#task-2-the-web_root-setting)
- [Task 3: Serving the SPA](#task-3-serving-the-spa)
- [Task 4: The web build with precompression](#task-4-the-web-build-with-precompression)
- [Task 5: The first-screen budget](#task-5-the-first-screen-budget)
- [Task 6: The build job in CI](#task-6-the-build-job-in-ci)
- [Task 7: Docs, registers and final checks](#task-7-docs-registers-and-final-checks)
- [After tasks 1–7: open the PR](#after-tasks-17-open-the-pr)

## Global Constraints

- Branch `feat/ph-06a-production-build-and-serving`, already created, holding the spec commit; never commit to `main`; no worktree (`CLAUDE.md`, git workflow). Before any `git switch`, run `git status -sb`: another session may own the checkout.
- **Execution: subagent-driven, with a fresh reviewer per task.** After a task's review passes and it is committed, `git push` the branch and **pause** until the owner has reviewed that task; start the next task only when the owner says so. Tick each task's step boxes (`- [ ]` → `- [x]`) in this plan in the task's own commit.
- **No build step for the API:** production runs `node src/server.ts`; never add `tsc` emit, a bundler or `dist/` to `apps/api` (spec, decision 1). `dev` keeps `tsx watch`.
- **`engines.node` is exactly `">=24.12 <25"`** in the root `package.json`.
- **`WEB_ROOT` is required,** validated as a non-empty string, returned as `webRoot`, an absolute path made with `path.resolve` against the working directory. A folder that does not exist does not stop startup (spec, decision 2).
- **Cache headers, exactly:** files under `<root>/assets/`: `public, max-age=31536000, immutable`; every other file, `index.html` through the fallback included: `no-cache` (spec, decision 5).
- **Fallback rules, exactly** (spec, decision 6): a path equal to `/api` or starting with `/api/` → JSON 404; a last path segment containing a dot → JSON 404; any other GET or HEAD → `index.html`; any other method → JSON 404. The path is the URL without its query string. The JSON 404 body is Fastify's own: `{ statusCode: 404, error: "Not Found", message: "Route <METHOD>:<url> not found" }`.
- **Compression settings:** Brotli quality 11, gzip level 9; compressed extensions: `.html .js .css .svg .json .txt .webmanifest`.
- **Budget:** `200 * 1024` bytes of Brotli-compressed JavaScript, counted from the entry chunk through static `imports` only (spec, decision 4).
- **Packages:** add with `pnpm add` (never by editing `package.json`), so the lockfile follows. The only new package is `@fastify/static` (major 10) in `apps/api`'s `dependencies`.
- **Imports use `.ts` extensions.** Tests import `describe`, `it`, `expect` and the hooks from `"vitest"`: no globals. No `vi.mock` of our own modules ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 16).
- **TDD** for the config and the serving plugin: write the test, run it and see it fail for the expected reason, then write the code. The two Vite plugins have no unit tests (spec, "The first-screen budget"); they are checked by running the build.
- **`allowBuilds` is the owner's decision:** if `pnpm add` stops with `ERR_PNPM_IGNORED_BUILDS`, stop and show the owner the message and which dependency it names; the expected recommendation is `false` ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18).
- **PostgreSQL must be running** for `pnpm test` and `pnpm start`: `docker compose up -d --wait`. `apps/api/.env` must exist; from Task 2 on it must contain `WEB_ROOT` (Task 2, step 1).
- Every commit passes `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm test`. The pre-commit hook formats staged files; Markdown is never formatted by Prettier.
- Commit messages follow Conventional Commits with ADR 0009's nine types and the `scope-enum` list in `commitlint.config.js` (`api`, `web`, `ci`, `adr`, `plan`, `deps`, `roadmap` …; read the list before committing). **Every commit ends with these trailers, naming the model that actually wrote the commit** (the implementer's own model, which the controller names in the dispatch prompt), not the orchestrating model:
  ```
  Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0169uUQtKeK2YtNxYydhRNeb
  ```
- Docs follow `CLAUDE.md`'s writing style: niche acronyms spelled out on first use and added to the glossary; status icons before their word; requirements linked, never plain IDs; a `## Contents` section in documents over about 100 lines, kept in sync; an ADR that refines, extends, completes or revisits another is noted in three places.
- Never merge a PR, never run `gh workflow run`, never delete a remote branch; do not work around `.claude/settings.json` or the push hook.

## Review Focus

Inputs a person will meet that the spec does not spell out; each has its test or check in the owning task.

1. **An existing `apps/api/.env` without `WEB_ROOT`:** every developer's file predates the setting, and the test helpers parse it through `loadConfig`, so all database tests fail at once with `WEB_ROOT: missing`. Expected: the message names the setting (it does), the plan updates the local file (Task 2, step 1), and the setup guide tells the owner what to add (Task 7, step 4).
2. **A query string on a page or a file:** `/some/route?tab=a.b` must get `index.html` (the dot is in the query, not the path), and `/assets/missing.js?v=1` must stay a 404. Test: Task 3, "ignores the query string".
3. **`/api` without a trailing slash:** a mistyped API call must get the JSON 404, not the app's HTML with 200. Test: Task 3, the `it.each` of 404s.
4. **A real browser's `Accept-Encoding`** (`gzip, deflate, br, zstd`), not a single encoding: the server must pick `br`. Test: Task 3, the first test uses that header.
5. **The SPA not built yet** (`pnpm dev`, or a forgotten build before `pnpm start`): the API must start and answer `/api/health`, and `/` must be a 404, not a 500 or a crash. Test: Task 3, "keeps the API working when WEB_ROOT does not exist".

## Facts checked, and what is not

Checked on 2026-10-08 with throwaway probes outside the repository:

- **Node 24.21 runs `apps/api/src/app.ts` and imports `@szop/shared` by type stripping,** with no warning: pnpm's symlink resolves to `packages/shared/src/`, outside `node_modules`.
- **`@fastify/static` 10.1.5** (peer `fastify ^5.1.0`): `setHeaders` receives the Fastify **`reply`** (call `reply.header(…)`, not `res.setHeader`) and the path of the file actually sent (`…/index.html.br` when the Brotli copy is chosen); `preCompressed` sets `Content-Encoding` and adds `Vary: Accept-Encoding`; with `wildcard: false`, GET and HEAD routes exist per file and `/` serves `index.html`; `reply.sendFile("index.html")` from a not-found handler picks the compressed copy, runs `setHeaders` and answers 200; `/../package.json` answers 404; a missing root logs `"root" path "…" must exist` at warn level, the API's own routes keep working, and the fallback's `sendFile` then answers a plain-text 404 (no 500). Inside a not-found handler, `reply.callNotFound()` cannot reach Fastify's default handler, so the handler sends Fastify's 404 body itself.
- **Vite 8.3.3 with Rolldown:** the output chunks passed to `writeBundle` have `type`, `fileName`, `isEntry`, `imports`, `dynamicImports` and `code`; today's build is one entry chunk of 109.8 KB Brotli (131 KB gzip); `closeBundle` runs after `index.html` and the assets are written; `configResolved` gives `config.root` and `config.build.outDir`.
- **`apps/web`'s tsconfig accepts `node:zlib` and `node:fs/promises` imports** (Node's types come in through Vite's), and `Dirent.parentPath` exists.

**Not checked; each is a step below that runs the thing first:**

- Whether `closeBundle` runs when `writeBundle` throws (the budget failing), and whether its own error could then hide the budget's message: Task 5, step 3.
- Whether pnpm refuses an install script among `@fastify/static`'s dependencies: Task 3, step 1.
- Whether `actionlint` and `zizmor` are installed locally: Task 6, step 2.

---

### Task 1: The API runs by type stripping

**Files:**
- Modify: `package.json` (root), `apps/api/package.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `pnpm start` (root) → `pnpm --filter @szop/api start` → `node --env-file=.env src/server.ts`; `pnpm build` (root) → `pnpm -r build` (no package has a `build` script until Task 4, so it does nothing yet).

- [x] **Step 1: Raise the Node floor and add the root scripts**

In the root `package.json`, set `"engines": { "node": ">=24.12 <25" }`, and add to `"scripts"`, after `"dev"`:

```json
    "build": "pnpm -r build",
    "start": "pnpm --filter @szop/api start",
```

- [x] **Step 2: Add the API's start script**

In `apps/api/package.json`, add to `"scripts"`, after `"dev"`:

```json
    "start": "node --env-file=.env src/server.ts",
```

- [x] **Step 3: Check that pnpm accepts the engine range**

Run: `node --version && pnpm install --frozen-lockfile`
Expected: `v24.21.0` (or any 24.x from 24.12 on) and an install with no engine error. If the local Node is older than 24.12, stop and tell the owner to run `nvm install 24` (the setup guide's step).

- [x] **Step 4: Start the API the production way**

```bash
docker compose up -d --wait
pnpm start > /tmp/szop-start.log 2>&1 &
sleep 3
curl -s http://127.0.0.1:3000/api/health; echo
kill %1; sleep 1; cat /tmp/szop-start.log | head -5
```

Expected: `{"status":"ok","database":{"status":"up","schemaVersion":"0000_init"}}`; the log is JSON lines (no `pino-pretty`) with `migrations applied` and `Server listening`, and no `ExperimentalWarning`. If `kill %1` leaves the API running (pnpm's child survives), run `pkill -f "node --env-file=.env src/server.ts"`.

- [x] **Step 5: Run the checks**

Run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`
Expected: all pass.

- [x] **Step 6: Tick this task's boxes and commit**

```bash
git add package.json apps/api/package.json docs/superpowers/plans/2026-10-08-PH-06a-production-build-and-serving.md
git commit -F - <<'EOF'
build(api): run the API by Node's type stripping in production

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0169uUQtKeK2YtNxYydhRNeb
EOF
```

---

### Task 2: The WEB_ROOT setting

**Files:**
- Modify: `apps/api/src/config.ts`, `apps/api/src/config.test.ts`, `apps/api/.env.example`, `apps/api/src/health/routes.test.ts`; the git-ignored `apps/api/.env` (local only, not committed)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `Config.webRoot: string` (absolute), read from `WEB_ROOT`. Task 3 passes `config.webRoot` to the serving plugin.

- [x] **Step 1: Add WEB_ROOT to the local .env first**

The test helper `src/test/database.ts` parses `apps/api/.env` with `loadConfig`; once `WEB_ROOT` is required, a file without it fails every database test.

```bash
grep -q '^WEB_ROOT=' apps/api/.env || printf '\n# The built SPA, written by pnpm build.\nWEB_ROOT=../web/dist\n' >> apps/api/.env
grep WEB_ROOT apps/api/.env
```

Expected: `WEB_ROOT=../web/dist`.

- [x] **Step 2: Write the failing config tests**

In `apps/api/src/config.test.ts`:

- Add `import { resolve } from "node:path";` as the first import.
- Add `WEB_ROOT: "../web/dist",` as the last entry of `valid`.
- In "returns the typed config for a valid environment", add `webRoot: resolve("../web/dist"),` after `logLevel: "info",` in the expected object.
- Add `"WEB_ROOT"` to the list of the "rejects an empty %s" `it.each`.
- Add, after "ignores variables it does not know":

```ts
  it("resolves a relative WEB_ROOT against the working directory", () => {
    expect(loadConfig({ ...valid, WEB_ROOT: "../web/dist" }).webRoot).toBe(
      resolve(process.cwd(), "../web/dist"),
    );
  });

  it("keeps an absolute WEB_ROOT as it is", () => {
    expect(loadConfig({ ...valid, WEB_ROOT: "/srv/szop/web" }).webRoot).toBe(
      "/srv/szop/web",
    );
  });
```

`names` is built from `valid`, so "names %s when it is missing" and "lists every problem at once" cover `WEB_ROOT` without further change.

- [x] **Step 3: Run the tests and see them fail**

Run: `pnpm test --project api src/config.test.ts`
Expected: FAIL: "names WEB_ROOT when it is missing", "rejects an empty WEB_ROOT", the two new tests and the typed-config test fail (`webRoot` is `undefined`).

- [x] **Step 4: Implement the setting**

In `apps/api/src/config.ts`:

- Add `import { resolve } from "node:path";` before the `zod` import.
- In `envSchema`, after the `DATABASE_PASSWORD` line, add:

```ts
  // The built SPA (ADR 0023, decision 2). A folder that does not exist yet,
  // as in pnpm dev, is not an error: the API logs a warning and serves its
  // own routes only.
  WEB_ROOT: z.string().min(1),
```

- In `interface Config`, after `database: DatabaseSettings;`, add:

```ts
  // Absolute: a relative WEB_ROOT is resolved against the working directory.
  webRoot: string;
```

- In the object `loadConfig` returns, after the `database: { … },` block, add `webRoot: resolve(data.WEB_ROOT),`.

- [x] **Step 5: Run the config tests and see them pass**

Run: `pnpm test --project api src/config.test.ts`
Expected: PASS.

- [x] **Step 6: Update the other config literal and the example file**

In `apps/api/src/health/routes.test.ts`, add to the `config` literal, after the `database` line:

```ts
  // Not served here: the SPA's serving is tested in web/routes.test.ts.
  webRoot: "/nonexistent/szop-web-root",
```

In `apps/api/.env.example`, append:

```
# The built web app, which `pnpm build` writes to apps/web/dist. Relative
# paths are resolved against the folder the API starts in (apps/api through
# pnpm). If the folder does not exist yet, as in `pnpm dev`, the API logs a
# warning and serves its own routes only (ADR 0023).
WEB_ROOT=../web/dist
```

- [x] **Step 7: Run every check**

Run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`
Expected: all pass. `typecheck` would have caught any other `Config` literal; there is none today.

- [x] **Step 8: Tick this task's boxes and commit**

```bash
git add apps/api/src/config.ts apps/api/src/config.test.ts apps/api/.env.example apps/api/src/health/routes.test.ts docs/superpowers/plans/2026-10-08-PH-06a-production-build-and-serving.md
git commit -F - <<'EOF'
feat(api): add the WEB_ROOT setting

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0169uUQtKeK2YtNxYydhRNeb
EOF
```

Tell the owner in the task summary: their own `apps/api/.env` needs `WEB_ROOT=../web/dist` (done on this machine in step 1).

---

### Task 3: Serving the SPA

**Files:**
- Create: `apps/api/src/web/routes.ts`, `apps/api/src/web/routes.test.ts`, `apps/api/src/test/web-root.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/package.json` and `pnpm-lock.yaml` (through `pnpm add`)

**Interfaces:**
- Consumes: `Config.webRoot` (Task 2); `buildApp({ config, db })` from `app.ts`; `useTestDatabase()` from `src/test/database.ts`.
- Produces: `webRoutes(app: FastifyInstance, options: { root: string }): Promise<void>`, registered in `buildApp`; `useWebRoot(): { readonly path: string }` and `webRootFiles` in `src/test/web-root.ts`.

- [x] **Step 1: Add the dependency**

Run: `pnpm --filter @szop/api add @fastify/static@^10.1.5`
Expected: `@fastify/static` under `dependencies` in `apps/api/package.json`, no `ERR_PNPM_IGNORED_BUILDS` (if it appears, stop: see Global Constraints).

- [x] **Step 2: Write the fixture helper**

Create `apps/api/src/test/web-root.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { afterAll, beforeAll } from "vitest";

// A built SPA in miniature: what apps/web's build writes, a file and its .br
// and .gz copies (ADR 0023, decision 8).
export const webRootFiles = {
  "index.html": '<!doctype html><title>Szop</title><div id="root"></div>',
  "assets/index-abc123.js": 'console.log("szop");',
} as const;

// Gives a test file a fresh copy in a temporary folder, removed afterwards.
// Call it at the top of the file; use `webRoot.path` inside the tests.
export function useWebRoot(): { readonly path: string } {
  let dir: string | undefined;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "szop-web-root-"));
    for (const [name, content] of Object.entries(webRootFiles)) {
      const file = join(dir, name);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, content);
      await writeFile(`${file}.br`, brotliCompressSync(content));
      await writeFile(`${file}.gz`, gzipSync(content));
    }
  });
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });
  return {
    get path(): string {
      if (!dir) throw new Error("useWebRoot's folder exists only inside tests");
      return dir;
    },
  };
}
```

- [x] **Step 3: Write the failing tests**

Create `apps/api/src/web/routes.test.ts`:

```ts
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { Config } from "../config.ts";
import { useTestDatabase } from "../test/database.ts";
import { useWebRoot, webRootFiles } from "../test/web-root.ts";

function configFor(webRoot: string): Config {
  return {
    host: "127.0.0.1",
    port: 3000,
    logLevel: "silent",
    // Not used: each test passes its own database to buildApp.
    database: { host: "", port: 1, name: "", user: "", password: "" },
    webRoot,
  };
}

const immutable = "public, max-age=31536000, immutable";

describe("serving the SPA", () => {
  const database = useTestDatabase();
  const webRoot = useWebRoot();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  function start(root = webRoot.path): FastifyInstance {
    app = buildApp({ config: configFor(root), db: database.db });
    return app;
  }

  it("sends index.html as Brotli to a browser, never cached", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/",
      headers: { "accept-encoding": "gzip, deflate, br, zstd" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-encoding"]).toBe("br");
    expect(response.headers["content-type"]).toMatch(/^text\/html/);
    expect(response.headers["cache-control"]).toBe("no-cache");
    expect(response.headers.vary).toMatch(/accept-encoding/i);
    expect(brotliDecompressSync(response.rawPayload).toString()).toBe(
      webRootFiles["index.html"],
    );
  });

  it("sends a fingerprinted asset as gzip, cached for a year", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/assets/index-abc123.js",
      headers: { "accept-encoding": "gzip" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(response.headers["content-type"]).toMatch(/javascript/);
    expect(response.headers["cache-control"]).toBe(immutable);
    expect(gunzipSync(response.rawPayload).toString()).toBe(
      webRootFiles["assets/index-abc123.js"],
    );
  });

  it("sends the plain file to a client that accepts no encoding", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/assets/index-abc123.js",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers["cache-control"]).toBe(immutable);
    expect(response.body).toBe(webRootFiles["assets/index-abc123.js"]);
  });

  it("answers a client-side route with index.html, never cached", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/some/route",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^text\/html/);
    expect(response.headers["cache-control"]).toBe("no-cache");
    expect(response.body).toBe(webRootFiles["index.html"]);
  });

  it("answers HEAD on a client-side route like GET, without a body", async () => {
    const response = await start().inject({
      method: "HEAD",
      url: "/some/route",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^text\/html/);
    expect(response.body).toBe("");
  });

  it("ignores the query string when it decides", async () => {
    start();

    const page = await app.inject({ method: "GET", url: "/some/route?tab=a.b" });
    expect(page.statusCode).toBe(200);
    expect(page.body).toBe(webRootFiles["index.html"]);

    const file = await app.inject({
      method: "GET",
      url: "/assets/missing.js?v=1",
    });
    expect(file.statusCode).toBe(404);
  });

  it.each([
    ["GET", "/api/nope"],
    ["GET", "/api"],
    ["GET", "/assets/missing.js"],
    ["GET", "/favicon.ico"],
    ["POST", "/some/route"],
  ] as const)("answers %s %s with Fastify's JSON 404", async (method, url) => {
    const response = await start().inject({ method, url });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.json()).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${method}:${url} not found`,
    });
  });

  it("still routes /api/health to its handler", async () => {
    const response = await start().inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("keeps the API working when WEB_ROOT does not exist", async () => {
    start("/nonexistent/szop-web-root");

    const health = await app.inject({ method: "GET", url: "/api/health" });
    expect(health.statusCode).toBe(200);

    const page = await app.inject({ method: "GET", url: "/" });
    expect(page.statusCode).toBe(404);
  });
});
```

- [x] **Step 4: Run the tests and see them fail**

Run: `pnpm test --project api src/web/routes.test.ts`
Expected: FAIL in the six tests that need a file or the fallback (Brotli, gzip, plain file, client-side route, HEAD, query string), each with a 404 where 200 is expected, since nothing serves files yet. The JSON 404s, "still routes /api/health" and "keeps the API working" already pass: Fastify's default 404 has the same body, which is why the handler must copy it exactly. Check that the failures are 404s, not import or setup errors.

- [x] **Step 5: Write the plugin**

Create `apps/api/src/web/routes.ts`:

```ts
import { join, sep } from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

export interface WebRoutesOptions {
  root: string;
}

// Vite puts a content hash in the name of every file under assets/, so a
// changed file gets a new name and the old one can be cached for good.
const immutable = "public, max-age=31536000, immutable";

// Serves the built SPA (ADR 0013, decision 5; ADR 0023, decisions 5 and 6):
// the .br or .gz copy the request accepts, cache headers by path, and
// index.html for any path that is a page of the app.
export async function webRoutes(
  app: FastifyInstance,
  { root }: WebRoutesOptions,
): Promise<void> {
  const assets = join(root, "assets") + sep;

  await app.register(fastifyStatic, {
    root,
    preCompressed: true,
    // One route per file found at startup; every other path reaches the
    // not-found handler below.
    wildcard: false,
    // The path is the file actually sent, such as index.html.br.
    setHeaders(reply, path) {
      reply.header(
        "cache-control",
        path.startsWith(assets) ? immutable : "no-cache",
      );
    },
  });

  app.setNotFoundHandler((request, reply) => {
    const [path = ""] = request.url.split("?", 1);
    const lastSegment = path.slice(path.lastIndexOf("/") + 1);
    const isApi = path === "/api" || path.startsWith("/api/");
    const isPage =
      (request.method === "GET" || request.method === "HEAD") &&
      !isApi &&
      !lastSegment.includes(".");
    if (isPage) {
      // React Router renders the path; setHeaders above marks it no-cache.
      return reply.sendFile("index.html");
    }
    // The body of Fastify's own 404, which this handler replaces: an API
    // call or a missing file never gets the app's HTML.
    return reply.code(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method}:${request.url} not found`,
    });
  });
}
```

- [x] **Step 6: Register it in buildApp**

In `apps/api/src/app.ts`, add `import { webRoutes } from "./web/routes.ts";` after the `healthRoutes` import, and after the `healthRoutes` registration add:

```ts
  // The built SPA, and index.html for the app's own paths. Registered last:
  // its not-found handler answers every path no route above claims.
  app.register(webRoutes, { root: config.webRoot });
```

- [x] **Step 7: Run the tests and see them pass**

Run: `pnpm test --project api src/web/routes.test.ts`
Expected: PASS, 13 tests. If a header differs from the probe's findings (Facts checked), read `@fastify/static`'s README for 10.x before changing the plugin, and report the difference.

- [x] **Step 8: Run every check**

Run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`
Expected: all pass. If ESLint's `strictTypeChecked` flags the not-found handler's return values, adjust the code, not the rules.

- [x] **Step 9: Tick this task's boxes and commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/app.ts apps/api/src/web apps/api/src/test/web-root.ts docs/superpowers/plans/2026-10-08-PH-06a-production-build-and-serving.md
git commit -F - <<'EOF'
feat(api): serve the built SPA, precompressed and cached

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0169uUQtKeK2YtNxYydhRNeb
EOF
```

---

### Task 4: The web build with precompression

**Files:**
- Modify: `apps/web/package.json`, `apps/web/vite.config.ts`, `.gitignore`, `.prettierignore`, `eslint.config.js`

**Interfaces:**
- Consumes: the root `build` script (Task 1); the serving plugin (Task 3).
- Produces: `apps/web/dist/` with `.br` and `.gz` copies; the functions `brotli(data)` and `precompress()` in `vite.config.ts`, which Task 5 reuses (`brotli`).

- [ ] **Step 1: Keep `dist/` out of git and the tools first**

So no generated file is ever staged or linted:

- `.gitignore`: after the `# Dependencies installed by pnpm` block, add:

```
# The web app's production build (pnpm build)
dist/
```

- `.prettierignore`: after the `coverage/` block, add:

```

# Generated by pnpm build.
dist/
```

- `eslint.config.js`: in `globalIgnores`, add `"**/dist/"`, and extend the comment above it: `coverage/ holds Vitest's generated report; dist/ holds the web app's build.`

- [ ] **Step 2: Add the build script**

In `apps/web/package.json`, add to `"scripts"`, after `"dev"`: `"build": "vite build",`

- [ ] **Step 3: Add the precompress plugin**

Replace `apps/web/vite.config.ts` with:

```ts
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Brotli at its strongest: slow, but it runs once per build, not per request.
function brotli(data: Buffer | string): Buffer {
  return brotliCompressSync(data, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  });
}

// Text files only: images and fonts are compressed already.
const compressible = /\.(html|js|css|svg|json|txt|webmanifest)$/;

// Writes a .br and a .gz copy next to every text file of the build, which
// @fastify/static sends by the request's Accept-Encoding (ADR 0013,
// decision 5; ADR 0023, decision 3).
function precompress(): Plugin {
  let outDir = "";
  return {
    name: "szop:precompress",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // After every file is written, those copied from public/ included.
    async closeBundle() {
      const entries = await readdir(outDir, {
        recursive: true,
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (!entry.isFile() || !compressible.test(entry.name)) continue;
        const file = join(entry.parentPath, entry.name);
        const data = await readFile(file);
        await writeFile(`${file}.br`, brotli(data));
        await writeFile(`${file}.gz`, gzipSync(data, { level: 9 }));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), precompress()],
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

- [ ] **Step 4: Build and look at the output**

```bash
pnpm build
find apps/web/dist -type f | sort
git status --short
```

Expected: the build succeeds; `dist/index.html`, `dist/index.html.br`, `dist/index.html.gz`, and `dist/assets/index-<hash>.js` with its `.br` and `.gz`; `git status` shows only the four modified files of this task (no `dist/`).

- [ ] **Step 5: Serve the build from the API**

```bash
pnpm start > /tmp/szop-start.log 2>&1 &
sleep 3
curl -s -o /dev/null -D - -H 'accept-encoding: br' http://127.0.0.1:3000/ | grep -iE '^(HTTP|content-encoding|cache-control|vary)'
curl -s -o /dev/null -D - -H 'accept-encoding: br' "http://127.0.0.1:3000$(ls apps/web/dist/assets/*.js | head -1 | sed 's|apps/web/dist||')" | grep -iE '^(HTTP|content-encoding|cache-control)'
curl -s http://127.0.0.1:3000/some/route | head -c 120; echo
pkill -f "node --env-file=.env src/server.ts"
```

Expected: `/` → `200`, `content-encoding: br`, `cache-control: no-cache`, `vary: accept-encoding`; the asset → `200`, `br`, `public, max-age=31536000, immutable`; `/some/route` → the HTML of `index.html`.

- [ ] **Step 6: Run every check with `dist/` present**

Run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`
Expected: all pass; ESLint and Prettier do not look inside `apps/web/dist/`.

- [ ] **Step 7: Tick this task's boxes and commit**

```bash
git add .gitignore .prettierignore eslint.config.js apps/web/package.json apps/web/vite.config.ts docs/superpowers/plans/2026-10-08-PH-06a-production-build-and-serving.md
git commit -F - <<'EOF'
build(web): add the production build with precompressed copies

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0169uUQtKeK2YtNxYydhRNeb
EOF
```

---

### Task 5: The first-screen budget

**Files:**
- Modify: `apps/web/vite.config.ts`

**Interfaces:**
- Consumes: `brotli(data)` and `precompress()` in `vite.config.ts` (Task 4).
- Produces: `firstScreenBudget(limitBytes: number): Plugin`; the build's output line `first-screen JavaScript: <n> KB Brotli of 200.0 KB (<k> chunks)`, which Task 6's job shows in its log.

- [ ] **Step 1: Add the plugin**

In `apps/web/vite.config.ts`, after `precompress()`, add:

```ts
// NFR-3: the JavaScript the first screen needs is at most 200 KB compressed
// (ADR 0013, decision 4). It is the entry chunk and every chunk it imports
// statically; chunks loaded later through import() do not count. Measured
// in Brotli, what browsers download (ADR 0023, decision 4).
function firstScreenBudget(limitBytes: number): Plugin {
  return {
    name: "szop:first-screen-budget",
    apply: "build",
    writeBundle(_options, bundle) {
      const chunks = new Map(
        Object.values(bundle)
          .filter((output) => output.type === "chunk")
          .map((chunk) => [chunk.fileName, chunk]),
      );
      const entry = [...chunks.values()].find((chunk) => chunk.isEntry);
      if (!entry) throw new Error("first-screen budget: no entry chunk");

      const counted = new Set<string>();
      const queue = [entry.fileName];
      let bytes = 0;
      for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
        const chunk = chunks.get(name);
        if (!chunk || counted.has(name)) continue;
        counted.add(name);
        bytes += brotli(chunk.code).length;
        queue.push(...chunk.imports);
      }

      const kb = (n: number): string => (n / 1024).toFixed(1);
      const summary = `first-screen JavaScript: ${kb(bytes)} KB Brotli of ${kb(limitBytes)} KB (${String(counted.size)} chunks)`;
      if (bytes > limitBytes) {
        throw new Error(`${summary}: over budget (NFR-3)`);
      }
      console.log(summary);
    },
  };
}
```

and register it: `plugins: [react(), precompress(), firstScreenBudget(200 * 1024)],`.

- [ ] **Step 2: Build and read the line**

Run: `pnpm build 2>&1 | grep -E "first-screen|error|built in"`
Expected: `first-screen JavaScript: 109.8 KB Brotli of 200.0 KB (1 chunks)` (the size may differ by a few tenths) and `built in …`.

- [ ] **Step 3: Prove the failure path once, by hand**

Temporarily change the call to `firstScreenBudget(50 * 1024)`, then:

```bash
pnpm build; echo "exit $?"
```

Expected: the build fails with `first-screen JavaScript: 109.8 KB Brotli of 50.0 KB (1 chunks): over budget (NFR-3)` and a non-zero exit. Check that this message is the one shown: if `closeBundle` of `precompress()` also ran and its own error (for example `ENOENT` on the output folder) hides it, make `precompress()` skip its work when the folder is missing, and say so in the task summary. Record the exact output for the PR's *How it was tested*. **Restore `200 * 1024`**, and check with `git diff apps/web/vite.config.ts | grep firstScreenBudget` that the registration reads `200 * 1024`.

- [ ] **Step 4: Run every check**

Run: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`
Expected: all pass.

- [ ] **Step 5: Tick this task's boxes and commit**

```bash
git add apps/web/vite.config.ts docs/superpowers/plans/2026-10-08-PH-06a-production-build-and-serving.md
git commit -F - <<'EOF'
build(web): fail the build above 200 KB of first-screen JavaScript

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0169uUQtKeK2YtNxYydhRNeb
EOF
```

---

### Task 6: The build job in CI

**Files:**
- Modify: `.github/workflows/ci.yml`, `docs/development/ci-cd.md`

**Interfaces:**
- Consumes: the root `pnpm build` (Tasks 1, 4, 5).
- Produces: a `build` job that `ci-ok` needs.

- [ ] **Step 1: Add the job**

In `.github/workflows/ci.yml`, after the `test` job and before `commits`, add:

```yaml
  build:
    name: build
    needs: changes
    if: needs.changes.outputs.code == 'true'
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup
      # The production build of the web app. It fails when the first screen
      # needs more than 200 KB of JavaScript (NFR-3, ADR 0023, decision 4);
      # the log shows the size.
      - run: pnpm build
```

and change `ci-ok`'s `needs` to `[changes, lint, typecheck, test, build, commits, workflows]`.

- [ ] **Step 2: Lint the workflow**

Run: `command -v actionlint && actionlint; command -v zizmor && zizmor .github/workflows/ci.yml`
Expected: no findings from the tools that are installed. If neither is installed, say so in the task summary: the `workflows` job checks them in CI after the push.

- [ ] **Step 3: Document the job**

In `docs/development/ci-cd.md` (read it first):

- *The jobs*: a `build` row or paragraph in the existing format: runs `pnpm build` (the web app's production build with its precompressed copies); fails when the first screen's JavaScript exceeds 200 KB Brotli ([NFR-3](../requirements/functional-requirements.md#nfr-3), [ADR 0023](../decisions/0023-production-build-and-serving-details.md)); skipped when only Markdown changed; no database.
- *ci-ok and the required checks*: `build` is among the jobs `ci-ok` waits for; the required check is still only `ci-ok`, so no GitHub setting changes.
- *Reading a failed run*: a failed `build` with `over budget (NFR-3)`: the log line names the size; run `pnpm build` locally, find what grew (a new dependency, an import that should be lazy), and either shrink it or, with a reason, change the budget through an ADR ([ADR 0013](../decisions/0013-visual-design.md), decision 4: "adjusted with a reason when real measurements exist").
- Keep `## Contents` in sync if headings change.

The ADR link resolves once Task 7 adds the file; the link check runs in Task 7.

- [ ] **Step 4: Tick this task's boxes, commit and push**

```bash
git add .github/workflows/ci.yml docs/development/ci-cd.md docs/superpowers/plans/2026-10-08-PH-06a-production-build-and-serving.md
git commit -F - <<'EOF'
ci: build the web app and check its size on every code PR

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0169uUQtKeK2YtNxYydhRNeb
EOF
git push
```

There is no PR yet, so CI does not run on the push (`ci.yml` runs on pull requests and on `main`). The job is proved on the PR (After tasks 1–7, step 4).

---

### Task 7: Docs, registers and final checks

**Files:**
- Create: `docs/decisions/0023-production-build-and-serving-details.md`
- Modify: `docs/decisions/0005-development-environment.md`, `0007-testing-strategy.md`, `0010-ci-cd.md`, `0013-visual-design.md`, `0019-api-skeleton-details.md` (status lines and decision cells), `docs/architecture/architecture.md`, `docs/architecture/stack-overview.md`, `docs/architecture/threat-model.md`, `docs/development/setup.md`, `docs/development/testing.md`, `docs/development/tools/vite.md`, `docs/development/tools/node-and-nvm.md`, `docs/development/tools/tsx.md`, `docs/glossary.md`, `README.md`, `docs/open-points.md`, `docs/roadmap.md`

**Interfaces:**
- Consumes: the finished code and what Tasks 1 to 6 reported (any difference from the probes, the budget's failure output, any `allowBuilds` entry, whether `precompress()` needed a guard).
- Produces: the records the PR links to, and the state the PR is opened from.

- [ ] **Step 1: Write ADR 0023**

`docs/decisions/0023-production-build-and-serving-details.md`, in the shape of [ADR 0021](../../decisions/0021-spa-skeleton-details.md) (read it first):

- Title `# ADR 0023 — Production build and serving details`; `- **Status:** ✅ Accepted`; `- **Date:** 2026-10-08`;
- `- **Refines:** [ADR 0005](0005-development-environment.md), decisions 8 and 9 (how packages/shared reaches production; tsx for development only, see decision 1); [ADR 0007](0007-testing-strategy.md), decision 15 (the API the E2E tests start is run by type stripping, see decision 1)`;
- `- **Extends:** [ADR 0010](0010-ci-cd.md), decision 7 (the build job, see decision 7)`;
- `- **Completes:** [ADR 0013](0013-visual-design.md), decisions 4 and 5 (how the budget is measured and enforced, and which files are cached how, see decisions 3 to 6)`;
- `- **Revisits:** [ADR 0019](0019-api-skeleton-details.md), decision 6 (it kept a tsc build open for this phase; there is none, see decision 1)`.
- `## Context`: [PH-06a](../roadmap.md#ph-06a-production-build-and-serving), split from PH-06 (retired); the ADRs above set the direction; its brainstorm and the [spec](../superpowers/specs/2026-10-08-PH-06a-production-build-and-serving-design.md) settled the details.
- `## Decisions`: the spec's decisions 1 to 8, copied with their wording, links rewritten from `../../decisions/X` to `X` and from `../../` to `../`. Add what the implementation settled, in the cells of the decisions it touches: in decision 5, that `setHeaders` sees the path of the file actually sent (`.br` or `.gz` included); in decision 6, that the handler sends Fastify's 404 body itself, since a not-found handler cannot hand over to Fastify's default; anything Tasks 1 to 6 reported differently from the plan.
- `## Consequences`: production needs Node 24.12 or later; PH-08's image keeps the symlinked workspace and copies `drizzle/` (OP-084, [OP-078](../open-points.md#op-078)); every developer's `apps/api/.env` needs `WEB_ROOT`; a client-side path whose last segment has a dot (`/lists/milk.2`) gets a 404 on reload, so routes must not end in such segments; a build is served after a restart, since files are found at startup; the plugins in `vite.config.ts` have no unit tests and are checked by the `build` job; the open points closed, moved and added (step 6); the living docs.

- [ ] **Step 2: Note the cross-references in the earlier ADRs**

In the three places `CLAUDE.md` asks for (ADR 0023's header is step 1). Read each file's status line and the decision's cell first, and add in the same style as the notes already there (code formatting in the real cells):

- ADR 0005, status line: append `; decisions 8 and 9 refined by [ADR 0023](0023-production-build-and-serving-details.md) (production runs the source by type stripping)`. Decision 8's cell, at the bottom: `<br>✏️ **Refined by [ADR 0023](0023-production-build-and-serving-details.md), decision 1:** production runs node src/server.ts by Node's type stripping, so packages/shared reaches production from source too; nothing is compiled.` Decision 9's cell: `<br>✏️ **Refined by [ADR 0023](0023-production-build-and-serving-details.md), decision 1:** tsx is for development only; production uses Node's type stripping, stable since Node 24.12.`
- ADR 0007, status line: append `; decision 15 refined by [ADR 0023](0023-production-build-and-serving-details.md) (the API is run by type stripping, not compiled)`. Decision 15's cell: `<br>✏️ **Refined by [ADR 0023](0023-production-build-and-serving-details.md), decision 1:** "the compiled API" is the API run by Node's type stripping, serving the SPA built by pnpm build.`
- ADR 0010, status line: append `; decision 7 extended by [ADR 0023](0023-production-build-and-serving-details.md) (the build job)`. Decision 7's cell: `<br>➕ **Extended by [ADR 0023](0023-production-build-and-serving-details.md), decision 7:** a build job runs pnpm build, which fails above the first-screen budget; ci-ok needs it.`
- ADR 0013, status line: append `; decisions 4 and 5 completed by [ADR 0023](0023-production-build-and-serving-details.md) (the budget's plugin and the serving rules)`. Decision 4's cell: `<br>🧩 **Completed by [ADR 0023](0023-production-build-and-serving-details.md), decision 4:** an inline Vite plugin sums the Brotli size of the entry chunk and its static imports and fails the build above 200 KB; CI's build job runs it.` Decision 5's cell: `<br>🧩 **Completed by [ADR 0023](0023-production-build-and-serving-details.md), decisions 3, 5 and 6:** an inline Vite plugin writes the copies; files under /assets/ are immutable for a year, everything else no-cache; page paths get index.html, API paths and missing files a JSON 404.`
- ADR 0019, status line: append `; decision 6 revisited by [ADR 0023](0023-production-build-and-serving-details.md) (no tsc build)`. Decision 6's cell: `<br>🔍 **Revisited by [ADR 0023](0023-production-build-and-serving-details.md), decision 1:** the build this decision kept open is not needed: Node runs the .ts specifiers directly.`

- [ ] **Step 3: Update the architecture, the stack overview and the threat model**

`docs/architecture/architecture.md` (read sections 1, 2 and 5 first): in *Code structure* of the backend, `web/routes.ts` serves the built SPA; a short paragraph (in section 2 or 5, wherever serving the SPA is described today) on how the API serves it: `WEB_ROOT`, the precompressed copies, the cache rules, the fallback rules, and that production runs `node src/server.ts` by type stripping.

`docs/architecture/stack-overview.md`: correct the tsx paragraph in section 6 (it says Node's stripping "has rough edges with workspace packages"; now: tsx for development because of its watch mode, Node's own type stripping in production, stable since 24.12, and why that needs no build); section 15 (*How fast is fast enough*) gains, for a learner: precompression (compress once at build time with the strongest settings, the server picks by `Accept-Encoding`), fingerprinted files and `immutable` versus `no-cache` with ETags, and the first-screen budget measured in CI; section 4 (*Lifecycle of opening the app*) mentions the fallback that makes a reload of any client-side path work, if it describes the first request.

`docs/architecture/threat-model.md` (read *Entry points, checked against STRIDE* first): add the static files as an entry point in the table's format: anyone, through GET and HEAD on any non-API path; guarded by `@fastify/static`, which refuses paths that leave `WEB_ROOT`, lists no folders and serves no dotfiles; files are found at startup, so nothing written later is served; API paths never fall back to HTML.

- [ ] **Step 4: Update the guides and tool pages**

`docs/development/setup.md`: section 3 (*nvm and Node*): Node 24.12 or later is required (type stripping); section 9 gains a subsection, or a closing part, *Run the production build*: `pnpm build`, then `pnpm start` (PostgreSQL running), open `http://localhost:3000`; what `WEB_ROOT` in `apps/api/.env` is, and **that an existing `.env` needs the line `WEB_ROOT=../web/dist` added** (copy it from `.env.example`); that `pnpm dev` logs a warning about the missing folder until the first build, which is harmless. Section 11 (*Coming later*): drop the production build line. Keep `## Contents` in sync.

`docs/development/testing.md`: *Writing an API test* gains a short part on the serving tests: `useWebRoot()` writes a miniature build into a temporary folder, with `.br` and `.gz` copies, so the tests never depend on running `pnpm build`; `rawPayload` and `brotliDecompressSync` to check a compressed body. Keep `## Contents` in sync.

`docs/development/tools/vite.md`: replace "There is no `build` script yet" with the production build: `pnpm build` writes `apps/web/dist/`; the two plugins in `vite.config.ts`, each explained (what, when it runs, why inline); where `dist/` is ignored. Also check its first paragraph for the PH-06a link set in the spec commit.

`docs/development/tools/node-and-nvm.md`: the engines range `>=24.12 <25` and why (type stripping became stable in 24.12, and production relies on it); the paragraph on type stripping now says production uses it too.

`docs/development/tools/tsx.md`: tsx runs the API in development only (watch mode); production runs `node src/server.ts` ([ADR 0023](../../decisions/0023-production-build-and-serving-details.md)).

`README.md`, *Development*: one sentence that `pnpm build` and `pnpm start` run the app the production way on `http://localhost:3000`.

- [ ] **Step 5: Update the glossary**

`docs/glossary.md`, alphabetically under its existing sections, where missing (search first): **Brotli** (a compression format for the web, smaller than gzip, sent when the browser accepts `br`), **Content hash (fingerprint)** (a short hash of a file's content put in its name by the build, so a changed file gets a new name and the old one can be cached forever), **ETag** (a version tag of a response; the browser sends it back to ask whether its copy is still current, and gets `304 Not Modified` if so), **Precompression** (writing compressed copies at build time, so the server never compresses per request), **SPA fallback** (answering the app's own paths with `index.html`, so the client-side router can render them on a reload). Update **Type stripping**: production runs this way too ([ADR 0023](decisions/0023-production-build-and-serving-details.md)); it no longer says only the push hook does.

- [ ] **Step 6: Update the open points**

In `docs/open-points.md` (group `### PH-06a Production build and serving`), with the branch link `https://github.com/luiki-dev/szop/tree/feat/ph-06a-production-build-and-serving` until the PR exists:

- **OP-007**, **OP-058**, **OP-059:** status `✅ Closed` with a link to ADR 0023: OP-007 by decision 1, OP-058 by decisions 3, 5 and 6, OP-059 by decisions 4 and 7. Move each to `## Closed`, in that section's format (read it first).
- **OP-013:** the PH-06a part gets `✅ Done (branch link)`; move the entry to `### PH-08 Container image` and drop `OP-013` from PH-08's `Also:` line, since the entry now sits there.
- **OP-078:** rewrite its text for what is true now: the API is not compiled; Node runs `apps/api/src/db/migrate.ts` itself, so `../../drizzle` stays correct as long as the image keeps `apps/api/` whole; PH-08's image must copy `drizzle/` with `meta/_journal.json`, and test the image's startup or catch a missing journal (`buildApp` runs outside the startup `try`). Add `- **Since PH-06a:** no build step (ADR 0023, decision 1); the PH-06a part is settled by design.` Move it to `### PH-08 Container image` and drop it from PH-08's `Also:` line.
- New, under `### PH-08 Container image`: `#### OP-084` **Keep the symlinked workspace in the container image.** Node refuses to strip types in files under `node_modules`; `@szop/shared` works because pnpm links it to `packages/shared/src/`. An image built with `pnpm deploy`, or any step that copies workspace packages into `node_modules`, makes the API fail at startup with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` once it imports `@szop/shared`. The image copies the workspace as it is and installs production dependencies with `pnpm install --prod --frozen-lockfile`. Source: [ADR 0023](decisions/0023-production-build-and-serving-details.md), decision 1. Status: ⬜ Open.
- Check that PH-06a's group now holds only its heading and its roadmap link, as PH-05's does.

- [ ] **Step 7: Update the roadmap**

In `docs/roadmap.md`: the PH-06a row's Plan column links `superpowers/plans/2026-10-08-PH-06a-production-build-and-serving.md` (the plan commit set it; check). PH-06a's *Delivers* gains `([ADR 0023](decisions/0023-production-build-and-serving-details.md))`. The row stays `🚧 In progress`; the README diagram stays at ◐ until the PR.

- [ ] **Step 8: The end-to-end check in Chrome**

```bash
docker compose up -d --wait
pnpm build
pnpm start > /tmp/szop-start.log 2>&1 &
```

Then, through the `chrome-devtools-win` MCP server (`~/.claude/CLAUDE.md`: Windows Chrome on port 9222; if `curl -s http://127.0.0.1:9222/json/version` returns nothing, ask the controller to start it), open `http://localhost:3000`, and check and record for the PR:

- the page shows `API: ok`, `Database: up` and the schema version;
- in the network requests: the document and the JS have `content-encoding: br`; the JS has `cache-control: public, max-age=31536000, immutable`; the document has `cache-control: no-cache`;
- navigate to `http://localhost:3000/some/route`: the app loads (React Router's error screen for an unknown route is expected: only `/` exists);
- `http://localhost:3000/api/nope` shows the JSON 404.

Then `pkill -f "node --env-file=.env src/server.ts"`. If the browser cannot be reached, do the same checks with `curl` (Task 4, step 5), and say so.

- [ ] **Step 9: Walk through the definition of done**

Read `docs/development/definition-of-done.md` and note each item's state for the PR. Expected: item 1 (tests) ✅; item 2 ➖ N/A: no domain rules; item 3 after CI; item 4 ➖ N/A: no demo environment until PH-12; item 5 ➖ N/A: no `infra/base`; items 6–10 ✅; item 11: read it and decide, with the reason, whether it is ✅ or ➖ N/A (the SPA's look does not change).

- [ ] **Step 10: Links, final checks and a self-review of the diff**

```bash
for f in docs/decisions/0023-production-build-and-serving-details.md docs/decisions/00{05,07,10,13,19}-*.md docs/architecture/*.md docs/development/*.md docs/development/tools/*.md docs/glossary.md docs/open-points.md docs/roadmap.md README.md; do
  grep -oE '\]\([^)#]+' "$f" | sed 's/](//' | grep -v '^http' | sort -u | while read -r l; do [ -e "$(dirname "$f")/$l" ] || echo "BROKEN in $f: $l"; done
done; echo "link check done"
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
git diff main --stat
```

Expected: `link check done` with no `BROKEN` line; every check passes. Check by eye that each changed document's `## Contents` lists its `##` and `###` headings, and that requirements are linked, never plain IDs. Read the whole diff against the spec's *Goal and success criteria*, one by one, and list any gap.

- [ ] **Step 11: Tick this task's boxes and commit**

```bash
git add docs README.md
git commit -F - <<'EOF'
docs(adr): add ADR 0023 and update the docs for PH-06a

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0169uUQtKeK2YtNxYydhRNeb
EOF
```

---

## After tasks 1–7: open the PR

Only when the owner says so, after reviewing Task 7.

1. Run every check once more, with PostgreSQL running: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build`.
2. Open the PR with `gh pr create`: title `feat(api): serve the production build of the SPA`; the body fills `.github/pull_request_template.md`, with *How it was tested* holding Task 4, step 5's headers, Task 5, step 3's budget failure output and Task 7, step 8's browser check; the definition of done as walked through in Task 7, step 9; and a note for the owner: add `WEB_ROOT=../web/dist` to `apps/api/.env`.
3. Then, in one commit (`docs(roadmap): mark PH-06a done`): the PR link in PH-06a's roadmap row and in the open points that pointed at the branch; the row set to `✅ Done`; the README diagram's PH-06a marker `◐` → `●`, with the road travelled ending at PH-06a ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)). Push.
4. Check that CI is green: the `build` job runs and prints the first-screen line, and `ci-ok` passes. Link the run in the PR.
5. Stop. The owner reviews and merges.
