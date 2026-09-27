# ADR 0002 — Technical architecture and technology choices

- **Status:** Accepted — decision 8 refined by [ADR 0003](0003-abuse-protection.md)
- **Date:** 2026-09-22
- **Supersedes:** decision 1 of [ADR 0001](0001-functional-requirements-scope.md) (where guest data lives)

## Context

With the [functional requirements](../requirements/functional-requirements.md) agreed, the next step was choosing the technology stack and the high-level architecture. Szop is a learning project: the owner has a Java background (not recent), is learning Python and JavaScript/TypeScript, has little framework experience in either, and wants to learn the most popular industry-standard technologies.

Two requirements shaped the choices most:

- **Guest mode** (ACC-1, ACC-4): a full workspace without an account.
- **Live updates** (SYN, Later): a long-running server holding WebSocket connections.

The resulting design is described in [architecture.md](../architecture/architecture.md). Development environment, testing strategy, CI/CD, deployment and visual design are decided separately.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | Stack family | TypeScript end to end (React SPA + Node API); Next.js full-stack; React + Python FastAPI; React + Spring Boot | **TypeScript end to end.** One language the owner is already learning; domain rules and API schemas live in one shared package used by both sides; clear frontend/API separation makes the architecture explicit; WebSockets are straightforward. Next.js's strengths (server rendering, SEO) matter little for a private app-like tool, and its server-component model blurs where code runs. Python and Java options would duplicate domain rules across two languages. |
| 2 | Backend framework | NestJS; Fastify | **Fastify.** Small and explicit, so the owner learns how a backend is put together. Schema-first validation fits shared Zod schemas. NestJS (Spring-like, on top of Express or Fastify) was the alternative for learning enterprise conventions; for an app this size its structure would mostly be ceremony, and its class-validator style fights shared Zod schemas. |
| 3 | Validation and API contract | Zod; class-based validation | **Zod** schemas in `packages/shared`, used by Fastify routes (`fastify-type-provider-zod`), the API client and forms. |
| 4 | Database | PostgreSQL; SQLite | **PostgreSQL.** The industry default for relational data; handles tree queries well. SQLite is simpler to run but less representative of production. |
| 5 | Database access | Drizzle; Prisma; Kysely | **Drizzle.** Close to SQL, so SQL skills are learned and transferable; types inferred without a code-generation step; fits the Zod-first direction. Prisma is more widespread and smoother to start but hides SQL; Kysely is a query builder with more manual work. |
| 6 | Authentication | Better Auth; hand-rolled; hosted provider (Auth0, Clerk, Supabase Auth) or Keycloak | **Better Auth.** Self-hosted open-source code we can read, data in our own database, security-critical parts written by specialists, anonymous-user and social-login plugins available. Hand-rolled auth teaches the most but is the easiest place for real security bugs; hosted providers move user data outside and hide the mechanics. |
| 7 | Session mechanism | Cookie-based sessions; JWTs in browser storage | **Cookie-based sessions** (`HttpOnly`, `Secure`, `SameSite`). Simpler and safer for an SPA served from the same site as its API; revocation is trivial. |
| 8 | Guest workspace storage | In the browser (IndexedDB) with a second data layer; local-first sync engine; anonymous server-side accounts | **Anonymous server-side accounts** (Better Auth anonymous plugin). One code path for guests and users; registration reassigns the workspace instead of uploading it; share links for guests fit naturally. Trade-offs accepted: guests need a connection, anonymous data is stored and cleaned up after 30 days of inactivity (new ACC-7). Browser storage would have doubled the data-layer work; sync engines are the most complex option and solve offline, which is deferred. **This supersedes ADR 0001 decision 1.** |
| 9 | API style | REST + shared Zod schemas + OpenAPI; tRPC; GraphQL | **REST.** The most transferable skill, works for any client including the future Android app; shared schemas give most of tRPC's type safety. tRPC suits TypeScript-only clients; GraphQL is overkill for this size. |
| 10 | Frontend routing | React Router; TanStack Router | **React Router** (plain SPA mode). By far the most widely used; Szop's routes are simple enough that TanStack Router's type-safe routing would not pay off. |
| 11 | Server state | TanStack Query | **TanStack Query.** The de facto standard: caching, refetching, optimistic updates; WebSocket events can later invalidate its cache. |
| 12 | Forms | React Hook Form + Zod resolver | **React Hook Form**, validating with the shared schemas. |
| 13 | Global client state | Redux; Zustand; none | **None for now.** Server state lives in TanStack Query, URL state in React Router, the rest in components. A store is added only on a real need. |
| 14 | Repository layout | Monorepo; separate repositories | **Monorepo**: `apps/web`, `apps/api`, `packages/shared`. Tooling is decided in the development environment step. |
| 15 | Backend code structure | Framework-imposed structure; our own layering | **Feature modules with routes / service / repository layers**, dependencies passed explicitly, no dependency-injection container. |
| 16 | Access control | Per-query scoping; central list-access check | **Every query scoped by the session's workspace**; with sharing, one central `requireListAccess` check. "Not found" and "no access" both return 404. |
| 17 | Money representation | Floating point; decimal; integer minor units | **Integer minor units** (cents, grosze) to avoid rounding errors. |
| 18 | Live updates mechanism (Later) | WebSocket with invalidate-and-refetch; WebSocket pushing data; polling | **WebSocket + in-process event bus; clients refetch the changed list.** Simple and correct; pushing the data itself or a shared channel for several server processes (PostgreSQL `LISTEN/NOTIFY`, Redis) come only if needed. |
| 19 | Offline behavior | Block changes; queue changes | **Block** changes while offline and show a banner (NET-1); queueing is the "offline check-off" future extension. |

## Consequences

- The requirements are updated for server-side guests: ACC-1, ACC-2, ACC-4, NET-1, the Guest actor and the assumptions change, and ACC-7 (cleanup of inactive anonymous workspaces) is added.
- Every change to data goes through the API, so the domain rules in `packages/shared` are used by the backend for correctness and by the frontend only for instant feedback (sorting after optimistic updates, form validation).
- Next.js, NestJS, Prisma and tRPC — all popular — are deliberately not part of the stack; the stack overview explains how the chosen pieces relate to them.
- The design assumes the SPA and API are served from one origin; deployment must provide that.
