# Szop — Technical Architecture

Living description of how Szop is built. It implements the [functional requirements](../requirements/functional-requirements.md); requirement IDs (ACC-1, ORD-5, …) refer to that document. The decisions behind this design, with the alternatives considered, are in [ADR 0002](../decisions/0002-technical-architecture.md). For a gentler, concept-by-concept explanation of the stack, read the [stack overview](stack-overview.md). Acronyms and terms are explained in the [glossary](../glossary.md).

Out of scope here, decided in later steps: development environment and tooling, testing strategy, continuous integration and delivery (CI/CD), hosting and deployment, visual design (including component library and styling).

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
| **React single-page application (SPA)** | Built by Vite into static files. Renders everything in the browser. Talks to the API only over REST (and, later, a WebSocket). |
| **Fastify API** | One Node.js process. Business logic, access control, persistence. Mounts Better Auth. Later hosts the WebSocket endpoint for live updates. |
| **PostgreSQL** | The single source of truth for all data, including anonymous guests' workspaces. |
| **Email service** | Sends verification and password-reset emails. Hidden behind an `EmailSender` interface. The provider is chosen with deployment. |
| **`packages/shared`** | Code used by both sides: Zod schemas (the API contract), TypeScript types inferred from them, and pure domain rules such as item ordering (ORD) and totals (ITM-8). |

**Same origin.** The SPA and the API are served under one domain (for example `szop.app` and `szop.app/api`). Session cookies are therefore first-party and no Cross-Origin Resource Sharing (CORS) setup is needed. How this is achieved (reverse proxy, or the API serving the static files) is a deployment decision.

**Monorepo layout.** One repository, three packages:

```
apps/web          React SPA
apps/api          Fastify API (Drizzle schema, migrations, seed data)
packages/shared   Zod schemas, types, domain rules
```

Tooling (package manager, workspace tool, build and lint setup) is decided in the development environment step.

## 2. Backend (`apps/api`)

### Code structure

Feature modules — `lists`, `items`, `categories`, `catalog`, `units`, `templates`, `account` (and `sharing` later) — each with three layers:

| File | Layer | Knows about | Does not know about |
|---|---|---|---|
| `routes.ts` | HTTP | Fastify, shared Zod schemas | SQL, business rules |
| `service.ts` | Business logic | rules, access checks, transactions | HTTP |
| `repository.ts` | Persistence | Drizzle queries | business rules |

Dependencies (database client, email sender, clock) are passed in explicitly when the app is assembled. There is no dependency-injection container. Tests pass fakes the same way.

### Request lifecycle

1. The request reaches Fastify.
2. An auth hook asks Better Auth for the session and attaches the user (possibly anonymous) to the request.
3. Zod validates the path parameters, query and body (via `fastify-type-provider-zod`).
4. The route handler calls the service.
5. The service checks access, applies business rules, and calls the repository (inside a transaction when several writes belong together).
6. The repository runs Drizzle queries against PostgreSQL.
7. The response is serialized through its Zod schema, so nothing outside the contract leaks out.

The same Zod route schemas generate an OpenAPI description of the API (via `@fastify/swagger`).

### Access control

- Every user, anonymous or registered, has exactly **one workspace**.
- Services always scope queries by the workspace ID taken from the **session**, never by an ID sent by the browser.
- With sharing (Later), one central check — `requireListAccess(user, list, "shopper" | "editor" | "owner")` — decides access to a list.
- "Not found" and "not allowed" both return **404**, so nobody can probe whether another user's list exists.

### Data model highlights

- **Users, sessions, accounts:** Better Auth's tables, including the anonymous-user flag. `workspaces` is 1:1 with users and holds settings (currency).
- **Category tree:** each category stores `parent_id` and its `position` among siblings. Trees are small, so the API loads a workspace's whole tree and the shared domain rules compute the depth-first, parent-first order (ORD-2, ORD-3). Deleting a category cascades to its subcategories in the database. Catalog products and list items pointing to a deleted category get `category_id = null` (CAT-3).
- **Money:** stored as integers in minor units (cents, grosze) to avoid floating-point rounding errors. **Quantity:** decimal.
- **List items:** copy their catalog defaults when added (ITM-6, PRD-3) and record when they were added, which gives the "order added" sort (ORD-5).
- **Templates:** `templates` and `template_items`, the same shape as lists and items without checked state.

### Seed data

A versioned data file in `apps/api` holds the default catalog, category tree and units. Creating a workspace copies it into that workspace's tables in one transaction.

### Anonymous guests

- **Lazy creation (ACC-1).** A visitor without a session has no user and no workspace. Read requests without a session get the **seed data** (catalog, categories, units), which the API keeps in memory, read-only, and an empty set of lists and templates. Nothing is written to the database.
- On the visitor's **first change**, the frontend asks Better Auth's anonymous plugin for an anonymous session (rate-limited, see Abuse protection). Creating the anonymous user also creates its workspace by copying the seed data. The frontend then sends the original change.
- When an anonymous user registers or logs in, Better Auth links them to the registered account. In that step the server either:
  - reassigns the anonymous workspace to the new account on registration (ACC-2), or
  - imports the guest's lists and templates into the existing account's workspace, or discards them, according to the user's choice (ACC-4).
- **Activity tracking.** Each workspace has a `last_active_at` timestamp, updated by the auth hook at most once an hour to avoid a database write on every request.
- **Cleanup.** A scheduled task inside the API process deletes (ACC-7, ACC-8):
  - anonymous users whose `last_active_at` is within 1 hour of creation, 3 days after creation;
  - other anonymous users inactive for 30 days;
  - registered users not verified within 7 days.

### Abuse protection

Anonymous users make writes cheap for anyone, so the design limits how much a script can cost us. The values are the defaults from LIM-1 to LIM-4, read from configuration.

- **Lazy creation** (above): visits that change nothing — crawlers, uptime monitors, link previews — create nothing.
- **Rate limits** with `@fastify/rate-limit`: anonymous-session creation and registration per IP address; all other API requests per session. IPv6 addresses are keyed by their /64 block, so one machine cannot rotate through addresses. Login attempts use Better Auth's built-in rate limiting, per IP address and per email address.
- **Quotas**: services check a workspace's counts before inserting (lists, items per list or template, templates, products, categories and tree depth, units). Text lengths are part of the shared Zod schemas.
- **Request size**: Fastify's default body limit (1 MB) stays on.
- **Not in the application**: volumetric denial of service (floods of traffic) is handled at the infrastructure level (reverse proxy, content delivery network), decided with deployment. A bot challenge (such as Cloudflare Turnstile) on anonymous-session creation is an escalation option if abuse ever appears.

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

Feature folders mirroring the backend: `lists`, `items`, `catalog`, `categories`, `templates`, `account`. Each holds its pages, components and **data hooks** — small functions such as `useList(id)` or `useCheckItem()` that wrap TanStack Query. Components never call `fetch` directly. One typed **API client** module, built on the shared Zod schemas, does all HTTP calls. Cookies are sent automatically because everything is on the same origin.

### Routes (React Router)

| Path | Page |
|---|---|
| `/` | Active lists |
| `/lists/:id` | A list |
| `/archive` | Archived lists |
| `/templates`, `/templates/:id` | Templates, a template |
| `/catalog` | Catalog |
| `/categories` | Category tree |
| `/settings` | Profile and account settings |
| `/login`, `/register`, `/verify-email`, `/reset-password` | Account flows |
| `/shared` *(Later)* | Shared with me |
| `/s/:token` *(Later)* | Opening a share link |

### Startup

The app asks Better Auth (through its React client) for the current session. If there is none, the app works without one: it shows the (empty) lists and the read-only seed catalog and categories. On the visitor's first change, the API client creates an anonymous session and then sends the change, so a first-time visitor still lands directly in a working app — the workspace just appears when they first need it.

The rate-limit (429) and quota (`quota_exceeded`) errors are shown as clear messages (LIM-3, LIM-4), never as generic failures.

### State

| Kind | Examples | Owner |
|---|---|---|
| **Server state** | lists, items, catalog, categories | TanStack Query (fetching, caching, refreshing) |
| **URL state** | which list is open | React Router |
| **Local UI state** | an open dialog, text typed in an input | the component (`useState`) |
| **Device preference** | "hide checked items" toggle (ORD-4) | `localStorage` |

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
- A guest opening a share link already has an anonymous user, so the share is recorded against that user. Access stays tied to their session (SHR-2).
- All list access goes through `requireListAccess` (see Access control).
- Matching an editor's catalog product to the owner's categories by name (SHR-5) lives in the items service.

### Live updates (SYN)

- A WebSocket endpoint at `/api/ws` (via `@fastify/websocket`). The browser subscribes to the list it is viewing.
- After a change succeeds, the service publishes a small event ("list 42: item changed") on an **in-process event bus**. The WebSocket hub forwards it to that list's subscribers, and the browser tells TanStack Query to refetch the list. Pushing the changed data itself can come later if refetching proves too slow.
- Edit requests send only the changed fields (`PATCH`), which gives "last change wins per field" (SYN-2).
- The in-process bus works for a single server process. Several processes would need a shared channel (PostgreSQL `LISTEN/NOTIFY` or Redis), decided with deployment if needed.

### Cross-cutting

- **Configuration:** environment variables, validated with a Zod schema at startup. A missing or invalid setting stops the app immediately with a clear error.
- **Logging:** Fastify's built-in structured logger (pino), one JSON line per event.
- **Email:** the `EmailSender` interface. A console implementation for development prints emails instead of sending them. The real provider is chosen with deployment.
