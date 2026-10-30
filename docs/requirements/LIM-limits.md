# Limits (LIM)

The quotas, text lengths and rate limits that protect the service. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

All values below are configurable defaults, adjustable without code changes. They are the same for guests and registered users.

## LIM-1

🎯 [MVP] · ❔ Draft (0 of 8) · ❔ Criteria not finalized

Workspace quotas:

| What | Limit |
|---|---|
| Lists (active and archived together) | 200 |
| Items per list or template | 500 |
| Templates | 100 |
| Catalog products | 2,000 |
| Categories | 300, at most 5 levels deep |
| Units | 50 |

| ID | Criterion | Status |
|---|---|---|
| LIM-1.1 | A workspace holds at most 200 lists, active and archived together. | ❔ Draft |
| LIM-1.2 | A list or a template holds at most 500 items. | ❔ Draft |
| LIM-1.3 | A workspace holds at most 100 templates. | ❔ Draft |
| LIM-1.4 | A workspace's catalog holds at most 2,000 products. | ❔ Draft |
| LIM-1.5 | A workspace holds at most 300 categories, nested at most 5 levels deep; a new category or a move that would nest deeper is refused. | ❔ Draft · [OP-041](https://github.com/luiki-dev/szop/issues/100) |
| LIM-1.6 | A workspace holds at most 50 units. | ❔ Draft |
| LIM-1.7 | The limits are the same for guests and registered users. | ❔ Draft |
| LIM-1.8 | An action that adds several things at once (an import, a duplicate, adding from the catalog, a list from a template) and would pass a quota adds nothing. | ❔ Draft · [OP-047](https://github.com/luiki-dev/szop/issues/111) |

## LIM-2

🎯 [MVP] · 🚧 In progress (0 of 2) · ❔ Criteria not finalized

Text lengths: names (list, item, product, category, template, unit) at most 100 characters; item notes at most 500 characters. Forms enforce the same limits.

| ID | Criterion | Status |
|---|---|---|
| LIM-2.1 | A list, item, product, category, template or unit name is at most 100 characters; an item's note is at most 500. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) (list names) |
| LIM-2.2 | A form refuses a text over its limit before sending it, with the same limit the API applies. | 🚧 [PH-16a](../roadmap.md#ph-16a-guests-first-list) (list names) |

## LIM-3

🎯 [MVP] · ❔ Draft (0 of 2) · ❔ Criteria not finalized

When a quota is reached, the app explains which limit was hit and how to make room (for example "You've reached the limit of 200 lists, archived ones included. Delete some to make room").

| ID | Criterion | Status |
|---|---|---|
| LIM-3.1 | When a quota is reached, the message names the limit and says how to make room, such as "You've reached the limit of 200 lists, archived ones included. Delete some to make room". | ❔ Draft |
| LIM-3.2 | The API answers a request that would pass a quota with 409 and the code `quota_exceeded`. | ❔ Draft |

## LIM-4

🎯 [MVP] · ❔ Draft (0 of 10) · ❔ Criteria not finalized

Rate limits protect the service from abuse:

| What | Limit |
|---|---|
| Creating anonymous guests | 10 per hour per IP address |
| Registrations | 5 per hour per IP address, and 3 per hour per email address registered |
| Login attempts | 10 per 15 minutes per IP address; 10 failed attempts per 15 minutes per email address |
| Password-reset and verification-resend requests | 5 per hour per IP address, and 3 per hour per email address |
| Requests without a session | 300 per minute per IP address |
| All other API requests | 300 per minute per session |
| Emails sent, in total | a daily cap, set below the email service's sending quota |

IPv6 addresses are grouped by their /64 block. When a limit is hit, the app asks the user to wait and try again. The per-email limits and the daily email cap are the exception: registration, reset and resend requests then answer as usual and send no email, so the answer never reveals anything about the address ([ACC-2](ACC-accounts-and-guest-mode.md#acc-2), [ACC-3](ACC-accounts-and-guest-mode.md#acc-3)).

| ID | Criterion | Status |
|---|---|---|
| LIM-4.1 | At most 10 guests an hour are created from one IP address. | ❔ Draft |
| LIM-4.2 | At most 5 registrations an hour come from one IP address, and at most 3 an hour for one email address. | ❔ Draft |
| LIM-4.3 | At most 10 login attempts every 15 minutes come from one IP address, and at most 10 failed attempts every 15 minutes for one email address. | ❔ Draft |
| LIM-4.4 | At most 5 password-reset and verification-resend requests an hour come from one IP address, and at most 3 an hour for one email address. | ❔ Draft |
| LIM-4.5 | At most 300 requests a minute without a session come from one IP address, and at most 300 a minute come from one session. | ❔ Draft |
| LIM-4.6 | The service sends at most a daily number of emails in total, set below the email service's sending quota. | ❔ Draft |
| LIM-4.7 | IPv6 addresses count by their /64 block. | ❔ Draft |
| LIM-4.8 | A request over a limit gets 429, and the app asks the user to wait and try again. | ❔ Draft |
| LIM-4.9 | When a per-email limit or the daily email cap is reached, registration, reset and resend answer as usual and send no email. | ❔ Draft |
| LIM-4.10 | A limit holds across all of the service's running instances, not per instance. | ❔ Draft |
