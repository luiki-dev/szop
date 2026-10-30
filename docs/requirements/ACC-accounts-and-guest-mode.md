# Accounts and guest mode (ACC)

Guest mode, registration, logging in and out, passwords, profile settings, and the deletion of accounts and guest workspaces. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.


## Contents

- [ACC-1](#acc-1)
- [ACC-2](#acc-2)
- [ACC-3](#acc-3)
- [ACC-4](#acc-4)
- [ACC-5](#acc-5)
- [ACC-6](#acc-6)
- [ACC-7](#acc-7)
- [ACC-8](#acc-8)

## ACC-1

🎯 [MVP] · 🚧 In progress (1 of 9) · ❔ Criteria not finalized

A guest can use the app without registering. Until their first change, they see the default (seed) catalog, categories and units, read-only. Their first change (for example creating a list) creates an anonymous workspace from the seed data, tied to their browser.

| ID | Criterion | Status |
|---|---|---|
| ACC-1.1 | A visitor can use the app at once, with no sign-up step. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) |
| ACC-1.2 | Before their first change, a visitor sees the default catalog, categories and units, read-only, and no lists or templates. | 🚧 [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · the catalog; the rest in [PH-16](../roadmap.md#ph-16-guest-workspace-and-lists) |
| ACC-1.3 | A visit that changes nothing stores nothing: a request that only reads sets no session cookie and creates no workspace. | ✅ [PH-15a](../roadmap.md#ph-15a-seed-catalog-read-only) · `GET /api/catalog`; later read routes keep it true |
| ACC-1.4 | A visitor's first change, such as creating a list, creates their workspace from the default data and then applies the change, with nothing more asked of them. | ❔ Draft |
| ACC-1.5 | The first change succeeds when it refers to default data, such as adding the default product "Milk" with its default category. | ❔ Draft · [OP-048](https://github.com/luiki-dev/szop/issues/101) |
| ACC-1.6 | Two tabs that make their first change at the same moment end up in one workspace. | ❔ Draft · [OP-048](https://github.com/luiki-dev/szop/issues/101) |
| ACC-1.7 | A guest's browser keeps access to their workspace for as long as [ACC-7](#acc-7) keeps the workspace. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) · [OP-039](https://github.com/luiki-dev/szop/issues/98) |
| ACC-1.8 | Clearing the browser's cookies loses access to the guest workspace. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) |
| ACC-1.9 | A change to the default data reaches only workspaces created after it; existing workspaces keep their copy. | ❔ Draft |

## ACC-2

🎯 [MVP] · ❔ Draft (0 of 8) · ❔ Criteria not finalized

Register with email and password, with email verification. On registration, the guest's anonymous workspace in that browser becomes the account's workspace. Passwords are 15 to 128 characters, with no rules about which characters they must contain, and are refused if they appear in known data breaches. The app never reveals whether an email address already has an account: registration always asks the user to check their inbox, and an address that already has an account receives an email saying so, with links to log in or reset the password.

| ID | Criterion | Status |
|---|---|---|
| ACC-2.1 | A user registers with an email address and a password, and verifies the address through a link emailed to it. | ❔ Draft |
| ACC-2.2 | A password of 15 to 128 characters is accepted, whatever characters it contains; pasting and password managers work. | ❔ Draft |
| ACC-2.3 | A password that appears in known data breaches is refused, with a message saying why. | ❔ Draft |
| ACC-2.4 | When the breached-password service cannot be reached, the password is accepted. | ❔ Draft |
| ACC-2.5 | Registration always answers "check your inbox", whether or not the address already has an account. | ❔ Draft |
| ACC-2.6 | An address that already has an account receives an email saying so, with links to log in and to reset the password. | ❔ Draft |
| ACC-2.7 | On registration, the guest workspace in that browser, with its lists, templates, catalog and categories, becomes the account's workspace. | ❔ Draft · [OP-038](https://github.com/luiki-dev/szop/issues/97) |
| ACC-2.8 | Once verified, the account's data is available on every device the user logs in from. | ❔ Draft |

## ACC-3

🎯 [MVP] · ❔ Draft (0 of 9) · ❔ Criteria not finalized

Log in and log out. Reset a forgotten password via email. Change the password while logged in. A failed login, a reset request and a request to resend the verification email answer the same way whether or not the address has an account. Changing or resetting the password logs out every other session.

| ID | Criterion | Status |
|---|---|---|
| ACC-3.1 | A registered user logs in with their email address and password, and logs out. | ❔ Draft |
| ACC-3.2 | A failed login answers the same, in about the same time, for an unknown address and for a wrong password. | ❔ Draft |
| ACC-3.3 | A user who forgot their password asks for a reset link by email, and sets a new password through it. | ❔ Draft |
| ACC-3.4 | A reset request answers the same whether or not the address has an account. | ❔ Draft |
| ACC-3.5 | A request to resend the verification email answers the same whether or not the address has an account. | ❔ Draft |
| ACC-3.6 | A logged-in user changes their password. | ❔ Draft |
| ACC-3.7 | A new password, by change or by reset, follows the rules of registration: 15 to 128 characters, not found in known data breaches. | ❔ Draft |
| ACC-3.8 | Changing or resetting the password logs out every other session of the account at once. | ❔ Draft · [OP-055](https://github.com/luiki-dev/szop/issues/109) |
| ACC-3.9 | Verification and reset links work once, and expire. | ❔ Draft |

## ACC-4

🎯 [MVP] · ❔ Draft (0 of 5) · ❔ Criteria not finalized

When logging into an *existing* account from a browser whose guest workspace holds data, the app offers to import the guest's lists and templates or to discard them. Imported items are matched to the account's categories by name. Unmatched items become uncategorized.

| ID | Criterion | Status |
|---|---|---|
| ACC-4.1 | Logging into an existing account in a browser whose guest workspace holds lists or templates asks whether to import them or discard them; a guest workspace without them is not asked about. | ❔ Draft |
| ACC-4.2 | Importing copies the guest's lists and templates into the account's workspace. | ❔ Draft |
| ACC-4.3 | An imported item keeps its category when the account has a category with the same full path, or with the same name when only one category has it; otherwise it becomes uncategorized. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| ACC-4.4 | Discarding deletes the guest's data. | ❔ Draft |
| ACC-4.5 | An import that would pass one of the account's quotas imports nothing, and says which limit it would pass. | ❔ Draft · [OP-047](https://github.com/luiki-dev/szop/issues/111) |

## ACC-5

🎯 [MVP] · ❔ Draft (0 of 4) · ❔ Criteria not finalized

Profile settings: display name and currency.

| ID | Criterion | Status |
|---|---|---|
| ACC-5.1 | A user sets their display name. | ❔ Draft |
| ACC-5.2 | A user chooses their currency, from the currencies that have two decimal places. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| ACC-5.3 | Changing the currency converts no amounts. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| ACC-5.4 | A new workspace, a guest's included, starts with a default currency. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |

## ACC-6

🎯 [MVP] · ❔ Draft (0 of 3) · ❔ Criteria not finalized

Delete the account with all its data, after confirming with the current password. Lists it shared disappear for collaborators.

| ID | Criterion | Status |
|---|---|---|
| ACC-6.1 | A user deletes their account after confirming with their current password; a confirmation without it is refused. | ❔ Draft · [OP-055](https://github.com/luiki-dev/szop/issues/109) |
| ACC-6.2 | Deleting the account removes all of its data. | ❔ Draft |
| ACC-6.3 | Lists the account shared disappear for their collaborators. | ❔ Draft |

## ACC-7

🎯 [MVP] · ❔ Draft (0 of 2) · ❔ Criteria not finalized

Anonymous (guest) workspaces are deleted automatically:

- after **3 days**, if they had no activity later than 1 hour after being created (used only briefly);
- otherwise after **30 days** of inactivity.

| ID | Criterion | Status |
|---|---|---|
| ACC-7.1 | A guest workspace with no activity later than 1 hour after its creation is deleted 3 days after its creation. | ❔ Draft · [OP-039](https://github.com/luiki-dev/szop/issues/98) |
| ACC-7.2 | Any other guest workspace is deleted after 30 days without activity. | ❔ Draft |

## ACC-8

🎯 [MVP] · ❔ Draft (0 of 1) · ❔ Criteria not finalized

Registered accounts whose email is not verified within **7 days** are deleted automatically.

| ID | Criterion | Status |
|---|---|---|
| ACC-8.1 | A registered account whose email address is not verified within 7 days of registering is deleted, with its data. | ❔ Draft |
