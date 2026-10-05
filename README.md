# Szop

Szop is a web application for tracking shopping lists — not only groceries, but any kind of shopping: a hardware store run, party supplies, a renovation project.

It is built for the phone in your hand in the store as much as for planning at a desk, and you can start using it right away, without creating an account.

## Roadmap

Szop is built in phases, grouped into stages. The road below shows how far along it is; the [roadmap](docs/roadmap.md) has each phase's name, goal and details.

```text
  START
  ║
  ║ Stage 1 · Local foundations
  ║  PH-01   PH-02
  ╚════●═══════●═══════════════════════════════════════════════════════════╗
                                                                           ║
                              Stage 2 · Walking skeleton, running locally  ║
                             PH-08   PH-07   PH-06   PH-05   PH-04   PH-03 ║
  ╭────────────────────────────○───────○───────○───────○───────○───────●═══╝
  │
  │ Stage 3 · Walking skeleton, deployed and released
  │  PH-09   PH-10   PH-11   PH-12   PH-13
  ╰────○───────○───────○───────○───────○───────────────────────────────────╮
                                                                           │
                                                            Stage 4 · MVP  │
     PH-22   PH-21   PH-20   PH-19   PH-18   PH-17   PH-16   PH-15   PH-14 │
  ╭────○───────○───────○───────○───────○───────○───────○───────○───────○───╯
  │
  │
  │  PH-23   PH-24   PH-25   PH-26   PH-27   PH-28   PH-29   PH-30   PH-31
  ╰────○───────○───────○───────○───────○───────○───────○───────○───────○───╮
                                                                           │
                                                          Stage 5 · Later  │
                                                             PH-33   PH-32 │
                                                       DONE ───○───────○───╯


  ● done   ◐ in progress   ○ not started   ✕ dropped   ═ road travelled
```

## Features

- **Shopping lists** — create, rename and delete lists. Archive the ones you are done with, duplicate an existing list, or uncheck everything to reuse the same list next week.
- **Adding items** — type into one input and Szop suggests products from your catalog, or press enter to add whatever you typed as a one-off item (and optionally save it to the catalog). You can also browse the catalog by category and add several products at once.
- **Item details** — every item can carry a quantity, a unit, a short note and a price. The list totals what you have bought and what is still ahead of you.
- **Shopping** — check items off as you go and hide what is already in the basket.
- **Your own catalog and categories** — Szop starts you off with a predefined product catalog and a category tree, and both are yours to change: add, rename, remove, and nest categories up to five levels deep.
- **Ordering that matches the store** — arrange your categories in the order you actually walk the aisles, and every list sorts itself that way. Prefer a plain list instead? Turn category sorting off and items stay in the order you added them.
- **Templates** — keep reusable sets of items, like a camping trip or a weekly shop, and start a new list from one in a tap.
- **Accounts and guest mode** — use Szop without signing up: your lists are kept on our server and tied to this browser. Create an account and your lists, catalog and categories come with you to every device.

## Coming later

- Sharing a list with other people, as a **shopper** (check items off) or an **editor** (add, change and remove items)
- Share links, so someone without an account can shop from your list
- Live updates, so you see each other's changes as they happen

## Future ideas

- Themes, including choosing light or dark mode yourself (for now, Szop follows your device's setting)
- Android application
- Advanced functionality for subscribers
- AI-driven list creation for recipes, events and projects
- Social login
- Multiple store layouts to pick from per list
- Manual ordering of items on a list
- Offline use: checking items off at first, full editing later, with changes syncing when you are back online
- Installing Szop on your phone's home screen, like an app
- More languages
- An admin panel for the predefined catalog, users and moderation

## Tech stack

- **Frontend** — React single-page application built with Vite, React Router, TanStack Query and React Hook Form, styled with Tailwind CSS and shadcn/ui components on Base UI
- **Backend** — Node.js with Fastify, REST API
- **Shared** — Zod schemas and domain rules used by both frontend and backend, all in TypeScript
- **Database** — PostgreSQL with Drizzle
- **Authentication** — Better Auth, cookie-based sessions

## Development

Szop is a pnpm monorepo in TypeScript, developed in Windows Subsystem for Linux (WSL). To set up a machine and run the checks, follow the [setup guide](docs/development/setup.md); every tool has its own page in [docs/development/tools](docs/development/tools/).

`pnpm dev` starts the API, after you copy `apps/api/.env.example` to `apps/api/.env`, and `pnpm test` runs every test; see the [testing guide](docs/development/testing.md).

## Documentation

- [Functional requirements](docs/requirements/functional-requirements.md) — what Szop does, in detail
- [Architecture](docs/architecture/architecture.md) — how Szop is built
- [Stack overview](docs/architecture/stack-overview.md) — the technologies and concepts behind it, explained
- [Threat model](docs/architecture/threat-model.md) — what Szop protects, from whom, and how
- [Visual design](docs/architecture/visual-design.md) — what Szop looks like, and the design system its screens are built from
- [Glossary](docs/glossary.md) — acronyms and terms used in the docs
- [Roadmap](docs/roadmap.md) — what is built in which order, and how far along it is
- [Open points](docs/open-points.md) — what is still undecided or undone, and where it will be settled
- [Git workflow](docs/development/git-workflow.md) — how changes reach `main` and how releases are cut
- [Definition of done](docs/development/definition-of-done.md) — what every PR must meet before it is merged
- [GitHub settings](docs/development/github-settings.md) — the repository settings behind the workflow
- [Setup guide](docs/development/setup.md) — from a clean Windows machine to passing checks
- [Tool pages](docs/development/tools/) — each development tool, why it was chosen and its configuration explained
- [Decisions](docs/decisions/) — records of the decisions behind the project and why they were made
