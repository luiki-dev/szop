# Limits (LIM)

The quotas, text lengths and rate limits that protect the service. Part of the [functional requirements](functional-requirements.md), which explain how requirements and their criteria are written and show the status of every requirement.

All values below are configurable defaults, adjustable without code changes. They are the same for guests and registered users.

## LIM-1

🎯 [MVP] Workspace quotas:

| What | Limit |
|---|---|
| Lists (active and archived together) | 200 |
| Items per list or template | 500 |
| Templates | 100 |
| Catalog products | 2,000 |
| Categories | 300, at most 5 levels deep |
| Units | 50 |

## LIM-2

🎯 [MVP] Text lengths: names (list, item, product, category, template, unit) at most 100 characters; item notes at most 500 characters. Forms enforce the same limits.

## LIM-3

🎯 [MVP] When a quota is reached, the app explains which limit was hit and how to make room (for example "You've reached the limit of 200 lists, archived ones included. Delete some to make room").

## LIM-4

🎯 [MVP] Rate limits protect the service from abuse:

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
