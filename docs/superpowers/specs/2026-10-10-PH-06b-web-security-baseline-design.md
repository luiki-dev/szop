# PH-06b Web security baseline — design

- **Phase:** [PH-06b](../../roadmap.md#ph-06b-web-security-baseline)
- **Date:** 2026-10-10
- **Path:** full (spec and plan), [ADR 0004](../../decisions/0004-implementation-process.md), decision 8
- **Open points:** [OP-053](../../open-points.md#op-053) (PH-06b part; new PH-18 and PH-20 parts); [OP-055](../../open-points.md#op-055) gains two rules; [OP-071](../../open-points.md#op-071) gains a note; [OP-067](../../open-points.md#op-067) moved to [PH-07](../../roadmap.md#ph-07-first-e2e-journey)

Every response the API sends carries the security headers, and every request that could change data is checked before any route sees it, so the first endpoint that changes data, in a later phase, is protected from its first line. The direction was settled by [ADR 0012](../../decisions/0012-security-baseline.md): decision 7 (unsafe requests must come from the app itself and carry JSON), decision 8 (`@fastify/helmet` with a strict Content Security Policy (CSP), HTTP Strict Transport Security (HSTS) and `Referrer-Policy: no-referrer`), decision 9 (tokens stripped from logged URLs) and decision 13 (exactly the configured number of proxy hops trusted for the client address). This spec holds the details those left to the phase, as agreed in the brainstorm.

## Contents

- [Goal and success criteria](#goal-and-success-criteria)
- [Out of scope](#out-of-scope)
- [Decisions taken in the brainstorm](#decisions-taken-in-the-brainstorm)
- [Design](#design)
  - [Layout](#layout)
  - [The TRUSTED_PROXY_HOPS setting](#the-trusted_proxy_hops-setting)
  - [Wiring in buildApp](#wiring-in-buildapp)
  - [Security headers](#security-headers)
  - [The cross-site check](#the-cross-site-check)
  - [JSON-only bodies](#json-only-bodies)
  - [The request log](#the-request-log)
  - [The web build](#the-web-build)
  - [Tests](#tests)
  - [Dependencies](#dependencies)
- [Documentation and records](#documentation-and-records)
- [Tasks](#tasks)
- [To verify during implementation](#to-verify-during-implementation)

## Goal and success criteria

The roadmap's goal: every response carries the security headers and every unsafe request is checked, before the first endpoint that changes data exists. API tests prove the headers, the request checks, the client address behind a forged `X-Forwarded-For` and the tokens stripped from logged URLs.

The phase is done when:

- API tests prove that a JSON response, the SPA's `index.html`, a fingerprinted asset, the JSON 404 and a refused request all carry the exact CSP, HSTS, `Referrer-Policy` and `X-Content-Type-Options` headers;
- API tests prove the cross-site check row by row ([decision 1](#decisions-taken-in-the-brainstorm), [The cross-site check](#the-cross-site-check)) for POST, PUT, PATCH and DELETE, and that safe methods are not checked;
- API tests prove that a form's content types get a 415 and that JSON bodies and body-less requests pass;
- API tests prove that, behind one trusted hop, a forged `X-Forwarded-For` does not change the logged client address, and that with no trusted hop the header is ignored;
- API tests prove that a token in a query string never reaches the log;
- `TRUSTED_PROXY_HOPS` is required and validated at startup like every other setting;
- checked by hand: after `pnpm build` and `pnpm start`, the app at `http://localhost:3000` loads in Chrome with no CSP violation in the console, and DevTools shows the headers on `/`, on an asset and on `/api/health`;
- `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm build` pass, and CI's `ci-ok` is green on the PR;
- ADR 0025, the architecture, the threat model, the stack overview, the testing and setup guides, the project tracking guide, the glossary, the roadmap, the README diagram, the open points and their GitHub issues describe all of the above.

The demo check of the [definition of done](../../development/definition-of-done.md) is ➖ N/A: nothing deploys until [PH-12](../../roadmap.md#ph-12-first-deploy), which also does the one-time check that the demo's log shows the real client address ([OP-053](../../open-points.md#op-053)).

## Out of scope

- **Better Auth's share of the baseline:** handing Better Auth the same client address, its exact `trustedOrigins`, and the forged-header test for its limiter. Better Auth arrives in [PH-18](../../roadmap.md#ph-18-registration-and-login); a new PH-18 part of [OP-053](../../open-points.md#op-053).
- **The rate limiter's key:** `@fastify/rate-limit` arrives in [PH-20](../../roadmap.md#ph-20-quotas-and-rate-limits), which extends the forged-header test to it; a new PH-20 part of [OP-053](../../open-points.md#op-053).
- **The session cookie's attributes** (`HttpOnly`, `Secure`, `SameSite=Lax`, the `__Host-` prefix): set with Better Auth in PH-18 ([OP-055](../../open-points.md#op-055)).
- **Building email links and removing a used token from the address bar:** the account phases, PH-18 and PH-29 ([OP-055](../../open-points.md#op-055)).
- **The app's JSON error shape:** the 403 and 415 answers use Fastify's shape until [OP-071](../../open-points.md#op-071) settles the app's own.
- **The WebSocket's `Origin` check:** the live updates phase, [PH-33](../../roadmap.md#ph-33-live-updates).
- **Failing E2E journeys on a CSP violation:** [PH-07](../../roadmap.md#ph-07-first-e2e-journey).
- **The CSP during `pnpm dev`:** Vite serves the SPA in development, without the API's headers; the policy applies to `pnpm start` and the deployed app, which is what PH-07's tests drive.

## Decisions taken in the brainstorm

ADR 0025 records decisions 1 to 9.

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | An unsafe request with neither `Sec-Fetch-Site` nor `Origin` | Let it through, as Go's `net/http.CrossOriginProtection` does; refuse it | **Refuse it with 403, as [ADR 0012](../../decisions/0012-security-baseline.md), decision 7 says.** The only allowed unsafe requests carry `Sec-Fetch-Site: same-origin`, or, without that header, an `Origin` whose host is the request's `Host`. Letting such requests through is sound reasoning: every browser of [NFR-1](../../requirements/functional-requirements.md#nfr-1) sends `Sec-Fetch-Site`, so a request with neither header is not a browser and cannot be cross-site request forgery (CSRF), which is a browser sending the user's cookie for another site. But it would change an accepted decision for convenience only: nothing sends unsafe requests from outside a browser today (the load balancer's health check is a GET), refusing fails closed if a browser setup ever strips both headers, and the cost is one header in tests and in `curl`. **Revisit** when a non-browser client must send unsafe requests, such as a webhook or a native app; that phase decides an exemption and records it. The check defends against a malicious site steering the user's browser, nothing else: page scripts cannot set `Sec-Fetch-Site` or `Origin`, but any other program can, so scripts calling the API directly are met by sessions, rate limits and quotas. |
| 2 | What the `Origin` fallback compares with | The request's raw `Host` header; Fastify's `request.host`; a new `APP_ORIGIN` setting | **The host of the `Origin` header against the raw `Host` header**, as Go's check does. `request.host` reads `X-Forwarded-Host` once a proxy is trusted, which is one more header to reason about. An `APP_ORIGIN` setting would be needed by nothing else before PH-18, where Better Auth's base URL may bring one. An `Origin` that is not a URL, such as `null`, is refused. |
| 3 | How bodies are kept to JSON | A hook checking `Content-Type` on unsafe methods; removing Fastify's `text/plain` parser | **Remove Fastify's `text/plain` parser**, leaving `application/json` as the only body Fastify parses; every other content type gets Fastify's own **415 Unsupported Media Type**. The content types an HTML form can send (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`) are the browser's "simple requests", which reach the server without a CORS preflight; this closes them with Fastify's own mechanism and no custom code. A request without a body passes: there is nothing to be non-JSON, and a real `DELETE /api/lists/:id` has no body. A cross-site DELETE without a body is impossible from a form, needs a preflight from `fetch`, and is refused by decision 1 anyway. |
| 4 | How the CSP is written | Helmet's default policy with overrides; the whole policy written out, helmet's CSP defaults off | **The whole policy written out, with `useDefaults: false`:** `default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`, exactly [ADR 0012](../../decisions/0012-security-baseline.md), decision 8. Scripts, styles, fonts, images and `fetch` fall back to `default-src 'self'`. Helmet's defaults allow `style-src 'self' https: 'unsafe-inline'`, which is exactly the inline style ADR 0012 and [ADR 0013](../../decisions/0013-visual-design.md), decision 9 rule out, plus `data:` fonts and images; with overrides, the effective policy would be half helmet's version-dependent defaults, readable only in its source. Written out, the policy sits in one place, the test asserts the exact header, and an upgrade of helmet cannot change it. **The build stays inside it:** `build.assetsInlineLimit: 0` in `apps/web/vite.config.ts` stops Vite from inlining small assets as `data:` URIs, which `'self'` blocks. Nothing is inlined today, so the build is unchanged; small assets would become fingerprinted files, cached for a year, at the cost of one request each the first time, and they would no longer count against the first-screen budget of [NFR-3](../../requirements/functional-requirements.md#nfr-3). An explicit `?inline` import still inlines, and the CSP and PH-07's guard would catch it. |
| 5 | HSTS and subdomains | Keep `includeSubDomains`, helmet's default; leave it out | **Keep it:** `max-age=31536000; includeSubDomains`, without `preload`. Every subdomain below the app's host name must then be HTTPS, which suits a demo served only over HTTPS and planned with no HTTP-only sites on its domain. If the app ends up on a subdomain of another domain ([PH-10](../../roadmap.md#ph-10-domain-and-base-infrastructure)), only the subdomains below it are covered. |
| 6 | How tokens are kept out of the log | Hide every query value and keep the names; hide only listed parameter names; drop the query string | **Hide every query value, keep the names:** `/reset-password?token=abc&next=/lists` is logged as `/reset-password?token=[redacted]&next=[redacted]`. A new token parameter is covered the day it appears, and the log still shows which parameters a request carried. The API reads no query values today, so nothing useful is lost; a phase that wants a value in the log adds an exception with its reason. A list of names fails silently when a phase forgets to extend it, the leak [ADR 0012](../../decisions/0012-security-baseline.md), decision 9 guards against; dropping the query loses the names too. **Tokens travel in the query string, never in the path,** so the rule covers them: Better Auth's default reset link puts the token in the path (`/reset-password/<token>`), so PH-18 and PH-29 build their own links through Better Auth's email callbacks ([OP-055](../../open-points.md#op-055)). |
| 7 | The `TRUSTED_PROXY_HOPS` setting | — | **Required, a whole number of 0 or more,** validated at startup like every setting ([ADR 0019](../../decisions/0019-api-skeleton-details.md), decision 2): 1 behind the AWS load balancer, 0 locally. It is passed to Fastify's `trustProxy` as a number of hops, never `true`. An empty value is refused like a missing one rather than read as 0. |
| 8 | Where the code lives | One `security/plugin.ts` with the log module beside it; everything in `app.ts`; one file per concern | **A `security/` folder with one file per concern** (`headers.ts`, `cross-site.ts`, `json-only.ts`, `log.ts`), each with its test beside it, next to `health/` and `web/`. Each concern can be read alone, and everything ADR 0012, decisions 7–9 and 13 ask for is in one folder. `app.ts` stays a short list of what the app is made of. **Each plugin is wrapped with `fastify-plugin`**, the Fastify team's helper that turns off encapsulation, so its hooks and its parser change reach every route, the SPA's files and the not-found handler included; a plain function called on the root app would do the same without the dependency, but is the less idiomatic path. |
| 9 | How tests read the log | An optional log destination in `AppDeps`; asserting `request.ip` through a test route | **An optional `logStream` in `AppDeps`**: production leaves it out and logs to stdout, tests pass an in-memory stream and read the JSON lines back. It proves end to end what matters: the URL the log actually holds, and the `remoteAddress` it records. It follows [ADR 0007](../../decisions/0007-testing-strategy.md), decision 14: what the app needs from outside comes in through `buildApp`. |

## Design

### Layout

```
apps/api/
  package.json              + @fastify/helmet, fastify-plugin
  .env.example              + TRUSTED_PROXY_HOPS=0
  src/config.ts             + TRUSTED_PROXY_HOPS → config.trustedProxyHops
  src/config.test.ts        + TRUSTED_PROXY_HOPS cases
  src/app.ts                trustProxy, the log serializer and stream; registers the security plugins first
  src/security/
    headers.ts              @fastify/helmet: the CSP, HSTS, Referrer-Policy
    headers.test.ts
    cross-site.ts           the Sec-Fetch-Site and Origin check on unsafe methods
    cross-site.test.ts
    json-only.ts            removes the text/plain parser
    json-only.test.ts
    log.ts                  redactUrl() and the request serializer
    log.test.ts
    client-ip.test.ts       the forged X-Forwarded-For
  src/test/config.ts        testConfig(overrides)
  src/test/log.ts           captureLog(): an in-memory log stream
  src/health/routes.test.ts uses testConfig
  src/web/routes.test.ts    uses testConfig; POST /some/route sends Sec-Fetch-Site
apps/web/
  vite.config.ts            + build.assetsInlineLimit: 0
```

### The TRUSTED_PROXY_HOPS setting

- **`config.ts`:** `TRUSTED_PROXY_HOPS` is parsed from a string of digits only (an empty string, `-1`, `1.5` and `abc` are refused; `z.coerce.number()` alone would read an empty string as 0) and returned as `trustedProxyHops: number`.
- **`.env.example`:** `TRUSTED_PROXY_HOPS=0`, with a comment: the number of proxies in front of the API whose `X-Forwarded-For` entries are trusted; 0 locally, 1 behind the AWS load balancer; never more than the real number, since every extra hop lets a client choose its own address.
- **Developers' `.env` files** need the new line, which the setup guide says, as it did for `WEB_ROOT`.

### Wiring in buildApp

```ts
export interface AppDeps {
  config: Config;
  db: Database;
  // Where the log goes; stdout when left out. Tests pass a stream they read.
  logStream?: DestinationStream;
}

const app = Fastify({
  trustProxy: config.trustedProxyHops,
  logger: {
    level: config.logLevel,
    stream: logStream,
    serializers: { req: requestSerializer },
  },
});
app.register(headers);
app.register(crossSite);
app.register(jsonOnly);
// then healthRoutes and webRoutes, as today
```

The three security plugins are registered before any route. A number for `trustProxy` makes Fastify trust that many hops from the right of `X-Forwarded-For`: with 1, `request.ip` is the address the load balancer appended; with 0, the header is ignored and `request.ip` is the socket's address.

### Security headers

`security/headers.ts` registers `@fastify/helmet` with:

- **`contentSecurityPolicy`:** `useDefaults: false` and the directives `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`, which give the header `default-src 'self';object-src 'none';base-uri 'none';form-action 'self';frame-ancestors 'none'` (helmet's own separator, pinned by the test).
- **`strictTransportSecurity`:** `maxAge: 31536000`, `includeSubDomains: true`, `preload: false`.
- **`referrerPolicy`:** `no-referrer`.
- **Every other helmet header at its default:** `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Frame-Options`, `Origin-Agent-Cluster` and the rest. `X-Frame-Options` repeats `frame-ancestors` for browsers that predate it.

Helmet sets the headers in an `onRequest` hook, so they are on every response, a refusal by the cross-site check included, since helmet is registered first.

### The cross-site check

`security/cross-site.ts` adds an `onRequest` hook:

1. GET, HEAD and OPTIONS pass unchecked: they never change anything ([ADR 0012](../../decisions/0012-security-baseline.md), decision 7).
2. Every other method is checked:

| The unsafe request carries | Result |
|---|---|
| `Sec-Fetch-Site: same-origin` | ✅ allowed |
| `Sec-Fetch-Site` with any other value (`same-site`, `cross-site`, `none`) | ⛔ 403 |
| no `Sec-Fetch-Site`, and an `Origin` whose host equals the `Host` header | ✅ allowed |
| no `Sec-Fetch-Site`, and an `Origin` on another host, or one that is not a URL (`null`) | ⛔ 403 |
| neither header | ⛔ 403 |

A refusal answers before the body is read, with Fastify's error shape: `{ "statusCode": 403, "error": "Forbidden", "message": "Cross-site request refused" }`. `same-site` is refused too: a sibling subdomain is another site to Szop, and `SameSite=Lax` alone would not stop it.

### JSON-only bodies

`security/json-only.ts` calls `app.removeContentTypeParser("text/plain")`. Fastify parses only `application/json` (with any parameters, such as `; charset=utf-8`) from then on, and answers any other content type with its own 415. The cross-site check runs first, in `onRequest`, so a cross-site form gets the 403 before its body is looked at; the 415 is what a same-origin request with the wrong body gets.

### The request log

`security/log.ts` exports:

- **`redactUrl(url: string): string`:** everything before the first `?` is kept as it is. In the query, each `&`-separated parameter becomes `name=[redacted]`, keeping the name as written (still percent-encoded), whatever its value, an empty one included; a parameter without `=` is replaced whole by `[redacted]`, since a bare value could be a token. Empty parameters (`a=1&&b=2`) are kept as they are. A URL without a query is returned unchanged. The fragment never reaches the server.
- **`requestSerializer`:** the same fields as Fastify's default request serializer, `method`, `url` (through `redactUrl`), `host`, `remoteAddress` (`request.ip`, so the trusted-hops address) and `remotePort`, so the log reads as before apart from the redacted query.

The serializer applies to every log line that carries the request, `incoming request` above all; `request completed` carries only the response. This covers API calls and the SPA's pages alike, since the API logs both (`/reset-password?token=…` is a page the API serves).

### The web build

`apps/web/vite.config.ts` gains `build: { assetsInlineLimit: 0 }`, with a comment pointing to the CSP (decision 4). `pnpm build` must write the same files as before.

### Tests

API tests through `inject()`, as [testing.md](../../development/testing.md) describes, each written first and seen failing.

- **`src/test/config.ts`:** `testConfig(overrides?: Partial<Config>)` returns a full `Config` for tests: `logLevel: "silent"`, `trustedProxyHops: 0`, a database setting that is never used (each test passes its own database), and a `webRoot` that does not exist. `health/routes.test.ts` and `web/routes.test.ts` switch to it; the new tests use it.
- **`src/test/log.ts`:** `captureLog()` returns a `logStream` to pass to `buildApp` and a function returning the lines written so far, parsed from JSON. Tests that read the log set `logLevel: "info"`.
- **`headers.test.ts`:** one `it.each` over five responses: `GET /api/health` (JSON), `GET /` (`index.html`), `GET /assets/index-abc123.js` (a fingerprinted asset, from the fixture web root), `GET /api/nope` (the JSON 404) and a `POST` with `Sec-Fetch-Site: cross-site` (the 403). Each has exactly the CSP string above, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff`.
- **`cross-site.test.ts`:** the test registers a throwaway route on the app it builds, answering 200 to POST, PUT, PATCH and DELETE on `/api/test-unsafe`, since no real one exists yet. One `it.each` per row of the table, for each of the four methods: `same-origin` passes; `same-site`, `cross-site` and `none` get 403 with the body above; no `Sec-Fetch-Site` with `Origin: http://localhost` and `Host: localhost` passes; `Origin: https://evil.example`, and `Origin: null`, get 403; neither header gets 403. And a GET with `Sec-Fetch-Site: cross-site` passes: safe methods are not checked.
- **`json-only.test.ts`:** a comment at the top says every request is same-origin, so only the body rule is under test. With the same throwaway route: `text/plain`, `application/x-www-form-urlencoded` and `multipart/form-data` get 415; `application/json`, with and without `; charset=utf-8`, passes; a DELETE without a body passes ("the JSON rule is about bodies"); a POST with a body and no `Content-Type` gets what Fastify really answers, expected 415, pinned by the test.
- **`log.test.ts`:** unit tests of `redactUrl`: no query; one value; several; a repeated name; an empty value (`?a=`); a bare parameter (`?abc123`); a percent-encoded value; an empty parameter between two others. Then end to end: `GET /reset-password?token=s3cret` through `inject()` with a captured log; the `incoming request` line's `req.url` is `/reset-password?token=[redacted]`, and `s3cret` appears in no captured line.
- **`client-ip.test.ts`:** a request from the load balancer (`remoteAddress: "10.0.0.5"` in `inject()`) carrying `X-Forwarded-For: 6.6.6.6, 203.0.113.7`, where the client forged the first entry and the load balancer appended the second. With `trustedProxyHops: 1`, the logged `req.remoteAddress` is `203.0.113.7`; with 0, it is `10.0.0.5`. Without the header, both give `10.0.0.5`.
- **`config.test.ts`:** `TRUSTED_PROXY_HOPS` joins the `valid` object, so the existing missing-setting test covers it; new cases refuse an empty string, `-1`, `1.5` and `abc`, and accept `0` and `1`.
- **`web/routes.test.ts`:** the `POST /some/route` → 404 case sends `Sec-Fetch-Site: same-origin`; without it, the request would now be a 403 before routing, which is right but not what that case is about.

### Dependencies

- **`apps/api` dependencies:** `@fastify/helmet`, version 13 (13.1.2 today, on helmet 8), and `fastify-plugin`, version 6 (6.0.1 today), which `@fastify/helmet` already depends on and the security plugins now import directly. Neither is expected to have install scripts; if pnpm stops on one, the evidence goes to the owner first ([ADR 0012](../../decisions/0012-security-baseline.md), decision 18).

## Documentation and records

- **ADR 0025, "Web security baseline details":** decisions 1 to 9 above. It refines [ADR 0012](../../decisions/0012-security-baseline.md), decisions 7 (the requests with neither header, the `Origin` fallback, how bodies are kept to JSON), 8 (the policy written out, HSTS's subdomains, the build's inline limit), 9 (which part of a logged URL is hidden, tokens only in the query) and 13 (the setting's form). Noted in ADR 0025's header, ADR 0012's status line and those decisions' cells, as `CLAUDE.md` asks.
- **Architecture, Web security:** the 403 and the 415, the query redaction, the `security/` folder.
- **Threat model:** no new actor or entry point. The "Malicious website" row and the REST API's tampering cell name the 415 and the refused `same-site`; a sentence says the check defends browsers only, and scripts calling the API directly are met by sessions, limits and quotas.
- **Stack overview:** fetch metadata (`Sec-Fetch-Site`) and why page scripts cannot forge it; simple requests and why that makes JSON-only bodies a defense; trusted proxy hops and `X-Forwarded-For`; escaping encapsulation with `fastify-plugin`; the CSP written out.
- **Testing guide:** unsafe requests in tests send `Sec-Fetch-Site: same-origin`; `testConfig()`; reading the log through `captureLog()`; the throwaway route for testing hooks before real routes exist.
- **Setup guide:** an existing `apps/api/.env` needs `TRUSTED_PROXY_HOPS=0` from `.env.example`.
- **Project tracking guide:** in [How items move](../../development/project-tracking.md#how-items-move), "An open point's part is done" also sets its Status back to ⬜ Backlog, or 📌 Todo when the next phase is already picked; no workflow does it on a re-parent.
- **Glossary:** fetch metadata, simple request.
- **Open points, changed on GitHub first, then mirrored in the register ([ADR 0024](../../decisions/0024-github-project-tracking.md)):**
  - [OP-053](../../open-points.md#op-053) (#26): the PH-06b part ✅ done with the PR; new parts **PH-18** (Better Auth handed the same client address, its exact `trustedOrigins`, the forged-header test extended to its limiter) and **PH-20** (the forged-header test extended to `@fastify/rate-limit`); re-parented to [PH-12](../../roadmap.md#ph-12-first-deploy), whose part (the demo check) is next, with its status back to ⬜ Backlog.
  - [OP-055](../../open-points.md#op-055) (#109): tokens travel in the query string, so PH-18 and PH-29 build their own email links instead of Better Auth's path-token default; and the SPA removes a used token from the address bar ([ADR 0012](../../decisions/0012-security-baseline.md), decision 9), which no open point tracked.
  - [OP-071](../../open-points.md#op-071) (#94): the 403 of the cross-site check and the 415 of the JSON rule use Fastify's error shape until then.
  - [OP-067](../../open-points.md#op-067) (#27): moved to [PH-07](../../roadmap.md#ph-07-first-e2e-journey), since it does not depend on this phase.
- **Roadmap and README diagram:** PH-06b's row 🚧 with the spec link in this spec's commit, and ◐ in the diagram; the plan and PR links as they land; ✅ before the merge, in the same commits as the diagram ([ADR 0017](../../decisions/0017-readme-roadmap-diagram.md)). The PR closes #25 only; OP-053 stays open for its later parts.

## Tasks

One commit per task; the spec's own commit also sets the roadmap row to 🚧.

1. **The `TRUSTED_PROXY_HOPS` setting and `testConfig` (TDD):** `config.ts`, `.env.example`, `src/test/config.ts`, the two existing tests switched to it. *Verify:* the new config tests failed first and pass; `pnpm test` and `pnpm typecheck` pass.
2. **The request log and the client address (TDD):** `logStream` in `AppDeps`, `captureLog()`, `security/log.ts`, `trustProxy` in `buildApp`, `log.test.ts` and `client-ip.test.ts`. *Verify:* the tests failed first and pass; `pnpm dev` still pretty-prints the log.
3. **Security headers (TDD):** `@fastify/helmet` and `fastify-plugin`, `security/headers.ts`, registered first, `headers.test.ts` (the 403 case is added in task 4); `assetsInlineLimit: 0`. *Verify:* the tests failed first and pass; `pnpm build` writes the same files as before.
4. **The cross-site check (TDD):** `security/cross-site.ts`, `cross-site.test.ts`, the 403 case of `headers.test.ts`, the `POST /some/route` case of `web/routes.test.ts`. *Verify:* the tests failed first and pass; `pnpm test` passes.
5. **JSON-only bodies (TDD):** `security/json-only.ts`, `json-only.test.ts`. *Verify:* the tests failed first and pass.
6. **Docs, registers and final checks:** ADR 0025 with its cross-references, the living docs, the guides, the glossary, the open points on GitHub then in the register, the roadmap and README diagram; the check in Chrome; the definition of done walked through, every check run once more, a self-review of the diff. *Verify:* links resolve; contents lists in sync; `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:coverage` and `pnpm build` pass.

## To verify during implementation

- **`trustProxy` as a number** (task 2): that Fastify 5 with 1 takes the last `X-Forwarded-For` entry, with 0 ignores the header, and that `inject()`'s `remoteAddress` stands in for the socket.
- **The logger's `stream` with `serializers`** (task 2): that Fastify 5 accepts both in `logger`, that `incoming request` is the only line carrying the URL, and that `pnpm dev`'s pino-pretty pipe still works with the default stdout.
- **Helmet's CSP string** (task 3): the separator helmet 8 writes between directives, pinned by the test.
- **Helmet on every response** (tasks 3 and 4): that its headers reach `@fastify/static`'s files, the not-found handler's `sendFile` and JSON 404, and a reply sent from a later `onRequest` hook.
- **`Host` and default ports** (task 4): `inject()` sends `Host: localhost:80` unless told otherwise, and `new URL("http://localhost").host` drops the default port, so the fallback's tests set `Host` explicitly; whether the comparison should also treat `localhost:80` and `localhost` as equal is checked against what browsers send (they omit a default port from both headers).
- **A body without `Content-Type`** (task 5): what Fastify 5 answers to a POST with a body and no `Content-Type`, and to a form content type with an empty body; the cross-site check stays the guard either way.
- **`assetsInlineLimit: 0` under Vite 8** (task 3): that the option is still honored and the build output is unchanged.
- **Install scripts** (task 3): whether pnpm refuses any dependency of `@fastify/helmet`.
