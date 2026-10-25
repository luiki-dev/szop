# Szop — Technical Architecture

Living description of how Szop is built. It implements the [functional requirements](../requirements/functional-requirements.md); requirement IDs ([ACC-1](../requirements/functional-requirements.md#acc-1), [ORD-5](../requirements/functional-requirements.md#ord-5), …) refer to that document. The decisions behind this design, with the alternatives considered, are in [ADR 0002](../decisions/0002-technical-architecture.md). For a gentler, concept-by-concept explanation of the stack, read the [stack overview](stack-overview.md). Acronyms and terms are explained in the [glossary](../glossary.md).

The development environment and tooling are decided in [ADR 0005](../decisions/0005-development-environment.md), the testing strategy in [ADR 0007](../decisions/0007-testing-strategy.md), hosting in [ADR 0008](../decisions/0008-hosting.md) (summarized in [section 5](#5-deployment)), the git workflow in [ADR 0009](../decisions/0009-git-workflow.md), continuous integration and delivery (CI/CD) in [ADR 0010](../decisions/0010-ci-cd.md), the security baseline in [ADR 0012](../decisions/0012-security-baseline.md), and the visual design in [ADR 0013](../decisions/0013-visual-design.md). Who can act on Szop, and what guards each way in, is in the [threat model](threat-model.md). What Szop looks like, its design tokens and the layout and interaction principles every screen follows are in the [visual design](visual-design.md) doc; this document covers only how styling and components fit into the frontend ([Styling and components](#styling-and-components)).

## Contents

- [1. System overview](#1-system-overview)
- [2. Backend (`apps/api`)](#2-backend-appsapi)
  - [Code structure](#code-structure)
  - [Request lifecycle](#request-lifecycle)
  - [Access control](#access-control)
  - [Data model highlights](#data-model-highlights)
  - [Seed data](#seed-data)
  - [Anonymous guests](#anonymous-guests)
  - [Abuse protection](#abuse-protection)
  - [Web security](#web-security)
  - [Errors](#errors)
- [3. Frontend (`apps/web`)](#3-frontend-appsweb)
  - [Code structure](#code-structure-1)
  - [Styling and components](#styling-and-components)
  - [Routes (React Router)](#routes-react-router)
  - [Startup](#startup)
  - [State](#state)
  - [Optimistic updates](#optimistic-updates)
  - [Offline (NET-1)](#offline-net-1)
  - [Forms](#forms)
- [4. Later features and cross-cutting concerns](#4-later-features-and-cross-cutting-concerns)
  - [Sharing (SHR)](#sharing-shr)
  - [Live updates (SYN)](#live-updates-syn)
  - [Cross-cutting](#cross-cutting)
- [5. Deployment](#5-deployment)

## 1. System overview

```
 Browser                                   Server
┌──────────────────────────────┐         ┌──────────────────────────────┐
│ React SPA (static files)     │  HTTPS  │ Node.js process: Fastify API │
│  React Router  – pages/URLs  │  JSON   │  /api/*        REST routes   │     ┌────────────┐
│  TanStack Query – API cache  ├────────►│  /api/auth/*   Better Auth   ├────►│ PostgreSQL │
│  React Hook Form – forms     │ cookie  │  /api/ws       WebSocket     │ SQL │            │
│                              │◄ ─ ─ ─ ─┤                (Later)       │     └────────────┘
└──────────────┬───────────────┘  push   └───────┬──────────────┬───────┘
               │                                 │              │ SMTP/API
               │      ┌─────────────────────┐    │              ▼
               └─────►│ packages/shared     │◄───┘       ┌──────────────┐
                      │ Zod schemas, types, │            │ Email service│
                      │ domain rules        │            └──────────────┘
                      └─────────────────────┘
```

| Component | Responsibility |
|---|---|
| **React single-page application (SPA)** | Built by Vite into static files, styled with Tailwind CSS and built from shadcn/ui components. Renders everything in the browser. Talks to the API only over REST (and, later, a WebSocket). |
| **Fastify API** | One Node.js process. Business logic, access control, persistence. Mounts Better Auth. Later hosts the WebSocket endpoint for live updates. |
| **PostgreSQL** | The single source of truth for all data, including anonymous guests' workspaces. |
| **Email service** | Sends verification and password-reset emails, over the Simple Mail Transfer Protocol (SMTP) or an HTTP API. Hidden behind an `EmailSender` interface. In AWS, Amazon Simple Email Service (SES). |
| **`packages/shared`** | Code used by both sides: Zod schemas (the API contract), TypeScript types inferred from them, and pure domain rules such as item ordering ([ORD](../requirements/functional-requirements.md#list-display-and-ordering-ord)) and totals ([ITM-8](../requirements/functional-requirements.md#itm-8)). |

**Same origin.** The SPA and the API are served under one domain (for example `example.com` and `example.com/api`). Session cookies are therefore first-party and no Cross-Origin Resource Sharing (CORS) setup is needed. The API achieves this by serving the built SPA's static files itself (see [Deployment](#5-deployment)). In development, the Vite dev server proxies `/api/*` to the API, so the same rules hold locally.

**Monorepo layout.** One repository: three packages, the end-to-end tests and the infrastructure code:

```
apps/web          React SPA
apps/api          Fastify API (Drizzle schema, migrations, seed data)
packages/shared   Zod schemas, types, domain rules
e2e/              Playwright end-to-end tests (ADR 0007)
  start-server.ts   resets the E2E database, then starts the API on the built SPA
  support/          the CSP guard (test.ts) and the axe helper (accessibility.ts)
  tests/            the journeys, one file per use case (uc-NN-….spec.ts), plus the app shell's shell.spec.ts, the design system's design.spec.ts and the CSP guard's own test
infra/            Terraform root modules (ADR 0008): bootstrap (the state bucket and the budget, ADR 0029), base (permanent resources) and demo (one session)
```

The packages and `e2e/` are pnpm workspaces. The packages are named `@szop/api`, `@szop/web` and `@szop/shared`, and imports keep their `.ts` extension ([ADR 0019](../decisions/0019-api-skeleton-details.md), decisions 6 and 7). `packages/shared` is consumed from its TypeScript source, with no build step of its own. It exists since [PH-05](../roadmap.md#ph-05-spa-skeleton) and holds the health response's schema, `healthSchema`, which `apps/web` uses to parse `/api/health` and, in a test, `apps/api` uses to check its responses ([ADR 0021](../decisions/0021-spa-skeleton-details.md), decision 1). The rest of the tooling is in [ADR 0005](../decisions/0005-development-environment.md).

## 2. Backend (`apps/api`)

### Code structure

Feature modules — `lists`, `items`, `categories`, `catalog`, `units`, `templates`, `account` (and `sharing` later) — each with three layers:

| File | Layer | Knows about | Does not know about |
|---|---|---|---|
| `routes.ts` | HTTP | Fastify, shared Zod schemas | SQL, business rules |
| `service.ts` | Business logic | rules, access checks, transactions | HTTP |
| `repository.ts` | Persistence | Drizzle queries | business rules |

Dependencies (database client, email sender, clock) are passed in explicitly when the app is assembled. There is no dependency-injection container. Tests pass fakes the same way.

**Assembly.** `buildApp(deps)` in `app.ts` creates Fastify and registers each feature's routes as a plugin under `/api`, passing the services it needs as plugin options; there are no decorators for dependencies ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 1). `server.ts` is the entry point: it reads the configuration, calls `buildApp`, listens, and on SIGINT or SIGTERM closes the app so that requests in flight finish. The shutdown has a 10-second deadline: connections still open then are closed, and if the process has still not exited 5 seconds later it exits with code 1, well inside ECS's 30-second kill (`shutdown.ts`; [ADR 0033](../decisions/0033-app-ready-for-the-cloud-details.md), decision 6).

**Database.** `src/db/` holds the connection (`createDatabase`: Drizzle over a node-postgres pool of at most 5 connections, with a two-second connection timeout, and TLS with full certificate verification against the RDS bundle when `DATABASE_TLS` is `verify-full`; `none` locally), the migration check, the migration lock, the migrator and the schema version lookup; `drizzle/` holds the generated migrations. `server.ts` creates the database, builds the app with it (`AppDeps` is `{ config, db }`), takes the migration lock, checks that the migrations recorded in the database match its own, applies the migrations, releases the lock, logs `migrations applied` with the schema version, the commit, its instance ID and the database's `max_connections`, then listens. A recorded migration this code does not have, one it would skip or one whose SQL changed stops startup with an error naming each and the remedy ([ADR 0033](../decisions/0033-app-ready-for-the-cloud-details.md), decisions 3 and 5; [Drizzle](../development/tools/drizzle.md#the-migration-check)); on shutdown it closes the app, then the pool: whoever creates a pool closes it ([ADR 0020](../decisions/0020-database-details.md), decisions 11 and 12). A second entry point, `db-setup` (`src/db-setup.ts`, with its logic in `db/setup-role.ts`), is run by `demo-up` and not by the app: see [Deployment](#5-deployment). An unreachable database stops startup. A dropped idle connection does not crash the process: the pool's `error` listener logs its code and message at warn, and the pool opens a new connection on the next query (decision 14).

**Serving the SPA.** `web/routes.ts` registers `@fastify/static` after the API's routes, with the folder named by the required `WEB_ROOT` setting (`../web/dist` in development, resolved against the working directory). `pnpm build` writes a Brotli (`.br`) and a gzip (`.gz`) copy next to every text file, and the plugin sends the copy the request's `Accept-Encoding` allows, with `Vary: Accept-Encoding`. Files under `/assets/`, whose names carry a content hash, get `Cache-Control: public, max-age=31536000, immutable`; everything else, `index.html` included, gets `no-cache`, so the browser asks again each time and gets a `304 Not Modified` while its copy is current. A path no route claims reaches the not-found handler: a path under `/api/`, a path whose last segment has a dot (a missing file) and any method other than GET or HEAD get Fastify's JSON 404; any other path gets `index.html`, and React Router renders it. Files are found at startup, and a missing `WEB_ROOT` folder (as in `pnpm dev`) only logs a warning. In production the API runs as `node src/server.ts`: Node strips the types as it loads each file, so nothing is compiled and `packages/shared` runs from source too ([ADR 0023](../decisions/0023-production-build-and-serving-details.md), decisions 1, 2, 5 and 6).

**Web security.** `security/` holds the web baseline's four concerns, one file each, with its test beside it: `headers.ts` (the security headers, through `@fastify/helmet`), `cross-site.ts` (the check that unsafe requests come from the app), `json-only.ts` (bodies kept to JSON) and `log.ts` (the request log's serializer, which hides query values). `buildApp` registers the first three before any route, each wrapped with `fastify-plugin` so that it reaches every route, the SPA's files and the not-found handler included; `AppDeps` also takes an optional `logStream`, which tests pass to read the log back ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decisions 8 and 9).

### Request lifecycle

1. The request reaches Fastify.
2. An auth hook asks Better Auth for the session and attaches the user (possibly anonymous) to the request.
3. Zod validates the path parameters, query and body (via `fastify-type-provider-zod`).
4. The route handler gets the workspace context from the access layer (see Access control) and calls the service with it.
5. The service resolves every referenced ID within that workspace, applies business rules, and calls the repository (inside a transaction when several writes belong together).
6. The repository runs Drizzle queries against PostgreSQL.
7. The response is serialized through its Zod schema, so nothing outside the contract leaks out.

The same Zod route schemas generate an OpenAPI description of the API (via `@fastify/swagger`).

### Access control

- Every user, anonymous or registered, has exactly **one workspace**.
- **Every ID in a request is resolved within the workspace the request acts in**: the record itself and every record it points to (`category_id`, a new parent category, product IDs in a multi-add, a template, a unit), in the path, the query and the body ([ADR 0012](../decisions/0012-security-baseline.md), decision 3).
- **An access layer gives services the workspace they act in**; services never read the session. It returns a context `{ user, workspaceId, role }` from one of two functions:
  - `ownWorkspace(user)`: the session's own workspace, for one's own data (categories, catalog, units, templates, settings, the list overview);
  - `requireListAccess(user, listId, minRole)`: for anything reached through a list, the **list owner's** workspace and the caller's role. In the MVP the only role is owner; sharing (Later) adds shopper and editor here, without changing services or queries.
- **Item routes nest under their list** (`/api/lists/:listId/items/:itemId`), and an item is looked up within that list.
- **Every repository function takes `workspaceId` as a required parameter**; there is no lookup by ID alone, so a forgotten scope is a TypeScript error.
- "Not found", "not allowed" and a reference into another workspace all return **404**, so nobody can probe whether another user's records exist.
- **Tests:** for every field that references another record, an API test checks that a reference into another workspace returns 404; a schema test checks that every workspace-owned table and every reference to one follows the composite-key rule below.

### Data model highlights

- **Users, sessions, accounts:** Better Auth's tables, including the anonymous-user flag. `workspaces` is 1:1 with users and holds settings (currency).
- **Workspace keys:** every workspace-owned table has `workspace_id NOT NULL` and `UNIQUE (workspace_id, id)`, and every reference to such a table is a **composite foreign key** on `(workspace_id, …)`, so PostgreSQL refuses a reference into another workspace even if a service check is missing. A nullable reference that becomes null when its target is deleted uses `ON DELETE SET NULL (column)`, which needs PostgreSQL 15 or newer ([ADR 0012](../decisions/0012-security-baseline.md), decision 6). Copying data between workspaces, as when a guest's lists are imported ([ACC-4](../requirements/functional-requirements.md#acc-4)), must remap every reference.
- **Category tree:** each category stores `parent_id` and its `position` among siblings. Trees are small, so the API loads a workspace's whole tree and the shared domain rules compute the depth-first, parent-first order ([ORD-2](../requirements/functional-requirements.md#ord-2), [ORD-3](../requirements/functional-requirements.md#ord-3)). Deleting a category cascades to its subcategories in the database. Catalog products and list items pointing to a deleted category get `category_id = null` ([CAT-3](../requirements/functional-requirements.md#cat-3)).
- **Money:** stored as integers in minor units (cents, grosze) to avoid floating-point rounding errors. **Quantity:** decimal.
- **List items:** copy their catalog defaults when added ([ITM-6](../requirements/functional-requirements.md#itm-6), [PRD-3](../requirements/functional-requirements.md#prd-3)) and record when they were added, which gives the "order added" sort ([ORD-5](../requirements/functional-requirements.md#ord-5)). They also record when they were checked, which orders the haul with the most recently checked first ([ORD-2](../requirements/functional-requirements.md#ord-2)); whether "checked" is that timestamp alone or a flag next to it is [OP-082](https://github.com/luiki-dev/szop/issues/106).
- **Templates:** `templates` and `template_items`, the same shape as lists and items without checked state.

### Seed data

A versioned data file in `apps/api` holds the default catalog, category tree and units. Creating a workspace copies it into that workspace's tables in one transaction.

### Anonymous guests

- **Lazy creation ([ACC-1](../requirements/functional-requirements.md#acc-1)).** A visitor without a session has no user and no workspace. Read requests without a session get the **seed data** (catalog, categories, units), which the API keeps in memory, read-only, and an empty set of lists and templates. Nothing is written to the database.
- On the visitor's **first change**, the frontend asks Better Auth's anonymous plugin for an anonymous session (rate-limited, see Abuse protection). Creating the anonymous user also creates its workspace by copying the seed data. The frontend then sends the original change.
- When an anonymous user registers or logs in, Better Auth links them to the registered account. In that step the server either:
  - reassigns the anonymous workspace to the new account on registration ([ACC-2](../requirements/functional-requirements.md#acc-2)), or
  - imports the guest's lists and templates into the existing account's workspace, or discards them, according to the user's choice ([ACC-4](../requirements/functional-requirements.md#acc-4)).

  How this maps onto Better Auth's anonymous plugin is not settled: by default the plugin links and deletes the anonymous user inside the sign-in request, before the [ACC-4](../requirements/functional-requirements.md#acc-4) choice can be made ([OP-038](https://github.com/luiki-dev/szop/issues/97)).
- **Activity tracking.** Each workspace has a `last_active_at` timestamp, updated by the auth hook at most once an hour to avoid a database write on every request.
- **Cleanup.** A scheduled task inside the API process deletes ([ACC-7](../requirements/functional-requirements.md#acc-7), [ACC-8](../requirements/functional-requirements.md#acc-8)). Each run starts with a PostgreSQL try-lock (`pg_try_advisory_lock`), so with several tasks only one cleans up per round and the others skip it ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decision 9):
  - anonymous users whose workspace's `last_active_at` is within 1 hour of creation, 3 days after creation;
  - other anonymous users inactive for 30 days;
  - registered users not verified within 7 days.

### Abuse protection

Anonymous users make writes cheap for anyone, so the design limits how much a script can cost us. The values are the defaults from [LIM-1](../requirements/functional-requirements.md#lim-1) to [LIM-4](../requirements/functional-requirements.md#lim-4), read from configuration.

- **Lazy creation** (above): visits that change nothing — crawlers, uptime monitors, link previews — create nothing.
- **Rate limits** with `@fastify/rate-limit`: anonymous-session creation, registration, requests without a session, and password-reset and verification-resend requests per IP address; registration, reset and resend also per target email; all other API requests per session. IPv6 addresses are keyed by their /64 block, so one machine cannot rotate through addresses. Login attempts use Better Auth's built-in rate limiting per IP address, plus custom code limiting failed attempts per email address. A daily cap on outgoing emails, below SES's quota, protects the quota from an attack spread over many addresses ([ADR 0012](../decisions/0012-security-baseline.md), decision 14).
- **The client IP** is the address the load balancer saw: Fastify trusts the proxies by their addresses, listed in the required `TRUSTED_PROXIES` setting (the VPC's range in AWS, `none` locally), and walks `X-Forwarded-For` from the right only while the address in hand is a trusted proxy, so a client connecting directly keeps its own address whatever it sends. Never `trustProxy: true` or a hop count, which would let a client forge `X-Forwarded-For` ([ADR 0012](../decisions/0012-security-baseline.md), decision 13; [ADR 0025](../decisions/0025-web-security-baseline-details.md), decision 7). Better Auth is handed the same address (decision 13).
- **Counters live in Redis**, for both limiters, so a limit holds across every task: `@fastify/rate-limit`'s `redis` option, and Better Auth's `rateLimit.customStorage` over the same client, whose `consume` checks and counts in one atomic step. Not Better Auth's `secondaryStorage`, which would move sessions and verification values into Redis as well; they stay in PostgreSQL ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decisions 6 and 8). Redis arrives in [PH-39](../roadmap.md#ph-39-redis-in-the-stack), before the limiters in PH-20.
- **Quotas**: services check a workspace's counts before inserting (lists, items per list or template, templates, products, categories and tree depth, units). Two concurrent requests can both pass the check and exceed a quota by a few rows. That race exists within one process already, so the number of tasks does not change it; with per-session rate limits it is harmless, so no locking is added for it. Text lengths are part of the shared Zod schemas.
- **Request size**: Fastify's default body limit (1 MB) stays on.
- **Not in the application**: volumetric denial of service (floods of traffic) is handled at the infrastructure level. The demo environment relies on AWS Shield Standard, which protects its load balancer at no cost; a content delivery network and a web application firewall are the step up for an always-on service ([ADR 0008](../decisions/0008-hosting.md)). A bot challenge (such as Cloudflare Turnstile) on anonymous-session creation is an escalation option if abuse ever appears.

### Web security

The application's baseline, production grade even on the demo ([ADR 0012](../decisions/0012-security-baseline.md), decisions 7–12):

- **Session cookie:** `HttpOnly`, `Secure`, `SameSite=Lax`, no `Domain` attribute, `__Host-` prefix where Better Auth allows it (otherwise `__Secure-`). Better Auth's session cookie cache stays off, so a revoked session stops working at once.
- **Cross-site request forgery (CSRF):** GET never changes anything. Every POST, PUT, PATCH and DELETE, on every route, must carry `Sec-Fetch-Site: same-origin` (or, as a fallback, the app's `Origin`), otherwise 403 before any route sees the request. A request with neither header is refused too, and so is `Sec-Fetch-Site: same-site`. A body must be JSON: every other content type, the three an HTML form can send included, gets 415 ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decisions 1 to 3). Both answers use Fastify's error shape until the app has its own ([OP-071](https://github.com/luiki-dev/szop/issues/94)). Better Auth's `trustedOrigins` lists exactly the app's origin. The WebSocket (Later) checks `Origin` on connect.
- **Security headers** with `@fastify/helmet`: a strict Content Security Policy (CSP) allowing only the app's own files (`default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`), written out in full with helmet's own defaults off, with no inline scripts or `<style>` elements, and a build that inlines no asset as a `data:` URI; HTTP Strict Transport Security (HSTS) for one year, subdomains included, without preload; `Referrer-Policy: no-referrer`; on every response, the SPA's files and the 404s included, except Fastify's 400 for a malformed URL, which it answers before any hook runs ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decisions 4 and 5).
- **Tokens in URLs** (verification, reset, later share links): single-use and expiring; travelling in the query string, never in the path; hidden in logged URLs by the request log's serializer, which replaces every query value with `[redacted]` and keeps the names, hiding a parameter without a value whole ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decision 6); removed from the address bar by the SPA once used.
- **Passwords:** 15 to 128 characters, no composition rules; checked against breached passwords with Better Auth's Have I Been Pwned plugin, failing open if it cannot be reached; hashed with scrypt.
- **Sessions:** a password change or reset revokes every other session; deleting an account requires the current password.
- **No account enumeration:** login, registration, password reset and verification resend answer the same whether or not an account exists; registration with an existing address sends that address an email instead.

### Errors

One JSON error shape: `{ "error": { "code": "...", "message": "..." } }`.

| Situation | Status |
|---|---|
| Invalid input (Zod validation) | 400 |
| No session, on a request that changes data | 401 |
| Not found, or no access | 404 |
| Conflict (e.g. editing an archived list), or a quota reached (`quota_exceeded`) | 409 |
| Rate limit hit | 429 |
| Anything unexpected | 500 — logged, no details sent to the browser |

## 3. Frontend (`apps/web`)

### Code structure

Feature folders mirroring the backend: `lists`, `items`, `catalog`, `categories`, `units`, `templates`, `account`. Each holds its pages, components and **data hooks** — small functions such as `useList(id)` or `useCheckItem()` that wrap TanStack Query. Components never call `fetch` directly. One typed **API client** module, built on the shared Zod schemas, does all HTTP calls. Cookies are sent automatically because everything is on the same origin.

**As built in [PH-05](../roadmap.md#ph-05-spa-skeleton)** ([ADR 0021](../decisions/0021-spa-skeleton-details.md)): `src/api/client.ts` holds `getHealth()`, the only code that calls `fetch`; `src/health/` holds the first feature folder, with the data hook `use-health.ts` (TanStack Query, `retry: false`), `health-page.tsx` and its component test; `src/routes.tsx` exports the route table that `src/app.tsx` (a `QueryClientProvider` around a `RouterProvider`) and the tests both build routers from; `src/test/` holds the Mock Service Worker (MSW) server and the test setup. In development, Vite proxies `/api` to the API at `http://127.0.0.1:3000`, a constant in `apps/web/vite.config.ts` (decision 3).

### Styling and components

Decided in [ADR 0013](../decisions/0013-visual-design.md) and [ADR 0022](../decisions/0022-ring-tail-redesign.md); the design system itself is described in [visual-design.md](visual-design.md).

- **Components:** shadcn/ui's components, built on Base UI, are copied into `apps/web/src/components/ui/` as phases need them and are ours to change. Feature folders compose them; they don't restyle them page by page.
- **Styling:** Tailwind CSS v4 through `@tailwindcss/vite`, compiled at build time into one stylesheet. The design tokens are CSS custom properties in two tiers (Tailwind's palette, and semantic roles such as `--primary` that components use), all in `apps/web`. Dark mode is the class `dark` on `<html>`, which Tailwind's `dark:` variant follows: the user's choice, or the system setting while the choice is System ([APR-1](../requirements/functional-requirements.md#apr-1)).
- **Under the CSP:** nothing injects `<style>` elements at run time ([Web security](#web-security)). Base UI runs with `disableStyleElements`, toasts use Base UI's Toast, and every E2E journey fails on a CSP violation.
- **As built in [PH-14a](../roadmap.md#ph-14a-design-system)** ([ADR 0048](../decisions/0048-design-system-phase-details.md)): `src/index.css` holds the tokens; `src/lib/utils.ts` exports `cn()`; `src/components/ui/button.tsx` is the first component; `src/app.tsx` wraps the app in Base UI's `CSPProvider`; `src/design/` is the `/design` page, with `roles.ts`, the role list it shows; the `@/` import alias means `src/`.
- **As built in [PH-14b](../roadmap.md#ph-14b-app-shell)** ([ADR 0049](../decisions/0049-app-shell-phase-details.md)): `src/routes.tsx` nests every page under one layout route without a path, `AppShell` in `src/shell/app-shell.tsx`, which renders the page through React Router's `<Outlet />`; each route names its page's title in its `handle` (`RouteHandle`), which the shell shows as the `h1` and in the tab. The shell renders, by `useMediaQuery` on Tailwind's `lg`, either the phone's header bar with ☰ and the menu in a drawer (shadcn/ui's Sheet on Base UI's Dialog), or the sidebar; `src/shell/menu.tsx` is the one menu, with the logo (`src/brand/logo.svg`), the links, the API's status (`api-status.tsx` with `use-health.ts`, moved from the old `src/health/`) and the color scheme control. `src/start/` is the Start page at `/`. The color scheme lives in two places with the same rules: `public/color-scheme.js`, loaded first in `index.html`, sets the class before the first paint, and `src/shell/color-scheme.ts` reads, stores (`localStorage`, `szop-color-scheme`) and applies the choice, and follows the system setting from `main.tsx` on.
- **Zod runs in its jitless mode in the browser:** zod would otherwise test for `eval` with `new Function("")` when `@szop/shared` builds its schemas, which the CSP blocks and reports. `apps/web/src/zod-config.ts` sets `z.config({ jitless: true })` and `main.tsx` imports it first; an entry point that loads `@szop/shared` imports it before anything else ([ADR 0026](../decisions/0026-first-e2e-journey-details.md)).
- **Assets:** the Gabarito font (`@fontsource-variable/gabarito`) and Lucide's icons are bundled by Vite, so everything is served from the app's own origin.
- **Budget:** the JavaScript needed for the first screen stays within 200 KB compressed, checked in CI ([NFR-3](../requirements/functional-requirements.md#nfr-3)).

### Routes (React Router)

| Path | Page |
|---|---|
| `/` | Active lists |
| `/lists/:id` | A list |
| `/archive` | Archived lists |
| `/templates`, `/templates/:id` | Templates, a template |
| `/catalog` | Catalog |
| `/categories` | Category tree |
| `/units` | Units |
| `/settings` | Profile and account settings |
| `/login`, `/register`, `/verify-email`, `/reset-password` | Account flows |
| `/shared` *(Later)* | Shared with me |
| `/s/:token` *(Later)* | Opening a share link |

Only `/` (the Start page) and `/design` exist so far; the table above is the target. Any other path shows React Router's default error screen until a not-found route is added ([ADR 0021](../decisions/0021-spa-skeleton-details.md), consequences).

### Startup

The app asks Better Auth (through its React client) for the current session. If there is none, the app works without one: it shows the (empty) lists and the read-only seed catalog and categories. On the visitor's first change, the API client creates an anonymous session and then sends the change, so a first-time visitor still lands directly in a working app — the workspace just appears when they first need it.

The rate-limit (429) and quota (`quota_exceeded`) errors are shown as clear messages ([LIM-3](../requirements/functional-requirements.md#lim-3), [LIM-4](../requirements/functional-requirements.md#lim-4)), never as generic failures.

### State

| Kind | Examples | Owner |
|---|---|---|
| **Server state** | lists, items, catalog, categories | TanStack Query (fetching, caching, refreshing) |
| **URL state** | which list is open | React Router |
| **Local UI state** | an open dialog, text typed in an input | the component (`useState`) |
| **Device preference** | none yet | `localStorage` |

There is no global client-state library (Redux, Zustand). One is added only when a real need appears.

### Optimistic updates

Checking, adding and editing items update the TanStack Query cache immediately and re-sort with the shared domain rules. The request then goes to the server. If it fails, the change is rolled back and a message is shown.

### Offline (NET-1)

The app watches the browser's online/offline events and failed requests. When offline it shows a clear banner and disables actions that change data. Changes are blocked, not queued. Queueing is the "offline check-off" future extension.

### Forms

React Hook Form with the Zod resolver and the shared schemas: the browser and the API reject exactly the same invalid input.

## 4. Later features and cross-cutting concerns

### Sharing (SHR)

- Tables: `list_shares` (list, user, role) and `share_links` (list, role, token). Link tokens are random and stored **hashed**, so a database leak does not hand out working links. "Regenerate" revokes the old link and creates a new one.
- A guest opening a share link already has an anonymous user, so the share is recorded against that user. Access stays tied to their session ([SHR-2](../requirements/functional-requirements.md#shr-2)).
- All list access goes through `requireListAccess` (see Access control), which gains the shopper and editor roles. Editors reach the owner's category tree through the list ([SHR-5](../requirements/functional-requirements.md#shr-5)); the route is chosen by the sharing phase.
- Matching an editor's catalog product to the owner's categories by name ([SHR-5](../requirements/functional-requirements.md#shr-5)) lives in the items service.

### Live updates (SYN)

- A WebSocket endpoint at `/api/ws` (via `@fastify/websocket`). The browser subscribes to the list it is viewing.
- After a change commits, the service publishes a small event ("list 42: item changed") on an **event bus**. The bus is backed by **Redis publish/subscribe**: every task subscribes to the channel, and each task's WebSocket hub forwards what it hears to that list's subscribers on that task; the browser tells TanStack Query to refetch the list. Pushing the changed data itself can come later if refetching proves too slow ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decision 7).
- **After a reconnect**, the browser refetches the lists it watches, since a WebSocket closes when its task stops (a deploy, a scale-in) and an event published meanwhile, or lost between a commit and its publish, would otherwise stay missed ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decision 5).
- Edit requests send only the changed fields (`PATCH`), which gives "last change wins per field" ([SYN-2](../requirements/functional-requirements.md#syn-2)).

### Cross-cutting

- **Configuration:** environment variables, validated with a Zod schema at startup. A missing or invalid setting stops the app immediately with a clear error. Every variable is required, with no defaults; locally, `apps/api/.env` (copied from `.env.example`, git-ignored) is loaded by Node's `--env-file`, and the error names each bad variable, never its value ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 2). The database has six settings, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` and `DATABASE_TLS` (`none` locally, `verify-full` on RDS), the first five kept separate so that ECS injects the password alone: the app's from the SSM parameter `/szop/db-app-password`, `db-setup`'s master password from the `password` key of the secret RDS manages ([ADR 0020](../decisions/0020-database-details.md), decision 3). In AWS, secrets arrive the same way, injected by Elastic Container Service (ECS) from the secret stores; the configuration is never logged, and pino redacts secret fields.
- **Logging:** Fastify's built-in structured logger (pino), one JSON line per event on standard output. Fastify logs each request (`incoming request` and `request completed`, with a request ID, a random UUID, unique across tasks and never taken from the request: [ADR 0040](../decisions/0040-two-tasks-details.md), decision 3), except requests to `GET /api/live` and `GET /api/health`, which the load balancer and the redeploy watch script send every few seconds; the route's own warning when the database is down still logs ([ADR 0033](../decisions/0033-app-ready-for-the-cloud-details.md), decision 7). In development the output is piped through pino-pretty; the app itself always writes JSON ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 3). In AWS, the lines go to CloudWatch Logs.
- **Email:** the `EmailSender` interface. A console implementation for development prints emails instead of sending them. In AWS, an SES implementation sends them through the AWS software development kit (SDK), authorized by the task's Identity and Access Management (IAM) role, with no API key.
- **Testing:** most tests are API tests that send real HTTP requests (Fastify's `inject()`) through all three layers into a real PostgreSQL, with only the edges (email, clock) faked. For that, the app is assembled by one `buildApp(deps)` function that production and tests both call. Pure domain rules get unit and property tests, the frontend gets component tests with the network faked, and each use case gets an end-to-end journey in a real browser. Details in [ADR 0007](../decisions/0007-testing-strategy.md).

## 5. Deployment

Szop runs on AWS as an **on-demand demo environment**: created for a session, destroyed afterwards, starting each time with an empty database. There is no always-on production and no staging. Decisions and alternatives are in [ADR 0008](../decisions/0008-hosting.md); the AWS concepts are explained in the [stack overview](stack-overview.md#12-where-szop-runs). Every AWS resource Terraform creates, and how the resources refer to each other, is drawn in [AWS resources](aws-resources.md).

```
 Internet
    │ HTTPS  szop.dzwoniec.com  (Route 53 DNS, ACM certificate per session)
    ▼
┌─ VPC, eu-central-1, two availability zones ──────────────────────────┐
│  public subnets                                                      │
│   ┌───────────────────────────┐          ┌──────────────────────────┐│
│   │ Application Load Balancer │ app port │ ECS Fargate tasks        ││
│   │ 443 (80 redirects to 443) ├─────────►│ (two, up to four)        ││
│   └───────────────────────────┘          │ Fastify API + built SPA  ││
│                                          └────────────┬─────────────┘│
│  private subnets                                      │ 5432         │
│   ┌───────────────────────────┐                       │              │
│   │ RDS PostgreSQL            │◄──────────────────────┘              │
│   └───────────────────────────┘                                      │
└──────────────────────────────────────────────────────────────────────┘
 The tasks also use: ECR (their image), Parameter Store and Secrets Manager
 (secrets), SES (email), CloudWatch Logs (logs), and from PH-39 ElastiCache
 Redis in the private subnets (rate limits, live updates).
```

In the diagram, the VPC (virtual private cloud) is the demo's own private network, ACM (AWS Certificate Manager) issues the HTTPS certificate, RDS (Relational Database Service) runs PostgreSQL and ECR (Elastic Container Registry) stores the images. The [stack overview](stack-overview.md#12-where-szop-runs) explains each.

- **The landing page** is separate from the app and always up: `dzwoniec.com` serves the static files of `apps/landing/` from GitHub Pages, deployed by `pages.yml` ([ADR 0044](../decisions/0044-landing-page-details.md); the stack overview explains [static hosting](stack-overview.md#static-hosting-the-landing-page)). A script on the page checks whether the demo answers at `https://szop.dzwoniec.com/api/health` with a `no-cors` request and shows a dot in the footer link to Szop: green and filled when it does, a grey ring when it does not. Under the link the footer carries a copyright line, "© Luiki 2026", smaller and lighter than the link. The application knows the page only through one header: `/api/health` sends `Cross-Origin-Resource-Policy: same-site`, or the browser blocks the answer the page asks for ([ADR 0046](../decisions/0046-health-answer-for-the-landing-page.md)); `szop.dzwoniec.com` does not redirect to it.
- **One container** runs the Fastify API, which also serves the built SPA with `@fastify/static` (falling back to `index.html` for non-API paths), so the SPA and the API share one origin with no extra infrastructure.
- **The container image** ([ADR 0028](../decisions/0028-container-image-details.md); [Docker](../development/tools/docker.md)) is built by a multi-stage `Dockerfile` on `node:24-trixie-slim`, pinned by digest. It holds, under `/app`, the API's production dependencies (`node_modules`, with `@szop/shared` linked to `packages/shared`, outside `node_modules`, so Node strips its types), the API's `src`, `drizzle` migrations and `certs` (the RDS certificate bundle), `packages/shared`'s source and the built SPA in `apps/web/dist`; no pnpm, npm, npx or Corepack (the final stage removes the ones the base image brings, [ADR 0041](../decisions/0041-security-scanners-details.md), decision 8), no development dependencies, no tests. CI scans it with Trivy on every PR that rebuilds it ([CI/CD](../development/ci-cd.md#the-security-scans-and-the-pr-comment)). It runs `node src/server.ts` from `/app/apps/api` as the non-root `node` user, with the code owned by root and nothing written to disk by the app (Compose and CI run it with a read-only root filesystem to prove that; on ECS the root filesystem is writable, because ECS Exec needs it, [ADR 0038](../decisions/0038-app-on-ecs-and-rds-details.md)). The image sets `WEB_ROOT`, `NODE_ENV` and `GIT_COMMIT`, a build argument (`unknown` when none is given) that `/api/health` reports, so the image tells which code it holds wherever it runs; every other setting (`HOST`, `PORT`, `LOG_LEVEL`, the `DATABASE_*` settings, `TRUSTED_PROXIES`) comes from whoever runs it: Compose locally (`pnpm check:image`), ECS on AWS.
- **Static files are compressed and cached** ([ADR 0013](../decisions/0013-visual-design.md), decision 5; [ADR 0023](../decisions/0023-production-build-and-serving-details.md)): the build writes Brotli and gzip copies of every text file and `@fastify/static` serves them (`preCompressed`); fingerprinted assets are cached for a year as `immutable`, while `index.html` is `no-cache`, checked again on every load, so a new deploy reaches the browser at once. See [Serving the SPA](#code-structure) for the rules. With no CDN, every byte comes from Frankfurt.
- **The app runs as one ECS service** (since [PH-12c](../roadmap.md#ph-12c-app-on-ecs-and-rds), [ADR 0038](../decisions/0038-app-on-ecs-and-rds-details.md); the stack overview explains [the concepts](stack-overview.md#ecs-and-rds-the-app-and-its-database)): the cluster `szop-demo` holds the service `szop-demo-app`, which keeps two Fargate tasks of the task definition `szop-demo-app` running, one in each availability zone since [PH-37](../roadmap.md#ph-37-two-tasks), behind the load balancer's target group `szop-demo-app` (`awsvpc` networking: each task has its own network interface, in a public subnet with a public IP address, since there is no NAT gateway). Each task has 0.25 vCPU and 512 MB, runs the container `app` from `szop:<commit>` in the registry, with a writable root filesystem and ECS Exec on (`enable_execute_command`), and logs through `awslogs` to `/szop/app` (stream prefix `app`). Its settings are task-definition environment entries (`HOST`, `PORT`, `LOG_LEVEL`, the `DATABASE_*` ones, `DATABASE_TLS=verify-full`, `TRUSTED_PROXIES` with the two public subnets' ranges) and one secret, `DATABASE_PASSWORD`, which ECS fetches from the parameter `/szop/db-app-password`. Terraform creates the service with a wanted count of 0 and ignores the count afterwards: `demo-up` sets it to 2 once `db-setup` has run ([ADR 0040](../decisions/0040-two-tasks-details.md), decision 10), and autoscaling will own it from [PH-38](../roadmap.md#ph-38-autoscaling). ECS waits 60 seconds after a task starts before it counts the load balancer's health checks, for the image pull and the migrations, and counts a new task healthy only after that, so the old and the new version serve side by side for about a minute during a redeploy, two tasks of each. The target group checks `/api/live` every 10 seconds (a task is healthy after 2 answers and unhealthy after 3 failures), as [PH-12d](../roadmap.md#ph-12d-safe-redeploys) set it.
- **The database** is the RDS instance `szop-demo` (since PH-12c): PostgreSQL 18, the major version of `compose.yaml`'s image, on `db.t4g.micro` with 20 GB of `gp3`, encrypted, single-AZ, in the two private subnets (subnet group `szop-demo`) and not publicly accessible. Its security group admits port 5432 from the tasks' security group only. The database `szop` and the master user `szop_admin` are created with it; RDS creates the master password and keeps it in Secrets Manager (`manage_master_user_password`), so it is never in Terraform state. There are no backups, no final snapshot and no deletion protection: it is recreated every session. The default parameter group requires TLS (`rds.force_ssl`).
- **Two database roles.** The app connects as **`szop_app`**, which owns the database `szop` (and so its `public` schema, where it creates the migrations' tables) and has `LOGIN` but no `SUPERUSER`, `CREATEROLE` or `CREATEDB`, so it cannot create roles or databases. The master user is used only by **`db-setup`**, which `demo-up` runs as a one-off ECS task after the apply and before it starts the app. `db-setup` is the same image with another command (`node src/db-setup.ts`) and its own task definition, `szop-demo-db-setup`, which injects the master password and `szop_app`'s. In one transaction it creates `szop_app` or sets its password again, grants the role to the master user (PostgreSQL 16 and later give the creator no membership, which `ALTER DATABASE … OWNER TO` needs) and makes it the database's owner. The password goes to PostgreSQL as a SCRAM-SHA-256 verifier computed in the task, so the cleartext never reaches the server and a failed statement cannot write it into the server's log. Running it at every `demo-up` means that on a redeploy it finds the role and sets its password again, which also picks up a rotated password. Separate migration and runtime roles are a step for an always-on Szop ([OP-033](https://github.com/luiki-dev/szop/issues/116)).
- **Two tasks** run, one in each availability zone (since [PH-37](../roadmap.md#ph-37-two-tasks), [ADR 0040](../decisions/0040-two-tasks-details.md)), and autoscaling keeps between two and four on average CPU (from [PH-38](../roadmap.md#ph-38-autoscaling)) ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decisions 1 and 13). A task keeps nothing to itself that another needs: migrations and the cleanup take PostgreSQL advisory locks, the rate limits and the event bus go through Redis, sessions are in PostgreSQL, and request IDs are unique across tasks: always a random universally unique identifier (UUID), never the load balancer's `X-Amzn-Trace-Id`, whose `Root` a client can choose (decision 10; [ADR 0040](../decisions/0040-two-tasks-details.md), decision 3). Each process draws an 8-character instance ID at startup, which `/api/health` reports as `instance`, so the answers show which task gave them. Each task's pool holds at most 5 connections, the migration lock's included, within a budget that keeps the worst case, every task doubled by a deploy, under about 80% of the database's `max_connections`: 2 × 2 × 5 = 20 connections now, 4 × 2 × 5 = 40 at autoscaling's maximum, against a `max_connections` of 79 on `db.t4g.micro`, whose 80% is about 63 (decision 11; [ADR 0040](../decisions/0040-two-tasks-details.md), decision 7). The cleanup only matters while the environment is up, since all data disappears on teardown.
- **Migrations** run when the container starts, before it accepts requests, after a check that the database holds no migration of another branch; on a mismatch the container stops and the remedy is `demo-down`, then `demo-up`. Since [PH-37](../roadmap.md#ph-37-two-tasks), the check and the migration run under a PostgreSQL advisory lock held on a connection checked out of the pool, so tasks starting together migrate one at a time: the others wait, then find nothing pending ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decision 2; [ADR 0040](../decisions/0040-two-tasks-details.md), decisions 4 to 6). The connection to RDS uses TLS with full certificate verification (`DATABASE_TLS=verify-full`). There are two health routes. **`GET /api/health`** is the readiness check: it checks the database connection, for `demo-up`'s wait, the redeploy watch script and people, and answers 200 with the commit the image was built from, the instance ID and the latest migration's name, or 503 with the commit and the instance ID when the database cannot be reached. The commit is public by design: the repository is public, and it lets the watch script tell which version answered. **`GET /api/live`** is the liveness check, which the load balancer's target group asks since [PH-12d](../roadmap.md#ph-12d-safe-redeploys): it touches only the process and answers 200 once the server listens, which is after the migrations, so a task is never healthy before it has migrated. A database outage then leaves the tasks running, serving the SPA, instead of replacing them in a loop ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decision 4).
- **Deploys are rolling**: old and new tasks serve side by side for a minute or two, so every migration must be safe for the previous version (expand, then contract). Since [PH-12d](../roadmap.md#ph-12d-safe-redeploys) the service demands a minimum of 100% and allows a maximum of 200% healthy, so the two new tasks start beside the two old ones and the old ones stop only once the new ones are healthy. The deployment circuit breaker is on with no rollback: after three tasks in a row fail to start or fail their health checks the deployment is `FAILED`, ECS launches no more tasks, and the old tasks keep serving; the fix goes forward, in a new deploy ([ADR 0036](../decisions/0036-scalability-and-isolation.md), decision 3). The deregistration delay is 30 seconds: ECS takes a task out of the target group before stopping it, the old task gets 30 seconds to finish its requests, and a target with none is deregistered at once (decision 5). **The gap:** while both tasks are healthy, the load balancer routes each request on its own, so a page load can mix two versions of the SPA, `index.html` from the new task and an asset only the new build has asked of the old one, which answers `404`, and the page loads blank until a reload. The gap is accepted: the demo is redeployed a few times a phase and a reload fixes it ([OP-103](https://github.com/luiki-dev/szop/issues/249); [ADR 0040](../decisions/0040-two-tasks-details.md), decision 1).
- **The network and the load balancer** (built in [PH-12b](../roadmap.md#ph-12b-network-and-the-demo-up-button), [ADR 0034](../decisions/0034-network-and-demo-up-details.md); the stack overview explains [each piece](stack-overview.md#the-demos-network-and-load-balancer)): a VPC `10.0.0.0/16` named `szop-demo` with four subnets in `eu-central-1a` and `eu-central-1b`: public `10.0.0.0/24` and `10.0.1.0/24`, private `10.0.10.0/24` and `10.0.11.0/24`. An internet gateway and a route table with `0.0.0.0/0` through it serve the public subnets; the private ones have only the VPC's local route, and there is no NAT gateway and no VPC endpoint. The private subnets hold the database since PH-12c. The internet-facing application load balancer `szop-demo` sits in the two public subnets, IPv4 only. Its listener on 80 redirects to HTTPS with a 301. Its listener on 443 holds the ACM certificate for `szop.dzwoniec.com` (validated through a CNAME record in base's zone and created per session), the TLS policy `ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09`, and a default action that forwards to the app's target group (a fixed placeholder page until PH-12c). An alias `A` record `szop.dzwoniec.com` points at the load balancer. `infra/demo` finds the zone by name, with a data source, not through base's state ([ADR 0034](../decisions/0034-network-and-demo-up-details.md)).
- **Security groups** chain the layers: the load balancer accepts traffic from anyone, the task only from the load balancer, the database only from the task. The database has no route to the internet.
- **Secrets** (the Better Auth secret and `szop_app`'s password in Parameter Store, the master password in Secrets Manager, where RDS keeps it) are injected by ECS as environment variables when a task starts, through the task execution role. The app's task definition names only `szop_app`'s password; only `db-setup`'s names the master password. Their values are never in git, the image, the task definition or Terraform state. [Who can reach which secret](threat-model.md#who-can-reach-which-secret).
- **Email** goes through SES, with `dzwoniec.com` as its identity (DKIM-signed; DMARC `p=reject` and SPF `-all` refuse forgeries), in its sandbox, which delivers only to verified addresses.
- **Infrastructure as code:** Terraform, in three root modules under `infra/`: `bootstrap` (state bucket, budget alerts), `base` (permanent: image registry, DNS zone (imported from the registration, never destroyed), email identity, the Better Auth secret, `szop_app`'s password, log group, the app's IAM roles (`szop-app-task-execution` and `szop-app-task`), and the GitHub OIDC provider with CI's roles) and `demo` (created per session: network, load balancer, the certificate and the `szop` record since PH-12b; the database, the ECS cluster, task definitions and service since PH-12c). Images carry the commit hash and, when built from a version tag, the version.
- **Deployments are push-button:** GitHub Actions workflows build the image, push it when the registry lacks it, apply `infra/demo`, start the app and destroy it all on request and every night. `demo-up` is pressed on the branch being checked. Its job `build` builds the image of the commit with no AWS credentials, while the job `deploy` waits for the owner's approval of the GitHub environment `demo`; `deploy` then pushes the image, applies `infra/demo` with the commit it checked out as `deployed_commit` (a precondition refuses an apply without one), runs `db-setup` (and stops it at its deadline), starts the service (a count of 0 is set to 2 with a forced new deployment) and watches the deployment until it completes or the circuit breaker fails it, then waits until `/api/health` answers ok with the commit it deployed ([CI/CD](../development/ci-cd.md#demo-up-job-by-job)); a separate job, `enable-teardown`, switches `demo-down` back on. CI reaches AWS through OpenID Connect (OIDC), with no stored keys. See [ADR 0010](../decisions/0010-ci-cd.md).
- **CI's access to AWS** ([ADR 0032](../decisions/0032-ci-access-and-teardown-details.md); [CI/CD](../development/ci-cd.md#cis-access-to-aws)): `infra/base` holds the OIDC provider for `token.actions.githubusercontent.com` and two roles. **`szop-ci-plan`** is assumed by `ci.yml`'s `plan` job on a pull request from this repository (`sub` is `repo:luiki-dev@290870182/szop@1380292421:pull_request`): AWS's `ReadOnlyAccess`, with explicit denies on secret values, log contents, S3 objects outside base's and demo's state, billing and cost, and the account's contact details. It plans `infra/base` and `infra/demo`, has IAM Access Analyzer validate every IAM policy in the plan, and never writes; a failed plan or a serious finding blocks the PR ([ADR 0041](../decisions/0041-security-scanners-details.md), decision 4). **`szop-ci-deploy`** is assumed by `demo-down.yml` in the GitHub environment `demo-teardown`, which only `main` may use (`sub` is `repo:luiki-dev@290870182/szop@1380292421:environment:demo-teardown`), and by `demo-up.yml` in the environment `demo`, which any branch may use after the owner's approval (`sub` is `repo:luiki-dev@290870182/szop@1380292421:environment:demo`, with no `ref` condition). It reaches the demo's state and lock file in the state bucket and, through six customer managed policies (`szop-ci-deploy-demo-network`, `-load-balancer`, `-dns`, `-database` and `-service`, and `szop-ci-deploy-image`), the demo's network, load balancer, certificate, database, cluster, task definitions, service and target group only on resources tagged `project` = `szop` and `group` = `demo`, the `szop` and certificate-validation records in the zone, a push to the registry `szop`, `ecs:RunTask` of `db-setup`'s task definition, `ecs:StopTask` of its tasks and `iam:PassRole` of the two app roles; it grows with `infra/demo` phase by phase. Their ARNs are the repository variables `AWS_PLAN_ROLE_ARN` and `AWS_DEPLOY_ROLE_ARN`. `demo-down` runs by hand and every night at 01:17 UTC, always as a real `terraform destroy` of `infra/demo`, with the Terraform code of the commit the demo was deployed from when one is recorded (the `deployed_commit` output `demo-up` records), and with `main`'s otherwise.
