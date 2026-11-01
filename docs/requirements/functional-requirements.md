# Szop — Functional Requirements

Living source of truth for what Szop does, and the qualities it must have while doing it ([non-functional requirements](NFR-non-functional-requirements.md): browsers, accessibility, performance, security). Technical and visual design are out of scope here and are documented separately.

Decisions behind these requirements are recorded in [ADR 0001](../decisions/0001-functional-requirements-scope.md), [ADR 0002](../decisions/0002-technical-architecture.md) (guest workspaces live on the server), [ADR 0003](../decisions/0003-abuse-protection.md) (lazy guest workspaces, limits), [ADR 0013](../decisions/0013-visual-design.md) (the non-functional requirements), [ADR 0022](../decisions/0022-ring-tail-redesign.md) (checked items go to the haul) and [ADR 0051](../decisions/0051-acceptance-criteria.md) (acceptance criteria and their status). Acronyms are explained in the [glossary](../glossary.md).

## Contents

- [How requirements are written](#how-requirements-are-written)
  - [Release tags](#release-tags)
  - [Files and links](#files-and-links)
  - [Acceptance criteria](#acceptance-criteria)
  - [Statuses](#statuses)
  - [Tests that cover a criterion](#tests-that-cover-a-criterion)
  - [How phases change criteria](#how-phases-change-criteria)
- [Requirements by area](#requirements-by-area)
  - [Accounts and guest mode (ACC)](#accounts-and-guest-mode-acc)
  - [Shopping lists (LST)](#shopping-lists-lst)
  - [List items (ITM)](#list-items-itm)
  - [List display and ordering (ORD)](#list-display-and-ordering-ord)
  - [Categories (CAT)](#categories-cat)
  - [Catalog (PRD)](#catalog-prd)
  - [Units (UNT)](#units-unt)
  - [Templates (TPL)](#templates-tpl)
  - [Sharing (SHR)](#sharing-shr)
  - [Live updates (SYN)](#live-updates-syn)
  - [Limits (LIM)](#limits-lim)
  - [Connectivity (NET)](#connectivity-net)
  - [Appearance (APR)](#appearance-apr)
  - [App-wide behavior (APP)](#app-wide-behavior-app)
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

### Release tags

- **🎯 [MVP]** — part of the first release.
- **🔜 [Later]** — planned core functionality, built after the MVP.
- **✖️ [Dropped]** — no longer a requirement; the ID is kept and never reused.

### Files and links

Each area has its own file, `<AREA-CODE>-<full-area-name>.md`, and every requirement and use case has its own heading in it, so its ID can be linked directly, for example [`ACC-accounts-and-guest-mode.md#acc-1`](ACC-accounts-and-guest-mode.md#acc-1) or [`UC-use-cases.md#uc-3-shop-in-a-store`](UC-use-cases.md#uc-3-shop-in-a-store). Other documents refer to requirements, use cases and areas by these links rather than by plain IDs. The use cases are in [their own file](UC-use-cases.md); they are scenarios and have no criteria.

### Acceptance criteria

Every requirement lists its **acceptance criteria**: short, checkable statements of what must be true for the requirement to be met ([ADR 0051](../decisions/0051-acceptance-criteria.md)).

- **What a criterion is:** something a user, or someone sending requests to the API, can observe; one statement, in plain present-tense English. How it is built belongs to the [architecture](../architecture/architecture.md).
- **ID:** the requirement's ID, a dot and a number, such as `APR-1.2`. Criteria are rows of the requirement's table, not headings, so links go to the requirement. A number is never reused: a criterion that moves to another requirement gets a new ID there.
- **A criterion that applies to every screen** is a general rule. It is ✅ when everything that exists meets it and a test checks it; later phases keep it true. What one screen must do is a criterion of that screen's requirement.

### Statuses

A criterion's status:

| Status | Meaning |
|---|---|
| ❔ Draft | Written from a decision, or from an open point's direction (then linked); no phase has finalized it. |
| ⬜ Not started | Finalized by a phase's brainstorm, which is named; not built yet. |
| 🚧 In progress | The named phase is building it; or it is built, but no test covers it yet ("no test yet"), or a person has yet to check it at a demo check ("to check at the next demo"). |
| ✅ Done | Delivered by the named phase and covered by a test, or checked by a person at the demo check ("checked at the demo"). |
| ➡️ Moved | Moved to another requirement, under the ID named. |
| ✖️ Dropped | No longer wanted, for the reason given. |

A requirement's **list of criteria** is either:

- **❔ Criteria not finalized**: no brainstorm has reviewed the requirement as a whole with the owner, so criteria may still be missing; or
- **✅ Criteria finalized**: a brainstorm, named, reviewed every criterion and judged the list complete. It is the brainstorm of the phase that delivers the requirement's last part ([ADR 0050](../decisions/0050-seed-catalog-phase-details.md), decision 14); an earlier phase reviews only the criteria it delivers. Later phases may still add, move or drop criteria.

A requirement's own status follows from both, leaving out moved and dropped criteria:

- **✅ Done** when its list is finalized and every criterion is ✅;
- **🚧 In progress** when at least one criterion is 🚧 or ✅, including when all are ✅ but the list is not finalized;
- **⬜ Not started** when its list is finalized and no criterion has started;
- **❔ Draft** when its list is not finalized and no criterion has started.

The line under each requirement's heading shows its release tag, its status, how many criteria are done, and its list's state. The tables in [Requirements by area](#requirements-by-area) show the same, for every requirement.

### Tests that cover a criterion

A criterion is ✅ only when a phase delivered it and a test covers it. The test's name starts with the criterion's ID and a colon, such as `it('APR-1.2: …')`, and `grep -rn 'APR-1.2[:,]'` finds every test of a criterion ([testing.md](../development/testing.md#rules)).

### How phases change criteria

A phase's brainstorm reviews with the owner the criteria it delivers of every requirement, and the whole list of a requirement whose last part it delivers: drafts become ⬜ or 🚧, criteria are added, moved or dropped, and a list reviewed as a whole becomes ✅ Criteria finalized. A requirement that later phases also deliver stays ❔ Criteria not finalized until the phase of its last part ([ADR 0050](../decisions/0050-seed-catalog-phase-details.md), decision 14, refining [ADR 0051](../decisions/0051-acceptance-criteria.md), decision 15). The phase's PR marks what it delivered ✅ and updates the requirement's line and this index ([ADR 0051](../decisions/0051-acceptance-criteria.md)).

## Requirements by area

### Accounts and guest mode (ACC)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [ACC-1](ACC-accounts-and-guest-mode.md#acc-1) | 🎯 MVP | 🚧 In progress | 4 of 9 | ❔ Not finalized |
| [ACC-2](ACC-accounts-and-guest-mode.md#acc-2) | 🎯 MVP | ❔ Draft | 0 of 8 | ❔ Not finalized |
| [ACC-3](ACC-accounts-and-guest-mode.md#acc-3) | 🎯 MVP | ❔ Draft | 0 of 9 | ❔ Not finalized |
| [ACC-4](ACC-accounts-and-guest-mode.md#acc-4) | 🎯 MVP | ❔ Draft | 0 of 5 | ❔ Not finalized |
| [ACC-5](ACC-accounts-and-guest-mode.md#acc-5) | 🎯 MVP | ❔ Draft | 0 of 4 | ❔ Not finalized |
| [ACC-6](ACC-accounts-and-guest-mode.md#acc-6) | 🎯 MVP | ❔ Draft | 0 of 3 | ❔ Not finalized |
| [ACC-7](ACC-accounts-and-guest-mode.md#acc-7) | 🎯 MVP | ❔ Draft | 0 of 2 | ❔ Not finalized |
| [ACC-8](ACC-accounts-and-guest-mode.md#acc-8) | 🎯 MVP | ❔ Draft | 0 of 1 | ❔ Not finalized |

### Shopping lists (LST)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [LST-1](LST-shopping-lists.md#lst-1) | 🎯 MVP | 🚧 In progress | 4 of 5 | ❔ Not finalized |
| [LST-2](LST-shopping-lists.md#lst-2) | 🎯 MVP | 🚧 In progress | 2 of 3 | ❔ Not finalized |
| [LST-3](LST-shopping-lists.md#lst-3) | 🎯 MVP | ❔ Draft | 0 of 4 | ❔ Not finalized |
| [LST-4](LST-shopping-lists.md#lst-4) | 🎯 MVP | ❔ Draft | 0 of 2 | ❔ Not finalized |
| [LST-5](LST-shopping-lists.md#lst-5) | 🎯 MVP | ❔ Draft | 0 of 1 | ❔ Not finalized |
| [LST-6](LST-shopping-lists.md#lst-6) | 🎯 MVP | ❔ Draft | 0 of 1 | ❔ Not finalized |

### List items (ITM)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [ITM-1](ITM-list-items.md#itm-1) | 🎯 MVP | ❔ Draft | 0 of 3 | ❔ Not finalized |
| [ITM-2](ITM-list-items.md#itm-2) | 🎯 MVP | ❔ Draft | 0 of 3 | ❔ Not finalized |
| [ITM-3](ITM-list-items.md#itm-3) | 🎯 MVP | ❔ Draft | 0 of 2 | ❔ Not finalized |
| [ITM-4](ITM-list-items.md#itm-4) | 🎯 MVP | ❔ Draft | 0 of 3 | ❔ Not finalized |
| [ITM-5](ITM-list-items.md#itm-5) | 🎯 MVP | ❔ Draft | 0 of 2 | ❔ Not finalized |
| [ITM-6](ITM-list-items.md#itm-6) | 🎯 MVP | ❔ Draft | 0 of 2 | ❔ Not finalized |
| [ITM-7](ITM-list-items.md#itm-7) | 🎯 MVP | ❔ Draft | 0 of 3 | ❔ Not finalized |
| [ITM-8](ITM-list-items.md#itm-8) | 🎯 MVP | ❔ Draft | 0 of 4 | ❔ Not finalized |

### List display and ordering (ORD)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [ORD-1](ORD-list-display-and-ordering.md#ord-1) | 🎯 MVP | ❔ Draft | 0 of 11 | ❔ Not finalized |
| [ORD-2](ORD-list-display-and-ordering.md#ord-2) | 🎯 MVP | 🚧 In progress | 0 of 5 | ❔ Not finalized |
| [ORD-3](ORD-list-display-and-ordering.md#ord-3) | 🎯 MVP | 🚧 In progress | 0 of 1 | ❔ Not finalized |
| [ORD-4](ORD-list-display-and-ordering.md#ord-4) | ✖️ Dropped | — | — | — |
| [ORD-5](ORD-list-display-and-ordering.md#ord-5) | 🎯 MVP | ❔ Draft | 0 of 4 | ❔ Not finalized |

### Categories (CAT)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [CAT-1](CAT-categories.md#cat-1) | 🎯 MVP | ❔ Draft | 0 of 6 | ❔ Not finalized |
| [CAT-2](CAT-categories.md#cat-2) | 🎯 MVP | ❔ Draft | 0 of 1 | ❔ Not finalized |
| [CAT-3](CAT-categories.md#cat-3) | 🎯 MVP | ❔ Draft | 0 of 3 | ❔ Not finalized |

### Catalog (PRD)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [PRD-1](PRD-catalog.md#prd-1) | 🎯 MVP | ❔ Draft | 0 of 4 | ❔ Not finalized |
| [PRD-2](PRD-catalog.md#prd-2) | 🎯 MVP | ✅ Done | 12 of 12 | ✅ Finalized |
| [PRD-3](PRD-catalog.md#prd-3) | 🎯 MVP | ❔ Draft | 0 of 1 | ❔ Not finalized |

### Units (UNT)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [UNT-1](UNT-units.md#unt-1) | 🎯 MVP | 🚧 In progress | 0 of 4 | ❔ Not finalized |

### Templates (TPL)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [TPL-1](TPL-templates.md#tpl-1) | 🎯 MVP | ❔ Draft | 0 of 4 | ❔ Not finalized |
| [TPL-2](TPL-templates.md#tpl-2) | 🎯 MVP | ❔ Draft | 0 of 1 | ❔ Not finalized |
| [TPL-3](TPL-templates.md#tpl-3) | 🎯 MVP | ❔ Draft | 0 of 3 | ❔ Not finalized |

### Sharing (SHR)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [SHR-1](SHR-sharing.md#shr-1) | 🔜 Later | ❔ Draft | 0 of 3 | ❔ Not finalized |
| [SHR-2](SHR-sharing.md#shr-2) | 🔜 Later | ❔ Draft | 0 of 4 | ❔ Not finalized |
| [SHR-3](SHR-sharing.md#shr-3) | 🔜 Later | ❔ Draft | 0 of 3 | ❔ Not finalized |
| [SHR-4](SHR-sharing.md#shr-4) | 🔜 Later | ❔ Draft | 0 of 4 | ❔ Not finalized |
| [SHR-5](SHR-sharing.md#shr-5) | 🔜 Later | ❔ Draft | 0 of 4 | ❔ Not finalized |

### Live updates (SYN)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [SYN-1](SYN-live-updates.md#syn-1) | 🔜 Later | ❔ Draft | 0 of 4 | ❔ Not finalized |
| [SYN-2](SYN-live-updates.md#syn-2) | 🔜 Later | ❔ Draft | 0 of 2 | ❔ Not finalized |

### Limits (LIM)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [LIM-1](LIM-limits.md#lim-1) | 🎯 MVP | ❔ Draft | 0 of 8 | ❔ Not finalized |
| [LIM-2](LIM-limits.md#lim-2) | 🎯 MVP | 🚧 In progress | 0 of 2 | ❔ Not finalized |
| [LIM-3](LIM-limits.md#lim-3) | 🎯 MVP | ❔ Draft | 0 of 2 | ❔ Not finalized |
| [LIM-4](LIM-limits.md#lim-4) | 🎯 MVP | ❔ Draft | 0 of 10 | ❔ Not finalized |

### Connectivity (NET)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [NET-1](NET-connectivity.md#net-1) | 🎯 MVP | ❔ Draft | 0 of 6 | ❔ Not finalized |

### Appearance (APR)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [APR-1](APR-appearance.md#apr-1) | 🎯 MVP | ✅ Done | 5 of 5 | ✅ Finalized |

### App-wide behavior (APP)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [APP-1](APP-app-wide-behavior.md#app-1) | 🎯 MVP | 🚧 In progress | 8 of 10 | ❔ Not finalized |
| [APP-2](APP-app-wide-behavior.md#app-2) | 🎯 MVP | ✅ Done | 2 of 2 | ✅ Finalized |
| [APP-3](APP-app-wide-behavior.md#app-3) | 🎯 MVP | ❔ Draft | 0 of 3 | ❔ Not finalized |
| [APP-4](APP-app-wide-behavior.md#app-4) | 🎯 MVP | 🚧 In progress | 3 of 3 | ❔ Not finalized |
| [APP-5](APP-app-wide-behavior.md#app-5) | 🎯 MVP | ❔ Draft | 0 of 1 | ❔ Not finalized |
| [APP-6](APP-app-wide-behavior.md#app-6) | 🎯 MVP | ❔ Draft | 0 of 2 | ❔ Not finalized |
| [APP-7](APP-app-wide-behavior.md#app-7) | 🎯 MVP | ❔ Draft | 0 of 2 | ❔ Not finalized |

### Non-functional requirements (NFR)

| Requirement | Release | Status | Criteria done | Criteria list |
|---|---|---|---|---|
| [NFR-1](NFR-non-functional-requirements.md#nfr-1) | 🎯 MVP | ✅ Done | 1 of 1 | ✅ Finalized |
| [NFR-2](NFR-non-functional-requirements.md#nfr-2) | 🎯 MVP | 🚧 In progress | 8 of 8 | ❔ Not finalized |
| [NFR-3](NFR-non-functional-requirements.md#nfr-3) | 🎯 MVP | 🚧 In progress | 3 of 3 | ❔ Not finalized |
| [NFR-4](NFR-non-functional-requirements.md#nfr-4) | 🎯 MVP | 🚧 In progress | 8 of 11 | ❔ Not finalized |

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

🎯 [ACC](ACC-accounts-and-guest-mode.md), [LST](LST-shopping-lists.md), [ITM](ITM-list-items.md), [ORD](ORD-list-display-and-ordering.md), [CAT](CAT-categories.md), [PRD](PRD-catalog.md), [UNT](UNT-units.md), [TPL](TPL-templates.md), [LIM](LIM-limits.md), [NET](NET-connectivity.md), [APR](APR-appearance.md), [APP](APP-app-wide-behavior.md): a complete single-user experience (guest mode, accounts, lists, catalog, categories, templates) without collaboration, meeting the [NFR](NFR-non-functional-requirements.md) qualities.

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
- Manual reordering of lists and of items on a list (drag and drop)
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
