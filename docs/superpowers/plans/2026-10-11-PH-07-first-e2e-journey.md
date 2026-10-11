# PH-07 First E2E Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pnpm test:e2e` builds the app, resets `szop_e2e`, starts the API on port 3100 and runs the first journey on desktop Chromium, desktop Firefox and an emulated Pixel 7, with axe in light and dark mode and a guard that fails any test the browser reports a CSP violation in; CI runs it on every code PR and keeps the report of a failed run.

**Architecture:** a new workspace package `e2e/`. `playwright.config.ts` defines three projects and a `webServer` that runs `start-server.ts`, which checks the build, resets the database through `pg` and starts `apps/api/src/server.ts` as a child with `{ ...process.env, ...fileEnv, ...overrides }`. `support/test.ts` wraps Playwright's `context` fixture with the CSP guard; `support/accessibility.ts` holds `expectAccessible(page)`. Journeys live in `tests/` and import only from `support/`, which ESLint enforces. A new `e2e` job in `ci.yml`, required through `ci-ok`.

**Tech Stack:** Node 24.21, pnpm 12.8.1, `@playwright/test` 1.63.0 (Chromium 1243, Firefox 155), `@axe-core/playwright` 4.13.0, `pg` 8.23, PostgreSQL 18.6 from `compose.yaml`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-11-PH-07-first-e2e-journey-design.md`. Read it before starting; this plan argues from it.

## Contents

- [Global Constraints](#global-constraints)
- [Review Focus](#review-focus)
- [Facts checked, and what is not](#facts-checked-and-what-is-not)
- [Task 1: The e2e package and the health journey](#task-1-the-e2e-package-and-the-health-journey)
- [Task 2: The CSP guard](#task-2-the-csp-guard)
- [Task 3: The accessibility check](#task-3-the-accessibility-check)
- [Task 4: The e2e job in CI](#task-4-the-e2e-job-in-ci)
- [Task 5: The guides](#task-5-the-guides)
- [Task 6: The records](#task-6-the-records)
- [After tasks 1–6: open the PR](#after-tasks-16-open-the-pr)

## Global Constraints

- Branch `test/ph-07-first-e2e-journey`, already created and pushed, holding the spec commit; never commit to `main`; no worktree (`CLAUDE.md`, git workflow). Before any `git switch`, run `git status -sb`: another session may own the checkout.
- **Execution: subagent-driven, with a fresh reviewer per task.** After a task's review passes and it is committed, `git push` the branch and **pause** until the owner has reviewed that task; start the next task only when the owner says so. Tick each task's step boxes (`- [ ]` → `- [x]`) in this plan in the task's own commit.
- **Versions, exactly:** `@playwright/test@1.63.0` and `@axe-core/playwright@4.13.0` (1.64.0 is under a week old, spec, dependencies); `pg@^8.23.1`, `@types/pg@^8.23.1`, `@types/node@^24.19.0`, as `apps/api` has them. All in `e2e`'s `devDependencies`, added with `pnpm --filter @szop/e2e add -D …` (never by editing `package.json`), so the lockfile follows.
- **The port is 3100**, written once in `playwright.config.ts` and handed to `start-server.ts` as `E2E_PORT` through `webServer.env`. **The database is `szop_e2e`.** The API is reached at `http://127.0.0.1:3100`.
- **The projects, exactly:** `desktop-chromium` (`devices["Desktop Chrome"]`), `desktop-firefox` (`devices["Desktop Firefox"]`), `pixel` (`devices["Pixel 7"]`).
- **axe's tags, exactly:** `["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]`. No rule is turned off globally.
- **The API is not changed.** `apps/api/src/server.ts` reads `process.env` as always; every E2E setting reaches it through the child's environment.
- **`start-server.ts` never relays signals** to the API: Playwright signals the whole process group, so a relayed signal would be the API's second one ([Facts checked](#facts-checked-and-what-is-not)).
- **Imports use `.ts` extensions.** Journeys in `e2e/tests/` import `test` and `expect` only from `../support/test.ts` (Task 2 adds the ESLint rule that enforces it).
- **`allowBuilds` is the owner's decision:** if `pnpm add` stops with `ERR_PNPM_IGNORED_BUILDS`, stop and show the owner the message and which dependency it names ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18).
- **PostgreSQL must be running** (`docker compose up -d --wait`) and `apps/api/.env` must exist, for `pnpm test` and `pnpm test:e2e` alike.
- **Playwright's browsers:** Task 1 downloads them with `pnpm --filter @szop/e2e exec playwright install chromium firefox`. On this machine they launch without `--with-deps` (checked). Installing their system libraries needs `sudo` and is the owner's step ([#159](https://github.com/luiki-dev/szop/issues/159)); if a browser fails to launch for a missing library, stop and ask the owner to run `pnpm --filter @szop/e2e exec playwright install --with-deps chromium firefox`.
- Every commit passes `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` and, from Task 1 on, `pnpm test:e2e`. ESLint runs `strictTypeChecked`: numbers in template literals go through `String()`, a floating promise is an error (`void` or `await` it), and an empty function needs a comment inside it. The pre-commit hook formats staged files.
- Commit messages follow Conventional Commits with ADR 0009's nine types and the `scope-enum` list in `commitlint.config.js`: code here is `test(e2e)` or `ci`; docs are `docs(adr)`, `docs(plan)`, `docs(roadmap)` or no scope. **There is no `open-points` scope.** Read the list before committing. **Every commit ends with these trailers, naming the model that actually wrote the commit** (the implementer's own model, which the controller names in the dispatch prompt), not the orchestrating model:
  ```
  Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
  ```
- Docs follow `CLAUDE.md`'s writing style: niche acronyms spelled out on first use and added to the glossary; status icons before their word; requirements linked, never plain IDs; a `## Contents` section in documents over about 100 lines, kept in sync; an ADR that refines another is noted in three places.
- **GitHub first** for open points and the phase's issue ([ADR 0024](../../decisions/0024-github-project-tracking.md)): change the issues, then mirror them in `open-points.md` and `roadmap.md` (Task 6).
- Never merge a PR, never run `gh workflow run`, never delete a remote branch; do not work around `.claude/settings.json` or the push hook.

## Review Focus

Inputs a person will meet that the spec does not spell out; each has its check in the owning task.

1. **A journey that imports from `@playwright/test`** runs without the CSP guard and still passes. Expected: `pnpm lint` refuses it with a message naming `support/test.ts`. Check: Task 2, step 6.
2. **Running from the VS Code extension, or `playwright test` directly, with no build:** `start-server.ts` stops with "run `pnpm build` first" instead of a server that answers 404 on every page. Check: Task 1, step 9.
3. **A `pnpm start` already running on port 3100,** or anything else on it: Playwright refuses to start ("is already used") when it answers `/api/health`, and otherwise the API cannot listen and the run stops; the journey never runs against it. Check: Task 1, step 9.
4. **A test stopped with Ctrl+C, or a failed run:** nothing is left listening on 3100, and the API logs no second signal. Check: Task 1, step 10.
5. **A component that sets a low-contrast color through `element.style`,** which the CSP allows: axe must still catch it, in both schemes, with the rule ID and the element. Check: Task 3, step 4.

## Facts checked, and what is not

Checked on 2026-10-11 with throwaway probes outside the repository, on `@playwright/test` 1.63.0 and `@axe-core/playwright` 4.13.0, Chromium 1243 and Firefox 155, against a Node server sending Szop's exact CSP:

- **The browsers launch on this WSL machine without `--with-deps`**: its system libraries are already there.
- **`devices["Pixel 7"]`, `devices["Desktop Chrome"]` and `devices["Desktop Firefox"]`** exist.
- **`failOnFlakyTests: true` with `retries: 1`:** a test that fails, then passes on its retry, is reported `1 flaky` and the run exits 1.
- **The CSP guard as designed:** a `<style>` element added by `page.evaluate` is blocked (the body's color stays `rgb(0, 0, 0)`) and fires `securitypolicyviolation` with `effectiveDirective: "style-src-elem"` and `blockedURI: "inline"` in all three projects, Firefox included. At the teardown of a wrapped `context` fixture, the test's page is still open, so one `page.evaluate` round trip reaches it. Against a server that sends no CSP, the guard's test fails, as it should.
- **axe:** `new AxeBuilder({ page }).withTags([...]).analyze()` after `page.emulateMedia({ colorScheme })` works in all three projects; a page with `lang`, a `<title>`, a `<main>` and an `<h1>` has no violation; one without `lang` and `<title>` reports `html-has-lang` and `document-title`.
- **`webServer`** (read in `playwright/lib/runner/index.js`): `env` is merged as `{ ...process.env, ...webServer.env }`; the command runs in a shell, from the config's folder; `gracefulShutdown` runs `process.kill(-pid, signal)`, **signalling the whole process group**. With a parent that relays the signal, the child got `SIGTERM` twice. `server.ts` registers its handlers with `process.once`, so a second `SIGTERM` would kill the API mid-shutdown: `start-server.ts` therefore catches the signals without relaying them, and the child then got exactly one `SIGTERM`, after a passing run and after Ctrl+C (Playwright stops its server group with `SIGTERM` on Ctrl+C too).
- **Before starting, Playwright requests the `webServer` URL** to see whether something already answers (`isURLAvailable`): a status from 200 to 403 counts as answering, and then, with `reuseExistingServer: false`, it stops with `<url> is already used`. Anything else on the port (a 404, say) does not count: Playwright starts `start-server.ts`, and the API fails to listen with `EADDRINUSE`, logs `startup failed` and exits 1.

**Seen on this machine, and fixed by the owner before execution:** during the probes, every TCP connection from WSL to a *closed* port on `127.0.0.1` timed out after about two minutes instead of being refused (WSL's mirrored networking; `127.0.0.2` and `::1` refused at once). Playwright's pre-start request and its readiness polls have no timeout of their own, so every run stalled. Rechecked on 2026-10-11 after the owner's fix: closed ports on `127.0.0.1` refuse at once. If `pnpm test:e2e` ever prints nothing and hangs at the start again, check with `timeout 3 bash -c 'echo > /dev/tcp/127.0.0.1/3100'`: a timeout, rather than "Connection refused", is this problem. **Stop and tell the controller**; do not work around it in the code.

**Not checked; each is a step below that runs the thing first:**

- Whether pnpm refuses an install script among the new packages: Task 1, step 2.
- The real API behind `start-server.ts` (migrations on an empty database, the `warn` log level, the SPA from `WEB_ROOT`): Task 1, step 8.
- Whether the health page passes axe as it is: Task 3, step 3. If it does not, the fix goes in `apps/web`, not in a disabled rule.
- The `e2e` job on GitHub's runner, the install step's time and the artifact: only when the PR is open, since `ci.yml` runs on pull requests and on `main` ([After tasks 1–6](#after-tasks-16-open-the-pr)).

---

### Task 1: The e2e package and the health journey

**Files:**
- Create: `e2e/package.json`, `e2e/tsconfig.json`, `e2e/playwright.config.ts`, `e2e/start-server.ts`, `e2e/tests/health.spec.ts`
- Modify: `pnpm-workspace.yaml`, `package.json` (root `scripts`), `pnpm-lock.yaml` (by pnpm), `.gitignore`, `.prettierignore`, `eslint.config.js` (ignores)

**Interfaces:**
- Consumes: `apps/api/src/server.ts` (reads `HOST`, `PORT`, `LOG_LEVEL`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `WEB_ROOT`, `TRUSTED_PROXIES` from `process.env`; runs migrations, then listens; exits 1 after logging `startup failed`); `apps/api/.env`; `apps/web/dist/` from `pnpm build`; the `status` region of the health page (`apps/web/src/health/health-page.tsx`: "API: ok", "Database: up").
- Produces: the workspace package `@szop/e2e`; the root script `pnpm test:e2e`; `e2e/playwright.config.ts` with the three projects; `e2e/tests/` as the test folder. Task 2 changes the journey's import; Task 3 adds a call to it.

- [ ] **Step 1: Register the package**

`pnpm-workspace.yaml`: the comment and the list become

```yaml
# The workspace packages: apps/api since PH-03, apps/web and packages/shared
# since PH-05, e2e since PH-07.
packages:
  - apps/*
  - packages/*
  - e2e
```

`e2e/package.json`:

```json
{
  "name": "@szop/e2e",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Add the dependencies**

```bash
pnpm --filter @szop/e2e add -D @playwright/test@1.63.0 @axe-core/playwright@4.13.0 pg@^8.23.1 @types/pg@^8.23.1 @types/node@^24.19.0
```

Expected: the five in `e2e/package.json`'s `devDependencies`, the lockfile updated, no `ERR_PNPM_IGNORED_BUILDS` (if it appears, stop: Global Constraints). Then `pnpm --filter @szop/e2e exec playwright --version` prints `Version 1.63.0`.

- [ ] **Step 3: Download the browsers**

```bash
pnpm --filter @szop/e2e exec playwright install chromium firefox
```

Expected: Chromium and Firefox downloaded to `~/.cache/ms-playwright`. (`--with-deps` is the owner's step, Global Constraints.)

- [ ] **Step 4: The root script and the ignores**

Root `package.json`, in `scripts`, after `"test:coverage"`:

```json
"test:e2e": "pnpm build && pnpm --filter @szop/e2e exec playwright test",
```

`.gitignore`, after the `dist/` block:

```
# Playwright's report and test output (pnpm test:e2e)
e2e/playwright-report/
e2e/test-results/
```

`.prettierignore`, after the `dist/` block:

```
# Generated by pnpm test:e2e.
e2e/playwright-report/
e2e/test-results/
```

`eslint.config.js`: the `globalIgnores` line and its comment become

```js
  // Docs hold no code; .superpowers/ holds the brainstorm companion's
  // untracked files; coverage/ holds Vitest's generated report; dist/ holds
  // the web app's build; e2e/playwright-report/ and e2e/test-results/ hold
  // Playwright's output.
  globalIgnores([
    "docs/",
    ".superpowers/",
    "coverage/",
    "**/dist/",
    "e2e/playwright-report/",
    "e2e/test-results/",
  ]),
```

- [ ] **Step 5: TypeScript**

`e2e/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "lib": ["es2024", "dom"],
    "types": ["node"]
  },
  "include": ["**/*.ts"]
}
```

`dom` is there because the functions passed to `page.evaluate` and `addInitScript` run in the browser and use `document` and `window`. `node_modules` is excluded by TypeScript's default.

- [ ] **Step 6: The config**

`e2e/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

// The E2E server's port, written once and handed to start-server.ts. Not
// 3000, so a running `pnpm start`, with the development database, is never
// tested by mistake (ADR 0026, decision 2).
const port = 3100;
const baseURL = `http://127.0.0.1:${String(port)}`;
const ci = Boolean(process.env.CI);

// The E2E suite against the production build (ADR 0007, decisions 5, 11
// and 15; ADR 0013, decision 2; the details in ADR 0026).
export default defineConfig({
  testDir: "tests",
  // Each test starts in a fresh browser context, a fresh guest, so the tests
  // run in parallel (ADR 0007, decision 15).
  fullyParallel: true,
  // A forgotten test.only would pass CI while running one test.
  forbidOnly: ci,
  // In CI, one retry tells a flaky test from a broken one, and a test that
  // passes only on its retry still fails the run (ADR 0026, decision 4).
  retries: ci ? 1 : 0,
  failOnFlakyTests: ci,
  // The HTML report holds the trace and screenshot of every failed test; it
  // is what CI uploads. github puts failures on the PR as annotations.
  reporter: ci
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Resets szop_e2e, then runs the API, which serves the built SPA.
    command: "node start-server.ts",
    url: `${baseURL}/api/health`,
    env: { E2E_PORT: String(port) },
    // A fresh server every run: whatever already answers on the port is
    // refused, never tested.
    reuseExistingServer: false,
    // The API logs at warn, so only what matters shows.
    stdout: "pipe",
    // SIGTERM, not SIGKILL, so the API shuts down as it does on ECS.
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
  },
});
```

- [ ] **Step 7: Write the journey and see it fail**

`e2e/tests/health.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

// The walking skeleton's page: the SPA, served by the API, shows the API's
// health, which reads PostgreSQL. No use case is complete yet, so the file is
// named after the page; it goes when the page does (OP-087).
test("the health page shows the API and the database up", async ({
  page,
}) => {
  await page.goto("/");
  const status = page.getByRole("status");
  await expect(status).toContainText("API: ok");
  await expect(status).toContainText("Database: up");
});
```

(Task 2 changes the import to `../support/test.ts`.)

```bash
docker compose up -d --wait
pnpm test:e2e
```

Expected: the build passes, then Playwright fails before any test with `Process from config.webServer was not able to start. Exit code: 1` and Node's `Cannot find module …/e2e/start-server.ts`. If it prints nothing and hangs, see [Facts checked](#facts-checked-and-what-is-not).

- [ ] **Step 8: Write the start script and see the journey pass**

`e2e/start-server.ts`:

```ts
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import pg from "pg";

// Run by Playwright's webServer (playwright.config.ts): resets the E2E
// database, then starts the API on the built SPA (ADR 0026, decision 6).
// Each problem stops it with a message saying what to do.

const apiDir = new URL("../apps/api/", import.meta.url);
const webDist = new URL("../apps/web/dist/", import.meta.url);
// Fixed, never input, so it is safe to put into the statements below.
const database = "szop_e2e";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// Without the build, the API would start and answer 404 on every page.
if (!existsSync(new URL("index.html", webDist))) {
  fail(
    "apps/web/dist is missing: run `pnpm build` first (`pnpm test:e2e` does it for you)",
  );
}

const port = process.env.E2E_PORT;
if (!port) fail("E2E_PORT is not set: run the suite with `pnpm test:e2e`");

// The API's own settings, read the way its test helper reads them.
let fileEnv: NodeJS.Dict<string>;
try {
  fileEnv = parseEnv(readFileSync(new URL(".env", apiDir), "utf8"));
} catch {
  fail(
    "apps/api/.env is missing: copy apps/api/.env.example to apps/api/.env (see docs/development/setup.md)",
  );
}

// Reset once per run (ADR 0007, decision 15), through the maintenance
// database, never the development one. FORCE closes connections a crashed run
// left. Nothing is dropped afterwards, so a failed run's data can be read.
const admin = new pg.Client({
  host: fileEnv.DATABASE_HOST,
  port: Number(fileEnv.DATABASE_PORT),
  database: "postgres",
  user: fileEnv.DATABASE_USER,
  password: fileEnv.DATABASE_PASSWORD,
  connectionTimeoutMillis: 2000,
});
try {
  await admin.connect();
} catch (error) {
  const reason = (error as { code?: string }).code ?? (error as Error).message;
  fail(
    `Cannot reach PostgreSQL at ${String(fileEnv.DATABASE_HOST)}:${String(fileEnv.DATABASE_PORT)} (${reason}). Start it with \`docker compose up -d\`.`,
  );
}
try {
  await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${database}`);
} finally {
  await admin.end();
}

// The order of the spread is the rule: the shell's variables, then the API's
// .env, then the E2E settings over both. The API migrates the empty database
// before it listens, so Playwright's wait for /api/health covers that too.
const overrides = {
  DATABASE_NAME: database,
  HOST: "127.0.0.1",
  PORT: port,
  LOG_LEVEL: "warn",
  WEB_ROOT: fileURLToPath(webDist),
};
const api = spawn(process.execPath, ["src/server.ts"], {
  cwd: apiDir,
  env: { ...process.env, ...fileEnv, ...overrides },
  stdio: "inherit",
});

// Playwright stops its server by signalling the whole process group, so the
// API gets the signal itself. Caught here only so this script outlives the
// API; never passed on, which would give the API a second signal after its
// process.once handler is used up and kill it mid-shutdown.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    // Nothing to do: the API's exit, below, ends this script.
  });
}
api.on("exit", (code) => {
  process.exit(code ?? 1);
});
```

```bash
pnpm test:e2e
```

Expected: `3 passed` (one per project). If TypeScript or Node refuses something in the script, fix it there, keeping its behavior.

- [ ] **Step 9: Check the failure messages**

Each check undoes itself; run them one at a time.

```bash
# No build: the script's own message, no test runs.
mv apps/web/dist "$CLAUDE_JOB_DIR/tmp/dist-aside"
pnpm --filter @szop/e2e exec playwright test --project=desktop-chromium; echo "exit=$?"
mv "$CLAUDE_JOB_DIR/tmp/dist-aside" apps/web/dist

# Something already answering /api/health on the port, as a pnpm start
# with PORT=3100 would: refused before anything starts.
mkdir -p "$CLAUDE_JOB_DIR/tmp/www/api" && echo ok > "$CLAUDE_JOB_DIR/tmp/www/api/health"
python3 -m http.server 3100 --bind 127.0.0.1 --directory "$CLAUDE_JOB_DIR/tmp/www" > /dev/null 2>&1 &
sleep 1
pnpm --filter @szop/e2e exec playwright test --project=desktop-chromium; echo "exit=$?"

# Something else on the port, answering 404: Playwright starts the server,
# and the API cannot listen.
rm "$CLAUDE_JOB_DIR/tmp/www/api/health"
pnpm --filter @szop/e2e exec playwright test --project=desktop-chromium; echo "exit=$?"
kill %1
```

Expected: the first prints `apps/web/dist is missing: run \`pnpm build\` first …` and `exit=1`; the second prints `http://127.0.0.1:3100/api/health is already used, …` and `exit=1`; the third shows the API's `startup failed` line with `EADDRINUSE`, then `Process from config.webServer was not able to start. Exit code: 1`, and `exit=1`. In no case does a test run against the other server. Note the outputs for the task's report.

- [ ] **Step 10: Check that nothing is left running**

```bash
port_free() { ss -ltn | grep -q ':3100 ' && echo "3100 STILL IN USE" || echo "3100 free"; }

# After a passing run.
pnpm --filter @szop/e2e exec playwright test; port_free

# After a failed run: a throwaway failing test, deleted right after.
printf 'import { test } from "@playwright/test";\ntest("fails", () => { throw new Error("on purpose"); });\n' > e2e/tests/zz-fail.spec.ts
pnpm --filter @szop/e2e exec playwright test --project=desktop-chromium; port_free
rm e2e/tests/zz-fail.spec.ts

# After Ctrl+C in the middle of a run: the run in its own process group,
# then SIGINT to the whole group, as a terminal sends it.
setsid bash -c 'exec pnpm --filter @szop/e2e exec playwright test --repeat-each=30' > "$CLAUDE_JOB_DIR/tmp/ctrl-c.log" 2>&1 &
sleep 8
kill -INT -- "-$!"
sleep 6
port_free
grep "shutdown failed" "$CLAUDE_JOB_DIR/tmp/ctrl-c.log" || echo "no shutdown failure"
```

Expected: `3100 free` three times, and `no shutdown failure`. The API logs at `warn`, so its `shutting down` line (level `info`) does not show; a `shutdown failed` line (level `error`) would. If the port is still in use, stop: the shutdown design is wrong, report it.

- [ ] **Step 11: All checks, tick, commit**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm test:e2e
git status -s
```

Expected: all pass; `git status` shows no `playwright-report/` or `test-results/` (ignored). Tick this task's boxes, then:

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml .gitignore .prettierignore eslint.config.js e2e docs/superpowers/plans/2026-10-11-PH-07-first-e2e-journey.md
git commit -F - <<'EOF'
test(e2e): add the e2e package and the first journey

Playwright runs the health page on desktop Chromium, desktop Firefox and
a Pixel 7 against the production build. start-server.ts resets szop_e2e
and starts the API on port 3100 with the E2E settings over apps/api/.env.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
EOF
```

---

### Task 2: The CSP guard

**Files:**
- Create: `e2e/support/test.ts`, `e2e/tests/csp-guard.spec.ts`
- Modify: `e2e/tests/health.spec.ts` (the import), `eslint.config.js` (a block for `e2e/tests/`)

**Interfaces:**
- Consumes: Task 1's package and config.
- Produces: `e2e/support/test.ts` exporting `test` (Playwright's, extended), `expect` (Playwright's), and `interface CspViolation { directive: string; blocked: string; source: string; sample: string }`; the fixture `cspViolations: CspViolation[]`. Task 3's `support/accessibility.ts` imports `test` and `expect` from `./test.ts`.

- [ ] **Step 1: Write the guard's test and see it fail**

`e2e/tests/csp-guard.spec.ts`:

```ts
import { expect, test } from "../support/test.ts";

// The guard catches what it is there for: a <style> element added at run
// time, which the CSP blocks (ADR 0013, decision 9). If the guard stops
// listening, or the built app loses its CSP, this test fails.
test("the CSP guard catches an injected style element", async ({
  page,
  cspViolations,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = "body { color: red; }";
    document.head.append(style);
  });
  await expect
    .poll(() => cspViolations.map((violation) => violation.directive))
    .toEqual(["style-src-elem"]);
  // Expected here, so emptied before the guard's own check after the test.
  cspViolations.length = 0;
});
```

```bash
pnpm --filter @szop/e2e exec playwright test tests/csp-guard.spec.ts
```

Expected: FAIL, Playwright cannot load `../support/test.ts` (`Cannot find module`).

- [ ] **Step 2: Write the guard**

`e2e/support/test.ts`:

```ts
import { test as base, expect } from "@playwright/test";

// What the browser reported about one blocked resource.
export interface CspViolation {
  directive: string;
  blocked: string;
  source: string;
  sample: string;
}

// Every journey imports test and expect from here, never from
// @playwright/test (ESLint enforces it in tests/), so the CSP guard runs in
// every test without being asked for (ADR 0013, decision 9; ADR 0026,
// decision 7).
export const test = base.extend<{ cspViolations: CspViolation[] }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright reads a fixture's dependencies from this pattern, and this one has none.
  cspViolations: async ({}, use) => {
    await use([]);
  },
  // The context, wrapped: Playwright creates page from it, so the listener is
  // in place before the first page opens, on every page and navigation.
  context: async ({ context, cspViolations }, use) => {
    await context.exposeBinding(
      "reportCspViolation",
      (_source, violation: CspViolation) => {
        cspViolations.push(violation);
      },
    );
    await context.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        const page = window as unknown as {
          reportCspViolation: (violation: CspViolation) => Promise<void>;
        };
        void page.reportCspViolation({
          directive: event.effectiveDirective,
          blocked: event.blockedURI,
          source: `${event.sourceFile}:${String(event.lineNumber)}`,
          sample: event.sample,
        });
      });
    });
    await use(context);
    // One round trip per open page, so a report sent in the test's last
    // moment has arrived before the check.
    for (const page of context.pages()) {
      await page.evaluate(() => undefined);
    }
    expect(cspViolations, "the browser reported CSP violations").toEqual([]);
  },
});

export { expect };
```

If ESLint (step 7) flags the `eslint-disable` comment as unused because `no-empty-pattern` is off, remove the comment; if it flags another rule, fix the code, not the rule.

- [ ] **Step 3: See the guard's test pass**

```bash
pnpm --filter @szop/e2e exec playwright test tests/csp-guard.spec.ts
```

Expected: `3 passed`.

- [ ] **Step 4: Guard the journey**

`e2e/tests/health.spec.ts`, the first line becomes:

```ts
import { expect, test } from "../support/test.ts";
```

- [ ] **Step 5: See the guard fail a journey**

Temporarily add, at the end of the health journey's body:

```ts
  await page.evaluate(() => {
    document.head.append(document.createElement("style"));
  });
```

```bash
pnpm --filter @szop/e2e exec playwright test tests/health.spec.ts --project=desktop-firefox
```

Expected: FAIL with `the browser reported CSP violations`, the diff showing one object with `"directive": "style-src-elem"` and `"blocked": "inline"`. Note the output for the task's report, then remove the three lines and run again: `1 passed`.

- [ ] **Step 6: The ESLint rule, and see it refuse a bypass**

`eslint.config.js`, a block after the React hooks block:

```js
  // Journeys import test and expect from e2e/support/test.ts, which adds the
  // CSP guard: one importing @playwright/test would run unguarded and still
  // pass (ADR 0026, decision 7).
  {
    files: ["e2e/tests/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@playwright/test",
              message:
                "Import test and expect from ../support/test.ts, which adds the CSP guard.",
            },
          ],
        },
      ],
    },
  },
```

```bash
printf 'import { test } from "@playwright/test";\ntest("bypass", () => undefined);\n' > e2e/tests/zz-bypass.spec.ts
pnpm exec eslint e2e/tests/zz-bypass.spec.ts; echo "exit=$?"
rm e2e/tests/zz-bypass.spec.ts
```

Expected: `'@playwright/test' import is restricted from being used. Import test and expect from ../support/test.ts, which adds the CSP guard.` and `exit=1`.

- [ ] **Step 7: All checks, tick, commit**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm test:e2e
```

Expected: all pass, `6 passed` in the E2E run. Tick this task's boxes, then:

```bash
git add e2e eslint.config.js docs/superpowers/plans/2026-10-11-PH-07-first-e2e-journey.md
git commit -F - <<'EOF'
test(e2e): fail every journey on a CSP violation

support/test.ts wraps Playwright's context fixture: it collects the
browser's securitypolicyviolation events and fails the test if any came.
A test proves the guard catches an injected style element, and ESLint
keeps journeys from importing @playwright/test directly.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
EOF
```

---

### Task 3: The accessibility check

**Files:**
- Create: `e2e/support/accessibility.ts`
- Modify: `e2e/tests/health.spec.ts`

**Interfaces:**
- Consumes: `test` and `expect` from `e2e/support/test.ts` (Task 2).
- Produces: `expectAccessible(page: Page, options?: { disableRules?: string[] }): Promise<void>`, exported from `e2e/support/accessibility.ts`. Every later journey calls it on every page it visits.

- [ ] **Step 1: Call the check from the journey and see it fail**

`e2e/tests/health.spec.ts` becomes:

```ts
import { expectAccessible } from "../support/accessibility.ts";
import { expect, test } from "../support/test.ts";

// The walking skeleton's page: the SPA, served by the API, shows the API's
// health, which reads PostgreSQL. No use case is complete yet, so the file is
// named after the page; it goes when the page does (OP-087).
test("the health page shows the API and the database up", async ({
  page,
}) => {
  await page.goto("/");
  const status = page.getByRole("status");
  await expect(status).toContainText("API: ok");
  await expect(status).toContainText("Database: up");
  await expectAccessible(page);
});
```

```bash
pnpm --filter @szop/e2e exec playwright test tests/health.spec.ts
```

Expected: FAIL, `Cannot find module …/support/accessibility.ts`.

- [ ] **Step 2: Write the check**

`e2e/support/accessibility.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./test.ts";

// WCAG 2.2 AA (NFR-2; ADR 0013, decision 3).
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

// Scans the page as it is now with axe, in light and then in dark, and fails
// with every violation of both (ADR 0026, decision 3). Call it once the page
// has settled, on every page a journey visits. No rule is turned off for all
// pages: a rule skipped for one page is passed in disableRules at that call,
// with a comment saying why.
export async function expectAccessible(
  page: Page,
  options: { disableRules?: string[] } = {},
): Promise<void> {
  const problems: string[] = [];
  for (const colorScheme of ["light", "dark"] as const) {
    await test.step(`axe (${colorScheme})`, async () => {
      await page.emulateMedia({ colorScheme });
      const results = await new AxeBuilder({ page })
        .withTags(tags)
        .disableRules(options.disableRules ?? [])
        .analyze();
      for (const violation of results.violations) {
        const targets = violation.nodes
          .map((node) => node.target.join(" "))
          .join(", ");
        problems.push(
          `[${colorScheme}] ${violation.id}: ${String(violation.nodes.length)} element(s) — ${targets}`,
        );
      }
    });
  }
  // Back to the projects' default.
  await page.emulateMedia({ colorScheme: "light" });
  expect(problems, "axe found accessibility violations").toEqual([]);
}
```

- [ ] **Step 3: See the journey pass**

```bash
pnpm --filter @szop/e2e exec playwright test tests/health.spec.ts
```

Expected: `3 passed`. If axe reports a violation on the health page, stop and report it with the rule and the element: the fix belongs in `apps/web` and needs the controller's go-ahead, never a disabled rule.

- [ ] **Step 4: See the check catch low contrast**

Temporarily add, in the journey right before `await expectAccessible(page);`:

```ts
  await page.evaluate(() => {
    const heading = document.querySelector("h1");
    if (heading) heading.style.color = "#cccccc";
  });
```

(`element.style` is allowed by the CSP, ADR 0013, decision 9, so the guard stays quiet.)

```bash
pnpm --filter @szop/e2e exec playwright test tests/health.spec.ts --project=desktop-chromium
```

Expected: FAIL with `axe found accessibility violations`, listing `[light] color-contrast: 1 element(s) — h1` and `[dark] color-contrast: 1 element(s) — h1`, and the report's steps `axe (light)` and `axe (dark)`. Note the output, then remove the four lines and run again: `1 passed`.

- [ ] **Step 5: All checks, tick, commit**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm test:e2e
```

Expected: all pass, `6 passed`. Tick this task's boxes, then:

```bash
git add e2e docs/superpowers/plans/2026-10-11-PH-07-first-e2e-journey.md
git commit -F - <<'EOF'
test(e2e): check every page with axe in light and dark

expectAccessible(page) runs axe's WCAG 2.2 AA rule sets in both color
schemes and fails with every violation of both. The health journey
calls it.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
EOF
```

---

### Task 4: The e2e job in CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `pnpm test:e2e` (Task 1), `./.github/actions/setup`, `compose.yaml`, `apps/api/.env.example`.
- Produces: a job named `e2e`, in `ci-ok`'s `needs`; an artifact `playwright-report` on failure. Task 5 documents both.

- [ ] **Step 1: Add the job**

In `.github/workflows/ci.yml`, after the `build` job and before `commits`:

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
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup
      # The same PostgreSQL as the test job, from compose.yaml (ADR 0020,
      # decision 6). start-server.ts reads the server from apps/api/.env and
      # creates szop_e2e itself.
      - run: cp apps/api/.env.example apps/api/.env
      - run: docker compose up -d --wait
      # Every run, not cached: restoring a cache takes about as long as the
      # download, and the system libraries come from apt anyway (ADR 0026,
      # decision 5).
      - name: Install Playwright's browsers
        run: pnpm --filter @szop/e2e exec playwright install --with-deps chromium firefox
      # Builds the app, then runs every journey on the three projects.
      - run: pnpm test:e2e
      # The HTML report, with the trace and screenshot of every failed test,
      # kept for 14 days (ADR 0010, decision 9).
      - if: failure()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: playwright-report
          path: e2e/playwright-report/
          retention-days: 14
```

`ci-ok`'s `needs` becomes:

```yaml
    needs: [changes, lint, typecheck, test, build, e2e, commits, workflows]
```

The file's header comment stays; nothing else changes.

- [ ] **Step 2: Check the workflow locally where possible**

```bash
pnpm exec prettier --check .github/workflows/ci.yml
command -v actionlint && actionlint || echo "actionlint not installed: CI's workflows job checks it"
command -v zizmor && zizmor .github/workflows/ci.yml || echo "zizmor not installed: CI's workflows job checks it"
git diff .github/workflows/ci.yml
```

Expected: Prettier passes; the diff shows only the new job and the `needs` line. The `workflows`, `e2e` and `ci-ok` jobs run on GitHub when the PR opens ([After tasks 1–6](#after-tasks-16-open-the-pr)).

- [ ] **Step 3: Tick, commit**

Tick this task's boxes, then:

```bash
git add .github/workflows/ci.yml docs/superpowers/plans/2026-10-11-PH-07-first-e2e-journey.md
git commit -F - <<'EOF'
ci: run the E2E journeys on every code PR

The e2e job installs Chromium and Firefox, runs pnpm test:e2e against
PostgreSQL from compose.yaml and keeps the HTML report for 14 days when
it fails. ci-ok needs it.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
EOF
```

---

### Task 5: The guides

**Files:**
- Create: `docs/development/tools/playwright.md`
- Modify: `docs/development/testing.md`, `docs/development/setup.md`, `docs/development/ci-cd.md`, `docs/architecture/stack-overview.md`, `docs/architecture/architecture.md`, `docs/glossary.md`, `.vscode/extensions.json`, `CLAUDE.md` (only if its documentation list needs the new tool page; read it first)

**Interfaces:**
- Consumes: the finished `e2e/` package and job (Tasks 1–4), and what their reports noted (the failure messages of Task 1, step 9; the outputs of Task 2, step 5 and Task 3, step 4).
- Produces: the living docs the PR links to; ADR 0026 (Task 6) links them.

Read each document before changing it, follow its existing structure and tone, and keep its `## Contents` in sync. Write for a learner: say what a thing is before how to use it.

- [ ] **Step 1: The tool page**

`docs/development/tools/playwright.md`, in the shape of `tools/vitest.md` (read it first): what Playwright is (a library that drives real browsers, and a test runner around it) and what axe is (a rule engine that checks a rendered page against the Web Content Accessibility Guidelines (WCAG)); `## Why Szop uses it`: Playwright over Cypress ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 11), the three projects (decision 5; [ADR 0013](../../decisions/0013-visual-design.md), decision 2), axe's rule sets (ADR 0013, decision 3); `## Configuration`: `e2e/package.json`, `e2e/tsconfig.json` (why `dom`), and `playwright.config.ts` setting by setting, as the spec's table has them; `start-server.ts` step by step, including why it does not relay signals; `support/test.ts` and `support/accessibility.ts`; the ESLint rule; `## Editor`: the Playwright Test extension (`ms-playwright.playwright`), which runs the same config but does not build first; `## Browsers`: where they are downloaded, `--with-deps` and why it needs `sudo`, and that the version follows `@playwright/test`.

- [ ] **Step 2: The testing guide**

`docs/development/testing.md`:

- the introduction: the guide's growth line no longer lists PH-07;
- *The layers today*: a row for **E2E journeys** (`e2e/tests/*.spec.ts`, for example `health.spec.ts`; a real browser drives the production build through the SPA, the API and PostgreSQL, on three projects; the column "Vitest project" says `➖ N/A: Playwright`), and the "Layers still to come" list keeps only PH-15's line;
- *Running the tests*: `pnpm test:e2e` (builds first), one project (`pnpm test:e2e --project=desktop-firefox`), one file, the UI mode (`--ui`), the editor (build first), and `pnpm --filter @szop/e2e exec playwright show-report` for the last run's report;
- a new `## Writing an E2E journey`: one file per use case, `uc-NN-….spec.ts` ([ADR 0007](../decisions/0007-testing-strategy.md), decisions 4 and 17), with `health.spec.ts` as the walking skeleton's exception; import `test` and `expect` from `../support/test.ts` (and why, the ESLint rule); call `expectAccessible(page)` once each page has settled, on every page; each test isolates itself in its fresh context, registers users with unique emails and never depends on another test's data; locators by role and text, as Testing Library's; edge cases stay in lower layers (decision 16);
- `### The CSP guard`: what it catches, what a failure looks like (the step 5 output of Task 2, shortened), and what to do: find what injected the style or script, never loosen the CSP; that `element.style` is allowed;
- `### The accessibility check`: what a failure looks like (Task 3, step 4's output, shortened), and the rule that no axe rule is turned off for all pages;
- `### Reading a failed run`: the HTML report, a test's trace (timeline, DOM snapshots, network, console), locally and from CI's artifact; what *flaky* and *failed* mean in CI (one retry, `failOnFlakyTests`);
- *Rules*: add "every journey imports from `support/test.ts`" and "no axe rule is turned off for all pages".

- [ ] **Step 3: Setup, CI/CD, stack overview, architecture, glossary, editor**

- `docs/development/setup.md`: a step (where the test tooling is, or after PostgreSQL) installing the browsers once: `pnpm --filter @szop/e2e exec playwright install --with-deps chromium firefox`, which asks for the `sudo` password for the system libraries; the check `pnpm test:e2e`; the Playwright Test extension in the extensions list; the "comes later" line for Playwright removed; a troubleshooting note: if `pnpm test:e2e` hangs at the start with no output, test `timeout 3 bash -c 'echo > /dev/tcp/127.0.0.1/3100'`, and if it times out instead of being refused, WSL's mirrored networking is dropping connections to closed ports on `127.0.0.1`; describe the fix the owner applied (the controller gives its wording in the dispatch).
- `docs/development/ci-cd.md`: the `e2e` job in the jobs list and in `ci-ok`'s needs; why the browsers are not cached; how to read a failed run: download the `playwright-report` artifact from the run's summary page, unzip it, `pnpm --filter @szop/e2e exec playwright show-report <folder>`, or drop a trace's zip on `trace.playwright.dev`; *flaky* versus *failed* in the annotations.
- `docs/architecture/stack-overview.md`: what an E2E test is and where it sits in the testing trophy; how Playwright drives a browser (a separate browser process, controlled over a protocol, each test in a fresh context); browser projects and device emulation; what axe checks and what it cannot (it finds about a third to a half of accessibility problems; keyboard and screen-reader use still need people); how the CSP guard listens for the browser's own violation events.
- `docs/architecture/architecture.md`: the `e2e/` line of the layout gains its parts (`start-server.ts`, `support/`, `tests/`); the *Under the CSP* line keeps its wording, as it already names the guard.
- `docs/glossary.md`, alphabetically, where missing (search first): **axe** (axe-core, the accessibility rule engine; see `tools/playwright.md`), **Playwright**, **Trace** (Playwright's recording of a test: actions, DOM snapshots, network and console, viewed in the trace viewer), **Flaky test** (a test that passes and fails on the same code; ADR 0007, decision 16).
- `.vscode/extensions.json`: `"ms-playwright.playwright"` after `"vitest.explorer"`.

- [ ] **Step 4: Check the links, tick, commit**

```bash
for f in docs/development/*.md docs/development/tools/playwright.md docs/architecture/*.md docs/glossary.md; do
  grep -oE '\]\([^)#]+' "$f" | sed 's/](//' | grep -v '^http' | sort -u | while read -r l; do [ -e "$(dirname "$f")/$l" ] || echo "BROKEN in $f: $l"; done
done; echo "link check done"
pnpm lint && pnpm format:check
```

Expected: `link check done` with no `BROKEN` line. Check by eye that each changed document's `## Contents` lists its `##` and `###` headings, and that requirements are linked, never plain IDs. Tick this task's boxes, then:

```bash
git add docs .vscode/extensions.json CLAUDE.md
git commit -F - <<'EOF'
docs: document the E2E journeys, Playwright and the e2e job

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
EOF
```

---

### Task 6: The records

**Files:**
- Create: `docs/decisions/0026-first-e2e-journey-details.md`
- Modify: `docs/decisions/0007-testing-strategy.md` (status line, decision 15's cell), `docs/decisions/0010-ci-cd.md` (status line, decision 9's cell), `docs/open-points.md`, `docs/roadmap.md`
- GitHub: issues #36, #63; the project item of #63

**Interfaces:**
- Consumes: everything Tasks 1–5 built and reported (any difference from the plan, any lint fix, any `allowBuilds` entry).
- Produces: the records the PR links to, and the state the PR is opened from.

- [ ] **Step 1: Write ADR 0026**

`docs/decisions/0026-first-e2e-journey-details.md`, in the shape of [ADR 0025](../../decisions/0025-web-security-baseline-details.md) (read it first):

- Title `# ADR 0026 — First E2E journey details`; `- **Status:** ✅ Accepted`; `- **Date:** 2026-10-11`;
- `- **Refines:** [ADR 0007](0007-testing-strategy.md), decision 15 (the reset once per run is done by the start script, and the E2E server runs on its own port, see decisions 2 and 6); [ADR 0010](0010-ci-cd.md), decision 9 (the Playwright browsers are installed every run, not cached, see decision 5)`.
- `## Context`: [PH-07](../roadmap.md#ph-07-first-e2e-journey); ADR 0007, 0010 and 0013 set the direction; the brainstorm and the [spec](../superpowers/specs/2026-10-11-PH-07-first-e2e-journey-design.md) settled the details.
- `## Decisions`: the spec's decisions 1 to 9, copied with their wording, links rewritten from `../../decisions/X` to `X` and from `../../` to `../`. Add what planning and building settled, as `<br>**Settled while building:** …` in the cells it touches: in decision 6, that Playwright signals the whole process group, so the script waits for the API and never relays a signal; in decision 7, that Firefox reports `style-src-elem` like Chromium; anything Tasks 1 to 5 reported differently from the plan.
- `## Consequences`: every developer installs the browsers once (`--with-deps`, `sudo`), in the setup guide; every journey imports from `support/test.ts` and calls `expectAccessible` on every page; each phase completing a use case adds its `uc-NN` journey (ADR 0007, decision 4); `health.spec.ts` goes with the health page ([OP-087](../open-points.md#op-087)); the `e2e` job adds a few minutes to every code PR, measured in the PR; the open points changed (step 4); the living docs (Task 5).

- [ ] **Step 2: Note the refinements in ADR 0007 and ADR 0010**

In the three places `CLAUDE.md` asks for (ADR 0026's header is step 1). Read each status line and cell first, and add in the same style as the notes already there:

- ADR 0007's status line: append `; decision 15 refined by [ADR 0026](0026-first-e2e-journey-details.md) (the start script resets the E2E database and runs the API on its own port)`.
- ADR 0007, decision 15's cell, at the bottom: `<br>✏️ **Refined by [ADR 0026](0026-first-e2e-journey-details.md), decisions 2 and 6:** \`e2e/start-server.ts\` resets \`szop_e2e\`, then starts the API on port 3100 with the E2E settings over \`apps/api/.env\`; Playwright starts a fresh one every run.`
- ADR 0010's status line: append `; decision 9 refined by [ADR 0026](0026-first-e2e-journey-details.md) (the Playwright browsers are installed every run, not cached)`.
- ADR 0010, decision 9's cell, at the bottom: `<br>✏️ **Refined by [ADR 0026](0026-first-e2e-journey-details.md), decision 5:** the Playwright browsers are installed every run, not cached: restoring the cache takes about as long as the download, and their system libraries come from apt anyway.`

- [ ] **Step 3: Change the issues on GitHub first**

Read each issue's body before editing (`gh issue view N --repo luiki-dev/szop`), and keep its sections; write bodies through a file under `$CLAUDE_JOB_DIR/tmp` with `gh issue edit N --repo luiki-dev/szop --body-file <file>`. Links inside bodies follow [project tracking, links](../../development/project-tracking.md#links-inside-issue-bodies).

- **#63 (OP-010):** *Parts*: tick PH-07 (`- [x] **PH-07:** Playwright with axe ✅ Done (branch link until the PR exists)`). Re-parent it under PH-15: `gh api -X POST repos/luiki-dev/szop/issues/44/sub_issues -F sub_issue_id="$(gh api repos/luiki-dev/szop/issues/63 -q .id)" -F replace_parent=true` (#44 is PH-15). Set its project Status to ⬜ Backlog (`gh project item-edit`; project `PVT_kwHOEVZTps4BmW8P`, Status field `PVTSSF_lAHOEVZTps4BmW8PzhlAT9c`, option `9700a2cc`; the item id from `gh project item-list 3 --owner luiki-dev --format json --limit 300`).
- **#64 (OP-012)** and **#65 (OP-057):** no change; the PR closes them.
- **#36 (PH-07):** *Delivers* gains `([ADR 0026](https://github.com/luiki-dev/szop/blob/main/docs/decisions/0026-first-e2e-journey-details.md))`. Its project's Plan field is set (the plan commit did it; check).

Then confirm with `gh issue view` on each, and `gh project item-list 3 --owner luiki-dev --format json --limit 300 -q '.items[] | select(.content.number==63) | {n:.content.number,status}'`.

- [ ] **Step 4: Mirror them in the register and the roadmap**

`docs/open-points.md`, following *How it works* (read it first):

- **OP-010:** the PH-07 part ticked `✅ Done` with the branch link; `- **Status:** ⬜ Open`; move the entry to `### PH-15 Seed catalog, read-only`'s group.
- **OP-012** and **OP-057:** stay in PH-07's group, 🚧 In progress on the branch, until the PR (After tasks, step 3, closes them).
- Check that OP-067 is in PH-08's group with its *Moved from PH-07* line, and OP-087 in PH-14's (the spec commit did both).

`docs/roadmap.md`: PH-07's *Delivers* gains `([ADR 0026](decisions/0026-first-e2e-journey-details.md))`; the row's Plan column links this plan (the plan commit set it; check). The row stays `🚧 In progress`; the README diagram stays at ◐ until the PR.

- [ ] **Step 5: Walk through the definition of done**

Read `docs/development/definition-of-done.md` and note each item's state for the PR. Expected: tests ✅ (a new layer, its first journey); domain rules ➖ N/A: no domain rules; CI after the PR opens; the demo check ➖ N/A: no demo environment until PH-12; `infra/base` ➖ N/A; the living docs ✅ (Task 5); the threat model ➖ N/A: no new actor or entry point (check: `e2e/` is a test package only); open points ✅ (step 4); UI screenshots ➖ N/A: the UI does not change. Read every item; this list is a forecast, not the answer.

- [ ] **Step 6: Links, final checks and a self-review of the diff**

```bash
for f in docs/decisions/0026-first-e2e-journey-details.md docs/decisions/0007-testing-strategy.md docs/decisions/0010-ci-cd.md docs/open-points.md docs/roadmap.md README.md; do
  grep -oE '\]\([^)#]+' "$f" | sed 's/](//' | grep -v '^http' | sort -u | while read -r l; do [ -e "$(dirname "$f")/$l" ] || echo "BROKEN in $f: $l"; done
done; echo "link check done"
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm test:e2e
git diff main --stat
```

Expected: `link check done` with no `BROKEN` line; every check passes. Read the whole diff against the spec's *Goal and success criteria*, one by one, and list any gap in the task's report.

- [ ] **Step 7: Tick this task's boxes and commit**

```bash
git add docs
git commit -F - <<'EOF'
docs(adr): add ADR 0026 and update the records for PH-07

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LkjpCbeRJmU2TE8M78vjPK
EOF
```

---

## After tasks 1–6: open the PR

Only when the owner says so, after reviewing Task 6.

1. Run every check once more, with PostgreSQL running: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm test:e2e`.
2. Open the PR with `gh pr create`: title `test(e2e): add the first E2E journey`; the body fills `.github/pull_request_template.md`, says `Closes #36`, `Closes #64` and `Closes #65` (OP-010 stays open for PH-15), lists the issue changes of Task 6, step 3 and of the spec commit that the doc diff mirrors ([project tracking, the trial rule](../../development/project-tracking.md#the-trial-rule)), holds the definition of done as walked through in Task 6, step 5, and a note for the owner: run the browser install once with `--with-deps` ([#159](https://github.com/luiki-dev/szop/issues/159)).
3. Then, in one commit (`docs(roadmap): mark PH-07 done`): the PR link in PH-07's roadmap row and in OP-010's ticked part, on GitHub first (#63), then in the register; OP-012 and OP-057 moved to *Closed* with the PR link; the row set to `✅ Done`; the README diagram's PH-07 marker `◐` → `●` ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)). Push.
4. Check that CI is green: `e2e`, `workflows` and `ci-ok` pass. Note the `Install Playwright's browsers` step's time and the whole `e2e` job's time in the PR description ([ADR 0026](../../decisions/0026-first-e2e-journey-details.md), decision 5). Link the run.
5. **Ask the owner** whether to see the failure path once on GitHub: a throwaway branch off the PR branch with one failing journey, opened as a draft PR against `main`, shows the `playwright-report` artifact and the `github` reporter's annotations; the draft is then closed, and the owner deletes the branch (Claude never deletes a remote branch). Do it only on a yes.
6. Stop. The owner reviews and merges.
