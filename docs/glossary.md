# Glossary

Acronyms and terms used across Szop's documentation. Common ones (API, UI, HTTP, JSON, SQL, URL) are not listed.

## Acronyms

| Acronym | Stands for | Meaning |
|---|---|---|
| **ADR** | Architecture Decision Record | A short document recording one significant decision: its context, the options considered, the choice and its consequences. Ours live in `docs/decisions/`. |
| **CI/CD** | Continuous Integration / Continuous Delivery (or Deployment) | Automatically building and testing every change (CI), and automatically releasing it (CD). |
| **CORS** | Cross-Origin Resource Sharing | Browser rules deciding when a page from one domain may call an API on another domain. Not needed when frontend and API share one origin. |
| **CDN** | Content Delivery Network | A network of servers around the world that serves static files close to users and can absorb or filter traffic floods in front of the application. |
| **CRUD** | Create, Read, Update, Delete | The four basic operations on data. |
| **CRLF / LF** | Carriage Return + Line Feed / Line Feed | The two conventions for ending a line of text: Windows uses CRLF, Linux and macOS use LF. Szop's repository uses LF only. |
| **DoS** | Denial of Service | An attack that makes a service unavailable, either by flooding it with traffic (volumetric) or by making it exhaust resources such as database space (resource exhaustion). |
| **E2E** | End-to-end | A test that drives the real app in a real browser, through every layer (SPA → API → database), the way a user would. Szop has one E2E journey per use case (see ADR 0007). |
| **ESM** | ECMAScript Modules | The standard JavaScript module system (`import` / `export`). Replaces CommonJS (`require`), the older Node-only format. Szop uses ESM everywhere. |
| **HTTPS** | HTTP Secure | HTTP encrypted with TLS. |
| **JWT** | JSON Web Token | A signed token carrying claims about a user. An alternative to server-side sessions; not used in Szop. |
| **LTS** | Long-Term Support | A release line that receives fixes for an extended period. Even-numbered Node.js releases (22, 24, …) become LTS. |
| **MVP** | Minimum Viable Product | The smallest release that is useful on its own. In the requirements, `[MVP]` marks what the first release contains. |
| **MSW** | Mock Service Worker | A library that intercepts the app's HTTP requests at the network level and answers them with fake responses. Szop's component tests use it, so the real API client runs unchanged. |
| **OAuth / OIDC** | Open Authorization / OpenID Connect | Standards for logging in through another provider ("Sign in with Google"). Relevant for the social-login future extension. |
| **ORM** | Object-Relational Mapper | A library that maps database tables to objects or types in code and builds queries. Drizzle is ours. |
| **PR** | Pull Request | A request to merge a branch into another (usually `main`), where the change can be reviewed and checked by CI before it lands. |
| **REST** | Representational State Transfer | An API style where URLs name resources (`/api/lists/42`) and HTTP methods say what to do with them (`GET`, `POST`, `PATCH`, `DELETE`). |
| **SEO** | Search Engine Optimization | Making pages rank well in search engines. Irrelevant for private data such as shopping lists. |
| **SMTP** | Simple Mail Transfer Protocol | The protocol for sending email. |
| **SPA** | Single-Page Application | A web app where the browser loads one page once and JavaScript renders every screen after that, without full page reloads. Szop's frontend is one. |
| **SSR** | Server-Side Rendering | Generating a page's HTML on the server for each request. The main strength of frameworks like Next.js; not used in Szop. |
| **TDD** | Test-Driven Development | Writing a failing test first, then the code that makes it pass, then tidying up ("red, green, refactor"). Szop uses it for domain rules, services and API routes (see ADR 0007). |
| **TLS** | Transport Layer Security | The encryption behind HTTPS. |
| **WASM** | WebAssembly | A compact binary format that browsers and Node.js can run at near-native speed. PGlite is PostgreSQL compiled to it; considered for tests, not used (see ADR 0007). |
| **WSL** | Windows Subsystem for Linux | A Linux environment running inside Windows. Szop is developed in WSL 2 with Ubuntu. |

## Requirement ID prefixes

Used in [functional-requirements.md](requirements/functional-requirements.md) and referenced across the docs.

| Prefix | Area |
|---|---|
| **ACC** | Accounts and guest mode |
| **LST** | Shopping lists |
| **ITM** | List items |
| **ORD** | List display and ordering |
| **CAT** | Categories |
| **PRD** | Catalog (products) |
| **UNT** | Units |
| **TPL** | Templates |
| **SHR** | Sharing |
| **SYN** | Live updates (synchronization) |
| **NET** | Connectivity (network) |
| **LIM** | Limits (quotas and rate limits) |
| **UC** | Use case |
| **FR** | Functional requirement (general name for any of the IDs above) |

## Terms

| Term | Meaning |
|---|---|
| **Accessibility check (axe)** | An automated scan of a page for barriers to people using assistive technology, such as a missing label or low contrast. axe-core is the common engine; Szop runs it in the E2E journeys. |
| **Anonymous user** | A server-side user without email or password, created automatically for a guest. Registering links it to a real account. |
| **Big design up front** | Designing a system in full detail before building any of it. Criticized because the decisions are made without feedback from working software. Szop decides direction up front and details per phase (see ADR 0004). |
| **Bundle** | The JavaScript and CSS files a build tool (Vite) produces from the source code for the browser to download. |
| **Definition of done** | The checklist every piece of work must meet before it counts as finished. Szop's is in ADR 0004: tests pass, CI green, deployed, docs updated. |
| **Design tokens** | Named values for the basic visual choices — colors, spacing, font sizes — used everywhere instead of raw values, so the look can be changed in one place. |
| **Container / Docker** | A container packages a program with everything it needs and runs it isolated from the rest of the machine. Docker is the most common tool for building and running containers. Szop runs PostgreSQL in one during development. |
| **Dev container** | A development environment defined in the repository and run inside a container, so every machine gets identical tools. Considered for Szop, not used (see ADR 0005). |
| **Docker Compose** | A Docker tool that starts a set of containers described in a `compose.yaml` file. A **named volume** in it keeps a container's data (such as the database files) when the container is recreated. |
| **Dependency injection** | Handing a component the things it depends on (database client, email sender) from outside instead of it creating them. NestJS and Spring do it with a container; Szop passes dependencies explicitly. |
| **Domain rules** | Business logic independent of HTTP and storage — e.g. how list items are ordered, how totals are computed. Szop keeps them in `packages/shared`. |
| **Event bus** | An in-process publish/subscribe mechanism: code publishes "list 42 changed", listeners (such as the WebSocket hub) react. |
| **Flaky test** | A test that sometimes passes and sometimes fails without any change to the code, usually because of timing or shared state. Treated as a bug in Szop. |
| **Formatter** | A tool that rewrites code into one consistent layout (indentation, quotes, line breaks). Szop uses Prettier. |
| **Git hook** | A script Git runs at a fixed moment, for example before a commit is created (a **pre-commit hook**). Szop's formats and lints the files being committed. |
| **Hook (Fastify)** | A function Fastify calls at a fixed point of a request's lifecycle (`onRequest`, `preHandler`, …). |
| **Hook (React)** | A function starting with `use` (`useState`, `useList`) that lets a component use state or other React features. Unrelated to Fastify hooks despite the name. |
| **IndexedDB** | A database built into the browser for storing structured data locally. Considered for guest workspaces, not used (see ADR 0002). |
| **Migration** | A versioned script that changes the database schema; applied in order in every environment. |
| **IPv6 /64 block** | The range of IPv6 addresses sharing their first 64 bits — typically what one household or device is given. Rate limits group addresses by it, since one machine can switch between billions of addresses inside its block. |
| **jsdom** | A simulated browser DOM that runs inside Node.js, so component tests can render and click without a real browser. It has no layout engine. |
| **Linter** | A tool that analyzes code for bugs and bad patterns without running it. Szop uses ESLint. |
| **Lazy creation** | Creating something only when it is first needed. Szop creates a guest's workspace on their first change, not on their first visit. |
| **Minor units** | The smallest unit of a currency (cents, grosze). Szop stores money as integers in minor units. |
| **Monorepo** | One repository holding several packages (here: `apps/web`, `apps/api`, `packages/shared`). |
| **Mutation testing** | Changing the code on purpose (a *mutant*, for example `<` flipped to `<=`) and checking that some test fails. A mutant that no test notices shows a gap in the tests. Szop uses StrykerJS for it. |
| **OpenAPI** | A standard, machine-readable description of a REST API, from which documentation and clients can be generated. |
| **Optimistic update** | Updating the screen immediately as if a request succeeded, then correcting it if the server disagrees. |
| **Origin** | The scheme, domain and port of a URL (`https://szop.app`). Cookies and browser security rules work per origin. |
| **Phantom dependency** | A package your code imports without declaring it, working only because something else happened to install it. It breaks when that other package changes. pnpm prevents it. |
| **Phase** | One step of the implementation roadmap, taken through its own brainstorm, design approval and implementation. |
| **Property-based testing** | Testing a rule against hundreds of generated inputs instead of a few hand-picked examples, checking a property that must always hold ("a parent category always comes before its children"). Szop uses fast-check. |
| **Proxy (dev server)** | The Vite dev server forwarding requests for `/api/*` to the API, so the browser sees a single origin during development. |
| **Quota** | A cap on how much data one workspace may hold (for example 200 lists). |
| **Rate limit** | A cap on how many requests of a kind are accepted in a time window (for example 10 guest creations per hour per IP address); excess requests get HTTP status 429. |
| **Seed data** | The predefined catalog, categories and units copied into every new workspace. |
| **Server state** | Data in the frontend that is a cached copy of data owned by the server. |
| **Session / session cookie** | The server's record of a logged-in (or anonymous) user, and the browser cookie that identifies it on each request. |
| **Snapshot test** | A test that saves the output (for example rendered HTML) on its first run and fails when later output differs. Szop avoids them for rendered markup, because updating a snapshot without reading it is too easy. |
| **Spec / implementation plan** | The two working documents of a larger phase: the spec describes the agreed design, the plan lists the steps to build it. Kept in `docs/superpowers/`. |
| **Template database** | A PostgreSQL database used as a pattern for creating others (`CREATE DATABASE … TEMPLATE`). Szop's tests migrate one template, then copy it for each test worker. |
| **Test double / fake** | Anything standing in for a real dependency in a test. A **fake** is a simple working implementation (an email sender that records emails instead of sending them); a **mock** is preprogrammed to expect certain calls. |
| **Testing pyramid / testing trophy** | Two shapes for a test suite. The pyramid puts most tests at the bottom as unit tests with mocked collaborators. The trophy puts most tests in the middle as integration tests against real components, such as a real database. Szop's suite is trophy-shaped (see ADR 0007). |
| **Type stripping** | Running TypeScript by deleting the type annotations instead of compiling it, which Node.js can now do itself. It does not check types. Szop uses tsx instead (see ADR 0005). |
| **V8** | The JavaScript engine inside Chrome and Node.js. Vitest measures test coverage with V8's built-in instrumentation. |
| **Vertical slice** | A piece of work that delivers one capability through every layer at once (database, API, UI, tests, deployment), as opposed to building one layer at a time. |
| **Walking skeleton** | The thinnest possible version of the whole system that runs end to end (here: SPA → API → database, built by CI and deployed) and does almost nothing yet. Built early to test the foundation decisions. |
| **WebSocket** | A persistent two-way connection between browser and server, letting the server push messages (used for live updates). |
| **Workspace** | Everything one user owns: lists, templates, catalog, categories, units, settings. |
| **Workspace (pnpm)** | Unrelated to the above: one package of the monorepo (`apps/web`, `apps/api`, `packages/shared`) as pnpm manages it. pnpm links workspaces to each other so they can import one another. |
| **Zod** | A TypeScript library for defining data schemas that give both compile-time types and runtime validation. |
