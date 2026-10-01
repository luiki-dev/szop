# Szop — Threat model

What Szop protects, who can act on it and through which path, and what guards each way in. The rules themselves, and why they were chosen, are in [ADR 0012](../decisions/0012-security-baseline.md); this page shows whom each rule stops. Acronyms are explained in the [glossary](../glossary.md).

**Keeping it current:** every phase that adds an actor or an entry point (share links, the WebSocket, a new workflow, a new AWS role) updates this page, as part of the definition of done's "living docs" item.

**A visitor becomes a user in steps** (ACC-1, ACC-2): a **visitor without a session** has nothing stored and sees the seed data; their first change gives them an **anonymous session** and a workspace, which makes them a **guest**; registering turns the guest into a **registered user**. Guests and registered users both hold a session cookie and a workspace, so they appear together below as **users with a session**.

## Contents

- [What we protect](#what-we-protect)
- [Who can act, and through which path](#who-can-act-and-through-which-path)
- [Entry points, checked against STRIDE](#entry-points-checked-against-stride)
- [Risks accepted on purpose](#risks-accepted-on-purpose)

## What we protect

- **Users' data and accounts:** lists, templates, catalogs, email addresses, password hashes, sessions.
- **The app's secrets:** the Better Auth secret and the database password.
- **The AWS account and its bill.**
- **The integrity of the repository:** `main`, version tags, the images built from them.
- **The email sender's reputation** in SES, and its daily sending quota.

## Who can act, and through which path

| Actor | Path in | Can reach | Guarded by |
|---|---|---|---|
| **Visitor without a session** | `/api/*`, `/api/auth/*` | the seed data; creating a guest; registering, logging in, resetting a password | lazy creation and per-IP limits ([ADR 0003](../decisions/0003-abuse-protection.md)); limits per target email and the daily email cap (ADR 0012, decision 14); never revealing which accounts exist (decision 12) |
| **User with a session** (guest or registered) | `/api/*` with their own session cookie | their own workspace only | the access layer and scoped repositories (decisions 3–5); composite foreign keys (decision 6); quotas and per-session limits (ADR 0003) |
| **Collaborator or share-link holder** (later, SHR) | `/api/lists/:listId/*` | one list, within their role | `requireListAccess` with roles (decision 4) |
| **Malicious website** open in the user's browser | the user's cookies, frames, the `Referer` header | requests sent in the user's name, the app shown inside its page | `SameSite=Lax`, the `Sec-Fetch-Site` or `Origin` check and JSON-only bodies (decision 7); `frame-ancestors 'none'` and `no-referrer` (decision 8) |
| **Network attacker** | between the browser and the load balancer | a session sent over plain HTTP | HTTPS only, with HTTP redirected ([ADR 0008](../decisions/0008-hosting.md)); HSTS and the `Secure` cookie (decisions 7 and 8) |
| **Reader of leaked data** | a database dump, CloudWatch Logs | tokens, secrets, password hashes | hashed tokens and share links; tokens stripped from logs (decision 9); secrets redacted and never in Terraform state (ADR 0008); scrypt password hashes |
| **Owner** | AWS IAM Identity Center, GitHub admin | everything | the guardrails catch mistakes: rulesets ([ADR 0009](../decisions/0009-git-workflow.md)), the deploy approval (decision 16), budget alerts and the nightly teardown ([ADR 0010](../decisions/0010-ci-cd.md)) |
| **Claude Code**, with the owner's credentials | `git push`, `gh` on the owner's machine | branches and PRs; anything the owner's credentials allow | `CLAUDE.md`, backed by deny rules (decision 19); the rulesets: no direct pushes to `main`, no moved tags (ADR 0009); the reviewer on `demo` (decision 16) |
| **Compromised dependency** | install scripts and code on the owner's machine, in CI runners, in the running app | the owner's credentials, CI tokens, the app's secrets | pnpm's install-script allowlist; no installs in jobs holding AWS credentials (decision 18); the reviewer on `demo` (decision 16); the Dependabot cooldown (ADR 0010) |
| **Dependabot** | PRs | a malicious update reaching `main` | the 7-day cooldown, CI, and the owner's review (ADR 0010) |
| **Contributor from a fork** | PRs from a fork | nothing beyond the PR itself | fork PRs get no secrets and no OIDC token; the owner's review (ADR 0010) |

## Entry points, checked against STRIDE

STRIDE names six kinds of threat: **S**poofing (pretending to be someone else), **T**ampering (changing data one should not), **R**epudiation (denying having done something, with no record to prove it), **I**nformation disclosure (seeing data one should not), **D**enial of service (making the service unavailable) and **E**levation of privilege (gaining rights one should not have). Each entry point is checked once against all six; "—" means the category does not apply there. Decisions without an ADR number are ADR 0012's.

| Entry point | Spoofing | Tampering | Repudiation | Information disclosure | Denial of service | Elevation of privilege |
|---|---|---|---|---|---|---|
| **REST API** `/api/*` | session cookie (decision 7) | Zod validation; every ID resolved in the workspace (decisions 3–6); CSRF checks (decision 7) | request log, 7 days | 404 for "not found" and "not allowed" (ADR 0002); responses serialized through their schemas | rate limits, quotas, the 1 MB body limit (ADR 0003, decision 14) | the access layer (decision 4) |
| **Auth** `/api/auth/*` | password policy and breach check (decision 11); per-email login limit (decision 14) | Better Auth's origin check with exact `trustedOrigins` (decision 7) | request log | never revealing accounts (decision 12); tokens stripped from logs (decision 9) | per-IP and per-email limits; the daily email cap (decision 14) | other sessions revoked on a password change; password required for deletion; no session cookie cache (decision 10) |
| **SPA files**, served by the API | HTTPS and HSTS (decision 8) | images built only by CI, from a known commit (ADR 0010) | — | no secrets in the bundle; configuration stays on the server | the load balancer and AWS Shield Standard (ADR 0008) | the CSP: no inline scripts, `frame-ancestors 'none'` (decision 8) |
| **Links in emails** (verification, reset; later share links) | DKIM signing (ADR 0008; DMARC and SPF in OP-044) | random tokens, stored hashed | — | single-use, expiring, stripped from logs, `no-referrer`, removed from the address bar (decision 9) | limits on email-sending endpoints; the daily cap (decision 14) | — |
| **WebSocket** `/api/ws` (later, SYN) | session cookie; `Origin` checked on connect (decision 7) | changes go through the REST API only | — | access checked on subscribe; re-checking it while connected is OP-045 | — | `requireListAccess` (decision 4) |
| **Pushes and PRs** | the owner's GitHub account; Claude Code acts with it | rulesets: `main` only through PRs, no force pushes, tags created only by the release App (ADR 0009; ADR 0011, decision 8) | git history and the PR record | secret scanning push protection (ADR 0009) | — | only the owner merges (ADR 0009); deny rules (decision 19) |
| **Workflows** (GitHub Actions) | OIDC tokens certify the environment or PR (ADR 0010) | actions pinned by commit hash; Dependabot cooldown (ADR 0010) | run logs; AWS session names carry the run ID (ADR 0010) | the plan role reads no secrets and no logs (decision 17); job logs are public | — | `id-token: write` per job, no installs next to AWS credentials (decision 18); the reviewer on `demo`, `demo-teardown` only from `main` (decision 16) |
| **AWS roles assumed from CI** | trust policies per environment or PR event (ADR 0010; decision 16) | the deploy role cannot change `infra/base` (ADR 0010) | CloudTrail's 90-day event history | denies on secret values and log contents (ADR 0010; decision 17) | budget alerts; the nightly teardown (ADR 0008, ADR 0010) | CI never creates or edits IAM; `iam:PassRole` only for the app's two roles (ADR 0010) |
| **Owner's AWS access** | IAM Identity Center with MFA; the root user locked away with MFA (OP-003) | — | CloudTrail's 90-day event history | — | budget alerts (ADR 0008) | — |
| **CloudWatch Logs** | — | — | — | secrets redacted; tokens stripped (decision 9); 7-day retention; the plan role cannot read them (decision 17) | — | — |

## Risks accepted on purpose

- **No audit trail of user actions.** The request log keeps 7 days of requests, not who changed what; that is enough for a demo.
- **A per-email login limit can lock a victim out** for 15 minutes at a time; the victim can still reset the password (decision 14).
- **The breach check fails open** when its service cannot be reached, so an outside outage never blocks registration (decision 11).
- **Rate-limit counters live in memory** and reset when the container restarts (decision 15).
- **`terraform plan` can run arbitrary code** with the plan role, which is read-only and reads neither secrets nor logs (decision 17).
- **Claude Code's deny rules can be worked around** by a command written in another form; they catch mistakes, while the rulesets and the deploy approval are the real boundaries (decision 19).
