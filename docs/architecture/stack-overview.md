# Szop — Stack Overview

A learning-oriented tour of the technologies behind Szop: what each piece is, what it is responsible for, who talks to whom, and how a request travels through the system. The binding design lives in [architecture.md](architecture.md); this document explains the ideas behind it. Unfamiliar acronyms and terms are in the [glossary](../glossary.md).

## Contents

- [1. The big picture](#1-the-big-picture)
- [2. Who is responsible for what](#2-who-is-responsible-for-what)
- [3. Who talks to whom](#3-who-talks-to-whom)
- [4. Lifecycle of opening the app](#4-lifecycle-of-opening-the-app)
- [5. Lifecycle of a request: checking an item off](#5-lifecycle-of-a-request-checking-an-item-off)
- [6. Node.js, Express, Fastify and NestJS — how they relate](#6-nodejs-express-fastify-and-nestjs--how-they-relate)
- [7. Kinds of state in a frontend](#7-kinds-of-state-in-a-frontend)
- [8. The shared package and Zod](#8-the-shared-package-and-zod)
- [9. Data access: Drizzle and PostgreSQL](#9-data-access-drizzle-and-postgresql)
- [10. Authentication: sessions and cookies](#10-authentication-sessions-and-cookies)
- [11. The monorepo](#11-the-monorepo)
- [12. Where Szop runs](#12-where-szop-runs)
  - [Infrastructure as code and Terraform](#infrastructure-as-code-and-terraform)
  - [The pieces, from the network inwards](#the-pieces-from-the-network-inwards)
  - [A demo session, step by step](#a-demo-session-step-by-step)
- [13. Web security in the browser](#13-web-security-in-the-browser)
- [14. Styling: Tailwind, components and design tokens](#14-styling-tailwind-components-and-design-tokens)
- [15. How fast is fast enough](#15-how-fast-is-fast-enough)
- [16. CI/CD: checking every change](#16-cicd-checking-every-change)
- [17. The single-page application: React, React Router and TanStack Query](#17-the-single-page-application-react-react-router-and-tanstack-query)
- [18. Tracking the work: issues, milestones and projects](#18-tracking-the-work-issues-milestones-and-projects)

## 1. The big picture

Szop is three running things plus one shared library:

1. **The frontend** — a React single-page application (SPA). The browser downloads it once as static files (HTML, JavaScript, CSS); from then on, JavaScript draws every screen and switches between them without full page reloads.
2. **The backend** — a Node.js program built with Fastify. It exposes a REST API: URLs such as `GET /api/lists/42` or `PATCH /api/lists/42/items/7` that accept and return JSON.
3. **The database** — PostgreSQL, where all data lives.
4. **The shared package** — TypeScript code that both the frontend and the backend import: the data shapes (Zod schemas) and pure rules (how to sort a list, how to compute totals).

The frontend never touches the database. The backend never draws screens. The shared package never does input/output — it only describes and computes.

## 2. Who is responsible for what

| Piece | Docs | Where it runs | Responsible for | Not responsible for |
|---|---|---|---|---|
| **[Vite](https://vite.dev/)** | [Guide](https://vite.dev/guide/) | your machine, at build time | Bundling the frontend source into static files; a fast development server | Anything at runtime — Vite is not present in production |
| **[React](https://react.dev/)** | [Reference](https://react.dev/reference/react) | browser | Turning state into screens (components), reacting to clicks and typing | Fetching data, URLs, talking to the server |
| **[React Router](https://reactrouter.com/)** | [Docs](https://reactrouter.com/home) | browser | Mapping the URL (`/lists/42`) to the page component to show | Data |
| **[TanStack Query](https://tanstack.com/query)** | [Docs](https://tanstack.com/query/latest/docs/framework/react/overview) | browser | Fetching server data, caching it, refreshing it, loading/error states, optimistic updates | Deciding *what* the URL or payload is — the API client does that |
| **[Tailwind CSS](https://tailwindcss.com/)** | [Docs](https://tailwindcss.com/docs) | your machine, at build time | Turning the utility classes used in the code into one stylesheet | Components — it only produces CSS |
| **[shadcn/ui](https://ui.shadcn.com/)** | [Docs](https://ui.shadcn.com/docs) | your machine, when a component is added | Copying styled component source (buttons, dialogs, menus) into `apps/web/src/components/ui/` | Anything at runtime — after copying, the code is ours |
| **[Base UI](https://base-ui.com/)** | [Docs](https://base-ui.com/react/overview/quick-start) | browser | Components' behavior and accessibility: focus, keyboard use, dialogs, menus, toasts | Looks — Tailwind classes in shadcn's components do that |
| **[React Hook Form](https://react-hook-form.com/)** | [Docs](https://react-hook-form.com/docs) | browser | Form field state, submission, showing validation errors | The validation rules themselves — Zod provides them |
| **[Better Auth client](https://www.better-auth.com/)** | [Docs](https://www.better-auth.com/docs/concepts/client) | browser | Calling the login, registration and session endpoints | Storing passwords or sessions — the server does |
| **[Zod](https://zod.dev/)** (shared) | [API](https://zod.dev/api) | browser and server | Describing data shapes once; validating at runtime and producing TypeScript types from the same definition | — |
| **[Node.js](https://nodejs.org/)** | [API](https://nodejs.org/docs/latest/api/) | server | Running JavaScript outside the browser: network, files, timers | Routing, validation — frameworks add those |
| **[Fastify](https://fastify.dev/)** | [Docs](https://fastify.dev/docs/latest/) | server | Receiving HTTP requests, routing them to handlers, running hooks, validating and serializing via schemas, plugins | Business rules — our services hold those |
| **[Better Auth](https://www.better-auth.com/)** | [Docs](https://www.better-auth.com/docs/introduction) | server | Users, password hashing, sessions, cookies, email verification and reset flows, anonymous users | What a user may do with a list — our access control |
| **[Drizzle](https://orm.drizzle.team/)** | [Docs](https://orm.drizzle.team/docs/overview) | server | Describing tables in TypeScript, building type-safe SQL queries, migrations | Business rules |
| **[PostgreSQL](https://www.postgresql.org/)** | [Docs](https://www.postgresql.org/docs/current/) | database server | Storing data durably, enforcing constraints, running queries, transactions | Anything about HTTP or users' sessions in the browser |

## 3. Who talks to whom

```
Browser (React SPA)
   │  HTTPS + JSON, session cookie attached automatically
   ▼
Fastify API ── SQL (via Drizzle) ──► PostgreSQL
   │
   └── AWS SDK ──► Amazon SES (verification, password reset)

Later: Fastify API ── WebSocket push ──► Browser ("list 42 changed")
```

- The browser only ever talks to the API, over HTTPS.
- The API is the only thing that talks to the database.
- The shared package is not a running service; it is code *used by* both sides: Vite bundles it into the frontend, and the API runs it from its TypeScript source, by tsx in development and by Node's type stripping in production.

## 4. Lifecycle of opening the app

1. The browser requests `https://example.com/` and receives a small HTML file that references the JavaScript bundle. The API answers every path of the app this way, `/lists/42` as much as `/`, with the same `index.html` (the *SPA fallback*), so a reload or a shared link to any page works: the server does not know the app's routes, and React Router picks the page in the browser ([ADR 0023](../decisions/0023-production-build-and-serving-details.md), decision 6).
2. The bundle loads; React starts and React Router looks at the URL to decide which page to show.
3. The app asks Better Auth: "is there a session?" The browser sends the session cookie, if it has one.
4. The lists page mounts and calls `useLists()`. TanStack Query sees nothing cached, calls the API client, which sends `GET /api/lists`.
5. The response arrives, TanStack Query caches it, React re-renders with the data.
6. A first-time visitor has no session, so step 5 returns an empty list and the catalog shows the read-only seed data — nothing has been stored for them yet. Only when they make their **first change** does the API client ask Better Auth for an **anonymous** session: the server creates an anonymous user and a workspace copied from the seed data, sets a session cookie, and the change is sent. This *lazy creation* means visits that change nothing (search engine crawlers, link previews) cost the database nothing — see [ADR 0003](../decisions/0003-abuse-protection.md).

## 5. Lifecycle of a request: checking an item off

1. **Click.** The checkbox component calls `checkItem.mutate({ listId: 42, id: 7, checked: true })` (a TanStack Query mutation from the `useCheckItem()` hook).
2. **Optimistic update.** Before the server answers, the hook updates the cached list: item 7 becomes checked and the shared ordering rules move it from the list to the haul. The screen updates instantly.
3. **HTTP request.** The API client sends `PATCH /api/lists/42/items/7` with `{ "checked": true }` and the session cookie.
4. **Fastify hooks.** The request passes through Fastify's lifecycle: `onRequest` (our auth hook asks Better Auth for the session and attaches the user) → body parsing → **validation** against the Zod schema (invalid input is rejected with 400 here, before our code runs) → `preHandler` → the **route handler**.
5. **Access layer and service.** The handler asks the access layer whether this user may work on list 42: `requireListAccess(user, 42, "shopper")` returns the list owner's workspace, or 404 if the list is not theirs (in the MVP, only the owner passes). It then calls `itemsService.update(ctx, 42, 7, { checked: true })`. The service loads item 7 within list 42 and that workspace (not there → 404), checks the list is not archived (→ 409), and asks the repository to save it.
6. **Repository and database.** Drizzle builds `UPDATE list_items SET checked = true WHERE workspace_id = … AND list_id = 42 AND id = 7` and PostgreSQL executes it.
7. **Response.** The updated item is serialized through the response schema and sent back as JSON.
8. **Reconciliation.** TanStack Query replaces its optimistic guess with the server's answer. If the request failed, it rolls the cache back and the app shows a message.

## 6. Node.js, Express, Fastify and NestJS — how they relate

They are layers, not competitors on the same level:

```
NestJS                 application framework: modules, dependency injection, decorators
  │ runs on top of
Express  or  Fastify   web frameworks: routing, middleware/hooks, request/response helpers
  │ run on top of
Node.js  (http module) runtime: raw sockets and bare HTTP requests/responses
```

- **Node.js** can already serve HTTP with its built-in `http` module, but you would parse URLs, bodies and headers by hand.
- **Express** (2010) is the classic minimal web framework: a chain of *middleware* functions `(req, res, next)` that each handle or pass the request on. Still the most used by sheer numbers; simple, but older and without built-in validation or types.
- **Fastify** is a modern alternative to Express at the same level: routes declare **schemas** (validation and fast serialization), a fixed sequence of **hooks** replaces free-form middleware, and **plugins** with encapsulation provide modularity. It is faster and TypeScript-friendly. Szop uses Fastify directly.
- **NestJS** is one level higher: an opinionated application framework that uses Express (default) or Fastify underneath for HTTP, and adds structure — modules, controllers, providers, dependency injection, guards, pipes.

A Java analogy, if it helps:

| Node world | Java world (roughly) |
|---|---|
| Node.js `http` module | Servlet API |
| Express / Fastify | Lightweight frameworks like Javalin or Spark |
| NestJS | Spring Boot |

**Fastify's request lifecycle**, in order: `onRequest` → `preParsing` → (body parsed) → `preValidation` → (schema validation) → `preHandler` → **handler** → `preSerialization` → (response serialized) → `onSend` → `onResponse`. `onError` runs if anything throws. Hooks registered inside a plugin apply only to that plugin's routes (encapsulation) — that is how, for example, "all routes in this module require a registered user" can be expressed.

**How Szop's API is put together.** A Fastify *instance* is the app. A *plugin* is a function that receives the instance (and options) and adds routes or hooks to it. *Encapsulation* means that what a plugin adds stays inside it unless the plugin says otherwise. Szop's `buildApp` is a factory: it creates the instance and registers the plugins, one per feature, handing each the services it needs as options. That is how a test gets the same app as production, only with fakes passed in. `inject()` then runs a fake HTTP request through the whole app, with no network involved. The reasons are in [ADR 0019](../decisions/0019-api-skeleton-details.md), decision 1; the tests are described in the [testing guide](../development/testing.md).

**Escaping encapsulation with `fastify-plugin`.** Encapsulation is usually what you want: one feature's hooks stay with that feature's routes. A security rule wants the opposite: it must reach every route, the SPA's files and the not-found handler too. Wrapping a plugin with `fastify-plugin` (`fp(plugin, { name })`), a small helper from the Fastify team, tells Fastify not to give the plugin a context of its own, so what it adds lands on the instance that registered it, here the root app. Szop's `security/` plugins are wrapped this way and registered before any route ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decision 8). Calling a plain function on the root app would have the same effect without the dependency; `fastify-plugin` is the idiomatic way, and the one Fastify's own plugins use.

**pino, the logger.** Fastify's built-in logger is pino, which writes one JSON object per line for every event, so a log aggregator can search the fields instead of parsing prose. Szop's API logs every request twice, as `incoming request` and `request completed`, both carrying the same request ID, which is how you follow one request through the log. JSON is hard to read in a terminal, so only the `dev` script pipes the output through pino-pretty; the app itself always writes JSON, and so does production ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 3).

**tsx in development, type stripping in production.** In development, `tsx` runs the API's `.ts` files directly, with no compile step, and `tsx watch` restarts the API whenever a file changes; that watch mode is why development uses it ([ADR 0005](../decisions/0005-development-environment.md), decision 9). In production, Node runs the same files itself: `node src/server.ts` uses Node's own *type stripping*, stable since Node 24.12, which replaces every type annotation with spaces as it loads a file, so lines and columns, and the stack traces, stay exact. Szop's code already keeps to what stripping allows (no TypeScript-only syntax that generates code, `.ts` import specifiers), and pnpm links `packages/shared` into place as a symlink to its source, so nothing has to be compiled: no build step, no `dist/` that can go stale, and production runs the very files the tests run ([ADR 0023](../decisions/0023-production-build-and-serving-details.md), decision 1). The catch is that Node refuses to strip types in files under `node_modules`, so the container image must keep the workspace's symlinks. Neither tsx nor Node checks types: `pnpm typecheck` runs the TypeScript compiler for that.

## 7. Kinds of state in a frontend

"State" is any data that can change while the app runs and that the screen depends on. The key to a clean frontend is knowing **who owns each piece**:

| Kind | What it is | Szop examples | Owner in Szop |
|---|---|---|---|
| **Server state** | A *copy* of data whose source of truth is the server. Can go stale; must be fetched, cached and refreshed. | Lists, items, catalog, categories | TanStack Query |
| **URL state** | What is encoded in the address bar. Survives reloads, can be bookmarked and shared. | Which list is open | React Router |
| **Local UI state** | Belongs to one component and dies with it. | Is this dialog open? What is typed in the add-item input? | `useState` in the component |
| **Global client state** | Client-only data many unrelated components need, that is *not* a copy of server data. | Nothing yet (a theme could become one) | Would be React Context or a store like Zustand — deliberately not used yet |

Why this matters: libraries such as Redux became famous partly because apps kept **server data** in a global store and hand-wrote the fetching, caching and invalidation. Once server state is handed to a dedicated tool like TanStack Query, very little truly *global* state is left — which is why Szop has no global store.

## 8. The shared package and Zod

A Zod schema is a single definition that gives you two things:

```ts
const ItemPatch = z.object({ checked: z.boolean().optional(), name: z.string().min(1).optional() });
type ItemPatch = z.infer<typeof ItemPatch>;   // a compile-time TypeScript type
ItemPatch.parse(body);                         // a runtime check that throws on bad input
```

TypeScript types vanish at runtime, so they cannot protect the server from a malformed request; Zod checks can. Defining schemas once in `packages/shared` means the form, the API client, the Fastify route and the OpenAPI description all agree by construction.

The API already uses Zod for one job of its own: checking its **configuration**. At startup, `loadConfig` in `apps/api/src/config.ts` validates the environment variables against a Zod schema and returns a typed config object, so `port` is a number from there on. Every variable is required, with no defaults, and a bad or missing one stops startup with a message that names the variable and never shows its value, since a value might be a secret ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 2).

Since [PH-05](../roadmap.md#ph-05-spa-skeleton) the package holds its first schema that both sides use, `healthSchema` in `packages/shared/src/health.ts`: the body of `GET /api/health`. It is a **discriminated union**, a choice between shapes told apart by one field, here `status`: `{ status: "ok", database: { status: "up", schemaVersion } }` when the database answers and `{ status: "error", database: { status: "down" } }` when it does not. The web app's client parses every answer with it, so a body of another shape is an error instead of a guess, and the TypeScript type `Health` comes from the same definition. The API's health test parses the real responses with it, so the API fails its own test when it drifts from the contract; the Mock Service Worker handlers in the web tests that return a valid health body are typed `Health`, so a fake that drifts fails the type check ([ADR 0021](../decisions/0021-spa-skeleton-details.md), decision 1). Because the package is consumed from source, both `apps/web` and `apps/api` import `@szop/shared` and get the `.ts` file, with no build step in between.

## 9. Data access: Drizzle and PostgreSQL

- **PostgreSQL** is a relational database: tables, rows, foreign keys between them, transactions that make several changes succeed or fail together.
- **Drizzle** is a TypeScript *object-relational mapper (ORM)* that stays close to SQL. Tables are declared in TypeScript; queries read like SQL (`db.select().from(items).where(eq(items.listId, 42))`) and are fully typed from the table definitions.
- **Composite foreign keys** make the database itself keep workspaces apart. Every workspace-owned table has a unique key on `(workspace_id, id)`, and an item points at its category through both columns: `(workspace_id, category_id) → categories (workspace_id, id)`. An item can then only point at a category of its own workspace; PostgreSQL refuses anything else, even if the application forgets to check. A plain foreign key on `category_id` alone would accept any workspace's category.
- **Migrations** are versioned SQL files that evolve the database schema step by step. Drizzle generates them from changes to the table definitions; they are committed and applied in order on every environment.
- **Locally and in CI**, PostgreSQL runs in a container started from `compose.yaml`. Drizzle's migrations are SQL files in `apps/api/drizzle/`, applied when the API starts and recorded in `drizzle.__drizzle_migrations`. A **connection pool** keeps a few connections open and lends them to queries, so each query does not pay for a new connection. Tests use a **template database**: migrated once, copied for each test worker, and emptied before each test. See [Drizzle](../development/tools/drizzle.md), [Docker Compose and PostgreSQL](../development/tools/docker-compose.md) and [testing](../development/testing.md).

## 10. Authentication: sessions and cookies

- On login, Better Auth creates a **session** row in the database and sends the browser a **cookie** holding the session's identifier.
- The cookie is `HttpOnly` (JavaScript cannot read it, so injected scripts cannot steal it), `Secure` (sent only over HTTPS) and `SameSite=Lax`. `Lax` withholds the cookie from requests other sites trigger in the background (a form posted to us, an image, a script's `fetch`), but still sends it when the user follows a link to us from elsewhere, so they arrive logged in. "Site" means the registrable domain, so every subdomain of the same domain counts as the same site. `SameSite` alone is therefore not a full defence against cross-site request forgery; see [section 13](#13-web-security-in-the-browser).
- The browser attaches the cookie to every request to our domain automatically. The server looks the session up and knows who is asking. Logging out, or revoking a session, simply deletes the row.
- **Anonymous users** are real users with a flag: they get a session and a workspace without email or password, until they register.

## 11. The monorepo

One Git repository holds `apps/web`, `apps/api` and `packages/shared`, plus the end-to-end tests in `e2e/` and the Terraform code in `infra/`. A change to a shared schema, the API route using it and the form using it can land in one commit and be checked together — which is the whole point of TypeScript end to end.

The three packages, and `e2e/`, are **pnpm workspaces**: pnpm links them to each other, so `apps/api` imports `packages/shared` like any installed library, except that it is the live source code in the same repository. `apps/api` is the first package that exists. Its name is `@szop/api`: the `@szop/` scope cannot clash with a package on the npm registry ([ADR 0019](../decisions/0019-api-skeleton-details.md), decision 7). `pnpm -r` runs a script in every package, and Vitest runs every package's tests from the root: it treats each package (and the push hook) as a **project**, today `api` and `hooks`, so one `pnpm test` runs them all, and `pnpm test:coverage` adds the coverage report. How the tests are written and run is in the [testing guide](../development/testing.md); the project layout is [ADR 0019](../decisions/0019-api-skeleton-details.md), decision 5. The development tooling around the stack (pnpm, TypeScript configuration, tsx, ESLint, Prettier, Docker Compose) is decided in [ADR 0005](../decisions/0005-development-environment.md). The [setup guide](../development/setup.md) installs them, and each tool has its own explanatory page in [`docs/development/tools/`](../development/tools/).

The testing tools (Vitest, Testing Library, Mock Service Worker, Playwright, fast-check, StrykerJS) and how the tests are layered are decided in [ADR 0007](../decisions/0007-testing-strategy.md). They get their own pages under `docs/development/tools/` too, next to a testing guide in `docs/development/testing.md`.

## 12. Where Szop runs

Szop runs on **AWS** (Amazon Web Services), but not all the time: it is a **demo environment** that is created when the owner wants to show or try something, and destroyed a few hours later. Everything about it is written down as code, so creating it again gives exactly the same result. The decisions are in [ADR 0008](../decisions/0008-hosting.md), the binding summary in [architecture.md](architecture.md#5-deployment). This section explains the concepts.

### Infrastructure as code and Terraform

**Infrastructure as code (IaC)** means describing servers, networks and databases in text files kept in git, instead of clicking them together in a web console. **Terraform** reads those files (written in its own language, HCL) and makes the cloud match them:

- `terraform plan` compares the files with what exists and shows what it would create, change or delete.
- `terraform apply` does it. `terraform destroy` deletes everything the configuration created.
- Terraform remembers what it created in a **state** file. Szop keeps it in an S3 bucket (AWS's file storage), so every machine sees the same state.
- A **provider** is the plugin that talks to one platform's API (here the AWS provider). A **root module** is one folder of configuration applied on its own, with its own state.

Szop's configuration is split into three root modules by how long their resources live: **bootstrap** (created once: the state bucket and budget alerts), **base** (permanent and cheap: image registry, domain, certificate, email identity, the Better Auth secret, logs, IAM roles) and **demo** (created for a session and destroyed after it: network, load balancer, container, database with its RDS-managed password). Destroying the demo can never touch the other two.

### The pieces, from the network inwards

| Piece | What it is | Szop's use |
|---|---|---|
| **Region, availability zone (AZ)** | A region is a geographic area (`eu-central-1` is Frankfurt) made of several **availability zones**: separate data centers with independent power and networking. | Everything runs in Frankfurt. The load balancer and the database require subnets in two AZs. |
| **Virtual private cloud (VPC), subnets** | A private network in AWS, divided into **subnets**. A **public** subnet has a route to the internet (through an *internet gateway*); a **private** one does not. | The load balancer and the container sit in public subnets; the database in private ones, unreachable from the internet. |
| **Security group** | A firewall attached to a resource, listing who may connect to it on which port. It can name another security group as the allowed source. | A chain: anyone → load balancer (443, and 80 only to redirect to HTTPS); only the load balancer → the container; only the container → the database (5432). |
| **Application Load Balancer (ALB)** | Receives HTTPS traffic, decrypts it (TLS termination) and forwards requests to healthy targets, checking their health regularly. | Fronts the one container; redirects HTTP to HTTPS; calls `/api/health`. |
| **Route 53, ACM** | Route 53 is AWS's DNS service (and domain registrar). AWS Certificate Manager (ACM) issues free TLS certificates for domains you control. | The domain, `demo.<domain>` pointing at the load balancer, and its certificate. |
| **Container image, ECR** | An image is the packaged app with everything it needs to run. Elastic Container Registry (ECR) stores images. | One image with the API and the built SPA, tagged with the git commit (and the version, for releases). |
| **ECS, Fargate** | Elastic Container Service (ECS) runs containers. A **task definition** describes one (image, CPU, memory, environment); a **task** is one running copy; a **service** keeps the wanted number of tasks running and replaces failed ones. **Fargate** runs tasks without servers to manage. | One service running exactly one task. |
| **RDS** | Relational Database Service: a managed database server. AWS installs, patches and runs PostgreSQL; you connect to it like any other. | The smallest PostgreSQL instance, empty at every spin-up. |
| **IAM, roles** | Identity and Access Management (IAM) decides who may do what in AWS. A **role** is a set of permissions that a person or a service *assumes* temporarily, instead of holding permanent keys. | ECS's **task execution role** pulls the image and reads secrets; the app's **task role** may only send email and accept ECS Exec sessions. People log in through IAM Identity Center with short-lived credentials. |
| **Parameter Store, Secrets Manager** | Encrypted stores for configuration values and secrets, readable only with the right IAM permissions. | The Better Auth secret; the database password, which RDS generates and keeps itself. ECS injects both as environment variables. |
| **SES** | Simple Email Service: sends email. New accounts are in a *sandbox* that delivers only to verified addresses. | Verification and password-reset emails. |
| **CloudWatch** | Logs and metrics. | The app's JSON log lines, kept for 7 days. |

### A demo session, step by step

1. **Build and push.** The Dockerfile builds the image; it is pushed to ECR, tagged with the commit hash. The `demo-up` workflow runs this step (if the image is missing) and the next one at the press of a button ([ADR 0010](../decisions/0010-ci-cd.md)).
2. **Spin up.** `terraform apply` in `infra/demo` creates the network, security groups, load balancer, database and ECS service, and points `demo.<domain>` at the load balancer. This takes 10–15 minutes, mostly for the database.
3. **Start.** ECS pulls the image, reads the secrets and starts the task. The app runs its migrations, then starts serving. Once `/api/health` answers, the load balancer sends traffic to it.
4. **Use.** The browser opens `https://demo.<domain>`: the same app as locally, with the same one-origin setup.
5. **Tear down.** `terraform destroy` removes everything created in step 2. The logs stay in CloudWatch for a week. If a session is forgotten, the nightly `demo-down` workflow destroys it ([ADR 0010](../decisions/0010-ci-cd.md)).

## 13. Web security in the browser

A browser runs code from many sites side by side and sends each site's cookies automatically. Most web attacks abuse one of those two facts. The rules Szop follows are in [ADR 0012](../decisions/0012-security-baseline.md) and `architecture.md`; who they stop is in the [threat model](threat-model.md).

- **Cross-site request forgery (CSRF).** A page on another site makes the victim's browser send a request to Szop, for example a hidden form posting "delete this list". The browser attaches the victim's cookie, so without a defence the request runs in their name. Szop refuses every request that changes data unless the browser says it came from Szop's own pages: browsers add a `Sec-Fetch-Site` header that page scripts cannot forge, with the older `Origin` header as a fallback. Changes must also be sent as JSON, which a plain HTML form on another site cannot produce.
- **Content Security Policy (CSP).** A response header listing where the page may load scripts, styles, images and frames from. Szop allows only its own files and no inline scripts, so even if an attacker managed to inject HTML into a page, the browser would refuse to run their script. `frame-ancestors 'none'` stops other sites from showing Szop inside a frame, which defeats *clickjacking*: tricking a user into clicking a button they cannot see.
- **HTTP Strict Transport Security (HSTS).** A response header telling the browser to use only HTTPS for this domain for a year. After the first visit, a typed `http://` address never goes out unencrypted, so nobody on the network can intercept that first request.
- **`Referrer-Policy: no-referrer`.** Browsers normally tell the next site which page the user came from, in the `Referer` header. A password-reset link carries its token in the URL, so Szop asks the browser never to send it.
- **`@fastify/helmet`** sets all these headers in one place, with safe defaults for the smaller ones.

**How fetch metadata works.** Every request a current browser sends carries `Sec-Fetch-*` headers saying where it comes from. `Sec-Fetch-Site` says how the page that sent it relates to the server: `same-origin` (a page with the same scheme, host and port), `same-site` (another subdomain of the same registrable domain), `cross-site` (any other site) or `none` (the user typed the address or opened a bookmark). The browser writes these headers itself, and page scripts cannot set or change any header whose name starts with `Sec-`, so a malicious page cannot pass its request off as Szop's own. Szop accepts a request that changes data (POST, PUT, PATCH, DELETE) only when it is marked `same-origin`; without the header, it falls back to `Origin`, whose host must equal the request's `Host`; a request with neither is refused ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decisions 1 and 2). The classic defence is a *CSRF token*: a random value the server puts into each page and expects back with every change, which another site cannot read. It works, but it is state to create, store and send. With the app and its API on one origin, and every supported browser sending `Sec-Fetch-Site`, the browser's own header answers the same question without any state, which is why newer frameworks, Go's standard library among them, check it instead. The check protects browsers only: any program other than a page script can write these headers, so a script calling the API directly passes it and is met by sessions, rate limits and quotas instead.

**Simple requests, and why bodies must be JSON.** Before a page's script sends another site a request that a plain HTML form could not have sent, the browser asks that site first, with an `OPTIONS` request called a *preflight*, and sends the real request only if the site agrees; that is Cross-Origin Resource Sharing (CORS). A *simple request* skips the question: a GET, HEAD or POST whose body has one of the three content types a form can send, `application/x-www-form-urlencoded`, `multipart/form-data` and `text/plain`. Forms are older than CORS, so browsers still send them to any site without asking. A body with `Content-Type: application/json` is not simple, so another site's page can send it only after a preflight, which Szop never approves. Fastify parses JSON and plain text out of the box; Szop removes the plain-text parser, which leaves JSON as the only body it accepts, and every other content type gets `415 Unsupported Media Type` ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decision 3). Together with the `Sec-Fetch-Site` check this is defence in depth: either alone would stop a forged form.

**The CSP written out.** Helmet comes with a default policy and lets you override single directives. Szop turns those defaults off and writes the whole policy itself: `default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`. Helmet's defaults allow inline styles and `data:` fonts and images, which Szop rules out; with overrides, the real policy would be half helmet's defaults, which an upgrade can change and which can be read only in its source. Written out, the policy sits in one file and a test checks the exact header. One consequence reaches the build: Vite normally inlines small images and fonts into the bundle as `data:` URIs, which `'self'` would block, so `assetsInlineLimit: 0` makes it write them as separate files instead ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decisions 4 and 5).

**The client's address behind a proxy.** In AWS the browser talks to the load balancer, and the load balancer opens its own connection to the API, so the address the API sees on the connection is the load balancer's, not the user's. A proxy passes the original address on by appending the address it saw to the `X-Forwarded-For` header: `X-Forwarded-For: <client>, <first proxy>, …`. But a client can send that header itself, with any addresses it likes, and the proxy appends to whatever it received. So only the entries on the right, written by proxies you trust, can be believed. Fastify's `trustProxy` option names those proxies. It used to accept a number of hops, "believe the last entry", but Fastify 5.12, the version Szop uses, ignores a number and trusts nothing: a hop count cannot tell whether the connection really came through the proxy, so a client reaching the API directly could write a forged `X-Forwarded-For` and have its last entry believed. Trusting by address fixes that. Fastify starts from the connection's address and walks the header from the right only while the address in hand is a trusted proxy. Through the load balancer (`10.0.1.5`, inside the trusted range), the next entry to the left is the address it saw, and that one counts; a client connecting directly is not a trusted proxy, so its own address counts and its header is ignored. Szop's `TRUSTED_PROXIES` setting lists those addresses: the VPC's range in AWS, `none` locally ([ADR 0025](../decisions/0025-web-security-baseline-details.md), decision 7).

## 14. Styling: Tailwind, components and design tokens

What Szop looks like is described in [visual-design.md](visual-design.md) and decided in [ADR 0013](../decisions/0013-visual-design.md) and [ADR 0022](../decisions/0022-ring-tail-redesign.md). This section explains the ideas behind the tools.

- **Where styles can come from.** A browser applies CSS from three places: a stylesheet file (`<link rel="stylesheet">`), a `<style>` element in the page, or a `style` attribute on an element. Libraries that write styles in JavaScript (CSS-in-JS) create `<style>` elements while the app runs. Szop's Content Security Policy ([section 13](#13-web-security-in-the-browser)) allows only stylesheet files from its own origin, which shuts that door, so every style must exist before the app runs.
- **Tailwind CSS builds that stylesheet.** Instead of naming a class and writing its CSS elsewhere (`.item-row { padding: 12px 16px; }`), you write small classes that each do one thing straight in the markup: `<li class="px-4 py-3 min-h-14 border-t">`. At build time Tailwind scans the source files and generates CSS for exactly the classes it finds, nothing else, so the stylesheet stays small however large Tailwind's vocabulary is. Variants prefix a class with a condition: `dark:bg-gray-900` applies only in dark mode, `lg:flex` only from 1024 px wide, `motion-safe:transition` only when the user hasn't asked for reduced motion. The price is long class lists, which is why they live inside components, written once.
- **Headless components carry the hard part.** A dialog looks simple, but it must move keyboard focus into itself, keep it there, close on Escape, hide the page behind it from screen readers and give focus back when it closes. A **headless** library such as Base UI does all of that and draws nothing; the app supplies the looks. **shadcn/ui** then supplies looks for Base UI's components, as source code copied into the project rather than a package: you can open `button.tsx` and change it, which is also how you learn what it does.
- **Design tokens keep it consistent.** A token is a named value: `--primary` instead of `#3F7357`. Szop's tokens come in two tiers. The **palette** is Tailwind's colors (`gray-500`, plus Szop's own `fur` and `sage-700`); the **semantic roles** (`primary`, `muted-foreground`, `border`, `warning`) say what a color is *for*, and point into the palette. Components use only roles (`bg-primary`), so dark mode is just a second set of role values, and a new brand color changes one line.

## 15. How fast is fast enough

"Fast" becomes testable once it is a number. Szop's numbers are [NFR-3](../requirements/functional-requirements.md#nfr-3); this section explains them.

- **Core Web Vitals** are Google's three measures of how a page *feels*: **LCP** (Largest Contentful Paint, when the main content appears), **INP** (Interaction to Next Paint, how fast a tap gets a visible response) and **CLS** (Cumulative Layout Shift, how much content jumps around while loading). Each has a "good" threshold.
- **Lighthouse**, built into Chrome's DevTools, loads a page while simulating a mid-range phone on a slow 4G connection and reports these numbers. Its results vary a little from run to run, so Szop runs it by hand during the demo check rather than as a CI gate.
- **A performance budget** stops slowness creeping in. The JavaScript needed for the first screen is the main *cause* of a slow start on a phone, and its size is the same on every build, so CI fails a PR that pushes it over 200 KB compressed. A library that would quietly double it is caught in review, not by a user. The check is a small plugin in the Vite build: it starts from the entry chunk, follows the chunks it imports statically (chunks loaded later with `import()` do not count), compresses them with Brotli and adds up the sizes, so every `pnpm build` prints the number and fails above the limit, locally and in CI's `build` job ([ADR 0023](../decisions/0023-production-build-and-serving-details.md), decision 4).
- **Compression and caching do the rest.** The build writes Brotli and gzip copies of every text file, and the server sends the smallest the browser accepts. Vite puts a hash of each file's content in its name (`index-3f9a1c.js`), so such files can be cached for a year: a changed file gets a new name. Only `index.html`, which names them, is `no-cache`: the browser keeps it but checks it with its ETag on every load.
- **Precompression** means compressing once, at build time, instead of on every request. Since it happens once, the build can afford the strongest and slowest settings (Brotli quality 11, gzip level 9), which a server compressing per request could not. The browser lists what it can decode in the `Accept-Encoding` header (`gzip, deflate, br, zstd` in Chrome), and the server picks the `.br` copy, the `.gz` copy or the plain file accordingly, adding `Vary: Accept-Encoding` so caches keep the variants apart ([ADR 0023](../decisions/0023-production-build-and-serving-details.md), decision 3).
- **`immutable` versus `no-cache`.** A fingerprinted file (one with a content hash in its name) can never change under the same name, so it is sent with `Cache-Control: public, max-age=31536000, immutable`: the browser keeps it for a year and never asks again. `index.html` cannot be fingerprinted, since its address is the app's address, so it is sent with `no-cache`, which, despite the name, lets the browser keep a copy but makes it ask the server before every use. The question is cheap: the browser sends back the copy's ETag, a version tag, and the server answers `304 Not Modified` with no body while it is current. A deploy therefore reaches the next page load at once, while the large files come from the browser's cache ([ADR 0023](../decisions/0023-production-build-and-serving-details.md), decision 5).

## 16. CI/CD: checking every change

**Continuous integration (CI)** means every change is built and checked automatically, as soon as it is proposed, so a broken change is found within minutes rather than after it is merged. **Continuous delivery (CD)** goes one step further: every change that passes the checks can be released or deployed at the push of a button. Szop runs CI in GitHub Actions today; CD arrives with [PH-11](../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net) and [PH-12](../roadmap.md#ph-12-first-deploy). The decisions are in [ADR 0010](../decisions/0010-ci-cd.md) and [ADR 0018](../decisions/0018-ci-details.md); the day-to-day guide is [CI/CD](../development/ci-cd.md). This section explains the concepts.

- **A pipeline of workflows, jobs and steps.** A **workflow** is a YAML file started by an event, such as a pull request. It holds **jobs**, which run side by side unless one waits for another, and each job is a list of **steps**: shell commands or ready-made **actions**. Every job runs on a **runner**, a fresh virtual machine that is thrown away afterwards, so no job can leave anything behind for the next one.
- **CI tests the merge, not the branch.** For a pull request, GitHub prepares a test merge of the branch into the current `main`, the **merge ref**, and the checks run on that. A branch that passes on its own can still break `main` when combined with someone else's newly merged change. That is also why a branch must be **up to date** with `main` before merging: once `main` moves, the tested merge is out of date, and the checks run again on a new one after *Update branch* (or a new push to the branch).
- **Required status checks** are the checks GitHub insists on before the merge button works. A workflow that does not start never reports, so a required check on it would wait forever; Szop's checks workflow therefore always runs, and skips the jobs a change does not need, such as the code checks on a docs-only PR. A skipped job counts as passed, so Szop requires one job, `ci-ok`, that always runs, sums up the others, and fails when the job deciding what to skip has itself failed.
- **Supply-chain security.** An action is someone else's code running inside your pipeline, with your token. Szop limits what a compromised or careless action could do:
  - **Actions are pinned to commit SHAs,** not version tags. A tag can be moved to other code; a commit cannot. In March 2025, attackers moved the version tags of the popular `tj-actions/changed-files` action to code that printed workflows' secrets into their logs. Projects that had pinned it to a SHA kept running the old, safe code.
  - **Tokens are read-only.** Each job gets only the permissions it needs, here only reading the repository.
  - **Untrusted text never reaches a shell through `${{ }}`.** GitHub pastes a `${{ … }}` value into a script before the shell runs it, so a PR title containing shell code would run as code (**template injection**). Such values go through environment variables instead, which the shell treats as plain text.
  - **Tools look for these mistakes:** zizmor checks every workflow change, and CodeQL scans the workflows and the code.
- **Dependabot keeps the pins and packages current.** Every Monday it proposes updates, with a **cooldown**: a new version is proposed only once it is a week old, since malicious releases are usually found and removed within days.

OpenID Connect (OIDC), which lets a workflow reach AWS without stored keys, GitHub environments, and deploying arrive with [PH-11](../roadmap.md#ph-11-ci-access-to-aws-and-the-teardown-safety-net) and [PH-12](../roadmap.md#ph-12-first-deploy).

## 17. The single-page application: React, React Router and TanStack Query

[PH-05](../roadmap.md#ph-05-spa-skeleton) built the first page of the single-page application (SPA): it asks the API how it is and shows the answer. The decisions are in [ADR 0021](../decisions/0021-spa-skeleton-details.md); this section explains the concepts the page uses, with the page's own code as the example.

- **React: components, hooks and rendering.** A **component** is a function that returns a description of a piece of the screen, written in JSX (HTML-like syntax inside TypeScript). `HealthPage` is one: it returns a heading and a `role="status"` element. **Rendering** means React calling the function and turning what it returns into the browser's elements; when the data a component depends on changes, React calls it again and updates only what differs. A **hook** is a function whose name starts with `use` that a component calls to attach something to itself, such as `useState` for its own state. `useHealth` is a hook of Szop's own that wraps another hook. Hooks may only be called at the top level of a component, never inside an `if`, which is the rule the ESLint React Hooks plugin enforces.
- **React Router: the data router.** React Router maps the address to the component to show. Szop uses its **data router**: the routes are one array, `routes` in `routes.tsx`, given to `createBrowserRouter` in the app and to `createMemoryRouter` in the tests, so tests run the real route table. The data router lets a route have a `loader`, a function that fetches data before the page renders. Szop leaves that unused: TanStack Query fetches data, and having two owners of it would blur the line drawn in [section 7](#7-kinds-of-state-in-a-frontend). Only `/` exists, so any other path shows the router's default error screen for now.
- **TanStack Query: queries, keys, caching.** A **query** is a function that fetches server data, which the library runs, caches and tracks as pending, success or error. `useHealth` calls `useQuery` with the function `getHealth` and the **query key** `["health"]`, the name the answer is cached under: two components asking with the same key share one request and one answer, and `queryClient.refetchQueries({ queryKey: ["health"] })` refreshes it by name. A cached answer is shown at once and refreshed in the background, and by default the library fetches again when the tab becomes visible again (TanStack Query listens for the browser's `visibilitychange` event), so returning to the tab refreshes the status. Failed queries are retried three times with growing delays by default, about seven seconds in all; the health query sets `retry: false`, because its whole job is to show a failure, which seven seconds of "Checking the API…" would hide.
- **One origin in development, through a proxy.** `pnpm dev` starts Vite's server, which serves the page, and the API on port 3000. The browser only ever talks to Vite (`http://localhost:5173`). A request for a path starting with `/api` is **proxied**: Vite forwards it to `http://127.0.0.1:3000` and passes the answer back. The browser therefore sees one origin, as in production, and needs no CORS setup. With the API stopped, the proxy itself answers `502` with an empty body, which the client treats as an error.
- **Mock Service Worker (MSW), in one paragraph.** In tests there is no API, so MSW fakes the network: a **handler** such as `http.get("/api/health", …)` says what an address answers, and the request goes out from the real client code and is caught on the way. Nothing in the app is replaced, so the real `getHealth`, hook and schema run; only the answer is made up. A test that needs another state adds a handler for that test with `server.use`. A request with no handler fails the test, naming the request: the setup file records it in a callback that rejects it, and checks the record after each test, because MSW 3's built-in `"error"` strategy would reject the request but leave the test green.
- **The path of one request.** The page renders `HealthPage`, which calls `useHealth`. TanStack Query runs `getHealth`, which calls `fetch("/api/health")`. The browser sends it to Vite, whose proxy forwards it to Fastify at `127.0.0.1:3000`. The health route runs one query against PostgreSQL to read the schema version. It answers `200` with the version, or `503` when the query fails, and the body travels back the same way. `getHealth` parses the body with `healthSchema`, TanStack Query caches it under `["health"]`, and React renders the new text: "API: ok", or "API: reachable" with "Database: down". When the request itself fails, the text is "Can't reach the API".

## 18. Tracking the work: issues, milestones and projects

Most teams plan on the same site that holds their code. On GitHub that means three pieces, which Szop uses next to its roadmap ([ADR 0024](../decisions/0024-github-project-tracking.md); the day-to-day guide is [project tracking](../development/project-tracking.md)):

- **An issue** is one piece of work with a number, a title, a body, labels and a state, open or closed. Closing records why: *completed* or *not planned*. A pull request whose description says `Closes #12` closes issue 12 when it is merged, which ties the work to the change that did it.
- **Issues relate to each other.** A **sub-issue** sits under a parent, which shows how many of its children are closed; an issue can be **blocked by** another; and any mention of `#12` leaves a note on issue 12. Szop puts each open point under the phase that settles it, and lets a spike block its phase.
- **A milestone** groups issues towards one goal and shows a progress bar. Szop's milestones are its roadmap stages, plus `Definition` for the decision work before the first phase.
- **A project** collects issues into one table with custom fields, such as a status or a position, and shows them as **views**: a table, a **board** of columns (a kanban board, from the Japanese for "signboard", where cards move from column to column as work progresses) or a **roadmap**, a timeline drawn from date fields. Built-in **workflows** update the fields on events, such as setting the status to done when an issue closes.
