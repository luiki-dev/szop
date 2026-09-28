# ADR 0003 — Abuse protection: lazy guest workspaces, rate limits and quotas

- **Status:** Accepted — infrastructure-level protection decided in [ADR 0008](0008-hosting.md)
- **Date:** 2026-09-27
- **Refines:** decision 8 of [ADR 0002](0002-technical-architecture.md) (anonymous server-side guests)

## Context

ADR 0002 moved guest workspaces to the server: any request without a session created an anonymous user, a session and a workspace copied from the seed data (hundreds of rows). That made the application vulnerable to **resource exhaustion**, an application-level form of denial of service (DoS):

- **Free for an attacker:** a script that never sends cookies creates a workspace on every request, with no sign-up in the way.
- **Amplified:** one tiny request causes hundreds of row writes.
- **Persistent:** the rows stay until cleanup (30 days), so the damage accumulates.

Even without an attacker, search engine crawlers, uptime monitors and link previews (a messenger fetching a pasted share link) keep no cookies and would each create an unused workspace.

Volumetric DoS (floods of traffic) cannot be solved in the application and is out of scope here; it belongs to the deployment decisions.

## Decisions

| # | Topic | Options considered | Decision and reasoning |
|---|-------|--------------------|------------------------|
| 1 | When a guest workspace is created | On the first request; on the first change | **On the first change (lazy creation).** Read requests without a session get the in-memory seed data and empty lists. Visits that change nothing cost nothing. This removes most of the problem on its own. |
| 2 | Rate limiting | None; per IP address; per session; bot challenge | **Per IP address for anonymous-session creation (10/hour) and registration (5/hour); per IP address and email for logins (10/15 min, Better Auth built-in); per session for everything else (300/min).** IPv6 keyed by /64 block. Per-IP limits are imprecise behind shared addresses (offices, mobile networks), but with lazy creation a real person hits them at most once per browser. A bot challenge (Cloudflare Turnstile or similar) adds friction for real users, so it is kept as an escalation option only. |
| 3 | Workspace quotas | None; same for everyone; lower for guests | **Same quotas for everyone** (LIM-1): 200 lists, 500 items per list or template, 100 templates, 2,000 products, 300 categories up to 5 levels, 50 units; text length limits (LIM-2). Lower guest quotas would cut abuse slightly and nudge registration, but add a rule and risk annoying guests. |
| 4 | Guest workspace lifetime | One 30-day rule; tiered | **Tiered** (ACC-7): 3 days for workspaces used only within the first hour after creation, 30 days of inactivity otherwise. Cheap to implement; limits what a rate-limited script can accumulate. |
| 5 | Unverified registrations | Keep; delete after a period | **Delete after 7 days** (ACC-8). Same weakness as guests at a smaller scale. |
| 6 | Where limits live | Constants in code; configuration | **Configuration with defaults**, so they can be tuned without code changes. |
| 7 | Error responses | — | **429** for rate limits; **409** with code `quota_exceeded` for quotas. The app shows a clear message for both. |

## Consequences

- Requirements: ACC-1 (lazy creation), ACC-7 (tiered cleanup) and UC-1 updated; ACC-8 and the Limits area (LIM-1 to LIM-4) added.
- The API must serve seed data without a session, and the frontend must create the anonymous session transparently on the first change.
- Each workspace tracks `last_active_at`, updated at most once an hour.
- Infrastructure-level protection is a required topic for the deployment step.
