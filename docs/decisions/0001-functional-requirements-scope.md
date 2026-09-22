# ADR 0001 — Functional requirements scope

- **Status:** Accepted — decision 1 superseded by [ADR 0002](0002-technical-architecture.md)
- **Date:** 2026-09-21

## Context

The README gives a high-level description of Szop. Before any technical or visual design, the functional behavior was refined in a brainstorming session. The result is [functional-requirements.md](../requirements/functional-requirements.md). This record captures the decisions made and the alternatives that were considered.

## Decisions

| # | Topic | Options considered | Decision |
|---|-------|--------------------|----------|
| 1 | Guest (no account) capabilities | Local-only guest workspace; read-only guest via shared link only; both | **Both**: a local workspace in the browser, plus opening shared lists via link. Guest data is taken over on registration. |
| 2 | Sharing model | Invite + link with roles; link-only with everyone editing; invite-only | **Invite registered users by email + share links**, each with a role. The owner can revoke or regenerate. |
| 3 | Share roles | Shopper + editor; viewer + shopper + editor | **Shopper** (view, check/uncheck) and **editor** (full item editing). "Read-only" means no content changes, but checking off is still allowed. Only the owner manages the list itself. |
| 4 | Sync of shared lists | Live updates; refresh to see changes | **Live updates**. Last change wins per item field. |
| 5 | Predefined catalog/categories customization | Copy per workspace; shared defaults + personal overrides | **Copy per workspace** at creation. Seed changes reach only new workspaces. |
| 6 | Categories on shared lists | Owner's tree; each viewer's own tree | **Owner's** tree, order and currency. Editor-added products are matched by category name. |
| 7 | Item attributes | Minimum (qty, unit, note); plus price; name only | **Quantity, unit, note and price per unit.** Currency is a profile setting. |
| 8 | Saving ad-hoc items to catalog | Automatic; suggested; never | **Suggested**, off by default. |
| 9 | Checked items display | Muted within their category; separate part at the bottom | **Separate part**: all unchecked items, then all checked items, each sorted by category order and then name. A toggle hides checked items. |
| 10 | List lifecycle | Uncheck all, remove checked, duplicate, archive, templates | **Archive, save as template, uncheck all, duplicate.** "Remove checked" is out of scope. |
| 11 | Templates | Created from lists only (read-only); full CRUD | **Full CRUD**, created from scratch or from a list. User-specific, never shared. |
| 12 | Accounts | Email/password; plus social login; social only | **Email/password** with verification, reset and account deletion. Social login is a future extension. |
| 13 | Category ordering | One order per user; multiple store layouts | **One order per user.** Store layouts are a future extension. |
| 14 | Item labeling and sorting | — | An item has one category at any tree level. Parent-labeled items come before subcategory items. Uncategorized items come last. Category sorting can be turned off per list (then items appear in the order added). Manual reordering is a future extension. |
| 15 | Adding items | Smart input; catalog browser; both | **Both**: a smart input with suggestions and ad-hoc entry as the main path, plus a multi-select catalog browser. |
| 16 | Language | English + Polish; English only; Polish only | **English only**. Internationalization is a future extension. |
| 17 | Offline | None; offline check-off; full offline | **None for now**, with a clear offline state. Both offline variants are future extensions. |
| 18 | Maintaining default catalog | Seed data in repo; admin panel | **Seed data in repo**. Admin role and panel are a future extension. |
| 19 | Release slicing | Tag requirements MVP/Later; no slicing | **MVP** = single-user experience with guest mode, accounts and templates. **Later** = sharing and live updates. |
| 20 | Documentation layout | Requirements doc + ADRs; single dated superpowers spec | **Living requirements doc in `docs/requirements/` + ADRs in `docs/decisions/`**. |

## Smaller decisions made with these

- Logging into an existing account in a browser with guest data offers to import or discard guest lists and templates.
- Archived lists are read-only until unarchived.
- Deleting a category also deletes its subcategories. Affected products and items become uncategorized.
- Collaborators cannot duplicate a shared list. Only the owner can.
- A list item is a copy of catalog defaults. Editing the item or deleting the catalog product does not affect the other.

## Consequences

- The MVP needs no real-time infrastructure. That arrives with sharing (Later).
- Guest mode requires local browser storage and a migration path into an account, which affects the technical design.
- The copy-per-workspace model keeps user data simple and fully independent of the seed data.
