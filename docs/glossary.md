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
| **DoS** | Denial of Service | An attack that makes a service unavailable, either by flooding it with traffic (volumetric) or by making it exhaust resources such as database space (resource exhaustion). |
| **HTTPS** | HTTP Secure | HTTP encrypted with TLS. |
| **JWT** | JSON Web Token | A signed token carrying claims about a user. An alternative to server-side sessions; not used in Szop. |
| **MVP** | Minimum Viable Product | The smallest release that is useful on its own. In the requirements, `[MVP]` marks what the first release contains. |
| **OAuth / OIDC** | Open Authorization / OpenID Connect | Standards for logging in through another provider ("Sign in with Google"). Relevant for the social-login future extension. |
| **ORM** | Object-Relational Mapper | A library that maps database tables to objects or types in code and builds queries. Drizzle is ours. |
| **REST** | Representational State Transfer | An API style where URLs name resources (`/api/lists/42`) and HTTP methods say what to do with them (`GET`, `POST`, `PATCH`, `DELETE`). |
| **SEO** | Search Engine Optimization | Making pages rank well in search engines. Irrelevant for private data such as shopping lists. |
| **SMTP** | Simple Mail Transfer Protocol | The protocol for sending email. |
| **SPA** | Single-Page Application | A web app where the browser loads one page once and JavaScript renders every screen after that, without full page reloads. Szop's frontend is one. |
| **SSR** | Server-Side Rendering | Generating a page's HTML on the server for each request. The main strength of frameworks like Next.js; not used in Szop. |
| **TLS** | Transport Layer Security | The encryption behind HTTPS. |

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
| **Anonymous user** | A server-side user without email or password, created automatically for a guest. Registering links it to a real account. |
| **Big design up front** | Designing a system in full detail before building any of it. Criticized because the decisions are made without feedback from working software. Szop decides direction up front and details per phase (see ADR 0004). |
| **Bundle** | The JavaScript and CSS files a build tool (Vite) produces from the source code for the browser to download. |
| **Definition of done** | The checklist every piece of work must meet before it counts as finished. Szop's is in ADR 0004: tests pass, CI green, deployed, docs updated. |
| **Design tokens** | Named values for the basic visual choices — colors, spacing, font sizes — used everywhere instead of raw values, so the look can be changed in one place. |
| **Dependency injection** | Handing a component the things it depends on (database client, email sender) from outside instead of it creating them. NestJS and Spring do it with a container; Szop passes dependencies explicitly. |
| **Domain rules** | Business logic independent of HTTP and storage — e.g. how list items are ordered, how totals are computed. Szop keeps them in `packages/shared`. |
| **Event bus** | An in-process publish/subscribe mechanism: code publishes "list 42 changed", listeners (such as the WebSocket hub) react. |
| **Hook (Fastify)** | A function Fastify calls at a fixed point of a request's lifecycle (`onRequest`, `preHandler`, …). |
| **Hook (React)** | A function starting with `use` (`useState`, `useList`) that lets a component use state or other React features. Unrelated to Fastify hooks despite the name. |
| **IndexedDB** | A database built into the browser for storing structured data locally. Considered for guest workspaces, not used (see ADR 0002). |
| **Migration** | A versioned script that changes the database schema; applied in order in every environment. |
| **IPv6 /64 block** | The range of IPv6 addresses sharing their first 64 bits — typically what one household or device is given. Rate limits group addresses by it, since one machine can switch between billions of addresses inside its block. |
| **Lazy creation** | Creating something only when it is first needed. Szop creates a guest's workspace on their first change, not on their first visit. |
| **Minor units** | The smallest unit of a currency (cents, grosze). Szop stores money as integers in minor units. |
| **Monorepo** | One repository holding several packages (here: `apps/web`, `apps/api`, `packages/shared`). |
| **OpenAPI** | A standard, machine-readable description of a REST API, from which documentation and clients can be generated. |
| **Optimistic update** | Updating the screen immediately as if a request succeeded, then correcting it if the server disagrees. |
| **Origin** | The scheme, domain and port of a URL (`https://szop.app`). Cookies and browser security rules work per origin. |
| **Phase** | One step of the implementation roadmap, taken through its own brainstorm, design approval and implementation. |
| **Quota** | A cap on how much data one workspace may hold (for example 200 lists). |
| **Rate limit** | A cap on how many requests of a kind are accepted in a time window (for example 10 guest creations per hour per IP address); excess requests get HTTP status 429. |
| **Seed data** | The predefined catalog, categories and units copied into every new workspace. |
| **Server state** | Data in the frontend that is a cached copy of data owned by the server. |
| **Session / session cookie** | The server's record of a logged-in (or anonymous) user, and the browser cookie that identifies it on each request. |
| **Spec / implementation plan** | The two working documents of a larger phase: the spec describes the agreed design, the plan lists the steps to build it. Kept in `docs/superpowers/`. |
| **Vertical slice** | A piece of work that delivers one capability through every layer at once (database, API, UI, tests, deployment), as opposed to building one layer at a time. |
| **Walking skeleton** | The thinnest possible version of the whole system that runs end to end (here: SPA → API → database, built by CI and deployed) and does almost nothing yet. Built early to test the foundation decisions. |
| **WebSocket** | A persistent two-way connection between browser and server, letting the server push messages (used for live updates). |
| **Workspace** | Everything one user owns: lists, templates, catalog, categories, units, settings. |
| **Zod** | A TypeScript library for defining data schemas that give both compile-time types and runtime validation. |
