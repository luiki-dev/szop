# PH-06b Web Security Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every response the API sends carries the security headers, every unsafe request is refused unless it comes from the app itself with a JSON body, the logged client address is the one the load balancer saw, and no query value reaches the log; API tests prove each.

**Architecture:** four concerns, one file each, in `apps/api/src/security/`: `headers.ts` (`@fastify/helmet` with a CSP written out in full), `cross-site.ts` (an `onRequest` hook checking `Sec-Fetch-Site`, then `Origin`, on every method but GET, HEAD and OPTIONS), `json-only.ts` (removes Fastify's `text/plain` parser) and `log.ts` (`redactUrl()` and the request serializer). The first three are plugins wrapped with `fastify-plugin`, registered in `buildApp` before any route. A new required setting, `TRUSTED_PROXIES`, is passed to Fastify's `trustProxy` as a list of addresses. `buildApp` gains an optional `logStream`, so tests read the log back.

**Tech Stack:** Node 24.21, Fastify 5.12.5, `@fastify/helmet` 13.1.2 (helmet 8), `fastify-plugin` 6.0.1, Zod 4, Vitest 5.0.3, Vite 8, pnpm 12.8.1.

**Spec:** `docs/superpowers/specs/2026-10-10-PH-06b-web-security-baseline-design.md`. Read it before starting; this plan argues from it.

## Contents

- [Global Constraints](#global-constraints)
- [Review Focus](#review-focus)
- [Facts checked, and what is not](#facts-checked-and-what-is-not)
- [Task 1: The TRUSTED_PROXIES setting and testConfig](#task-1-the-trusted_proxies-setting-and-testconfig)
- [Task 2: The request log and the client address](#task-2-the-request-log-and-the-client-address)
- [Task 3: Security headers](#task-3-security-headers)
- [Task 4: The cross-site check](#task-4-the-cross-site-check)
- [Task 5: JSON-only bodies](#task-5-json-only-bodies)
- [Task 6: Docs, registers and final checks](#task-6-docs-registers-and-final-checks)
- [After tasks 1–6: open the PR](#after-tasks-16-open-the-pr)

## Global Constraints

- Branch `feat/ph-06b-web-security-baseline`, already created, holding the spec commits; never commit to `main`; no worktree (`CLAUDE.md`, git workflow). Before any `git switch`, run `git status -sb`: another session may own the checkout.
- **Execution: subagent-driven, with a fresh reviewer per task.** After a task's review passes and it is committed, `git push` the branch and **pause** until the owner has reviewed that task; start the next task only when the owner says so. Tick each task's step boxes (`- [ ]` → `- [x]`) in this plan in the task's own commit.
- **The CSP header, exactly:** `default-src 'self';object-src 'none';base-uri 'none';form-action 'self';frame-ancestors 'none'`, with helmet's CSP defaults off (`useDefaults: false`). **HSTS, exactly:** `max-age=31536000; includeSubDomains`, no `preload`. **`Referrer-Policy: no-referrer`.** Every other helmet header at its default (spec, decisions 4 and 5).
- **The cross-site rule, exactly** (spec, decisions 1 and 2): GET, HEAD and OPTIONS pass unchecked. Any other method passes only with `Sec-Fetch-Site: same-origin`, or, when `Sec-Fetch-Site` is absent, with an `Origin` whose `new URL(origin).host` equals the raw `Host` header. Everything else, neither header included, gets 403 with the body `{ "statusCode": 403, "error": "Forbidden", "message": "Cross-site request refused" }`. Compare with `request.headers.host`, never `request.host` (which reads `X-Forwarded-Host` behind a trusted proxy).
- **JSON-only:** `app.removeContentTypeParser("text/plain")` and nothing else; Fastify's own 415 answers every other content type (spec, decision 3).
- **Log redaction, exactly** (spec, decision 6): the part before the first `?` unchanged; in the query, each `&`-separated parameter with an `=` becomes `<name as written>=[redacted]`, one without `=` becomes `[redacted]`, an empty one stays empty.
- **`TRUSTED_PROXIES`** (spec, decision 7): required; `none` alone, returned as `[]`, or a comma-separated list of IPv4 or IPv6 addresses, each optionally with `/<prefix>` (0–32 or 0–128), trimmed, returned as `string[]`. Passed to Fastify's `trustProxy` as that array; **never a number, never `true`**: Fastify 5.12 ignores a number and trusts nothing.
- **Packages:** add with `pnpm add` (never by editing `package.json`), so the lockfile follows. The only new packages are `@fastify/helmet` (major 13) and `fastify-plugin` (major 6), in `apps/api`'s `dependencies`.
- **Imports use `.ts` extensions.** Tests import `describe`, `it`, `expect` and the hooks from `"vitest"`: no globals. No `vi.mock` of our own modules ([ADR 0007](../../decisions/0007-testing-strategy.md), decision 16). Existing modules use named exports; so do the new ones.
- **Routes are added before the first `inject()`:** Fastify refuses `app.post(…)` once the app is ready (`FST_ERR_INSTANCE_ALREADY_LISTENING`), so a test's throwaway route is added right after `buildApp`.
- **TDD** for every task with code: write the test, run it and see it fail for the expected reason, then write the code.
- **`allowBuilds` is the owner's decision:** if `pnpm add` stops with `ERR_PNPM_IGNORED_BUILDS`, stop and show the owner the message and which dependency it names ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18).
- **PostgreSQL must be running** for `pnpm test`: `docker compose up -d --wait`. `apps/api/.env` must exist; from Task 1 on it must contain `TRUSTED_PROXIES` (Task 1, step 1).
- Every commit passes `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm test`. ESLint runs `strictTypeChecked`: a floating `reply.send()` is an error (use `void` or `return`), and an `async` function without `await` is one too. The pre-commit hook formats staged files.
- Commit messages follow Conventional Commits with ADR 0009's nine types and the `scope-enum` list in `commitlint.config.js` (code here is `api` or `web`; docs are `adr`, `plan`, `roadmap`; read the list before committing). **Every commit ends with these trailers, naming the model that actually wrote the commit** (the implementer's own model, which the controller names in the dispatch prompt), not the orchestrating model:
  ```
  Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01KBAbavVi1nADpvFxUxRfyy
  ```
- Docs follow `CLAUDE.md`'s writing style: niche acronyms spelled out on first use and added to the glossary; status icons before their word; requirements linked, never plain IDs; a `## Contents` section in documents over about 100 lines, kept in sync; an ADR that refines another is noted in three places.
- **GitHub first** for open points and the phase's issue ([ADR 0024](../../decisions/0024-github-project-tracking.md)): change the issues, then mirror them in `open-points.md` and `roadmap.md` (Task 6).
- Never merge a PR, never run `gh workflow run`, never delete a remote branch; do not work around `.claude/settings.json` or the push hook.

## Review Focus

Inputs a person will meet that the spec does not spell out; each has its test in the owning task.

1. **Both headers, disagreeing:** `Sec-Fetch-Site: cross-site` with an `Origin` that matches `Host`. `Sec-Fetch-Site` wins and the request gets 403; checking `Origin` first would let it through. Test: Task 4, "Sec-Fetch-Site wins over a matching Origin".
2. **Same host name, another port:** `Origin: http://localhost:5173` against `Host: localhost:3000` is another origin and gets 403. Test: Task 4, the `it.each` of refused origins.
3. **The load balancer seen as an IPv4-mapped IPv6 address** (`::ffff:10.0.1.5`, how a socket listening on `::` reports an IPv4 peer): it must still count as trusted. Probed: Fastify matches it against `10.0.0.0/16`. Test: Task 2, `client-ip.test.ts`.
4. **A route that throws, with a token in its query:** Fastify's error line carries `req` too, so it must be redacted like `incoming request`. Test: Task 2, "keeps the token out of the error line".
5. **An existing `apps/api/.env` without `TRUSTED_PROXIES`:** the test helpers parse it through `loadConfig`, so every database test fails at once with `TRUSTED_PROXIES: missing`. Expected: the message names the setting, Task 1, step 1 updates the local file, and the setup guide tells the owner (Task 6).

## Facts checked, and what is not

Checked on 2026-10-10 with throwaway probes outside the repository, on fastify 5.12.5, `@fastify/helmet` 13.1.2 and `fastify-plugin` 6.0.1:

- **`trustProxy` with a number trusts nothing** in Fastify 5.12 (its docs: hop-count trust "cannot validate the immediate peer"). **With `["10.0.0.0/16"]`:** from `remoteAddress: "10.0.1.5"` with `X-Forwarded-For: 6.6.6.6, 203.0.113.7`, `request.ip` is `203.0.113.7`; from `"198.51.100.9"`, it is `198.51.100.9`; from `"::ffff:10.0.1.5"`, `203.0.113.7`. **With `[]`**, `request.ip` is the socket's address. A malformed entry makes `Fastify()` throw `invalid IP address: …`. Behind a trusted proxy, `request.host` takes `X-Forwarded-Host`.
- **`inject()`** sends `Host: localhost:80` unless the test sets it, and accepts `remoteAddress`.
- **Logger:** `logger: { level, stream, serializers: { req } }` works; `stream: undefined` logs to stdout. The `req` serializer receives the Fastify request (`ip`, `host`, `url`, `method`, `socket`). `incoming request` and an error line (`msg` is the error's message, level 50) carry `req`; `request completed` carries only `res` and `responseTime`. Fastify's default `req` serializer returns `method`, `url`, `version` (the `Accept-Version` header), `host`, `remoteAddress` (`req.ip`), `remotePort`.
- **Helmet's headers** with the settings above: `content-security-policy: default-src 'self';object-src 'none';base-uri 'none';form-action 'self';frame-ancestors 'none'`, `strict-transport-security: max-age=31536000; includeSubDomains`, `referrer-policy: no-referrer`, `x-content-type-options: nosniff`, plus `cross-origin-opener-policy`, `cross-origin-resource-policy`, `origin-agent-cluster`, `x-dns-prefetch-control`, `x-download-options`, `x-frame-options: SAMEORIGIN`, `x-permitted-cross-domain-policies`, `x-xss-protection: 0`. They are on a 404 and on a 403 sent by a later `onRequest` hook.
- **A callback `onRequest` hook** that calls `void reply.code(403).send(…)` without calling `done` refuses the request; helmet's headers are on that reply. It also runs for unknown routes, so a `POST` to an unknown path with no `Sec-Fetch-Site` gets 403, not 404.
- **After `removeContentTypeParser("text/plain")`:** `text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data`, a body with no `Content-Type`, and a form type with an empty body all get 415 with `{ statusCode: 415, code: "FST_ERR_CTP_INVALID_MEDIA_TYPE", error: "Unsupported Media Type", message: … }`; `application/json` with or without `; charset=utf-8` passes; a DELETE without a body passes.

**Not checked; each is a step below that runs the thing first:**

- Helmet's headers on `@fastify/static`'s files and on the fallback's `sendFile`: Task 3's tests.
- Whether pnpm refuses an install script among the new packages' dependencies: Task 3, step 1.
- Whether `assetsInlineLimit: 0` changes Vite 8's output: Task 3, step 7.

---

### Task 1: The TRUSTED_PROXIES setting and testConfig

**Files:**
- Modify: `apps/api/src/config.ts`, `apps/api/src/config.test.ts`, `apps/api/.env.example`, `apps/api/.env` (local, git-ignored)
- Create: `apps/api/src/test/config.ts`
- Modify: `apps/api/src/health/routes.test.ts`, `apps/api/src/web/routes.test.ts` (switch to `testConfig`)

**Interfaces:**
- Produces: `Config.trustedProxies: string[]`; `testConfig(overrides?: Partial<Config>): Config` in `src/test/config.ts`, with `logLevel: "silent"`, `trustedProxies: []` and a `webRoot` that does not exist.

- [x] **Step 1: Add the setting to the local `.env`**

`apps/api/.env` is git-ignored and is read by the test helpers through `loadConfig`. Append the line now, so the database tests keep working once the setting is required:

```bash
grep -q '^TRUSTED_PROXIES=' apps/api/.env || printf '\nTRUSTED_PROXIES=none\n' >> apps/api/.env
```

- [x] **Step 2: Write the failing config tests**

In `apps/api/src/config.test.ts`:

1. Add `TRUSTED_PROXIES: "none",` as the last entry of `valid`.
2. In "returns the typed config for a valid environment", add `trustedProxies: [],` after `webRoot: resolve("../web/dist"),`.
3. Add `"TRUSTED_PROXIES"` to the list of the `it.each` "rejects an empty %s instead of treating it as missing".
4. Add these tests inside `describe("loadConfig", …)`, after the `LOG_LEVEL` test:

```ts
  it.each([
    ["none", []],
    ["10.0.0.0/16", ["10.0.0.0/16"]],
    ["10.0.1.5", ["10.0.1.5"]],
    ["fd00::/8", ["fd00::/8"]],
    ["10.0.0.0/16, 10.1.0.0/16", ["10.0.0.0/16", "10.1.0.0/16"]],
  ])("reads TRUSTED_PROXIES=%j", (value, expected) => {
    expect(loadConfig({ ...valid, TRUSTED_PROXIES: value }).trustedProxies).toEqual(
      expected,
    );
  });

  it.each([
    "10.0.0.0/16,",
    "none,10.0.0.0/16",
    "localhost",
    "abc",
    "10.0.0.0/33",
    "10.0.0.0/x",
    "fd00::/129",
  ])("rejects TRUSTED_PROXIES=%j", (value) => {
    expect(errorFor({ ...valid, TRUSTED_PROXIES: value })).toMatch(
      /TRUSTED_PROXIES: (?!missing)/,
    );
  });
```

- [x] **Step 3: Run them and see them fail**

Run: `pnpm test config`
Expected: FAIL. "returns the typed config" fails on the missing `trustedProxies`; the `reads TRUSTED_PROXIES` cases fail with `undefined`; the `rejects` cases fail with `expected loadConfig to throw`; "names TRUSTED_PROXIES when it is missing" fails, since the setting is not checked yet.

- [x] **Step 4: Add the setting to `config.ts`**

In `apps/api/src/config.ts`, add `import { isIP } from "node:net";` after the `node:path` import, and before `const envSchema`:

```ts
// An IPv4 or IPv6 address, optionally with a CIDR prefix length.
function isAddressOrRange(entry: string): boolean {
  const [address = "", prefix, ...rest] = entry.split("/");
  const version = isIP(address);
  if (version === 0 || rest.length > 0) return false;
  if (prefix === undefined) return true;
  return /^\d+$/.test(prefix) && Number(prefix) <= (version === 4 ? 32 : 128);
}

// The proxies whose X-Forwarded-For entries are believed, by address: "none",
// or a comma-separated list of addresses and ranges. Never a hop count, which
// Fastify ignores, and never "trust everything" (ADR 0025, decision 7).
const trustedProxies = z
  .string()
  .min(1)
  .refine(
    (value) =>
      value === "none" ||
      value.split(",").every((entry) => isAddressOrRange(entry.trim())),
    'must be "none" or a comma-separated list of IP addresses and CIDR ranges',
  )
  .transform((value) =>
    value === "none" ? [] : value.split(",").map((entry) => entry.trim()),
  );
```

In `envSchema`, after `WEB_ROOT`:

```ts
  // In AWS, the VPC's range, where the load balancer lives; "none" locally.
  TRUSTED_PROXIES: trustedProxies,
```

In `interface Config`, after `webRoot`:

```ts
  // Passed to Fastify's trustProxy; empty trusts nothing.
  trustedProxies: string[];
```

In `loadConfig`'s return, after `webRoot: resolve(data.WEB_ROOT),`: `trustedProxies: data.TRUSTED_PROXIES,`.

- [x] **Step 5: Run the config tests and see them pass**

Run: `pnpm test config`
Expected: PASS.

- [x] **Step 6: Add the shared test config and switch the two existing copies to it**

Create `apps/api/src/test/config.ts`:

```ts
import type { Config } from "../config.ts";

// A whole Config for tests; each test overrides only what it is about.
export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    host: "127.0.0.1",
    port: 3000,
    logLevel: "silent",
    // Not used: each test passes its own database to buildApp.
    database: { host: "", port: 1, name: "", user: "", password: "" },
    // Not served: tests that serve the SPA pass their own folder.
    webRoot: "/nonexistent/szop-web-root",
    trustedProxies: [],
    ...overrides,
  };
}
```

In `apps/api/src/health/routes.test.ts`, replace the `const config: Config = { … };` block with `const config = testConfig();`, import `testConfig` from `"../test/config.ts"`, and drop the now unused `Config` import.

In `apps/api/src/web/routes.test.ts`, delete the `configFor` function, replace `configFor(root)` with `testConfig({ webRoot: root })`, import `testConfig` from `"../test/config.ts"`, and drop the now unused `Config` import.

- [x] **Step 7: Document the setting in `.env.example`**

Append to `apps/api/.env.example`:

```
# The proxies in front of the API whose X-Forwarded-For entries are believed:
# "none", or a comma-separated list of IP addresses and CIDR ranges. Locally
# nothing sits in front of the API, so "none". In AWS, the VPC's range, where
# the load balancer lives. Never wider than the proxies' own addresses: whoever
# holds a trusted address can choose the client address the API logs and
# rate-limits (ADR 0025).
TRUSTED_PROXIES=none
```

- [x] **Step 8: Run every check**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check`
Expected: all pass.

- [x] **Step 9: Tick this task's boxes and commit**

```bash
git add apps/api/src/config.ts apps/api/src/config.test.ts apps/api/.env.example apps/api/src/test/config.ts apps/api/src/health/routes.test.ts apps/api/src/web/routes.test.ts docs/superpowers/plans/2026-10-10-PH-06b-web-security-baseline.md
git commit -F - <<'EOF'
feat(api): add the TRUSTED_PROXIES setting

The proxies whose X-Forwarded-For entries are believed, by address, or
none. Tests share one config helper.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBAbavVi1nADpvFxUxRfyy
EOF
```

---

### Task 2: The request log and the client address

**Files:**
- Create: `apps/api/src/security/log.ts`, `apps/api/src/security/log.test.ts`, `apps/api/src/security/client-ip.test.ts`, `apps/api/src/test/log.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Consumes: `Config.trustedProxies`, `testConfig()` (Task 1).
- Produces: `redactUrl(url: string): string` and `requestSerializer(request: FastifyRequest)` in `security/log.ts`; `LogStream` (`{ write(line: string): void }`) and `AppDeps.logStream?: LogStream` in `app.ts`; `captureLog(): { stream: LogStream; lines(): LogLine[] }` in `src/test/log.ts`, where `LogLine` is `Record<string, unknown>`.

- [x] **Step 1: Add the log capture helper**

Create `apps/api/src/test/log.ts`:

```ts
import type { LogStream } from "../app.ts";

export type LogLine = Record<string, unknown>;

// An in-memory log for one app: pass `stream` to buildApp as logStream, and
// read what was logged with `lines()`. The app must log at "info" or below.
export function captureLog(): { stream: LogStream; lines(): LogLine[] } {
  const written: string[] = [];
  return {
    stream: {
      write(line: string): void {
        written.push(line);
      },
    },
    lines(): LogLine[] {
      return written.map((line) => JSON.parse(line) as LogLine);
    },
  };
}
```

- [x] **Step 2: Write the failing tests for the log**

Create `apps/api/src/security/log.test.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { captureLog } from "../test/log.ts";
import { redactUrl } from "./log.ts";

describe("redactUrl", () => {
  it.each([
    ["/api/health", "/api/health"],
    ["/reset-password?token=abc", "/reset-password?token=[redacted]"],
    [
      "/verify?token=abc&next=/lists",
      "/verify?token=[redacted]&next=[redacted]",
    ],
    ["/a?tag=x&tag=y", "/a?tag=[redacted]&tag=[redacted]"],
    ["/a?a=", "/a?a=[redacted]"],
    ["/a?abc123", "/a?[redacted]"],
    ["/a?q=%2Fsecret%20x", "/a?q=[redacted]"],
    ["/a?x=1=2", "/a?x=[redacted]"],
    ["/a?a=1&&b=2", "/a?a=[redacted]&&b=[redacted]"],
    ["/a?", "/a?"],
  ])("logs %j as %j", (url, expected) => {
    expect(redactUrl(url)).toBe(expected);
  });
});

describe("the request log", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("logs a page's URL with its token hidden", async () => {
    const log = captureLog();
    app = buildApp({
      config: testConfig({ logLevel: "info" }),
      db: database.db,
      logStream: log.stream,
    });

    await app.inject({ method: "GET", url: "/reset-password?token=s3cret" });

    const incoming = log.lines().find((line) => line.msg === "incoming request");
    expect(incoming?.req).toMatchObject({
      method: "GET",
      url: "/reset-password?token=[redacted]",
    });
    expect(JSON.stringify(log.lines())).not.toContain("s3cret");
  });

  it("keeps the token out of the error line", async () => {
    const log = captureLog();
    app = buildApp({
      config: testConfig({ logLevel: "info" }),
      db: database.db,
      logStream: log.stream,
    });
    // A route that fails: Fastify's error line carries the request too.
    app.get("/api/test-fails", () => {
      throw new Error("kaput");
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/test-fails?token=s3cret",
    });

    expect(response.statusCode).toBe(500);
    expect(log.lines().some((line) => line.msg === "kaput")).toBe(true);
    expect(JSON.stringify(log.lines())).not.toContain("s3cret");
  });
});
```

Create `apps/api/src/security/client-ip.test.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { captureLog } from "../test/log.ts";

// The client wrote the first entry; the load balancer appended the second,
// the address it saw (ADR 0012, decision 13; ADR 0025, decision 7).
const forged = { "x-forwarded-for": "6.6.6.6, 203.0.113.7" };

describe("the client address", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  // The remoteAddress the log recorded for one request.
  async function loggedAddress(
    trustedProxies: string[],
    remoteAddress: string,
    headers: Record<string, string>,
  ): Promise<unknown> {
    const log = captureLog();
    app = buildApp({
      config: testConfig({ logLevel: "info", trustedProxies }),
      db: database.db,
      logStream: log.stream,
    });
    await app.inject({ method: "GET", url: "/api/health", remoteAddress, headers });
    const incoming = log.lines().find((line) => line.msg === "incoming request");
    return (incoming?.req as { remoteAddress?: unknown } | undefined)
      ?.remoteAddress;
  }

  it.each([
    ["through the load balancer", "10.0.1.5", "203.0.113.7"],
    ["through the load balancer, seen as IPv6", "::ffff:10.0.1.5", "203.0.113.7"],
    ["from a client connecting directly", "198.51.100.9", "198.51.100.9"],
  ])(
    "trusting 10.0.0.0/16, logs a request %s (from %s) as %s",
    async (_, from, expected) => {
      expect(await loggedAddress(["10.0.0.0/16"], from, forged)).toBe(
        expected,
      );
    },
  );

  it("trusting no proxy, ignores the header", async () => {
    expect(await loggedAddress([], "10.0.1.5", forged)).toBe("10.0.1.5");
  });

  it("logs the load balancer itself when it sends no header", async () => {
    expect(await loggedAddress(["10.0.0.0/16"], "10.0.1.5", {})).toBe(
      "10.0.1.5",
    );
  });
});
```

- [x] **Step 3: Run them and see them fail**

Run: `pnpm test security`
Expected: FAIL. `log.test.ts` fails to import `./log.ts`; `client-ip.test.ts` fails because `logStream` is not a property of `AppDeps` at type level, and at run time nothing is captured (`undefined` instead of the address).

- [x] **Step 4: Write `security/log.ts`**

```ts
import type { FastifyRequest } from "fastify";

// Hides every query value and keeps the names, so a token never reaches the
// log, whatever its parameter is called. Tokens travel in the query string,
// never in the path (ADR 0012, decision 9; ADR 0025, decision 6). A parameter
// without "=" is hidden whole: the bare value could be a token.
export function redactUrl(url: string): string {
  const start = url.indexOf("?");
  if (start === -1) return url;
  const query = url
    .slice(start + 1)
    .split("&")
    .map((parameter) => {
      if (parameter === "") return parameter;
      const equals = parameter.indexOf("=");
      return equals === -1
        ? "[redacted]"
        : `${parameter.slice(0, equals)}=[redacted]`;
    })
    .join("&");
  return `${url.slice(0, start)}?${query}`;
}

// Fastify's default request serializer with the URL redacted, used by every
// log line that carries the request ("incoming request", errors). It leaves
// out `version`, the Accept-Version header, which Szop does not use.
export function requestSerializer(request: FastifyRequest): {
  method: string;
  url: string;
  host: string;
  remoteAddress: string;
  remotePort: number | undefined;
} {
  return {
    method: request.method,
    url: redactUrl(request.url),
    host: request.host,
    // The address behind the trusted proxies (ADR 0025, decision 7).
    remoteAddress: request.ip,
    remotePort: request.socket.remotePort,
  };
}
```

- [x] **Step 5: Wire the log and the trusted proxies into `buildApp`**

In `apps/api/src/app.ts`, import `requestSerializer` from `"./security/log.ts"`, and replace the `AppDeps` interface and the `Fastify(…)` call:

```ts
// Where the log goes: anything that takes one line at a time.
export interface LogStream {
  write(line: string): void;
}

// Everything the app needs from outside. Production and tests both call
// buildApp, passing real or fake dependencies (ADR 0007, decision 14).
export interface AppDeps {
  config: Config;
  db: Database;
  // Stdout when left out. Tests pass a stream they read back (ADR 0025,
  // decision 9).
  logStream?: LogStream;
}

export function buildApp({ config, db, logStream }: AppDeps): FastifyInstance {
  const app = Fastify({
    // By address, never a hop count or true (ADR 0025, decision 7).
    trustProxy: config.trustedProxies,
    logger: {
      level: config.logLevel,
      stream: logStream,
      serializers: { req: requestSerializer },
    },
  });
```

The rest of `buildApp` is unchanged.

- [x] **Step 6: Run the tests and see them pass**

Run: `pnpm test security`
Expected: PASS. If the IPv6 case fails, stop and report: the probe showed it passing.

- [x] **Step 7: Check that development still logs**

Run, with PostgreSQL up: `timeout 8 pnpm --filter @szop/api dev; true`
Expected: pino-pretty's coloured lines, `migrations applied` and `Server listening at http://127.0.0.1:3000`. Then run every check: `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check`.

- [x] **Step 8: Tick this task's boxes and commit**

```bash
git add apps/api/src/app.ts apps/api/src/security/log.ts apps/api/src/security/log.test.ts apps/api/src/security/client-ip.test.ts apps/api/src/test/log.ts docs/superpowers/plans/2026-10-10-PH-06b-web-security-baseline.md
git commit -F - <<'EOF'
feat(api): log the real client address and hide query values

Fastify trusts X-Forwarded-For only from TRUSTED_PROXIES, and every
query value in a logged URL is redacted.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBAbavVi1nADpvFxUxRfyy
EOF
```

---

### Task 3: Security headers

**Files:**
- Create: `apps/api/src/security/headers.ts`, `apps/api/src/security/headers.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/package.json` and `pnpm-lock.yaml` (through `pnpm add`), `apps/web/vite.config.ts`

**Interfaces:**
- Consumes: `testConfig()` (Task 1); `useWebRoot()` and `webRootFiles` from `src/test/web-root.ts` (existing).
- Produces: `headers`, a `fastify-plugin` plugin exported from `security/headers.ts`, registered first in `buildApp`.

- [ ] **Step 1: Add the packages**

Run: `pnpm --filter @szop/api add @fastify/helmet@^13.1.2 fastify-plugin@^6.0.1`
Expected: both in `apps/api/package.json`'s `dependencies`. If pnpm stops with `ERR_PNPM_IGNORED_BUILDS`, stop and report to the controller (Global Constraints).

- [ ] **Step 2: Write the failing header tests**

Create `apps/api/src/security/headers.test.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";
import { useWebRoot } from "../test/web-root.ts";

// ADR 0012, decision 8; ADR 0025, decisions 4 and 5.
const csp =
  "default-src 'self';object-src 'none';base-uri 'none';form-action 'self';frame-ancestors 'none'";

describe("security headers", () => {
  const database = useTestDatabase();
  const webRoot = useWebRoot();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it.each([
    ["a JSON response", "GET", "/api/health", 200],
    ["the SPA's index.html", "GET", "/", 200],
    ["a fingerprinted asset", "GET", "/assets/index-abc123.js", 200],
    ["the JSON 404", "GET", "/api/nope", 404],
  ] as const)("are on %s", async (_, method, url, status) => {
    app = buildApp({
      config: testConfig({ webRoot: webRoot.path }),
      db: database.db,
    });

    const response = await app.inject({ method, url });

    expect(response.statusCode).toBe(status);
    expect(response.headers["content-security-policy"]).toBe(csp);
    expect(response.headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `pnpm test headers`
Expected: FAIL: every case gets `undefined` for `content-security-policy`.

- [ ] **Step 4: Write `security/headers.ts`**

```ts
import helmet from "@fastify/helmet";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

// The security headers on every response (ADR 0012, decision 8). The CSP is
// written out in full, with helmet's defaults off: they would allow inline
// styles and data: fonts (ADR 0025, decision 4). HSTS covers subdomains, for
// a year, without preload (ADR 0025, decision 5). Helmet's other headers keep
// their defaults.
async function securityHeaders(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: false,
    },
    referrerPolicy: { policy: "no-referrer" },
  });
}

// fastify-plugin turns off encapsulation, so the headers reach every route,
// the SPA's files and the not-found handler included.
export const headers = fp(securityHeaders, { name: "szop-security-headers" });
```

- [ ] **Step 5: Register it first in `buildApp`**

In `apps/api/src/app.ts`, import `headers` from `"./security/headers.ts"`, and right after the `Fastify(…)` call, before `healthRoutes`:

```ts
  // The web baseline, before any route, so every response and request goes
  // through it (ADR 0012, decisions 7 and 8).
  app.register(headers);
```

- [ ] **Step 6: Run the tests and see them pass**

Run: `pnpm test headers`
Expected: PASS. If the asset or `/` case lacks the headers, stop and report: `@fastify/static` would be bypassing the hooks.

- [ ] **Step 7: Keep the build inside the CSP**

In `apps/web/vite.config.ts`, inside `defineConfig({ … })`, after `plugins: […],`:

```ts
  build: {
    // Small assets become files, never data: URIs, which the CSP's
    // default-src 'self' blocks (ADR 0025, decision 4).
    assetsInlineLimit: 0,
  },
```

Run before and after the change, and compare: `pnpm build && ls -R apps/web/dist`.
Expected: the same files before and after (nothing is small enough to be inlined today), and the first-screen line unchanged.

- [ ] **Step 8: Run every check**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check`
Expected: all pass.

- [ ] **Step 9: Tick this task's boxes and commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/app.ts apps/api/src/security/headers.ts apps/api/src/security/headers.test.ts apps/web/vite.config.ts docs/superpowers/plans/2026-10-10-PH-06b-web-security-baseline.md
git commit -F - <<'EOF'
feat(api): send the security headers on every response

@fastify/helmet with the CSP written out, HSTS for a year with
subdomains, and no referrer. Vite no longer inlines small assets as
data: URIs, which the CSP blocks.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBAbavVi1nADpvFxUxRfyy
EOF
```

---

### Task 4: The cross-site check

**Files:**
- Create: `apps/api/src/security/cross-site.ts`, `apps/api/src/security/cross-site.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/security/headers.test.ts`, `apps/api/src/web/routes.test.ts`

**Interfaces:**
- Consumes: `testConfig()` (Task 1); `headers` registered first (Task 3).
- Produces: `crossSite`, a `fastify-plugin` plugin exported from `security/cross-site.ts`, registered after `headers`. Every later test that sends POST, PUT, PATCH or DELETE must send `Sec-Fetch-Site: same-origin`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/security/cross-site.test.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";

const unsafe = ["POST", "PUT", "PATCH", "DELETE"] as const;

const refused = {
  statusCode: 403,
  error: "Forbidden",
  message: "Cross-site request refused",
};

describe("the cross-site check", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  // No route changes data yet, so the test adds one, answering every method.
  function start(): FastifyInstance {
    app = buildApp({ config: testConfig(), db: database.db });
    app.route({
      method: ["GET", ...unsafe],
      url: "/api/test-unsafe",
      handler: () => ({ ok: true }),
    });
    return app;
  }

  async function send(
    method: "GET" | (typeof unsafe)[number],
    headers: Record<string, string>,
  ): Promise<{ statusCode: number; body: unknown }> {
    const response = await start().inject({
      method,
      url: "/api/test-unsafe",
      headers,
    });
    return { statusCode: response.statusCode, body: response.json() };
  }

  describe.each(unsafe)("%s", (method) => {
    it("passes with Sec-Fetch-Site: same-origin", async () => {
      const response = await send(method, { "sec-fetch-site": "same-origin" });
      expect(response.statusCode).toBe(200);
    });

    // same-site is a sibling subdomain: another site to Szop, and SameSite=Lax
    // alone would not stop it.
    it.each(["same-site", "cross-site", "none"])(
      "refuses Sec-Fetch-Site: %s",
      async (site) => {
        const response = await send(method, { "sec-fetch-site": site });
        expect(response).toEqual({ statusCode: 403, body: refused });
      },
    );

    it("passes without Sec-Fetch-Site when Origin matches Host", async () => {
      const response = await send(method, {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      });
      expect(response.statusCode).toBe(200);
    });

    it.each([
      ["another host", "https://evil.example"],
      ["the same host name on another port", "http://localhost:5173"],
      ["an opaque origin", "null"],
    ])("refuses an Origin from %s", async (_, origin) => {
      const response = await send(method, { host: "localhost:3000", origin });
      expect(response).toEqual({ statusCode: 403, body: refused });
    });

    it("refuses a request with neither header", async () => {
      const response = await send(method, {});
      expect(response).toEqual({ statusCode: 403, body: refused });
    });

    it("Sec-Fetch-Site wins over a matching Origin", async () => {
      const response = await send(method, {
        "sec-fetch-site": "cross-site",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      });
      expect(response).toEqual({ statusCode: 403, body: refused });
    });
  });

  it("does not check GET, which never changes anything", async () => {
    const response = await send("GET", { "sec-fetch-site": "cross-site" });
    expect(response.statusCode).toBe(200);
  });
});
```

In `apps/api/src/security/headers.test.ts`, add a fifth row to the `it.each`, so a refused request is proven to carry the headers too:

```ts
    ["a refused cross-site request", "POST", "/api/health", 403],
```

In `apps/api/src/web/routes.test.ts`, the `it.each` "answers %s %s with Fastify's JSON 404" sends POST without the header, which is now a 403 before routing. Change its call to `start().inject({ method, url, headers: { "sec-fetch-site": "same-origin" } })`, with a comment above the `it.each`: `// Same-origin, so POST passes the cross-site check and reaches routing.`

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test cross-site headers`
Expected: FAIL: every refusal case gets 200 instead of 403, and the headers test's new row gets 404.

- [ ] **Step 3: Write `security/cross-site.ts`**

```ts
import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

// GET, HEAD and OPTIONS never change anything (ADR 0012, decision 7).
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

// Whether the request comes from the app itself. Sec-Fetch-Site is set by the
// browser, and page scripts cannot change it; without it, the Origin's host
// must be the request's own Host. A request with neither is refused (ADR 0025,
// decisions 1 and 2). The raw Host header, not request.host, which reads
// X-Forwarded-Host behind a trusted proxy.
function comesFromTheApp(request: FastifyRequest): boolean {
  const site = request.headers["sec-fetch-site"];
  if (site !== undefined) return site === "same-origin";
  const origin = request.headers.origin;
  if (origin === undefined) return false;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    // Not a URL, such as the opaque origin "null".
    return false;
  }
}

// Refuses every unsafe request that does not come from the app: the defense
// against cross-site request forgery (CSRF). It protects users' browsers from
// other sites; scripts calling the API directly are met by sessions, limits
// and quotas instead.
function crossSiteCheck(app: FastifyInstance): void {
  app.addHook("onRequest", (request, reply, done) => {
    if (safeMethods.has(request.method) || comesFromTheApp(request)) {
      done();
      return;
    }
    // Fastify's error shape until the app has its own (OP-071).
    void reply.code(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Cross-site request refused",
    });
  });
}

// fastify-plugin turns off encapsulation, so the check reaches every route.
export const crossSite = fp(crossSiteCheck, { name: "szop-cross-site" });
```

- [ ] **Step 4: Register it after `headers`**

In `apps/api/src/app.ts`, import `crossSite` from `"./security/cross-site.ts"` and add `app.register(crossSite);` right after `app.register(headers);`.

- [ ] **Step 5: Run the tests and see them pass**

Run: `pnpm test cross-site headers web`
Expected: PASS.

- [ ] **Step 6: Run every check**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check`
Expected: all pass. If ESLint flags the hook's parameters or `reply.send`, fix it within the rule's intent (`void` for the send) and report what changed.

- [ ] **Step 7: Tick this task's boxes and commit**

```bash
git add apps/api/src/app.ts apps/api/src/security/cross-site.ts apps/api/src/security/cross-site.test.ts apps/api/src/security/headers.test.ts apps/api/src/web/routes.test.ts docs/superpowers/plans/2026-10-10-PH-06b-web-security-baseline.md
git commit -F - <<'EOF'
feat(api): refuse unsafe requests that do not come from the app

Every method but GET, HEAD and OPTIONS needs Sec-Fetch-Site:
same-origin or, without it, an Origin matching the Host; otherwise 403.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBAbavVi1nADpvFxUxRfyy
EOF
```

---

### Task 5: JSON-only bodies

**Files:**
- Create: `apps/api/src/security/json-only.ts`, `apps/api/src/security/json-only.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Consumes: `testConfig()` (Task 1); `crossSite` (Task 4), which every request here passes with `Sec-Fetch-Site: same-origin`.
- Produces: `jsonOnly`, a `fastify-plugin` plugin exported from `security/json-only.ts`, registered after `crossSite`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/security/json-only.test.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { testConfig } from "../test/config.ts";
import { useTestDatabase } from "../test/database.ts";

// Every request here is same-origin, so it passes the cross-site check and
// only the body rule is under test (ADR 0025, decision 3).
const sameOrigin = { "sec-fetch-site": "same-origin" };

describe("JSON-only bodies", () => {
  const database = useTestDatabase();
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  // No route takes a body yet, so the test adds one.
  function start(): FastifyInstance {
    app = buildApp({ config: testConfig(), db: database.db });
    app.route({
      method: ["POST", "DELETE"],
      url: "/api/test-body",
      handler: () => ({ ok: true }),
    });
    return app;
  }

  // The three content types an HTML form can send: the "simple requests" a
  // browser sends to another site without asking first.
  it.each([
    ["text/plain", "x"],
    ["application/x-www-form-urlencoded", "a=1"],
    ["multipart/form-data; boundary=x", "--x--"],
  ])("refuses a %s body with 415", async (type, payload) => {
    const response = await start().inject({
      method: "POST",
      url: "/api/test-body",
      headers: { ...sameOrigin, "content-type": type },
      payload,
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({
      statusCode: 415,
      error: "Unsupported Media Type",
    });
  });

  it.each(["application/json", "application/json; charset=utf-8"])(
    "accepts a %s body",
    async (type) => {
      const response = await start().inject({
        method: "POST",
        url: "/api/test-body",
        headers: { ...sameOrigin, "content-type": type },
        payload: '{"name":"Milk"}',
      });

      expect(response.statusCode).toBe(200);
    },
  );

  it("refuses a body without a Content-Type with 415", async () => {
    const response = await start().inject({
      method: "POST",
      url: "/api/test-body",
      headers: sameOrigin,
      payload: '{"name":"Milk"}',
    });

    expect(response.statusCode).toBe(415);
  });

  it("passes a same-origin DELETE without a body: the JSON rule is about bodies", async () => {
    const response = await start().inject({
      method: "DELETE",
      url: "/api/test-body",
      headers: sameOrigin,
    });

    expect(response.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test json-only`
Expected: FAIL: the `text/plain` case gets 200 (Fastify still parses it). The other cases pass already, since Fastify has no parser for forms; they pin the behavior.

- [ ] **Step 3: Write `security/json-only.ts`**

```ts
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

// Bodies must be JSON (ADR 0012, decision 7). Fastify parses JSON and plain
// text out of the box; without the text parser, every content type but JSON
// gets Fastify's 415, which closes the last body an HTML form on another
// site could send (ADR 0025, decision 3).
function jsonOnlyBodies(app: FastifyInstance): void {
  app.removeContentTypeParser("text/plain");
}

// fastify-plugin turns off encapsulation, so every route loses the parser.
export const jsonOnly = fp(jsonOnlyBodies, { name: "szop-json-only" });
```

- [ ] **Step 4: Register it after `crossSite`**

In `apps/api/src/app.ts`, import `jsonOnly` from `"./security/json-only.ts"` and add `app.register(jsonOnly);` right after `app.register(crossSite);`.

- [ ] **Step 5: Run the tests and see them pass**

Run: `pnpm test json-only`
Expected: PASS.

- [ ] **Step 6: Run every check**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check`
Expected: all pass.

- [ ] **Step 7: Tick this task's boxes and commit**

```bash
git add apps/api/src/app.ts apps/api/src/security/json-only.ts apps/api/src/security/json-only.test.ts docs/superpowers/plans/2026-10-10-PH-06b-web-security-baseline.md
git commit -F - <<'EOF'
feat(api): accept only JSON bodies

Fastify's text/plain parser is removed, so any body but JSON gets 415.

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBAbavVi1nADpvFxUxRfyy
EOF
```

---

### Task 6: Docs, registers and final checks

**Files:**
- Create: `docs/decisions/0025-web-security-baseline-details.md`
- Modify: `docs/decisions/0012-security-baseline.md` (status line and the cells of decisions 7, 8, 9 and 13), `docs/architecture/architecture.md`, `docs/architecture/threat-model.md`, `docs/architecture/stack-overview.md`, `docs/development/testing.md`, `docs/development/setup.md`, `docs/development/project-tracking.md`, `docs/glossary.md`, `docs/open-points.md`, `docs/roadmap.md`
- GitHub: issues #25, #26, #27, #94, #109; the project's items for #26 and #27

**Interfaces:**
- Consumes: the finished code and what Tasks 1 to 5 reported (any difference from the probes, any lint fix, any `allowBuilds` entry).
- Produces: the records the PR links to, and the state the PR is opened from.

- [ ] **Step 1: Write ADR 0025**

`docs/decisions/0025-web-security-baseline-details.md`, in the shape of [ADR 0023](../../decisions/0023-production-build-and-serving-details.md) (read it first):

- Title `# ADR 0025 — Web security baseline details`; `- **Status:** ✅ Accepted`; `- **Date:** 2026-10-10`;
- `- **Refines:** [ADR 0012](0012-security-baseline.md), decisions 7 (unsafe requests with neither header, the Origin fallback, JSON-only bodies through Fastify's parsers, see decisions 1 to 3), 8 (the CSP written out, HSTS's subdomains, the build's inline limit, see decisions 4 and 5), 9 (every query value hidden in the log, tokens only in the query, see decision 6) and 13 (the proxy trusted by address, TRUSTED_PROXIES, instead of a hop count, see decision 7)`.
- `## Context`: [PH-06b](../roadmap.md#ph-06b-web-security-baseline), split from PH-06 (retired); ADR 0012 set the direction; the brainstorm and the [spec](../superpowers/specs/2026-10-10-PH-06b-web-security-baseline-design.md) settled the details. Decision 7 was found while planning: Fastify 5.12 ignores a hop count.
- `## Decisions`: the spec's decisions 1 to 9, copied with their wording, links rewritten from `../../decisions/X` to `X` and from `../../` to `../`. Add what the implementation settled, as `<br>**Settled while building:** …` in the cells it touches: in decision 3, that a body without `Content-Type` and a form type with an empty body get 415 too; in decision 6, that Fastify's error line carries the request and is redacted by the same serializer; in decision 7, that an IPv4-mapped IPv6 address of the proxy matches its IPv4 range; anything Tasks 1 to 5 reported differently from the plan.
- `## Consequences`: every developer's `apps/api/.env` needs `TRUSTED_PROXIES=none`; PH-12 sets `TRUSTED_PROXIES` to the VPC's range and checks the demo's log once; tests send `Sec-Fetch-Site: same-origin` on unsafe requests; a non-browser client that must send unsafe requests needs a decision of its own; PH-18 and PH-29 build their own email links; the 403 and 415 use Fastify's shape until [OP-071](../open-points.md#op-071); `@fastify/helmet` and `fastify-plugin` are new dependencies; the open points changed (step 7); the living docs.

- [ ] **Step 2: Note the refinements in ADR 0012**

In the three places `CLAUDE.md` asks for (ADR 0025's header is step 1). Read ADR 0012's status line and the four cells first, and add in the same style as the notes already there:

- Status line: append `; decisions 7, 8, 9 and 13 refined by [ADR 0025](0025-web-security-baseline-details.md) (the details of the web baseline; the proxy trusted by address, not by hop count)`.
- Decision 7's cell, at the bottom: `<br>✏️ **Refined by [ADR 0025](0025-web-security-baseline-details.md), decisions 1 to 3:** a request with neither header is refused; the Origin's host is compared with the raw Host header; bodies are kept to JSON by removing Fastify's text/plain parser, which answers 415.`
- Decision 8's cell: `<br>✏️ **Refined by [ADR 0025](0025-web-security-baseline-details.md), decisions 4 and 5:** the CSP is written out in full with helmet's defaults off, Vite no longer inlines assets as data: URIs, and HSTS includes subdomains.`
- Decision 9's cell: `<br>✏️ **Refined by [ADR 0025](0025-web-security-baseline-details.md), decision 6:** the log hides every query value and keeps the names; tokens travel in the query string, never in the path.`
- Decision 13's cell: `<br>✏️ **Refined by [ADR 0025](0025-web-security-baseline-details.md), decision 7:** the proxy is trusted by its addresses (TRUSTED_PROXIES), not by a hop count, which Fastify 5.12 ignores because it cannot tell whether a connection really comes from the proxy.`

- [ ] **Step 3: Update the architecture, the threat model and the stack overview**

`docs/architecture/architecture.md` (read *Abuse protection*, *Web security* and the backend's *Code structure* first): the client-address line names `TRUSTED_PROXIES` and trust by address, "never `trustProxy: true` or a hop count"; *Web security*: a refused unsafe request gets 403, a body that is not JSON gets 415, the log hides every query value and keeps the names; *Code structure*: `security/` holds the four concerns, one file each.

`docs/architecture/threat-model.md` (read the actor table and the STRIDE table first): in the "Malicious website" row, the guard names the 403 for `same-site` as well as `cross-site`, and the 415 for a form's body; in the REST API's tampering cell, the 415; below the STRIDE table, or in *Risks accepted on purpose*, wherever it reads best: the cross-site check defends browsers only, since only page scripts cannot set `Sec-Fetch-Site` or `Origin`; scripts calling the API directly are met by sessions, rate limits and quotas. The "Reader of leaked data" row: tokens are hidden in the query strings of logged URLs.

`docs/architecture/stack-overview.md` (read its security section first; it already explains cookies, CSRF and helmet): add, for a learner, how fetch metadata works (`Sec-Fetch-Site`, set by the browser, a header page scripts cannot set) and why it beats a CSRF token on one origin; what a "simple request" is, and why that makes JSON-only bodies a defense; `X-Forwarded-For`, trusted proxies, and why trust follows addresses rather than hop counts (the Fastify 5.12 change, as a worked example); Fastify encapsulation and `fastify-plugin`, next to the existing paragraph on plugins; the CSP written out rather than helmet's defaults.

- [ ] **Step 4: Update the guides**

`docs/development/testing.md`, *Writing an API test*: unsafe requests send `Sec-Fetch-Site: same-origin`, or the cross-site check answers 403 before routing; `testConfig()` gives a whole `Config` and each test overrides what it is about; `captureLog()` and `logStream` read back what the app logged (with `logLevel: "info"`); a hook is tested before real routes exist by adding a throwaway route right after `buildApp` and before the first `inject()`. Keep `## Contents` in sync.

`docs/development/setup.md`: where `.env` is created (section 9 or wherever `WEB_ROOT`'s note is), say that an existing `apps/api/.env` needs the line `TRUSTED_PROXIES=none` from `.env.example`, and that without it the API and the tests stop with `TRUSTED_PROXIES: missing`.

`docs/development/project-tracking.md`, *How items move*: the row "An open point's part is done" becomes `The part ticked with its PR; the issue re-parented to the next phase, still open, and its Status set to ⬜ Backlog, or 📌 Todo if that phase is already picked: no workflow changes it on a re-parent`.

- [ ] **Step 5: Update the glossary**

`docs/glossary.md`, alphabetically, where missing (search first): **Fetch metadata** (request headers such as `Sec-Fetch-Site` that the browser sets to say where a request comes from; page scripts cannot set them, which makes them a defense against cross-site request forgery; see ADR 0025), **Simple request** (a request a browser sends to another site without asking first: GET, HEAD or POST with a form's content types; JSON-only bodies close it; see ADR 0025), **X-Forwarded-For** (a header each proxy appends the address it saw to; only entries added by trusted proxies are believed; see ADR 0025), if the glossary lists headers.

- [ ] **Step 6: Change the issues on GitHub first**

Read each issue's body before editing (`gh issue view N --repo luiki-dev/szop`), and keep its sections; write bodies through a file under `$CLAUDE_JOB_DIR/tmp` with `gh issue edit N --repo luiki-dev/szop --body-file <file>`. Links inside bodies follow [project tracking, links](../../development/project-tracking.md#links-inside-issue-bodies).

- **#25 (PH-06b):** in *Delivers*, `` `TRUSTED_PROXY_HOPS` `` becomes `` `TRUSTED_PROXIES` ``.
- **#26 (OP-053):** in the text, `` `TRUSTED_PROXY_HOPS` `` becomes `` `TRUSTED_PROXIES` ``. *Parts*: tick PH-06b (`- [x] **PH-06b:** everything except the demo check ✅ Done (branch link until the PR exists)`); the PH-12 part becomes `the one-time check on the demo that the log shows the real address, and TRUSTED_PROXIES set to the VPC's range from Terraform`; add `- [ ] **PH-18:** Better Auth handed the same client address, its exact trustedOrigins, and the forged-header test extended to its limiter` and `- [ ] **PH-20:** the forged-header test extended to @fastify/rate-limit`. *Source* gains ADR 0025, decision 7. Re-parent it under PH-12 (#41): `gh api -X POST repos/luiki-dev/szop/issues/41/sub_issues -F sub_issue_id="$(gh api repos/luiki-dev/szop/issues/26 -q .id)" -F replace_parent=true`. Set its project Status to ⬜ Backlog (`gh project item-edit`; project `PVT_kwHOEVZTps4BmW8P`, Status field `PVTSSF_lAHOEVZTps4BmW8PzhlAT9c`, option `9700a2cc`; the item id from `gh project item-list 3 --owner luiki-dev --format json --limit 300`).
- **#27 (OP-067):** *History* gains `- **Moved from PH-06b:** it does not depend on that phase.`; re-parent it under PH-07 (#36), the same way as #26. Its Status stays 📌 Todo, since PH-07 is next.
- **#109 (OP-055):** the PH-18 part gains `; email links built by the app with the token in the query string, not Better Auth's path-token default (ADR 0025, decision 6); the SPA removes a used token from the address bar (ADR 0012, decision 9)`; the PH-29 part gains `; the reset link built the same way`. *Source* gains ADR 0025, decision 6.
- **#94 (OP-071):** the text gains `Until then, the 403 of the cross-site check and the 415 of the JSON rule use Fastify's shape too (ADR 0025).`

Then confirm with `gh issue view` on each, and `gh project item-list 3 --owner luiki-dev --format json --limit 300 -q '.items[] | select(.content.number==26 or .content.number==27) | {n:.content.number,status}'`.

- [ ] **Step 7: Mirror them in the register and the roadmap**

`docs/open-points.md`, following *How it works* (read it first):

- **OP-053:** the same text and parts as #26; `- **Status:** ⬜ Open`; move the entry to `### PH-12 First deploy`'s group, and drop it from that group's `Also:` line; add `[OP-053](#op-053)` to the `Also:` lines of `### PH-18 Registration and login` and `### PH-20 Quotas and rate limits` (create the line, in the `Roadmap entry: …\` + `Also: …` form PH-12 uses, if missing).
- **OP-067:** the new *Moved from PH-06b* line; move it to `### PH-07 First E2E journey`'s group.
- **OP-055**, **OP-071:** the same additions as #109 and #94.
- Check that PH-06b's group now holds only its heading and its roadmap link, as PH-06a's does.

`docs/roadmap.md`: PH-06b's *Delivers* says `` `TRUSTED_PROXIES` `` instead of `` `TRUSTED_PROXY_HOPS` `` and gains `([ADR 0025](decisions/0025-web-security-baseline-details.md))`; the row's Plan column links this plan (the plan commit set it; check). The row stays `🚧 In progress`; the README diagram stays at ◐ until the PR.

- [ ] **Step 8: The end-to-end check in Chrome**

```bash
docker compose up -d --wait
pnpm build
pnpm start > "$CLAUDE_JOB_DIR/tmp/szop-start.log" 2>&1 &
```

Then, through the `chrome-devtools-win` MCP server (`~/.claude/CLAUDE.md`: Windows Chrome on port 9222; if `curl -s http://127.0.0.1:9222/json/version` returns nothing, ask the controller to start it), open `http://localhost:3000`, and check and record for the PR:

- the page shows `API: ok`, `Database: up` and the schema version;
- the console has no CSP violation (no "Refused to …" message);
- in the network requests, the document, the JavaScript and `/api/health` each carry the CSP, HSTS and `Referrer-Policy` headers;
- from the page's console, `fetch("/api/health", { method: "POST" })` answers 404, since it is same-origin and reaches routing; and `curl -s -X POST -H "Origin: https://evil.example" http://localhost:3000/api/health` from the shell answers the 403 body.

Then `pkill -f "node --env-file=.env src/server.ts"`. If the browser cannot be reached, check the headers with `curl -sI` instead, and say so.

- [ ] **Step 9: Walk through the definition of done**

Read `docs/development/definition-of-done.md` and note each item's state for the PR. Expected: tests ✅; domain rules ➖ N/A: no domain rules; CI after the push; the demo check ➖ N/A: no demo environment until PH-12, which does this phase's demo check (OP-053); `infra/base` ➖ N/A; the living docs and threat model ✅; open points ✅ (step 7); UI screenshots ➖ N/A: the UI does not change. Read every item; this list is a forecast, not the answer.

- [ ] **Step 10: Links, final checks and a self-review of the diff**

```bash
for f in docs/decisions/0025-web-security-baseline-details.md docs/decisions/0012-security-baseline.md docs/architecture/*.md docs/development/*.md docs/glossary.md docs/open-points.md docs/roadmap.md README.md; do
  grep -oE '\]\([^)#]+' "$f" | sed 's/](//' | grep -v '^http' | sort -u | while read -r l; do [ -e "$(dirname "$f")/$l" ] || echo "BROKEN in $f: $l"; done
done; echo "link check done"
grep -rn "TRUSTED_PROXY_HOPS" docs README.md apps | grep -v "superpowers/\|decisions/0012\|decisions/0025\|audits/"
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
git diff main --stat
```

Expected: `link check done` with no `BROKEN` line; the `grep` prints nothing (the old name survives only in ADR 0012, ADR 0025, specs, plans and audits); every check passes. Check by eye that each changed document's `## Contents` lists its `##` and `###` headings, and that requirements are linked, never plain IDs. Read the whole diff against the spec's *Goal and success criteria*, one by one, and list any gap.

- [ ] **Step 11: Tick this task's boxes and commit**

```bash
git add docs
git commit -F - <<'EOF'
docs(adr): add ADR 0025 and update the docs for PH-06b

Co-Authored-By: Claude <the implementer's model> <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBAbavVi1nADpvFxUxRfyy
EOF
```

---

## After tasks 1–6: open the PR

Only when the owner says so, after reviewing Task 6.

1. Run every check once more, with PostgreSQL running: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build`.
2. Open the PR with `gh pr create`: title `feat(api): add the web security baseline`; the body fills `.github/pull_request_template.md`, says `Closes #25` (OP-053 stays open for its later parts), lists the issue changes of Task 6, step 6 that the doc diff mirrors ([project tracking, the trial rule](../../development/project-tracking.md#the-trial-rule)), holds Task 6, step 8's browser check in *How it was tested*, the definition of done as walked through in Task 6, step 9, and a note for the owner: add `TRUSTED_PROXIES=none` to `apps/api/.env`.
3. Then, in one commit (`docs(roadmap): mark PH-06b done`): the PR link in PH-06b's roadmap row and in OP-053's ticked part, on GitHub first (#26), then in the register; the row set to `✅ Done`; the README diagram's PH-06b marker `◐` → `●` ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)). Push.
4. Check that CI is green and `ci-ok` passes. Link the run in the PR.
5. Stop. The owner reviews and merges.
