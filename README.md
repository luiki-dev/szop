# Szop

Szop is a web application for tracking shopping lists — not only groceries, but any kind of shopping: a hardware store run, party supplies, a renovation project.

It is built for the phone in your hand in the store as much as for planning at a desk, and you can start using it right away, without creating an account.

## Features

- **Shopping lists** — create, rename and delete lists. Archive the ones you are done with, duplicate an existing list, or uncheck everything to reuse the same list next week.
- **Adding items** — type into one input and Szop suggests products from your catalog, or press enter to add whatever you typed as a one-off item (and optionally save it to the catalog). You can also browse the catalog by category and add several products at once.
- **Item details** — every item can carry a quantity, a unit, a short note and a price. The list totals what you have bought and what is still ahead of you.
- **Shopping** — check items off as you go and hide what is already in the basket.
- **Your own catalog and categories** — Szop starts you off with a predefined product catalog and a category tree, and both are yours to change: add, rename, remove, and nest categories as deep as you like.
- **Ordering that matches the store** — arrange your categories in the order you actually walk the aisles, and every list sorts itself that way. Prefer a plain list instead? Turn category sorting off and items stay in the order you added them.
- **Templates** — keep reusable sets of items, like a camping trip or a weekly shop, and start a new list from one in a tap.
- **Accounts and guest mode** — use Szop without signing up: your lists are kept on our server and tied to this browser. Create an account and your lists, catalog and categories come with you to every device.

## Coming later

- Sharing a list with other people, as a **shopper** (check items off) or an **editor** (change the list)
- Share links, so someone without an account can shop from your list
- Live updates, so you see each other's changes as they happen

## Future ideas

- Themes
- Android application
- Advanced functionality for subscribers
- AI-driven list creation for recipes, events and projects
- Social login
- Multiple store layouts to pick from per list
- Manual ordering of items on a list
- Offline shopping, with changes syncing when you are back online
- More languages
- Admin panel for maintaining the predefined catalog

## Tech stack

- **Frontend** — React single-page application built with Vite, React Router, TanStack Query and React Hook Form
- **Backend** — Node.js with Fastify, REST API
- **Shared** — Zod schemas and domain rules used by both frontend and backend, all in TypeScript
- **Database** — PostgreSQL with Drizzle
- **Authentication** — Better Auth, cookie-based sessions

## Documentation

- [Functional requirements](docs/requirements/functional-requirements.md) — what Szop does, in detail
- [Architecture](docs/architecture/architecture.md) — how Szop is built
- [Stack overview](docs/architecture/stack-overview.md) — the technologies and concepts behind it, explained
- [Glossary](docs/glossary.md) — acronyms and terms used in the docs
- [Open points](docs/open-points.md) — what is still undecided or undone, and where it will be settled
- [Git workflow](docs/development/git-workflow.md) — how changes reach `main` and how releases are cut
- [Definition of done](docs/development/definition-of-done.md) — what every PR must meet before it is merged
- [GitHub settings](docs/development/github-settings.md) — the repository settings behind the workflow
- [Decisions](docs/decisions/) — records of the decisions behind the project and why they were made
