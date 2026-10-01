# Szop — Functional Requirements

Living source of truth for what Szop does. Technical and visual design are out of scope here and are documented separately.

Requirements are tagged:

- **🎯 [MVP]** — part of the first release.
- **🔜 [Later]** — planned core functionality, built after the MVP.

Decisions behind these requirements are recorded in [ADR 0001](../decisions/0001-functional-requirements-scope.md), [ADR 0002](../decisions/0002-technical-architecture.md) (guest workspaces live on the server) and [ADR 0003](../decisions/0003-abuse-protection.md) (lazy guest workspaces, limits). Acronyms are explained in the [glossary](../glossary.md).

## Contents

- [1. General assumptions, actors, domain concepts](#1-general-assumptions-actors-domain-concepts)
  - [Assumptions](#assumptions)
  - [Actors](#actors)
  - [Domain concepts](#domain-concepts)
- [2. Functional requirements](#2-functional-requirements)
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
- [3. Use cases](#3-use-cases)
- [4. Release slicing and future extensions](#4-release-slicing-and-future-extensions)
  - [MVP](#mvp)
  - [Later (planned core functionality)](#later-planned-core-functionality)
  - [Future extensions (ideas, not committed)](#future-extensions-ideas-not-committed)
  - [Explicitly out of scope for now](#explicitly-out-of-scope-for-now)

## 1. General assumptions, actors, domain concepts

### Assumptions

- Szop is a web application for shopping lists of any kind (groceries, DIY, events, general shopping), used on phones in stores and on desktops for planning.
- The UI is English only.
- The app requires an internet connection, for guests and registered users alike.
- A user's workspace is private, except for lists they explicitly share.
- The requirements describe Szop as a public, always-on service, including the parts that matter only for one, such as cleaning up guest workspaces (ACC-7) and unverified accounts (ACC-8) and the rate limits (LIM-4). Where and how it runs is decided separately: for now, only as an on-demand demo environment that starts empty ([ADR 0008](../decisions/0008-hosting.md)).
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

## 2. Functional requirements

### Accounts and guest mode (ACC)

- **ACC-1 🎯 [MVP]** A guest can use the app without registering. Until their first change, they see the default (seed) catalog, categories and units, read-only. Their first change (for example creating a list) creates an anonymous workspace from the seed data, tied to their browser.
- **ACC-2 🎯 [MVP]** Register with email and password, with email verification. On registration, the guest's anonymous workspace in that browser becomes the account's workspace. Passwords are 15 to 128 characters, with no rules about which characters they must contain, and are refused if they appear in known data breaches. The app never reveals whether an email address already has an account: registration always asks the user to check their inbox, and an address that already has an account receives an email saying so, with links to log in or reset the password.
- **ACC-3 🎯 [MVP]** Log in and log out. Reset a forgotten password via email. Change the password while logged in. A failed login, a reset request and a request to resend the verification email answer the same way whether or not the address has an account. Changing or resetting the password logs out every other session.
- **ACC-4 🎯 [MVP]** When logging into an *existing* account from a browser whose guest workspace holds data, the app offers to import the guest's lists and templates or to discard them. Imported items are matched to the account's categories by name. Unmatched items become uncategorized.
- **ACC-5 🎯 [MVP]** Profile settings: display name and currency.
- **ACC-6 🎯 [MVP]** Delete the account with all its data, after confirming with the current password. Lists it shared disappear for collaborators.
- **ACC-7 🎯 [MVP]** Anonymous (guest) workspaces are deleted automatically:
  - after **3 days**, if they had no activity later than 1 hour after being created (used only briefly);
  - otherwise after **30 days** of inactivity.
- **ACC-8 🎯 [MVP]** Registered accounts whose email is not verified within **7 days** are deleted automatically.

### Shopping lists (LST)

- **LST-1 🎯 [MVP]** Create, rename and delete a list. Deleting requires confirmation.
- **LST-2 🎯 [MVP]** View all active lists. View archived lists separately.
- **LST-3 🎯 [MVP]** Archive and unarchive a list. An archived list is read-only until unarchived.
- **LST-4 🎯 [MVP]** Duplicate a list. The items are copied and all start unchecked. Shares are not copied.
- **LST-5 🎯 [MVP]** "Uncheck all" resets every item on the list.
- **LST-6 🎯 [MVP]** "Save as template" creates a template from the list's items.

### List items (ITM)

- **ITM-1 🎯 [MVP]** An item has a name (required) and an optional category, quantity, unit, note and price per unit.
- **ITM-2 🎯 [MVP]** Smart add input: while typing, the app suggests catalog products whose names match. Picking a suggestion adds the product with its defaults (category, unit, price). Pressing enter adds the typed text as an ad-hoc item.
- **ITM-3 🎯 [MVP]** After an ad-hoc item is added, the app offers to save it to the catalog. The option is off by default and saving never happens automatically.
- **ITM-4 🎯 [MVP]** If an unchecked item with the same name (case-insensitive) is already on the list, the app suggests increasing its quantity instead of adding a duplicate.
- **ITM-5 🎯 [MVP]** Catalog browser: navigate the category tree, select multiple products and add them to the list at once.
- **ITM-6 🎯 [MVP]** Edit any field of an item. Changes affect only that item, never the catalog.
- **ITM-7 🎯 [MVP]** Check and uncheck an item. Remove an item.
- **ITM-8 🎯 [MVP]** Totals: the list shows the sum of line totals for all items, for remaining (unchecked) items and for checked items. A line total is price × quantity, or just the price when there is no quantity. Items without a price are left out.

### List display and ordering (ORD)

- **ORD-1 🎯 [MVP]** The list shows unchecked items first, then checked items.
- **ORD-2 🎯 [MVP]** Within each of those two parts, items are sorted by the global category order, then alphabetically by name. Uncategorized items come last.
- **ORD-3 🎯 [MVP]** Items labeled with a parent category come before items labeled with its subcategories.
- **ORD-4 🎯 [MVP]** A toggle hides checked items.
- **ORD-5 🎯 [MVP]** Each list has a "sort by category" setting, on by default. When it is off, items appear in the order they were added, and the unchecked/checked split (ORD-1) still applies. The owner and editors can change the setting.

### Categories (CAT)

- **CAT-1 🎯 [MVP]** Create, rename and delete categories at any level of the tree. Move a category under a different parent.
- **CAT-2 🎯 [MVP]** Reorder sibling categories.
- **CAT-3 🎯 [MVP]** Deleting a category also deletes its subcategories. The confirmation shows how many products and items are affected. Catalog products and list items labeled with a deleted category become uncategorized.

### Catalog (PRD)

- **PRD-1 🎯 [MVP]** Create, edit and delete catalog products (name, default category, default unit, default price).
- **PRD-2 🎯 [MVP]** Browse the catalog by category, and search it by name.
- **PRD-3 🎯 [MVP]** Deleting a product does not affect list items created from it.

### Units (UNT)

- **UNT-1 🎯 [MVP]** Add, rename and delete units. Items that already use a unit keep its label.

### Templates (TPL)

- **TPL-1 🎯 [MVP]** Create a template from scratch, or from a list (LST-6).
- **TPL-2 🎯 [MVP]** Edit a template's name and items, the same way as a list but without checking items off.
- **TPL-3 🎯 [MVP]** Create a new list from a template. Delete a template.

### Sharing (SHR)

- **SHR-1 🔜 [Later]** The owner can share a list with a registered user by email, as **shopper** or **editor**. The list appears in that user's "Shared with me" view.
- **SHR-2 🔜 [Later]** The owner can create a share link per role, and revoke or regenerate it. Anyone opening the link, including guests, gets that role. For a guest, access is tied to their anonymous session in that browser.
- **SHR-3 🔜 [Later]** The owner can change a collaborator's role or remove them. A collaborator can leave a shared list.
- **SHR-4 🔜 [Later]** Only the owner can rename, archive, delete, duplicate or share the list.
- **SHR-5 🔜 [Later]** A shared list uses the **owner's** category tree, category order and currency. An editor picks categories from the owner's tree. When an editor adds a product from their own catalog, its category is matched by name in the owner's tree, otherwise the item is uncategorized. "Save to catalog" saves to the editor's own catalog.

### Live updates (SYN)

- **SYN-1 🔜 [Later]** Changes to a shared list appear for everyone viewing it within a few seconds, without reloading.
- **SYN-2 🔜 [Later]** For concurrent edits, the last change wins, per item field.

### Limits (LIM)

All values below are configurable defaults, adjustable without code changes. They are the same for guests and registered users.

- **LIM-1 🎯 [MVP]** Workspace quotas:

  | What | Limit |
  |---|---|
  | Lists (active and archived together) | 200 |
  | Items per list or template | 500 |
  | Templates | 100 |
  | Catalog products | 2,000 |
  | Categories | 300, at most 5 levels deep |
  | Units | 50 |

- **LIM-2 🎯 [MVP]** Text lengths: names (list, item, product, category, template, unit) at most 100 characters; item notes at most 500 characters. Forms enforce the same limits.
- **LIM-3 🎯 [MVP]** When a quota is reached, the app explains which limit was hit and how to make room (for example "You've reached the limit of 200 lists, archived ones included. Delete some to make room").
- **LIM-4 🎯 [MVP]** Rate limits protect the service from abuse:

  | What | Limit |
  |---|---|
  | Creating anonymous guests | 10 per hour per IP address |
  | Registrations | 5 per hour per IP address, and 3 per hour per email address registered |
  | Login attempts | 10 per 15 minutes per IP address; 10 failed attempts per 15 minutes per email address |
  | Password-reset and verification-resend requests | 5 per hour per IP address, and 3 per hour per email address |
  | Requests without a session | 300 per minute per IP address |
  | All other API requests | 300 per minute per session |
  | Emails sent, in total | a daily cap, set below the email service's sending quota |

  IPv6 addresses are grouped by their /64 block. When a limit is hit, the app asks the user to wait and try again. The per-email limits and the daily email cap are the exception: registration, reset and resend requests then answer as usual and send no email, so the answer never reveals anything about the address (ACC-2, ACC-3).

### Connectivity (NET)

- **NET-1 🎯 [MVP]** When the connection is lost, the app clearly shows an offline state and blocks changes rather than silently losing them. This applies to guests and registered users alike.

## 3. Use cases

- **UC-1 First visit as a guest** — A visitor opens Szop and sees an empty lists page; the default catalog and categories are already browsable. They create "Weekly groceries" — this first change creates their anonymous workspace from the seed data — and add items with the smart input.
- **UC-2 Plan a grocery trip** — The user opens a list and types "mil". They pick "Milk", which is added with category Dairy and unit l. They type "birthday candles" and press enter. The item is added ad-hoc and the app offers "Save to catalog?", which they skip. They open the catalog browser, select 5 products under Vegetables and add them. The list sorts itself by category.
- **UC-3 Shop in a store** — The user walks the store in category order, checking items off. Checked items move to the checked part of the list. They hide checked items to see only what is left. The totals show the spent and remaining amounts.
- **UC-4 Reuse a weekly list** — After shopping, the user taps "Uncheck all" on "Weekly groceries" and reuses it next week.
- **UC-5 Build from a template** — The user creates a "Camping trip" template from scratch. Before each trip, they create a new list from it and adjust it.
- **UC-6 Match the store layout** — The user reorders categories (Bakery before Dairy) and moves "Cheese" under Dairy. All their lists re-sort.
- **UC-7 Customize the catalog** — The user adds "Oat milk" under Dairy › Plant-based, with default unit l and a price. From then on it is suggested in the smart input.
- **UC-8 Guest becomes a user** — A guest with 3 lists registers and verifies their email. The lists, catalog and categories are now in their account and available on their laptop.
- **UC-9 Log in on a device with guest data** — A user logs in on a borrowed tablet that holds guest lists. The app asks whether to import or discard them. The user discards them.
- **UC-10 Share with a household member 🔜 [Later]** — The owner invites their partner by email as an editor. The partner sees the list in "Shared with me" and adds items. The owner sees them appear live.
- **UC-11 Hand off shopping to someone without an account 🔜 [Later]** — The owner creates a shopper link and sends it to a teenager. The teenager opens it as a guest and checks items off in the store. The owner sees progress live at home.
- **UC-12 Revoke access 🔜 [Later]** — The owner regenerates the share link. The old link stops working.
- **UC-13 Archive after a project** — Once a renovation list is done, the owner archives it. It leaves the active view and stays read-only in the archive.
- **UC-14 Delete an account** — The user deletes their account. All their data is removed, and lists they shared disappear for collaborators.

## 4. Release slicing and future extensions

### MVP

🎯 ACC, LST, ITM, ORD, CAT, PRD, UNT, TPL, LIM, NET: a complete single-user experience (guest mode, accounts, lists, catalog, categories, templates) without collaboration.

### Later (planned core functionality)

🔜 SHR (sharing, roles, links) and SYN (live updates).

### Future extensions (ideas, not committed)

💡 Ideas that may become requirements later:

- Themes
- Android application
- Advanced functionality for subscribers only
- AI-driven list creation for recipes, events, projects and other multi-product shopping
- Social login (Google and similar)
- Multiple store layouts (category orderings) per user, selectable per list
- Manual reordering of items on a list
- Offline check-off with sync on reconnect
- Full offline editing
- Internationalization (such as Polish)
- Admin role and admin panel (defaults management, user management, moderation)

### Explicitly out of scope for now

🚫 Not planned, for now:

- "Remove checked items" action
- Strict read-only viewer role
- Re-sharing by editors
- Collaborators editing the owner's catalog or categories
