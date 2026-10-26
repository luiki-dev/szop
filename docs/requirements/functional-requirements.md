# Szop — Functional Requirements

Living source of truth for what Szop does, and the qualities it must have while doing it ([section 3](NFR-non-functional-requirements.md): browsers, accessibility, performance). Technical and visual design are out of scope here and are documented separately.

Decisions behind these requirements are recorded in [ADR 0001](../decisions/0001-functional-requirements-scope.md), [ADR 0002](../decisions/0002-technical-architecture.md) (guest workspaces live on the server), [ADR 0003](../decisions/0003-abuse-protection.md) (lazy guest workspaces, limits), [ADR 0013](../decisions/0013-visual-design.md) (the non-functional requirements) and [ADR 0022](../decisions/0022-ring-tail-redesign.md) (checked items go to the haul). Acronyms are explained in the [glossary](../glossary.md).

## Contents

- [How requirements are written](#how-requirements-are-written)
- [Requirements by area](#requirements-by-area)
  - [Accounts and guest mode (ACC)](ACC-accounts-and-guest-mode.md)
  - [Shopping lists (LST)](LST-shopping-lists.md)
  - [List items (ITM)](ITM-list-items.md)
  - [List display and ordering (ORD)](ORD-list-display-and-ordering.md)
  - [Categories (CAT)](CAT-categories.md)
  - [Catalog (PRD)](PRD-catalog.md)
  - [Units (UNT)](UNT-units.md)
  - [Templates (TPL)](TPL-templates.md)
  - [Sharing (SHR)](SHR-sharing.md)
  - [Live updates (SYN)](SYN-live-updates.md)
  - [Limits (LIM)](LIM-limits.md)
  - [Connectivity (NET)](NET-connectivity.md)
  - [Appearance (APR)](APR-appearance.md)
  - [Non-functional requirements (NFR)](#non-functional-requirements-nfr)
- [General assumptions, actors, domain concepts](#general-assumptions-actors-domain-concepts)
  - [Assumptions](#assumptions)
  - [Actors](#actors)
  - [Domain concepts](#domain-concepts)
- [Release slicing and future extensions](#release-slicing-and-future-extensions)
  - [MVP](#mvp)
  - [Later (planned core functionality)](#later-planned-core-functionality)
  - [Future extensions (ideas, not committed)](#future-extensions-ideas-not-committed)
  - [Explicitly out of scope for now](#explicitly-out-of-scope-for-now)

## How requirements are written

Requirements are tagged:

- **🎯 [MVP]** — part of the first release.
- **🔜 [Later]** — planned core functionality, built after the MVP.
- **✖️ [Dropped]** — no longer a requirement; the ID is kept and never reused.

Each area has its own file, and every requirement and use case has its own heading in it, so its ID can be linked directly, for example [`ACC-accounts-and-guest-mode.md#acc-1`](ACC-accounts-and-guest-mode.md#acc-1) or [`UC-use-cases.md#uc-3-shop-in-a-store`](UC-use-cases.md#uc-3-shop-in-a-store). Other documents refer to requirements, use cases and areas by these links rather than by plain IDs. The use cases are in [their own file](UC-use-cases.md).

## Requirements by area

### Accounts and guest mode (ACC)

| Requirement | Release |
|---|---|
| [ACC-1](ACC-accounts-and-guest-mode.md#acc-1) | 🎯 MVP |
| [ACC-2](ACC-accounts-and-guest-mode.md#acc-2) | 🎯 MVP |
| [ACC-3](ACC-accounts-and-guest-mode.md#acc-3) | 🎯 MVP |
| [ACC-4](ACC-accounts-and-guest-mode.md#acc-4) | 🎯 MVP |
| [ACC-5](ACC-accounts-and-guest-mode.md#acc-5) | 🎯 MVP |
| [ACC-6](ACC-accounts-and-guest-mode.md#acc-6) | 🎯 MVP |
| [ACC-7](ACC-accounts-and-guest-mode.md#acc-7) | 🎯 MVP |
| [ACC-8](ACC-accounts-and-guest-mode.md#acc-8) | 🎯 MVP |

### Shopping lists (LST)

| Requirement | Release |
|---|---|
| [LST-1](LST-shopping-lists.md#lst-1) | 🎯 MVP |
| [LST-2](LST-shopping-lists.md#lst-2) | 🎯 MVP |
| [LST-3](LST-shopping-lists.md#lst-3) | 🎯 MVP |
| [LST-4](LST-shopping-lists.md#lst-4) | 🎯 MVP |
| [LST-5](LST-shopping-lists.md#lst-5) | 🎯 MVP |
| [LST-6](LST-shopping-lists.md#lst-6) | 🎯 MVP |

### List items (ITM)

| Requirement | Release |
|---|---|
| [ITM-1](ITM-list-items.md#itm-1) | 🎯 MVP |
| [ITM-2](ITM-list-items.md#itm-2) | 🎯 MVP |
| [ITM-3](ITM-list-items.md#itm-3) | 🎯 MVP |
| [ITM-4](ITM-list-items.md#itm-4) | 🎯 MVP |
| [ITM-5](ITM-list-items.md#itm-5) | 🎯 MVP |
| [ITM-6](ITM-list-items.md#itm-6) | 🎯 MVP |
| [ITM-7](ITM-list-items.md#itm-7) | 🎯 MVP |
| [ITM-8](ITM-list-items.md#itm-8) | 🎯 MVP |

### List display and ordering (ORD)

| Requirement | Release |
|---|---|
| [ORD-1](ORD-list-display-and-ordering.md#ord-1) | 🎯 MVP |
| [ORD-2](ORD-list-display-and-ordering.md#ord-2) | 🎯 MVP |
| [ORD-3](ORD-list-display-and-ordering.md#ord-3) | 🎯 MVP |
| [ORD-4](ORD-list-display-and-ordering.md#ord-4) | ✖️ Dropped |
| [ORD-5](ORD-list-display-and-ordering.md#ord-5) | 🎯 MVP |

### Categories (CAT)

| Requirement | Release |
|---|---|
| [CAT-1](CAT-categories.md#cat-1) | 🎯 MVP |
| [CAT-2](CAT-categories.md#cat-2) | 🎯 MVP |
| [CAT-3](CAT-categories.md#cat-3) | 🎯 MVP |

### Catalog (PRD)

| Requirement | Release |
|---|---|
| [PRD-1](PRD-catalog.md#prd-1) | 🎯 MVP |
| [PRD-2](PRD-catalog.md#prd-2) | 🎯 MVP |
| [PRD-3](PRD-catalog.md#prd-3) | 🎯 MVP |

### Units (UNT)

| Requirement | Release |
|---|---|
| [UNT-1](UNT-units.md#unt-1) | 🎯 MVP |

### Templates (TPL)

| Requirement | Release |
|---|---|
| [TPL-1](TPL-templates.md#tpl-1) | 🎯 MVP |
| [TPL-2](TPL-templates.md#tpl-2) | 🎯 MVP |
| [TPL-3](TPL-templates.md#tpl-3) | 🎯 MVP |

### Sharing (SHR)

| Requirement | Release |
|---|---|
| [SHR-1](SHR-sharing.md#shr-1) | 🔜 Later |
| [SHR-2](SHR-sharing.md#shr-2) | 🔜 Later |
| [SHR-3](SHR-sharing.md#shr-3) | 🔜 Later |
| [SHR-4](SHR-sharing.md#shr-4) | 🔜 Later |
| [SHR-5](SHR-sharing.md#shr-5) | 🔜 Later |

### Live updates (SYN)

| Requirement | Release |
|---|---|
| [SYN-1](SYN-live-updates.md#syn-1) | 🔜 Later |
| [SYN-2](SYN-live-updates.md#syn-2) | 🔜 Later |

### Limits (LIM)

| Requirement | Release |
|---|---|
| [LIM-1](LIM-limits.md#lim-1) | 🎯 MVP |
| [LIM-2](LIM-limits.md#lim-2) | 🎯 MVP |
| [LIM-3](LIM-limits.md#lim-3) | 🎯 MVP |
| [LIM-4](LIM-limits.md#lim-4) | 🎯 MVP |

### Connectivity (NET)

| Requirement | Release |
|---|---|
| [NET-1](NET-connectivity.md#net-1) | 🎯 MVP |

### Appearance (APR)

| Requirement | Release |
|---|---|
| [APR-1](APR-appearance.md#apr-1) | 🎯 MVP |

### Non-functional requirements (NFR)

| Requirement | Release |
|---|---|
| [NFR-1](NFR-non-functional-requirements.md#nfr-1) | 🎯 MVP |
| [NFR-2](NFR-non-functional-requirements.md#nfr-2) | 🎯 MVP |
| [NFR-3](NFR-non-functional-requirements.md#nfr-3) | 🎯 MVP |

## General assumptions, actors, domain concepts

### Assumptions

- Szop is a web application for shopping lists of any kind (groceries, DIY, events, general shopping), used on phones in stores and on desktops for planning.
- The UI is English only.
- The app requires an internet connection, for guests and registered users alike.
- A user's workspace is private, except for lists they explicitly share.
- The requirements describe Szop as a public, always-on service, including the parts that matter only for one, such as cleaning up guest workspaces ([ACC-7](ACC-accounts-and-guest-mode.md#acc-7)) and unverified accounts ([ACC-8](ACC-accounts-and-guest-mode.md#acc-8)) and the rate limits ([LIM-4](LIM-limits.md#lim-4)). Where and how it runs is decided separately: for now, only as an on-demand demo environment that starts empty ([ADR 0008](../decisions/0008-hosting.md)).
- Predefined content (catalog, categories, units) is seed data kept in the project repository. Each new workspace gets its own **copy**. Later changes to the seed data do not affect existing workspaces.

### Actors

- **Guest** — no account. Works in an *anonymous workspace* stored on the server and tied to their browser by a session cookie; clearing the browser's cookies loses access to it. Can open shared lists via a share link, with the role the link grants.
- **Registered user** — has an account. Their workspace is stored on the server and available on any device.
- **List owner** — the user who created a list. Only the owner can rename, archive, delete, duplicate or share it.
- **Collaborator** — someone a list is shared with, in one of two roles:
  - **shopper** — can view the list and check/uncheck items;
  - **editor** — shopper rights plus adding, editing and removing items.

### Domain concepts

- **Workspace** — everything one user or guest owns: lists, templates, catalog, category tree, units, settings.
- **Category** — a node in a hierarchical tree. Siblings have a user-defined order. The tree flattens depth-first, parent first, into one global order.
- **Catalog product** — a name plus an optional default category, unit and price.
- **Unit** — from a predefined, user-extendable set (pcs, kg, g, l, ml, pack, …).
- **Shopping list** — a name, items, a status (active or archived), a "sort by category" setting, and shares.
- **List item** — name, optional category (at any tree level), quantity, unit, note, price per unit, and checked state. It is a **copy** of catalog defaults, not a live link to the catalog product.
- **Template** — a named set of items without checked state. Owned by one user, never shared.
- **Share** — a role (shopper or editor) granted either to a registered user by invitation, or to anyone holding a share link.
- **Settings** — display name and currency. A list shows prices in its **owner's** currency.

## Release slicing and future extensions

### MVP

🎯 [ACC](ACC-accounts-and-guest-mode.md), [LST](LST-shopping-lists.md), [ITM](ITM-list-items.md), [ORD](ORD-list-display-and-ordering.md), [CAT](CAT-categories.md), [PRD](PRD-catalog.md), [UNT](UNT-units.md), [TPL](TPL-templates.md), [LIM](LIM-limits.md), [NET](NET-connectivity.md), [APR](APR-appearance.md): a complete single-user experience (guest mode, accounts, lists, catalog, categories, templates) without collaboration, meeting the [NFR](NFR-non-functional-requirements.md) qualities.

### Later (planned core functionality)

🔜 [SHR](SHR-sharing.md) (sharing, roles, links) and [SYN](SYN-live-updates.md) (live updates).

### Future extensions (ideas, not committed)

💡 Ideas that may become requirements later:

- Themes beyond light and dark (the choice between those two is [APR-1](APR-appearance.md#apr-1))
- Android application
- Advanced functionality for subscribers only
- AI-driven list creation for recipes, events, projects and other multi-product shopping
- Social login (Google and similar)
- Multiple store layouts (category orderings) per user, selectable per list
- Manual reordering of items on a list
- Offline check-off with sync on reconnect
- Full offline editing
- Installable app: a web app manifest and a home-screen icon, together with offline use
- Internationalization (such as Polish)
- Admin role and admin panel (defaults management, user management, moderation)

### Explicitly out of scope for now

🚫 Not planned, for now:

- "Remove checked items" action
- Strict read-only viewer role
- Re-sharing by editors
- Collaborators editing the owner's catalog or categories
