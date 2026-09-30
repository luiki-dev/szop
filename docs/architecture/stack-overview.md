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

## 1. The big picture

Szop is three running things plus one shared library:

1. **The frontend** — a React single-page application (SPA). The browser downloads it once as static files (HTML, JavaScript, CSS); from then on, JavaScript draws every screen and switches between them without full page reloads.
2. **The backend** — a Node.js program built with Fastify. It exposes a REST API: URLs such as `GET /api/lists/42` or `PATCH /api/items/7` that accept and return JSON.
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
- The shared package is not a running service; it is code *compiled into* both the frontend bundle and the API.

## 4. Lifecycle of opening the app

1. The browser requests `https://szop.app/` and receives a small HTML file that references the JavaScript bundle.
2. The bundle loads; React starts and React Router looks at the URL to decide which page to show.
3. The app asks Better Auth: "is there a session?" The browser sends the session cookie, if it has one.
4. The lists page mounts and calls `useLists()`. TanStack Query sees nothing cached, calls the API client, which sends `GET /api/lists`.
5. The response arrives, TanStack Query caches it, React re-renders with the data.
6. A first-time visitor has no session, so step 5 returns an empty list and the catalog shows the read-only seed data — nothing has been stored for them yet. Only when they make their **first change** does the API client ask Better Auth for an **anonymous** session: the server creates an anonymous user and a workspace copied from the seed data, sets a session cookie, and the change is sent. This *lazy creation* means visits that change nothing (search engine crawlers, link previews) cost the database nothing — see [ADR 0003](../decisions/0003-abuse-protection.md).

## 5. Lifecycle of a request: checking an item off

1. **Click.** The checkbox component calls `checkItem.mutate({ id: 7, checked: true })` (a TanStack Query mutation from the `useCheckItem()` hook).
2. **Optimistic update.** Before the server answers, the hook updates the cached list: item 7 becomes checked and the shared ordering rules move it to the checked part. The screen updates instantly.
3. **HTTP request.** The API client sends `PATCH /api/items/7` with `{ "checked": true }` and the session cookie.
4. **Fastify hooks.** The request passes through Fastify's lifecycle: `onRequest` (our auth hook asks Better Auth for the session and attaches the user) → body parsing → **validation** against the Zod schema (invalid input is rejected with 400 here, before our code runs) → `preHandler` → the **route handler**.
5. **Service.** The handler calls `itemsService.update(user, 7, { checked: true })`. The service loads the item scoped to the user's workspace (not theirs → 404), checks the list is not archived (→ 409), and asks the repository to save it.
6. **Repository and database.** Drizzle builds `UPDATE list_items SET checked = true WHERE id = 7 …` and PostgreSQL executes it.
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

## 9. Data access: Drizzle and PostgreSQL

- **PostgreSQL** is a relational database: tables, rows, foreign keys between them, transactions that make several changes succeed or fail together.
- **Drizzle** is a TypeScript *object-relational mapper (ORM)* that stays close to SQL. Tables are declared in TypeScript; queries read like SQL (`db.select().from(items).where(eq(items.listId, 42))`) and are fully typed from the table definitions.
- **Migrations** are versioned SQL files that evolve the database schema step by step. Drizzle generates them from changes to the table definitions; they are committed and applied in order on every environment.

## 10. Authentication: sessions and cookies

- On login, Better Auth creates a **session** row in the database and sends the browser a **cookie** holding the session's identifier.
- The cookie is `HttpOnly` (JavaScript cannot read it, so injected scripts cannot steal it), `Secure` (sent only over HTTPS) and `SameSite` (not sent on requests triggered by other sites).
- The browser attaches the cookie to every request to our domain automatically. The server looks the session up and knows who is asking. Logging out, or revoking a session, simply deletes the row.
- **Anonymous users** are real users with a flag: they get a session and a workspace without email or password, until they register.

## 11. The monorepo

One Git repository holds `apps/web`, `apps/api` and `packages/shared`. A change to a shared schema, the API route using it and the form using it can land in one commit and be checked together — which is the whole point of TypeScript end to end.

The three packages are **pnpm workspaces**: pnpm links them to each other, so `apps/api` imports `packages/shared` like any installed library, except that it is the live source code in the same repository. The development tooling around the stack (pnpm, TypeScript configuration, tsx, ESLint, Prettier, Docker Compose) is decided in [ADR 0005](../decisions/0005-development-environment.md). Each tool gets its own explanatory page under `docs/development/tools/` when the development environment is set up.

The testing tools (Vitest, Testing Library, Mock Service Worker, Playwright, fast-check, StrykerJS) and how the tests are layered are decided in [ADR 0007](../decisions/0007-testing-strategy.md). They get their own pages under `docs/development/tools/` too, next to a testing guide in `docs/development/testing.md`.

## 12. Where Szop runs

Szop runs on **AWS** (Amazon Web Services), but not all the time: it is a **demo environment** that is created when the owner wants to show or try something, and destroyed a few hours later. Everything about it is written down as code, so creating it again gives exactly the same result. The decisions are in [ADR 0008](../decisions/0008-hosting.md), the binding summary in [architecture.md](architecture.md#5-deployment). This section explains the concepts.

### Infrastructure as code and Terraform

**Infrastructure as code (IaC)** means describing servers, networks and databases in text files kept in git, instead of clicking them together in a web console. **Terraform** reads those files (written in its own language, HCL) and makes the cloud match them:

- `terraform plan` compares the files with what exists and shows what it would create, change or delete.
- `terraform apply` does it. `terraform destroy` deletes everything the configuration created.
- Terraform remembers what it created in a **state** file. Szop keeps it in an S3 bucket (AWS's file storage), so every machine sees the same state.
- A **provider** is the plugin that talks to one platform's API (here the AWS provider). A **root module** is one folder of configuration applied on its own, with its own state.

Szop's configuration is split into three root modules by how long their resources live: **bootstrap** (created once: the state bucket and budget alerts), **base** (permanent and cheap: image registry, domain, certificate, email identity, secrets, logs, IAM roles) and **demo** (created for a session and destroyed after it: network, load balancer, container, database). Destroying the demo can never touch the other two.

### The pieces, from the network inwards

| Piece | What it is | Szop's use |
|---|---|---|
| **Region, availability zone (AZ)** | A region is a geographic area (`eu-central-1` is Frankfurt) made of several **availability zones**: separate data centers with independent power and networking. | Everything runs in Frankfurt. The load balancer and the database require subnets in two AZs. |
| **Virtual private cloud (VPC), subnets** | A private network in AWS, divided into **subnets**. A **public** subnet has a route to the internet (through an *internet gateway*); a **private** one does not. | The load balancer and the container sit in public subnets; the database in private ones, unreachable from the internet. |
| **Security group** | A firewall attached to a resource, listing who may connect to it on which port. It can name another security group as the allowed source. | A chain: anyone → load balancer (443); only the load balancer → the container; only the container → the database (5432). |
| **Application Load Balancer (ALB)** | Receives HTTPS traffic, decrypts it (TLS termination) and forwards requests to healthy targets, checking their health regularly. | Fronts the one container; redirects HTTP to HTTPS; calls `/api/health`. |
| **Route 53, ACM** | Route 53 is AWS's DNS service (and domain registrar). AWS Certificate Manager (ACM) issues free TLS certificates for domains you control. | The domain, `demo.<domain>` pointing at the load balancer, and its certificate. |
| **Container image, ECR** | An image is the packaged app with everything it needs to run. Elastic Container Registry (ECR) stores images. | One image with the API and the built SPA, tagged with the git commit (and the version, for releases). |
| **ECS, Fargate** | Elastic Container Service (ECS) runs containers. A **task definition** describes one (image, CPU, memory, environment); a **task** is one running copy; a **service** keeps the wanted number of tasks running and replaces failed ones. **Fargate** runs tasks without servers to manage. | One service running exactly one task. |
| **RDS** | Relational Database Service: a managed database server. AWS installs, patches and runs PostgreSQL; you connect to it like any other. | The smallest PostgreSQL instance, empty at every spin-up. |
| **IAM, roles** | Identity and Access Management (IAM) decides who may do what in AWS. A **role** is a set of permissions that a person or a service *assumes* temporarily, instead of holding permanent keys. | ECS's **task execution role** pulls the image and reads secrets; the app's **task role** may only send email. People log in through IAM Identity Center with short-lived credentials. |
| **Parameter Store, Secrets Manager** | Encrypted stores for configuration values and secrets, readable only with the right IAM permissions. | The Better Auth secret; the database password, which RDS generates and keeps itself. ECS injects both as environment variables. |
| **SES** | Simple Email Service: sends email. New accounts are in a *sandbox* that delivers only to verified addresses. | Verification and password-reset emails. |
| **CloudWatch** | Logs and metrics. | The app's JSON log lines, kept for 7 days. |

### A demo session, step by step

1. **Build and push.** The Dockerfile builds the image; it is pushed to ECR, tagged with the commit hash. The `demo-up` workflow runs this step (if the image is missing) and the next one at the press of a button ([ADR 0010](../decisions/0010-ci-cd.md)).
2. **Spin up.** `terraform apply` in `infra/demo` creates the network, security groups, load balancer, database and ECS service, and points `demo.<domain>` at the load balancer. This takes 10–15 minutes, mostly for the database.
3. **Start.** ECS pulls the image, reads the secrets and starts the task. The app runs its migrations, then starts serving. Once `/api/health` answers, the load balancer sends traffic to it.
4. **Use.** The browser opens `https://demo.<domain>`: the same app as locally, with the same one-origin setup.
5. **Tear down.** `terraform destroy` removes everything created in step 2. The logs stay in CloudWatch for a week. If a session is forgotten, the nightly `demo-down` workflow destroys it ([ADR 0010](../decisions/0010-ci-cd.md)).
