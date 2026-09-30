# Design sanity check — 2026-09-29

A review of everything designed so far, done before the visual design topic and the roadmap. It treats the concepts from the brainstorming sessions the way a code review treats code: it looks for contradictions, wrong assumptions, security risks and gaps.

This is a point-in-time report, not a living document. It changes nothing by itself. Each finding still has to be accepted, rejected or deferred by the owner, and most accepted ones become a requirement change, an ADR or a roadmap task (see [What to do with this](#what-to-do-with-this)).

**Resolution markers.** The owner's triage of the findings is recorded in [ADR 0011](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings). Each finding gets a marker added under it, linking there: ✅ fixed, ⏳ deferred (with its open point in [open-points.md](../open-points.md)) or ✖️ rejected. The markers are the only later change; the findings' text stays as it was on 2026-09-29.

## Scope and method

**Reviewed:**
- `README.md`, `CLAUDE.md` and `.github/pull_request_template.md`
- the functional requirements, `architecture.md`, `stack-overview.md` and the glossary
- `git-workflow.md` and `github-settings.md`
- ADRs 0001–0010
- the live GitHub repository settings

No application code exists yet.

**How:**

1. **One full read.** Every document, in full, by the main reviewer.
2. **Four parallel reviewers, each with one lens:**
   - security, privacy and operations
   - cross-document consistency (contradictions, links, requirement IDs, acronyms)
   - functional and technical design soundness
   - process, workflow and CI/CD feasibility, including a read-only comparison of `github-settings.md` with the real repository using `gh`
3. **Verification.** Every finding was checked against the quoted text. Duplicates were merged, and claims about third-party behaviour were checked where it mattered. Each finding is marked:
   - **verified** — checked against upstream documentation or the live repository
   - **inferred** — based on known behaviour of a library or platform, not tested here; check it in the phase that builds the feature

**What came back clean:**
- Every relative link and `#anchor` in the docs resolves.
- Every requirement ID is defined exactly once, and every referenced ID exists.
- MVP and Later tags match the release slicing.
- The GitHub settings listed in `github-settings.md` match the live repository, apart from two gaps (m7, m8).

### Severity scale

| Severity | Meaning |
|---|---|
| **CRITICAL** | Blocks a planned step as written, or leaves a security hole in a core rule. Settle it before the roadmap or before the phase it affects. |
| **MAJOR** | Causes wrong behaviour, data loss or significant rework if built as written. Settle it in or before the phase that builds the area. |
| **MINOR** | A real inconsistency or gap with a local, cheap fix. |
| **CONSIDER IMPROVING** | Not wrong, but worth a deliberate decision. |

Severity is judged against the design **as written**. The requirements and ADR 0003 describe a public, multi-user app, while the only deployment is an ephemeral demo (ADR 0008). So the real-world impact today is often smaller than the label suggests. MAJOR-1 is about exactly that gap.

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 2 |
| MAJOR | 13 |
| MINOR | 24 |
| CONSIDER IMPROVING | 14 |

**The five to look at first:**

1. **CRITICAL-1.** The access-control rule scopes the record being written, not the records it points to. That is a data leak between workspaces.
2. **CRITICAL-2.** The phase that introduces the demo workflows cannot meet its own definition of done, and cannot have the teardown safety net ADR 0008 requires.
3. **MAJOR-2.** Moving guest data into an account does not match how Better Auth's anonymous plugin links users. The ACC-4 "import or discard" choice would have nothing left to import.
4. **MAJOR-4.** Per-IP rate limits behind the load balancer either lock out everyone or can be bypassed, depending on a setting no document mentions.
5. **MAJOR-10.** release-please with merge commits duplicates changelog entries, and release-please itself recommends squash merges.

### What the design does notably well

- **Abuse and access control were thought through at design time.** Guest workspaces are created lazily. Quotas and rate limits are configurable. "Not found" and "no access" both return 404. Share tokens are stored hashed. Every query is scoped by the session.
- **The CI/CD supply chain is set up with care:**
  - OpenID Connect (OIDC) only, with no stored AWS keys
  - least-privilege roles, and CI never edits IAM
  - actions pinned to a commit SHA, enforced by setting
  - `permissions: {}` in every workflow, and no `pull_request_target`
  - zizmor, actionlint and CodeQL
  - a Dependabot cooldown
  - a GitHub App instead of a personal token
- **Costs are guarded twice.** The nightly teardown re-enables itself, and budget alerts sit behind it.
- **Decisions leave a clear trail.** ADRs are linked both ways, alternatives are recorded, and supersession is explicit.
- **The testing strategy fits the architecture.** Most tests run against a real PostgreSQL, fakes come in through `buildApp(deps)`, and time-based rules are tested with a controllable clock.

---

## CRITICAL

### CRITICAL-1. IDs the browser sends for related records are not checked against the workspace

> ⏳ **Deferred** to the security baseline foundation topic ([ADR 0011, decision 6](../decisions/0011-design-sanity-check-follow-ups.md#decisions)): [OP-034](../open-points.md#security-baseline-topic). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **Where:** `architecture.md`, Access control: "Services always scope queries by the workspace ID taken from the **session**, never by an ID sent by the browser." ADR 0002, decision 16.
- **Problem:** The rule protects the record being written, not the records it points to. Many writes carry other records' IDs:
  - `category_id` on items and products (ITM-1, PRD-1)
  - the new parent in a category move (CAT-1)
  - product IDs in the catalog multi-add (ITM-5)
  - the template ID in "new list from template" (TPL-3)
  - a unit
  - later, the owner's category chosen by an editor (SHR-5)

  An item saved in my workspace with *your* `category_id` passes the scoped update. It then shows your category's name through a join, and CAT-3's delete cascade reaches across workspaces. This is the classic "insecure direct object reference" hole, one level removed.
- **Suggested fix:**
  - Extend the rule: *every* ID in a request is resolved within the session's workspace (or, with sharing, within the list owner's workspace).
  - Back it in the schema where possible, with composite foreign keys on `(workspace_id, id)` so the database rejects cross-workspace references.
  - Add an API test pattern: "a reference into another workspace returns 404".
  - Record it in `architecture.md` and ADR 0002's successor.

### CRITICAL-2. The demo workflows can't be used before they are merged, which breaks the definition of done and the safety-net ordering

> ✅ **Fixed** in [ADR 0011, decision 2](../decisions/0011-design-sanity-check-follow-ups.md#decisions) ([triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings)); the phase order is tracked as [OP-004](../open-points.md#before-the-roadmap).

- **Where:**
  - ADR 0008, decision 26: the teardown safety net and budget alerts "come before the walking skeleton, so no demo runs without it".
  - ADR 0008, consequences: "The walking skeleton phase writes the Terraform code for all three groups".
  - ADR 0010, decision 23: "`demo-down` is merged before or together with the first `demo-up`".
  - ADR 0010, decision 2: the definition-of-done check "becomes one click on the phase's branch".
  - ADR 0009, decision 8: a phase PR is merged once the demo check has run from the branch's image.
- **Problem (verified):** GitHub runs `workflow_dispatch` and `schedule` workflows only when the file exists on the default branch. As a result:
  - The phase that adds `demo-up.yml` and `demo-down.yml` cannot press its own button before merging.
  - "Merged together with" gives no nightly protection during that phase's pre-merge demo check.
  - The net destroys `infra/demo` using a deploy role and an OIDC provider from `infra/base`. All of that is written *in* the walking skeleton, so it cannot exist "before the walking skeleton".

  As written, the only way to pass that phase's definition of done is a local `terraform apply` with no safety net, which ADR 0008 forbids.
- **Suggested fix:**
  - Record an explicit bootstrap exception, in the roadmap or a small ADR. The phase that introduces the deploy workflows is done when `demo-down` is merged and one run of it has been seen working. Its first `demo-up` check happens right after the merge, from `main`.
  - Change "before or together with" to "before".
  - State whether a local-Terraform demo is ever allowed before the net exists. If it is, require it to be destroyed in the same session.
  - Note the refinement in ADR 0008's status line: today it says only that the net was "answered by ADR 0010".

---

## MAJOR

### MAJOR-1. The docs describe two different products: a persistent public service and a disposable demo

> ✅ **Fixed** in [ADR 0011, decision 5](../decisions/0011-design-sanity-check-follow-ups.md#decisions): the README's privacy sentence and a new assumption in the requirements. ⏳ **Deferred:** the always-on checklist ([OP-033](../open-points.md#unassigned)). ✖️ **Rejected:** the demo banner. See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **Where:**
  - README: "your lists, catalog and categories come with you to every device" and "everything stays in your browser".
  - Functional requirements: ACC-6 to ACC-8 and LIM-1 to LIM-4.
  - ADR 0003.
  - ADR 0008, decisions 1 and 9: the environment is "created for a session, destroyed afterwards, starting each time with an empty database", and "Data loss is acceptable".
- **Problem:**
  - Much of the MVP guards a long-lived public service: the 30-day and 3-day guest cleanup, deleting unverified accounts after 7 days, per-IP limits sized for the internet. No environment will ever exercise any of it.
  - The README makes promises the only deployment breaks.
  - "Everything stays in your browser" is false since ADR 0002 moved guest workspaces to the server. It is a user-facing privacy statement that is wrong (verified: README line 16 against the Guest actor in the functional requirements).

  Building these features is still worth it for learning. But nothing says so, and nothing says what must change before the app ever goes always-on.
- **Suggested fix:**
  - Fix the README sentence ("kept on our server and tied to this browser").
  - Add one assumption to the functional requirements: requirements describe the product as if it ran as a public service; the only deployment today is the disposable demo of ADR 0008.
  - Consider a short "going always-on" checklist in the future runbook, collecting everything ADR 0008 decision 32 defers:
    - backups
    - a web application firewall (WAF)
    - alarms
    - leaving the SES sandbox
    - a privacy notice
    - a storage alarm
  - Consider a "demo data is wiped" banner on the demo.

### MAJOR-2. Moving a guest into an account doesn't fit how Better Auth's anonymous plugin links users

> ⏳ **Deferred** to the phase delivering ACC-2 and ACC-4, after a Better Auth spike: [OP-038](../open-points.md#feature-phases). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **Where:** `architecture.md`, Anonymous guests: "When an anonymous user registers or logs in, Better Auth links them to the registered account. In that step the server either reassigns … or imports … or discards them, according to the user's choice (ACC-4)." ACC-2, ACC-4, ACC-8, UC-8 and UC-9.
- **Problem:**
  - **(a) The anonymous user is deleted during sign-in.** Verified in the Better Auth anonymous plugin documentation: linking happens server-side inside the sign-in or sign-up request, the `onLinkAccount` callback runs then, and "the `anonymousUser` will be deleted by default". The ACC-4 choice is made in the UI *after* login. By then the anonymous user, and by cascade the guest workspace, is already gone.
  - **(b) Where workspaces are created is unclear (inferred).** If a workspace is created whenever a user is created, sign-up creates a second seed workspace for the new account. That breaks "exactly one workspace" before the reassignment runs.
  - **(c) Verification may break the handover (inferred).** With email verification required, sign-up may return no session, and the verification link is often opened in a different browser, such as a phone mail app's in-app browser. It is undefined which browser completes the merge.
  - **(d) Registering can shorten a guest's data life.** A guest who registers but doesn't verify loses their former guest data after 7 days under ACC-8, even with daily use. As a guest it would have lasted 30 days of inactivity.
  - **(e) The unverified state is undefined.** Can the user log in? Can they correct a mistyped email? Can someone register a stranger's email and block it for 7 days?
- **Suggested fix:**
  - Run a short spike on Better Auth before the ACC phase: `onLinkAccount`, `disableDeleteAnonymousUser`, and how linking interacts with `requireEmailVerification`.
  - Keep the anonymous user and workspace until the ACC-4 choice is made, or ask the question *before* signing in. The client knows whether the guest has data.
  - Create workspaces explicitly, not in a user-creation hook.
  - Write down what an unverified user can do, and which browser completes the merge.

### MAJOR-3. Guest data lifetime doesn't match how guests use a shopping list

> ⏳ **Deferred:** the session lifetime to the phase delivering ACC-1, the retention rule to the phase delivering ACC-7: [OP-039](../open-points.md#feature-phases). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **Where:** ACC-7 ("after **3 days**, if they had no activity later than 1 hour after being created"; "otherwise after **30 days** of inactivity"). The Guest actor ("tied to their browser by a session cookie"). No document sets a session lifetime.
- **Problem:**
  - **Sessions expire first.** Verified: Better Auth sessions expire after 7 days by default and are extended once a day while used. A guest who comes back after 10 days has a dead cookie. Their workspace still exists but can never be reached again, and their next change quietly creates a brand-new one. The 30-day promise is really 7 days.
  - **The 3-day rule catches normal use.** "Plan now, shop later" is the normal shopping-list pattern. A guest builds "Weekly groceries" on Monday evening in one 20-minute sitting (UC-1, UC-2) and opens it in the store on Friday (UC-3). The workspace was deleted on Thursday. The rule meant for "used only briefly" hits exactly this user.
  - **Nothing says what a returning guest sees** when their workspace is gone.
- **Suggested fix:**
  - Set the session lifetime explicitly, per user type if needed, and record it next to ACC-7. The anonymous session must outlive the retention window.
  - Refine the 3-day rule, for example: keep the workspace if any list has items, or lengthen the window to 7–14 days.
  - Tell guests how long their data lasts ("Register to keep this list").
  - Add API tests that move the clock past the session expiry.

### MAJOR-4. The per-IP rate limits depend on a client-IP setting no document mentions

> ⏳ **Deferred** to the security baseline foundation topic ([ADR 0011, decision 6](../decisions/0011-design-sanity-check-follow-ups.md#decisions)): [OP-035](../open-points.md#security-baseline-topic). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **Where:** LIM-4 ("per IP address"). `architecture.md`, Abuse protection: "`@fastify/rate-limit` … Login attempts use Better Auth's built-in rate limiting, per IP address and per email address". ADR 0008, decisions 16 and 18: an Application Load Balancer (ALB) sits in front of the task. No document mentions `trustProxy` or `X-Forwarded-For`.
- **Problem:**
  - **Without `trustProxy`, everyone shares one bucket (inferred).** Fastify sees every request as coming from the load balancer. The 11th guest per hour and the 6th registration per hour are then refused *for the whole internet*.
  - **With `trustProxy: true`, the limits can be bypassed (inferred).** That value is the usual copy-paste, and it makes `request.ip` the leftmost `X-Forwarded-For` entry, which the client controls. A script sends a random value each time and bypasses the limits.
  - **Better Auth reads the IP separately.** Verified: its limiter reads `x-forwarded-for` through its own `ipAddressHeaders` setting, so the two limiters can disagree.
  - **"Per email address" is not built in.** Verified: Better Auth's built-in limiter "uses the connecting IP address" (plus path rules). The per-email login limit needs custom code.
  - **Email-sending endpoints have no row in LIM-4.** "Forgot password" and "resend verification" run without a session, so the "300 per minute per session" rule doesn't cover them. A script can flood a stranger's inbox, or use up the SES sandbox's 200 emails a day in the middle of a demo.
  - **Requests without a session have no limit at all.** They are cheap (served from memory), but that should be a stated choice.
- **Suggested fix:**
  - Record the rule: trust exactly one proxy hop in AWS and none locally, and configure Better Auth's IP header to match.
  - Implement the per-email login limit.
  - Add LIM-4 rows for password-reset and verification-resend requests, per IP and per target email. These endpoints always answer with the same generic success.
  - `inject()`-based tests can't catch a proxy misconfiguration, so add a test that sends a spoofed `X-Forwarded-For`.

### MAJOR-5. The web security baseline is not decided

> ⏳ **Deferred** to the security baseline foundation topic ([ADR 0011, decision 6](../decisions/0011-design-sanity-check-follow-ups.md#decisions)): [OP-036](../open-points.md#security-baseline-topic). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

No document mentions cross-site request forgery (CSRF), Origin checks, security headers, session revocation or account enumeration (verified by searching all the docs).

- **Cookies and CSRF:**
  - ADR 0002 decision 7 lists "`HttpOnly`, `Secure`, `SameSite`" without a value.
  - `stack-overview.md` §10 says SameSite means "not sent on requests triggered by other sites". That is too strong: `Lax` still sends the cookie on cross-site top-level GET navigations, and "site" includes every sibling subdomain of the domain.
  - Better Auth's origin check covers only `/api/auth/*`, not the app's own REST routes.
  - **Decide:** `SameSite=Lax`, a `__Host-` cookie prefix, an Origin or `Sec-Fetch-Site` check on every unsafe method (and later on the WebSocket upgrade), JSON-only bodies on unsafe routes, and exact `trustedOrigins` in Better Auth. Fix the sentence in the stack overview.
- **Security headers:**
  - Nothing mentions HTTP Strict Transport Security (HSTS), a Content Security Policy (CSP), `frame-ancestors` or `Referrer-Policy`, although the API serves the SPA itself.
  - **Decide** a `@fastify/helmet` baseline.
- **Tokens in URLs:**
  - Verification, reset and (later) share-link tokens travel in URLs.
  - Fastify's default request log includes `req.url`, and CloudWatch keeps logs for 7 days (inferred). That undermines "tokens are stored hashed so a database leak does not hand out working links".
  - **Decide:** a log serializer that strips tokens, `Referrer-Policy: no-referrer`, and removing the token from the address bar once it is used.
- **Sessions and account actions:**
  - Changing or resetting a password should revoke other sessions. Verified: Better Auth supports `revokeOtherSessions`, but it is not on by default.
  - ACC-6 deletion "after confirmation" should require the password or a recent login, not only a dialog.
  - Decide whether registration and (later) SHR-1 invitations may reveal which emails are registered. The design already hides which lists exist, but not which accounts exist.
- **Suggested fix:** Brainstorm this as one topic, before the walking skeleton builds the first endpoint, and record the result in an ADR. It could be a small "security baseline" foundation topic. ADR 0004's list has no home for it today.

### MAJOR-6. Flaky connectivity in the store is underspecified, and a library default contradicts the decision

> ⏳ **Deferred** to the phases that build the first changes from the SPA and NET-1; client-generated IDs to the first data phase; offline check-off to the roadmap brainstorm: [OP-040](../open-points.md#feature-phases). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **Where:**
  - README: "built for the phone in your hand in the store".
  - NET-1: "blocks changes rather than silently losing them".
  - ADR 0002, decision 19: "Block".
  - `architecture.md`: "Optimistic updates" and "Offline (NET-1)" ("Changes are blocked, not queued").
- **Problem:**
  - **An accidental queue (inferred).** TanStack Query's default `networkMode: 'online'` *pauses* mutations while offline and runs them on reconnect. That quietly contradicts "blocked, not queued".
  - **Weak signal looks online.** `navigator.onLine` reports "online" on a weak store signal. Without request timeouts, a check-off shows as done, hangs, and is rolled back minutes later, after the shopper has moved on.
  - **Lost responses cause duplicates.** If a POST's response is lost, the change is rolled back although the server applied it. The retry creates a duplicate item, because creates are not idempotent (safe to repeat).
  - **Optimistic adds need a temporary ID.** Checking or editing that item before the server answers targets an ID the server doesn't know.
  - **A product risk worth re-checking.** Weak signal in shops is common, and UC-3 is the core use case. "Offline check-off" is only a future extension.
- **Suggested fix:**
  - Set `networkMode` on purpose. Add request timeouts and a visible "not saved" state.
  - Make check and uncheck set an explicit value (`checked: true`) rather than toggle.
  - Use client-generated IDs (UUIDv7) so creates are idempotent. This also makes the future offline queue a small step instead of a redesign.
  - Add an E2E journey with the network cut or throttled. NET-1 has no use case today, so ADR 0007 decision 4 gives it no journey.
  - Consider moving "offline check-off" from future extensions to Later.

### MAJOR-7. Domain rules and the data model leave decisions open that shape the schema

> ⏳ **Deferred:** shared schema conventions to the first data phase, area rules to the phases building them: [OP-041](../open-points.md#feature-phases). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

These are cheap to decide now and expensive to change after migrations exist.

- **"Order added" isn't deterministic.** `architecture.md` derives ORD-5's order from a timestamp. PostgreSQL's `now()` is the *transaction start* time, so multi-add (ITM-5), duplicate (LST-4), list from template (TPL-3), save as template (LST-6) and the ACC-4 import all insert rows with identical timestamps. Their order is then random and can change between requests. Add a `position` or sequence tiebreaker; manual reordering, a future extension, needs one anyway.
- **Moving a category can create a cycle or break the depth limit.** Moving "Dairy" under its own child creates a cycle, which the depth-first flatten can't handle, on both server and client. Moving a 3-level subtree under a level-4 node reaches depth 7 while LIM-1 allows 5. Add a shared domain rule: no moves under a descendant, and parent depth plus subtree height must be 5 or less. Include moves in the fast-check property tests.
- **Money and quantity:**
  - Integer minor units times a decimal quantity gives fractions of a grosz (0.333 kg × 1299). Define the quantity precision, the rounding rule and where it applies (per line or on the sum).
  - node-postgres returns `numeric` as a string. Naive JavaScript arithmetic reintroduces floating-point errors, and client and server totals can differ.
  - Changing the currency reinterprets stored amounts: 12.50 PLN becomes 1,250 JPY. Offer only 2-decimal currencies, and state that a currency change converts nothing.
  - The default currency for guests is undefined.
- **Units.** "Items that already use a unit keep its label" (UNT-1) implies items copy the unit's label rather than reference it. The data model doesn't mention units at all. It is also undefined what happens to a product's default unit when that unit is deleted.
- **Text comparison.** Sorting (ORD-2), duplicate detection (ITM-4), search (PRD-2) and name matching (ACC-4, SHR-5) have no defined collation or normalization. JavaScript's `<`, `localeCompare` and PostgreSQL's collation order "Ł" and "ż" differently, so items jump when the server's answer replaces the optimistic sort. Category names aren't unique ("Other" under several parents), so matching by name is ambiguous. Put one collation and one normalization in `packages/shared`, and define how ties are broken.
- **Basics that aren't stated:**
  - the ID type
  - `created_at` and `timestamptz` everywhere (ACC-7 and ACC-8 depend on creation time)
  - uniqueness constraints
  - that CAT-3's "uncategorize" also covers `template_items`
- **Suggested fix:** Settle these in the brainstorm of the first data phase, and record them in `architecture.md`, "Data model highlights".

### MAJOR-8. The MVP's access-control shape will have to be rewritten for sharing

> ⏳ **Deferred** to the security baseline foundation topic, together with CRITICAL-1: [OP-042](../open-points.md#security-baseline-topic). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **Where:**
  - `architecture.md`: queries are scoped by "the workspace ID taken from the **session**", and `requireListAccess` arrives only "with sharing (Later)".
  - `stack-overview.md` §5: flat item routes (`PATCH /api/items/7`).
  - SHR-5: editors work in the **owner's** category tree.
- **Problem:** With sharing, item, list and category access is scoped by the *list owner's* workspace, not the session's. Every MVP query and route in these modules would change. Flat item URLs also need a join back to the list for every check.
- **Suggested fix:**
  - Build `requireListAccess(user, listId, role)` in the MVP, with only the owner role.
  - Consider nesting item routes under lists (`/api/lists/:listId/items/:id`).
  - Sharing then only adds roles.

### MAJOR-9. The single-instance guarantee doesn't hold during a redeploy, and branch redeploys can skip migrations

> ⏳ **Deferred** to the phase that builds the ECS service and migrations: [OP-043](../open-points.md#walking-skeleton); locking for several instances joins [OP-033](../open-points.md#unassigned). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **Where:**
  - ADR 0008, decision 14: "With exactly one instance nothing can race."
  - ADR 0010, decision 11: "Running it again with the demo up redeploys another commit".
  - ADR 0008, decision 15: the health check includes the database.
- **Problem:**
  - **Two tasks overlap (inferred).** ECS services default to a minimum of 100% healthy and a maximum of 200%. On a redeploy, the new task starts, and migrates the database, while the old one still serves traffic. For a while there are two cleanup timers and two event buses.
  - **Migrations can be silently skipped.** Deploying branch A (with a migration) and then branch B (whose migration has an earlier timestamp) can skip B's migration. Redeploying an older commit leaves old code on a newer schema. The definition-of-done check then passes or fails for the wrong reason.
  - **The health check can cause a restart loop.** Because it depends on the database, a database hiccup makes ECS kill the only task, which then restarts and re-runs migrations.
- **Suggested fix:**
  - Set the demo service to a minimum of 0% and a maximum of 100%; downtime during a redeploy is fine for a demo.
  - Document "redeploy forward only; to switch branches with different migrations, destroy and spin up again".
  - Show the latest applied migration in the `demo-up` summary.
  - Use a health check that covers only the process, plus a startup grace period.

### MAJOR-10. release-please doesn't work well with merge commits

> ⏳ **Deferred** to a trial in a throwaway repository before the phase that sets up release-please: [OP-025](../open-points.md#cicd-phase). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **Where:** ADR 0009, decisions 6, 11 and 14. ADR 0010, decisions 7 and 17. Verified live: the merge commit title is the PR title and its body is blank.
- **Problem:**
  - **Duplicate entries (verified).** release-please's README "highly recommends" squash merges. With merge commits, each phase adds its PR-title merge commit (`feat(lists): add shopping lists`) *and* every task commit (`feat(api): …`, `feat(web): …`). The changelog lists overlapping entries (release-please issue #2476).
  - **Noise.** Review-fix commits typed `fix(...)` show up as fixes for bugs that were never released.
  - **Nowhere for `Release-As`.** The `Release-As: 1.0.0` footer planned by ADR 0009 can't go into a merge commit whose body is blank.
  - **The PR-title check doesn't cover what lands.** The merge title can still be edited in GitHub's merge dialog.
- **Suggested fix:** Decide deliberately, ideally after a quick trial in a scratch repository, before the CI/CD phase. The options:
  - **Merge commits, default message.** Keep merge commits but go back to GitHub's default "Merge pull request #N" message, which release-please ignores. Then the task commits drive the changelog, and the PR-title check can go.
  - **Changelog sections.** Keep things as they are but use `changelog-sections` to hide noisy types, and accept some duplication.
  - **Squash.** Reconsider squash merges, and lose task-level `git bisect`.

  Also document how `1.0.0` is cut: an empty commit with the footer, merged through a PR.

### MAJOR-11. The `demo` environment is not the security boundary ADR 0010 says it is

> ⏳ **Deferred** to the security baseline foundation topic ([ADR 0011, decision 6](../decisions/0011-design-sanity-check-follow-ups.md#decisions)): [OP-037](../open-points.md#security-baseline-topic). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **Where:**
  - ADR 0010, decision 12: "The deploy role trusts only OIDC tokens from jobs in this environment, so no other workflow can assume it, even if edited", together with "Any branch may deploy" and "No required reviewer".
  - ADR 0010, decision 16 and the glossary ("trust only OIDC tokens from specific workflows").
  - `.claude/settings.local.json` allows `Bash(git push *)`.
- **Problem (inferred from how GitHub's OIDC subject works):** The token's subject is `repo:luiki-dev/szop:environment:demo`, whatever the workflow file or branch. Any job in any workflow on any branch that declares `environment: demo` gets the deploy role, without the button being pressed. That includes a new file with `on: push`, which runs as soon as its branch is pushed; "a branch without a PR runs nothing" is only true of `ci.yml`.

  Anyone who can push a branch can therefore:
  - create AWS resources
  - push images
  - pass the app's roles to a task definition that prints the injected secrets

  That covers Claude Code, a compromised development dependency, or a prompt-injected session. Related:
  - **The plan role reads too much.** It trusts every same-repository PR with `ReadOnlyAccess`, which includes CloudWatch Logs. An edited workflow can print app logs into public job output.
  - **Terraform plan runs code.** `data "external"` runs arbitrary programs during `plan`.
- **Suggested fix:**
  - Correct the ADR and glossary wording.
  - Add a required reviewer on the `demo` environment. It is free on a public repository, and it is the only thing that really enforces "the owner presses the button".
  - Optionally, customise the OIDC subject to include `job_workflow_ref`. This helps only together with the reviewer, since a branch can edit `demo-up.yml` itself.
  - Deny `logs:GetLogEvents`, `logs:FilterLogEvents` and `logs:StartQuery` to the plan role.
  - Back the CLAUDE.md-only rules with Claude Code permission `deny` entries: `gh pr merge*`, `gh workflow run*`, `git push --force*`, `git push --delete*`, `git push --tags`.

### MAJOR-12. The nightly destroy runs `main`'s Terraform, and "runs queue" isn't quite true

> ✅ **Fixed** in [ADR 0011, decision 7](../decisions/0011-design-sanity-check-follow-ups.md#decisions); the mechanism details join [OP-019](../open-points.md#cicd-phase). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **Where:** ADR 0010, decision 13 ("`demo-up` and `demo-down` share one `concurrency` group that never cancels: runs queue"). ADR 0010, decisions 2 and 11 ("Any branch may deploy").
- **Problem:**
  - **Wrong Terraform code (verified).** Scheduled runs use the default branch. If the demo was applied from a phase branch that changed `infra/demo` (a new provider version, a new module), destroying it with `main`'s older code can fail. The safety net then breaks exactly during infrastructure phases.
  - **Pending runs get replaced (inferred from GitHub's concurrency rules).** A concurrency group holds one running and at most *one pending* run, and a newly queued run replaces the pending one. A nightly destroy waiting behind a running `demo-up` can be silently replaced by another `demo-up`.
  - **Which commit's `infra/demo` does `demo-up` apply?** The ref it was dispatched from, or the commit given as input? If they differ, a branch's new task-definition variable is not applied, and the app fails its configuration check at startup.
- **Suggested fix:**
  - `demo-up` records the deployed commit, for example in an SSM parameter or a tag.
  - `demo-down` checks out that commit's `infra/demo` to destroy it.
  - `demo-up` always checks out infrastructure and application at the same commit.
  - Correct the "runs queue" wording, and make sure a replaced pending destroy is noticed.

### MAJOR-13. Roadmap, phases and the definition of done are not ready for the roadmap brainstorm

> ✅ **Fixed in part** in [ADR 0011, decisions 3 and 4](../decisions/0011-design-sanity-check-follow-ups.md#decisions): one [definition of done](../development/definition-of-done.md) and the document roles. ⏳ **Deferred:** the phase split ([OP-031](../open-points.md#before-the-roadmap)) and a CI job proving the image starts ([OP-032](../open-points.md#cicd-phase)). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

- **The walking skeleton reads as one very large phase.** ADR 0008's consequences put all Terraform, the Dockerfile, the static serving, `/api/health`, migrations, the SES sender, the runbook and tool pages into it. ADR 0009 expects `v0.1.0` after it, which needs release-please, the GitHub App and the `release` environment. That contradicts "the roadmap keeps phases small enough to review" (ADR 0009, decision 3) and "Do not bundle several of these into one change" (CLAUDE.md).
- **There is no single "CI/CD phase".**
  - ADR 0009, git-workflow.md and github-settings.md talk about "the CI/CD phase".
  - ADR 0010 decision 23 says each check "joins `ci.yml` in the phase that creates what it checks".
  - ADR 0010's consequences have "the CI/CD phase" write the IAM roles in `infra/base`, which ADR 0008 gives to the walking skeleton.
- **The definition of done is restated in five places that disagree:**
  - ADR 0004, decision 7 is the original.
  - ADR 0009 decision 8, `git-workflow.md` §6 and the glossary drop "significant decisions have ADRs".
  - None of them, the PR template included, lists the guides other ADRs make part of the definition of done: `setup.md` and the tool pages (ADR 0005), `testing.md` (ADR 0007), the runbook (ADR 0008), `ci-cd.md` (ADR 0010) and `github-settings.md`.
  - Also missing: reviewing surviving mutants (ADR 0007, decision 19) and "base changes are applied from the branch" (ADR 0010, decision 14).
- **"Deployed" goes stale.**
  - After *Update branch*, the PR head is a merge commit that was never deployed.
  - Nothing records that the demo check ran.
  - Dependabot bumps of the Node base image, the AWS provider or PostgreSQL are built in CI but never *run* before merging.
- **The N/A rules are too narrow.** The PR template allows N/A only "before CI or hosting exist". A formatter-only phase, or any PR before the roadmap exists, can't honestly tick "roadmap status" or "deployed".
- **Owner-only steps with lead times have no single home.** These must be done before the deploy phase:
  - the AWS account, the root user's multi-factor authentication (MFA) and IAM Identity Center
  - buying the domain
  - certificate and DKIM validation
  - verifying SES recipient addresses
  - the GitHub App
  - the environments
  - the Actions settings
- **Suggested fix:**
  - Start the roadmap brainstorm by collecting every "phase" and "roadmap" obligation from ADRs 0004–0010 into one list.
  - Split the skeleton into several phases, for example:
    1. development environment
    2. CI checks
    3. the skeleton app with E2E tests
    4. AWS bootstrap and base, OIDC, roles and `demo-down`
    5. `demo-up` and the first deploy
    6. releases
  - Keep one canonical definition of done, and have the other places link to it.
  - Define when the demo check must be repeated.
  - Add a CI job that starts the built image next to a PostgreSQL service and calls `/api/health`, or run E2E against the image. That covers most of "deployed" on every PR, Dependabot's included.
  - Widen the N/A rule, with a reason ("N/A: image unaffected").
  - Keep one owner checklist on the roadmap. A new ADR can extend ADR 0004's document roles to cover `docs/development/`, `docs/operations/` and audits like this one.

---

## MINOR

### Security and operations

- **m1. The tag ruleset allows permanent mistakes.** "Restrict creations" is off (`github-settings.md`), and updates and deletions are blocked with an empty bypass list. A stray `git push --tags`, or a `v*` tag pushed by hand, can then never be moved or deleted, and release-please fails when it later creates that version. **Fix:** restrict creations, with a bypass for the release App only.

  > ✅ **Fixed** in [ADR 0011, decision 8](../decisions/0011-design-sanity-check-follow-ups.md#decisions); adding the App to the bypass list joins [OP-003](../open-points.md#before-the-roadmap). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).
- **m2. Email authentication covers DKIM only.** ADR 0008 decision 24 has no Sender Policy Framework (SPF) record, custom MAIL FROM or Domain-based Message Authentication, Reporting and Conformance (DMARC) policy, so the domain can be spoofed in "reset your password" phishing. Also undefined: what registration does when SES refuses to send to an unverified sandbox address. **Fix:** add SPF and DMARC to `infra/base`, and define how a failed send is handled.

  > ⏳ **Deferred:** DMARC and SPF to the phase that sets up SES in `infra/base`, a failed send to the phase delivering ACC-2: [OP-044](../open-points.md#walking-skeleton). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).
- **m3. "Secrets never enter Terraform state" has no fallback and no check.** ADR 0008 decision 22 leaves it to "where the provider supports them". ADR 0010 decision 14 says public plan output is acceptable *only* because of this rule. **Fix:** make it a hard rule: the Better Auth secret is created outside Terraform, or through an ephemeral resource with a write-only argument. Add a way to check it, and document how to rotate the secret.

  > ⏳ **Deferred** to the phase that writes the Terraform code: [OP-016](../open-points.md#walking-skeleton), now a hard rule with a fallback, a check and rotation. See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).
- **m4. Real-time updates (Later) need more design:**
  - Access is not re-checked when a collaborator is removed or a link revoked.
  - The load balancer's 60-second idle timeout drops quiet sockets unless there is a ping (inferred).
  - Mobile browsers drop sockets in the background, so the client must refetch on reconnect.
  - Your own event triggers a refetch that can overwrite in-flight optimistic changes.
  - ITM-4's "increase quantity" is read-modify-write, so two concurrent increases lose one.
  - WebSocket testing is not in ADR 0007.

  > ⏳ **Deferred** to the SYN brainstorm, and the atomic quantity increase to the phase delivering ITM-4: [OP-045](../open-points.md#feature-phases). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).
- **m5. There is no `.gitignore` yet (verified).** ADR 0008 decision 7 relies on bootstrap's local state being "ignored by git", in a public repository. **Fix:** add `*.tfstate*` and `.terraform/` before anyone runs bootstrap. Only a global ignore rule currently covers `.claude/settings.local.json`.

  > ✅ **Fixed:** a `.gitignore` for Terraform state and `.claude/settings.local.json`; the development environment phase adds its tools' entries ([OP-005](../open-points.md#development-environment-phase)). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).
- **m6. `infra/base` applied from a branch can drift from `main`** (ADR 0010, decision 14) if the PR is reworked or abandoned. **Fix:** add a step: re-apply base from `main` after the merge, or after abandoning the PR.

  > ✅ **Fixed** in [ADR 0011, decision 9](../decisions/0011-design-sanity-check-follow-ups.md#decisions) and item 5 of the [definition of done](../development/definition-of-done.md). See the [triage](../decisions/0011-design-sanity-check-follow-ups.md#triage-of-the-findings).

### Process and CI

- **m7. Dependabot security updates are off (verified: `automated-security-fixes` → `enabled: false`).** ADR 0010 decision 18 says they "are on". Neither `github-settings.md` nor the owner's steps in ADR 0010 decision 23 list them. **Fix:** add the setting to both, then turn it on.
- **m8. An undocumented ruleset parameter (verified live).** The `main` ruleset has `require_extra_approval_for_unattributed_changes: true`, which `github-settings.md` doesn't mention. It reportedly requires an extra approval for PRs containing commits that can't be attributed to a GitHub account. With 0 required approvals and owner-authored PRs, the owner can't provide that approval. A commit made with an email that isn't linked to the account (a fresh WSL git config, for example) could then block a merge. **Fix:** confirm what the setting does, document it, and decide its value.
- **m9. commitlint will probably reject Dependabot commits (inferred).** `@commitlint/config-conventional` treats body and footer lines over 100 characters as errors. Dependabot's commit bodies routinely contain longer lines. The `commits` job would then fail, `ci-ok` would stay red, and the empty bypass list would block every Dependabot PR. **Fix:** ignore bot-authored commits or relax those two rules, and test against a real Dependabot commit before making `ci-ok` required. Also restrict `type-enum` to the nine documented types: config-conventional also accepts `style` and `revert`.
- **m10. The `ci-ok` aggregator can pass when nothing ran.** If the change-detection job fails, every job that depends on it reports `skipped`, and a naive "nothing failed" check turns green. **Fix:** `ci-ok` requires the detection job to succeed, and treats `failure` or `cancelled` as failed.
- **m11. The ECR lifecycle policy would expire released images.** "Keeps only the most recent few" (ADR 0008, decision 12) also removes `v*`-tagged images. **Fix:** keep version-tagged images, and expire only images tagged with just a commit hash.
- **m12. `infra-plan` on Dependabot PRs (inferred).** Dependabot-triggered runs get restricted tokens and probably no OIDC token, so Terraform provider bump PRs would show a failed plan job. **Fix:** skip the job for `dependabot[bot]`, or document that it is expected to fail.
- **m13. Dependabot major-version PRs conflict with pinned versions.** Separate PRs for Node or PostgreSQL major versions (ADR 0010, decision 18) would break "pinned to the same major version as production" (ADR 0005, ADR 0008) and Node 24 in `.nvmrc` and `engines`. **Fix:** ignore major updates for those two, or coordinate them.
- **m14. The E2E suite exceeds the default rate limits.** About 14 journeys × 2 viewports, each as a fresh guest and some registering users, all from one IP, exceeds 10 guests and 5 registrations per hour. ADR 0007 decision 14 raises the limits only for the API tests. **Fix:** state the E2E server's rate-limit configuration explicitly.
- **m15. CLAUDE.md guardrails are ambiguous or incomplete:**
  - "So does the PR title" reads as if the PR title follows the plan's tasks; it means Conventional Commits.
  - The rule "Claude never triggers `demo-up` or `demo-down`" (ADR 0010, consequences) is not added yet, although it costs nothing to add now.
  - The superpowers skills' defaults clash with ADR 0009: worktrees in `using-git-worktrees` and `executing-plans`, and the local-merge option in `finishing-a-development-branch`. CLAUDE.md doesn't say which options to pick.
  - "A roadmap phase … holding its spec, plan and code" ignores the bounded path of ADR 0004, decision 8, which has no spec or plan.
  - "(from the README disclaimer)" refers to a section the README no longer has. It was removed in commit `1f82330`.

### Requirements and architecture

- **m16. Units have no place in the frontend.** UNT-1 is MVP, and the backend has a `units` module. But `architecture.md`'s frontend folders ("mirroring the backend") and the routes table have no units page.
- **m17. Bulk operations against quotas are undefined.** Examples: importing 150 guest lists into an account that has 100 (ACC-4); multi-adding 30 products to a list with 480 items; duplicating a list that is at the limit. Is that all-or-nothing, or partial? Also undefined: ITM-4 when the units differ, and which actions still work on an archived list (LST-3). The "count before insert" quota check can be exceeded by concurrent requests. That is acceptable, but should be said.
- **m18. Lazy creation: seed IDs versus workspace IDs.** The cache holds the in-memory seed catalog's IDs, and the new workspace's copies get new IDs, so requests right after creation can hit 404. Two quick changes, or two tabs, can each create an anonymous session, and the loser's workspace is orphaned. **Fix:** invalidate all queries after the session is created, and allow only one session creation at a time in the API client.
- **m19. Sharing (Later) semantics that affect its tables:**
  - "A guest opening a share link already has an anonymous user" contradicts lazy creation: opening a link is not a change.
  - If a redeemed link becomes a `list_shares` row, "regenerate" (UC-12) doesn't remove people who already joined.
  - Inviting an unregistered email is undefined.
  - SHR-1 has no accept step, so anyone can push lists into anyone's "Shared with me".
  - A shopper who can see a list gets 404 rather than 403 when editing it.
  - Whether a shopper can run "Uncheck all" is undefined.
  - What happens to shares when an anonymous owner's workspace expires is undefined.

  **Fix:** decide these in the SHR brainstorm. Link-bound versus user-bound access is the choice that changes the tables.
- **m20. There are no non-functional requirements:**
  - no stated browser support; iPhones run WebKit, and E2E runs Chromium only
  - no accessibility target, although axe runs
  - no performance budget for a phone on a weak signal: compression and cache headers matter without a CDN
  - no decimal-comma input ("0,5")
  - no way for a guest to delete their own data

### Documentation consistency

- **m21. README drift:**
  - "nest categories as deep as you like", against LIM-1's 5 levels
  - "editor (change the list)", against SHR-4, where only the owner renames, archives or shares
  - future ideas omit "Full offline editing" and narrow the admin panel
- **m22. Stale structure and facts:**
  - "One repository, three packages" (`architecture.md`, `stack-overview.md`, the glossary) omits the `e2e/` workspace (ADR 0007) and `infra/` (ADR 0008).
  - The app's task role "may only send email" (`stack-overview.md`, the glossary), but ADR 0008 also gives it ECS Exec.
  - "Secrets" live in `infra/base`, but the RDS-managed password lives and dies with the demo.
  - The security-group chain in the stack overview omits port 80.
  - `last_active_at` is on the workspace in one sentence and on the user in the next.
  - The stack overview is missing the CI/CD section that ADR 0010 decision 22 promises.
- **m23. ADR cross-references:**
  - When to choose the PostgreSQL major version: "the setup phase" (ADR 0005) versus "when the walking skeleton is built" (ADR 0008). `compose.yaml` comes first.
  - ADR 0005's status line doesn't mention ADRs 0007, 0009 and 0010, which complete it.
  - ADR 0001's consequence "Guest mode requires local browser storage" is superseded without a note.
  - Phase names drift: "development environment setup phase", "development environment phase" and "the setup phase". ADR 0008 never defines "the implementation phase".
- **m24. Editorial nits:**
  - Acronyms not spelled out on first use: in `architecture.md`, ECS, IAM, SDK, VPC, RDS, ECR, SMTP and ACM; in ADR 0010, E2E, RDS, ECR and SSO; in ADR 0001, CRUD.
  - Acronyms missing from the glossary: S3, EC2, DOM, HCP, and possibly YAML, CLI and GUI.
  - The glossary tables are not in alphabetical order.
  - `git-workflow.md` says "This ADR's merge", but it isn't an ADR.
  - `github-settings.md` cites "ADR 0009, consequences" where decision 14 is meant.
  - The glossary says "Szop requires `ci-ok`" while the check is still off.
  - `szop.app` reads like the real domain.
  - ADR 0008 mixes € and $.
  - The scope examples (`feat(lists)`) go beyond the listed scopes, and "add item reordering" is a future extension.

---

## CONSIDER IMPROVING

1. **A threat model page.** One short page listing who can do what: the owner, Claude Code acting as the owner, Dependabot, forks, anonymous visitors. It would have caught MAJOR-11 and m1 directly. It fits the security baseline topic of MAJOR-5.
2. **A progressive web app (PWA) with an app-shell cache.** An installable app that caches its shell helps the in-store scenario, and it is the base for the offline extension.
3. **Undo for mis-taps on a phone.** "Remove item" and "Uncheck all" are easy to trigger by accident in a store. An undo message costs little.
4. **Test migrations against existing data.** Every environment starts empty, so a migration that breaks on existing rows is never exercised. That is a learning gap for a project that wants to learn migrations. Add a test that migrates from the previous schema with fixture data.
5. **Test the seed data.** Check that it satisfies the quotas, the depth limit and uniqueness, and see how much of the 300-category quota it uses.
6. **Container and database hardening.**
   - Run the container as a non-root user.
   - Connect to RDS over TLS with full certificate verification.
   - Turn on versioning, the public-access block and a TLS-only policy for the state bucket.
7. **Password policy.** Record the minimum length, and consider Better Auth's breached-password check. Keep Better Auth's cookie cache off unless there's a reason for it.
8. **CI jobs that hold AWS credentials** should not run dependency lifecycle scripts, or should rely on pnpm's script allowlist, and say so.
9. **Order the CodeQL rule last.** Turn on "Require code scanning results" only after CodeQL has run successfully on `main`. With an empty bypass list, a CodeQL that can't run blocks every merge. Check that the SHA-pinning policy doesn't block CodeQL's default setup or Dependabot's own workflows.
10. **The release image is never demo-checked,** and the "re-tag if ECR already has it" path will almost never apply, since the release commit is a new merge commit. Say so in ADR 0010's successor. Also make sure the privileged `release` job doesn't restore caches written by PR runs (cache poisoning).
11. **Per-IP limits and shared addresses.** ADR 0003 argues that a real person hits the guest limit "at most once per browser". But many people share one address behind mobile carrier-grade NAT or a shop's Wi-Fi, so a crowd shares 10 guests per hour. For a demo that doesn't matter; for an always-on service, add a global ceiling and revisit the per-IP value.
12. **Node.js 26 becomes LTS in October 2026,** about when the development environment phase starts. Node 24 stays supported until 2028, so pinning 24 is fine. Just make it a conscious choice in that phase.
13. **API versioning for the future Android app.** The web app ships together with the API, but an Android client won't. A `/api/v1` prefix, or a stated compatibility rule, is cheap now.
14. **Unverified factual claims in the ADRs.** Re-check a few before relying on them:
    - App Runner closed to new customers on 30 April 2026 (ADR 0008)
    - Dependabot's default cooldown is 3 days (ADR 0010)
    - GitHub's SHA-pinning policy dates from August 2025 (ADR 0010)

    They are plausible, but they came from brainstorming, not from sources recorded in the ADRs.

---

## What to do with this

A suggested order, following the project's step-by-step process:

1. **Before the roadmap brainstorm:** decide CRITICAL-2 and MAJOR-13, because they shape the roadmap itself. Fix the one-line README privacy sentence (MAJOR-1) and the MINOR documentation items (m21–m24) in a small `docs/` PR.
2. **As a small foundation topic before the walking skeleton:** a security baseline covering CRITICAL-1, MAJOR-4, MAJOR-5 and MAJOR-11, recorded in an ADR. ADR 0004's topic list can be extended by an ADR, the way ADR 0006 added the git workflow.
3. **Before the CI/CD and release phases:** MAJOR-10, MAJOR-12, m7–m12. A throwaway repository is a cheap place to try out release-please, commitlint and Dependabot together.
4. **In the phase brainstorms that build each area:** MAJOR-2, MAJOR-3 and MAJOR-6 to MAJOR-9, and the remaining MINOR items. Each becomes a requirement change, an `architecture.md` update or a note in that phase's spec.
5. **Record the outcome.** Decisions that change accepted ADRs get new ADRs, as usual. This report stays as it is, as a record of the state on 2026-09-29.

## Sources checked during verification

- [Better Auth — anonymous plugin](https://www.better-auth.com/docs/plugins/anonymous): linking in sign-in, `onLinkAccount`, deletion by default
- [Better Auth — rate limit](https://www.better-auth.com/docs/concepts/rate-limit): keyed by the connecting IP, `x-forwarded-for`, `ipAddressHeaders`
- [Better Auth — session management](https://www.better-auth.com/docs/concepts/session-management): 7-day default expiry, `revokeOtherSessions`
- [GitHub Docs — events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows): `workflow_dispatch` and `schedule` need the file on the default branch
- [release-please README](https://github.com/googleapis/release-please) and [issue #2476](https://github.com/googleapis/release-please/issues/2476): squash merges recommended; duplicate entries with merge commits
- Live repository settings, read with `gh api` on 2026-09-29: the rulesets, and `automated-security-fixes`
