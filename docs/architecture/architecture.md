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
infra/            Terraform root modules (ADR 0008)
```

The packages and `e2e/` are pnpm workspaces. The packages are named `@szop/api`, `@szop/web` and `@szop/shared`, and imports keep their `.ts` extension ([ADR 0019](../decisions/0019-api-skeleton-details.md), decisions 6 and 7). `packages/shared` is consumed from its TypeScript source, with no build step of its own. The rest of the tooling is in [ADR 0005](../decisions/0005-development-environment.md).

## 2. Backend (`apps/api`)

### Code structure

Feature modules — `lists`, `items`, `categories`, `catalog`, `units`, `templates`, `account` (and `sharing` later) — each with three layers:

| File | Layer | Knows about | Does not know about |
|---|---|---|---|
| `routes.ts` | HTTP | Fastify, shared Zod schemas | SQL, business rules |
| `service.ts` | Business logic | rules, access checks, transactions | HTTP |
| `repository.ts` | Persistence | Drizzle queries | business rules |

Dependencies (database client, email sender, clock) are passed in explicitly when the app is assembled. There is no dependency-injection container. Tests pass fakes the same way.

**Assembly.** `buildApp(deps)` in `app.ts` creates Fastify and registers each feature's routes as a plugin under `/api`, passing the services it needs as plugin options; there are no decorators for dependencies ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 1). `server.ts` is the entry point: it reads the configuration, calls `buildApp`, listens, and on SIGINT or SIGTERM closes the app so that requests in flight finish.

**Database.** `src/db/` holds the connection (`createDatabase`: Drizzle over a node-postgres pool, with a two-second connection timeout), the migrator and the schema version lookup; `drizzle/` holds the generated migrations. `server.ts` creates the database, builds the app with it (`AppDeps` is `{ config, db }`), applies the migrations, then listens; on shutdown it closes the app, then the pool: whoever creates a pool closes it ([ADR 0020](../decisions/0020-database-details.md), decisions 11 and 12). An unreachable database stops startup. A dropped idle connection does not crash the process: the pool's `error` listener logs its code and message at warn, and the pool opens a new connection on the next query (decision 14).

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
- **List items:** copy their catalog defaults when added ([ITM-6](../requirements/functional-requirements.md#itm-6), [PRD-3](../requirements/functional-requirements.md#prd-3)) and record when they were added, which gives the "order added" sort ([ORD-5](../requirements/functional-requirements.md#ord-5)).
- **Templates:** `templates` and `template_items`, the same shape as lists and items without checked state.

### Seed data

A versioned data file in `apps/api` holds the default catalog, category tree and units. Creating a workspace copies it into that workspace's tables in one transaction.

### Anonymous guests

- **Lazy creation ([ACC-1](../requirements/functional-requirements.md#acc-1)).** A visitor without a session has no user and no workspace. Read requests without a session get the **seed data** (catalog, categories, units), which the API keeps in memory, read-only, and an empty set of lists and templates. Nothing is written to the database.
- On the visitor's **first change**, the frontend asks Better Auth's anonymous plugin for an anonymous session (rate-limited, see Abuse protection). Creating the anonymous user also creates its workspace by copying the seed data. The frontend then sends the original change.
- When an anonymous user registers or logs in, Better Auth links them to the registered account. In that step the server either:
  - reassigns the anonymous workspace to the new account on registration ([ACC-2](../requirements/functional-requirements.md#acc-2)), or
  - imports the guest's lists and templates into the existing account's workspace, or discards them, according to the user's choice ([ACC-4](../requirements/functional-requirements.md#acc-4)).

  How this maps onto Better Auth's anonymous plugin is not settled: by default the plugin links and deletes the anonymous user inside the sign-in request, before the [ACC-4](../requirements/functional-requirements.md#acc-4) choice can be made ([OP-038](../open-points.md#op-038)).
- **Activity tracking.** Each workspace has a `last_active_at` timestamp, updated by the auth hook at most once an hour to avoid a database write on every request.
- **Cleanup.** A scheduled task inside the API process deletes ([ACC-7](../requirements/functional-requirements.md#acc-7), [ACC-8](../requirements/functional-requirements.md#acc-8)):
  - anonymous users whose workspace's `last_active_at` is within 1 hour of creation, 3 days after creation;
  - other anonymous users inactive for 30 days;
  - registered users not verified within 7 days.

### Abuse protection

Anonymous users make writes cheap for anyone, so the design limits how much a script can cost us. The values are the defaults from [LIM-1](../requirements/functional-requirements.md#lim-1) to [LIM-4](../requirements/functional-requirements.md#lim-4), read from configuration.

- **Lazy creation** (above): visits that change nothing — crawlers, uptime monitors, link previews — create nothing.
- **Rate limits** with `@fastify/rate-limit`: anonymous-session creation, registration, requests without a session, and password-reset and verification-resend requests per IP address; registration, reset and resend also per target email; all other API requests per session. IPv6 addresses are keyed by their /64 block, so one machine cannot rotate through addresses. Login attempts use Better Auth's built-in rate limiting per IP address, plus custom code limiting failed attempts per email address. A daily cap on outgoing emails, below SES's quota, protects the quota from an attack spread over many addresses ([ADR 0012](../decisions/0012-security-baseline.md), decision 14).
- **The client IP** is the address the load balancer saw: Fastify trusts exactly the number of proxy hops in `TRUSTED_PROXY_HOPS` (one in AWS, none locally), never `trustProxy: true`, which would let a client forge `X-Forwarded-For`. Better Auth is handed the same address (decision 13).
- **Counters live in memory**, for both limiters; that is valid because exactly one instance runs.
- **Quotas**: services check a workspace's counts before inserting (lists, items per list or template, templates, products, categories and tree depth, units). Two concurrent requests can both pass the check and exceed a quota by a few rows; with one instance and per-session rate limits that is harmless, so no locking is added for it. Text lengths are part of the shared Zod schemas.
- **Request size**: Fastify's default body limit (1 MB) stays on.
- **Not in the application**: volumetric denial of service (floods of traffic) is handled at the infrastructure level. The demo environment relies on AWS Shield Standard, which protects its load balancer at no cost; a content delivery network and a web application firewall are the step up for an always-on service ([ADR 0008](../decisions/0008-hosting.md)). A bot challenge (such as Cloudflare Turnstile) on anonymous-session creation is an escalation option if abuse ever appears.

### Web security

The application's baseline, production grade even on the demo ([ADR 0012](../decisions/0012-security-baseline.md), decisions 7–12):

- **Session cookie:** `HttpOnly`, `Secure`, `SameSite=Lax`, no `Domain` attribute, `__Host-` prefix where Better Auth allows it (otherwise `__Secure-`). Better Auth's session cookie cache stays off, so a revoked session stops working at once.
- **Cross-site request forgery (CSRF):** GET never changes anything. Every POST, PUT, PATCH and DELETE, on every route, must carry `Sec-Fetch-Site: same-origin` (or, as a fallback, the app's `Origin`), otherwise 403, and a JSON body. Better Auth's `trustedOrigins` lists exactly the app's origin. The WebSocket (Later) checks `Origin` on connect.
- **Security headers** with `@fastify/helmet`: a strict Content Security Policy (CSP) allowing only the app's own files (`default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`), with no inline scripts or `<style>` elements; HTTP Strict Transport Security (HSTS) for one year, without preload; `Referrer-Policy: no-referrer`.
- **Tokens in URLs** (verification, reset, later share links): single-use and expiring; stripped from logged URLs by the request log's serializer; removed from the address bar by the SPA once used.
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

### Styling and components

Decided in [ADR 0013](../decisions/0013-visual-design.md); the design system itself is described in [visual-design.md](visual-design.md).

- **Components:** shadcn/ui's components, built on Base UI, are copied into `apps/web/src/components/ui/` as phases need them and are ours to change. Feature folders compose them; they don't restyle them page by page.
- **Styling:** Tailwind CSS v4 through `@tailwindcss/vite`, compiled at build time into one stylesheet. The design tokens are CSS custom properties in two tiers (Tailwind's palette, and semantic roles such as `--primary` that components use), all in `apps/web`. Dark mode follows the system setting through Tailwind's `dark:` variant.
- **Under the CSP:** nothing injects `<style>` elements at run time ([Web security](#web-security)). Base UI runs with `disableStyleElements`, toasts use Base UI's Toast, and every E2E journey fails on a CSP violation.
- **Assets:** the Figtree font (`@fontsource-variable/figtree`) and Lucide's icons are bundled by Vite, so everything is served from the app's own origin.
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

### Startup

The app asks Better Auth (through its React client) for the current session. If there is none, the app works without one: it shows the (empty) lists and the read-only seed catalog and categories. On the visitor's first change, the API client creates an anonymous session and then sends the change, so a first-time visitor still lands directly in a working app — the workspace just appears when they first need it.

The rate-limit (429) and quota (`quota_exceeded`) errors are shown as clear messages ([LIM-3](../requirements/functional-requirements.md#lim-3), [LIM-4](../requirements/functional-requirements.md#lim-4)), never as generic failures.

### State

| Kind | Examples | Owner |
|---|---|---|
| **Server state** | lists, items, catalog, categories | TanStack Query (fetching, caching, refreshing) |
| **URL state** | which list is open | React Router |
| **Local UI state** | an open dialog, text typed in an input | the component (`useState`) |
| **Device preference** | "hide checked items" toggle ([ORD-4](../requirements/functional-requirements.md#ord-4)) | `localStorage` |

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
- After a change succeeds, the service publishes a small event ("list 42: item changed") on an **in-process event bus**. The WebSocket hub forwards it to that list's subscribers, and the browser tells TanStack Query to refetch the list. Pushing the changed data itself can come later if refetching proves too slow.
- Edit requests send only the changed fields (`PATCH`), which gives "last change wins per field" ([SYN-2](../requirements/functional-requirements.md#syn-2)).
- The in-process bus works for a single server process, which is what the deployment runs. Several processes would need a shared channel (PostgreSQL `LISTEN/NOTIFY` or Redis).

### Cross-cutting

- **Configuration:** environment variables, validated with a Zod schema at startup. A missing or invalid setting stops the app immediately with a clear error. Every variable is required, with no defaults; locally, `apps/api/.env` (copied from `.env.example`, git-ignored) is loaded by Node's `--env-file`, and the error names each bad variable, never its value ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 2). The database has five settings, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER` and `DATABASE_PASSWORD`, kept separate so that ECS injects the password alone from the RDS-managed secret ([ADR 0020](../decisions/0020-database-details.md), decision 3). In AWS, secrets arrive the same way, injected by Elastic Container Service (ECS) from the secret stores; the configuration is never logged, and pino redacts secret fields.
- **Logging:** Fastify's built-in structured logger (pino), one JSON line per event on standard output. Fastify logs each request (`incoming request` and `request completed`, with a request ID). In development the output is piped through pino-pretty; the app itself always writes JSON ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 3). In AWS, the lines go to CloudWatch Logs.
- **Email:** the `EmailSender` interface. A console implementation for development prints emails instead of sending them. In AWS, an SES implementation sends them through the AWS software development kit (SDK), authorized by the task's Identity and Access Management (IAM) role, with no API key.
- **Testing:** most tests are API tests that send real HTTP requests (Fastify's `inject()`) through all three layers into a real PostgreSQL, with only the edges (email, clock) faked. For that, the app is assembled by one `buildApp(deps)` function that production and tests both call. Pure domain rules get unit and property tests, the frontend gets component tests with the network faked, and each use case gets an end-to-end journey in a real browser. Details in [ADR 0007](../decisions/0007-testing-strategy.md).

## 5. Deployment

Szop runs on AWS as an **on-demand demo environment**: created for a session, destroyed afterwards, starting each time with an empty database. There is no always-on production and no staging. Decisions and alternatives are in [ADR 0008](../decisions/0008-hosting.md); the AWS concepts are explained in the [stack overview](stack-overview.md#12-where-szop-runs).

```
 Internet
    │ HTTPS  demo.<domain>  (Route 53 DNS, ACM certificate)
    ▼
┌─ VPC, eu-central-1, two availability zones ──────────────────────────┐
│  public subnets                                                      │
│   ┌───────────────────────────┐          ┌──────────────────────────┐│
│   │ Application Load Balancer │ app port │ ECS Fargate task         ││
│   │ 443 (80 redirects to 443) ├─────────►│ (exactly one)            ││
│   └───────────────────────────┘          │ Fastify API + built SPA  ││
│                                          └────────────┬─────────────┘│
│  private subnets                                      │ 5432         │
│   ┌───────────────────────────┐                       │              │
│   │ RDS PostgreSQL            │◄──────────────────────┘              │
│   └───────────────────────────┘                                      │
└──────────────────────────────────────────────────────────────────────┘
 The task also uses: ECR (its image), Parameter Store and Secrets Manager
 (secrets), SES (email), CloudWatch Logs (logs).
```

In the diagram, the VPC (virtual private cloud) is the demo's own private network, ACM (AWS Certificate Manager) issues the HTTPS certificate, RDS (Relational Database Service) runs PostgreSQL and ECR (Elastic Container Registry) stores the images. The [stack overview](stack-overview.md#12-where-szop-runs) explains each.

- **One container** runs the Fastify API, which also serves the built SPA with `@fastify/static` (falling back to `index.html` for non-API paths), so the SPA and the API share one origin with no extra infrastructure.
- **Static files are compressed and cached** ([ADR 0013](../decisions/0013-visual-design.md), decision 5): the build writes Brotli and gzip copies of every file and `@fastify/static` serves them (`preCompressed`); fingerprinted assets are cached for a year as `immutable`, while `index.html` is never cached, so a new deploy reaches the browser at once. With no CDN, every byte comes from Frankfurt.
- **Exactly one instance** runs, so the in-process event bus and the cleanup task work as designed. The cleanup only matters while the environment is up, since all data disappears on teardown.
- **Migrations** run when the container starts, before it accepts requests. **`GET /api/health`** checks the database connection and is used by the load balancer's health check. It answers 200 with the latest migration's name, or 503 when the database cannot be reached.
- **Security groups** chain the layers: the load balancer accepts traffic from anyone, the task only from the load balancer, the database only from the task. The database has no route to the internet.
- **Secrets** (the Better Auth secret in Parameter Store, the RDS-managed database password in Secrets Manager) are injected by ECS as environment variables. Their values are never in git, the image, the task definition or Terraform state.
- **Email** goes through SES in its sandbox, which delivers only to verified addresses.
- **Infrastructure as code:** Terraform, in three root modules under `infra/`: `bootstrap` (state bucket, budget alerts), `base` (permanent: image registry, DNS zone, certificate, email identity, the Better Auth secret, log group, the app's IAM roles, and the GitHub OIDC provider with CI's roles) and `demo` (created per session: network, load balancer, ECS, RDS). Images carry the commit hash and, when built from a version tag, the version.
- **Deployments are push-button:** GitHub Actions workflows build the image when it is missing, apply `infra/demo`, and destroy it on request and every night. CI reaches AWS through OpenID Connect (OIDC), with no stored keys. See [ADR 0010](../decisions/0010-ci-cd.md).
