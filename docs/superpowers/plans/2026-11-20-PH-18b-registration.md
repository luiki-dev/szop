# PH-18b Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementers:** read [`docs/superpowers/plans/CLAUDE.md`](CLAUDE.md) before your task.

**Goal:** A guest creates an account with a display name, an email address and a password, confirms the address through an emailed link, and keeps this browser's lists as the account's.

**Architecture:** Better Auth's email-and-password sign-up with verification, shaped by our hooks: a before hook on `/sign-up/email` (body checks, display name, breach check, replacing an unverified account), after hooks that even out the sign-up's answers and give `/verify-email` a `{ verified }` answer, and `beforeEmailVerification` moving the registering guest's workspace in one idempotent transaction. Three new `users` columns. A resend route of our own. In the SPA, registration pages in their own chunk, a `/verify` page, a placeholder `/login`, and the menu's account box.

**Tech Stack:** Better Auth 1.7.21 (email and password, email verification, anonymous plugin), Drizzle and PostgreSQL, Fastify, zod in `packages/shared`, React and React Router, Vitest and Testing Library, Playwright with Mailpit's HTTP API.

**Spec:** [`docs/superpowers/specs/2026-11-20-PH-18b-registration-design.md`](../specs/2026-11-20-PH-18b-registration-design.md); decisions in [ADR 0079](../../decisions/0079-registration-phase-details.md). The criteria are in the spec's [Acceptance criteria](../specs/2026-11-20-PH-18b-registration-design.md#acceptance-criteria), the docs to update in its [Documentation](../specs/2026-11-20-PH-18b-registration-design.md#documentation); each task below names the docs it updates.

## Order of work

1. [Task 1: Better Auth's configuration and sign-up](#task-1-better-auths-configuration-and-sign-up) — 🛑 stop
2. [Task 2: The breach check](#task-2-the-breach-check)
3. [Task 3: The verification link](#task-3-the-verification-link)
4. [Task 4: Moving the workspace](#task-4-moving-the-workspace) — 🛑 stop
5. [Task 5: Resending the link](#task-5-resending-the-link) — 🛑 stop (the illustrations)
6. [Task 6: The registration pages](#task-6-the-registration-pages)
7. [Task 7: The verify page and the login placeholder](#task-7-the-verify-page-and-the-login-placeholder)
8. [Task 8: The menu's account box](#task-8-the-menus-account-box)
9. [Task 9: The E2E journeys](#task-9-the-e2e-journeys)
10. [Task 10: The dialog strip](#task-10-the-dialog-strip)

## Global Constraints

- The branch is `feat/ph-18b-registration`. Scopes: `api` (Tasks 1 to 5), `web` (Tasks 6 to 8, 10), `e2e` (Task 9); subjects lowercase.
- **Rhythm** ([ADR 0079](../../decisions/0079-registration-phase-details.md), decision 1): stop after Task 1 (Better Auth's configuration, proving its hooks), after Task 4 (the workspace takeover), and after Task 5, before the first screen task: there the owner supplies the illustrations (a mailbox, an hourglass, a broken link) as SVG. The other tasks go on without a stop.
- **Task 1 proves Better Auth's hooks against PostgreSQL** before anything is built on them: the before hook on `/sign-up/email` sees the guest's session, `databaseHooks.user.create.before` can set an `input: false` field, `onExistingUserSignUp` runs for a verified address. Task 3 proves `beforeEmailVerification` runs before the account is marked verified, and the `{ verified }` after hook. If one does not behave as the spec reads, stop and report; do not work around it.
- **No log line holds an email address, a password, its hash, a token or a database error's detail** ([ADR 0078](../../decisions/0078-sending-email-phase-details.md), decision 5). Every email goes through `sendInBackground`.
- **Better Auth's error bodies** are `{ code, message }`; the app's are `{ error: { code, message } }` (`sendError`). New app routes answer the app's shape.
- Passwords: 15 to 128 UTF-16 code units (`password.length`), as Better Auth counts.
- Display name: 1 to 50 characters after trimming, no control characters, not unique.
- The verification link is `<appOrigin>/verify?token=<token>`; it expires after `24 * 60 * 60` seconds.
- Copy is the mockup's ([`ph-18b-journey-v5.html`](../../architecture/visual-design/ph-18b-journey-v5.html)) and the spec's [The screens](../specs/2026-11-20-PH-18b-registration-design.md#the-screens) and [The emails](../specs/2026-11-20-PH-18b-registration-design.md#the-emails); the emails open with "Hi," alone, with no display name.
- API tests: each sign-up request sends its own `x-forwarded-for` (Better Auth allows 3 sign-ups in 10 seconds per IP; `testConfig()` trusts `127.0.0.1`), and each test registers a unique address (`${randomUUID()}@example.com`).
- **Decisions this plan takes where the spec left them to the builder, to record in ADR 0079's "Settled while building" in the task that makes them:**
  1. `AppDeps` gains `email?: EmailSender`, defaulting to `createEmailSender(config.email)` inside `buildApp`, so `server.ts` and the 37 `buildApp` calls in tests do not change; tests that read emails pass a fake (Task 1).
  2. `GET /api/lists` answers `{ lists, hasWorkspace }`, so the registration form knows whether to show the checkbox and how many lists its hint names (Task 4).
  3. `sessionHook(auth, db)` reads `users.converted_at` with a query, only for an anonymous session's user, since the column is `returned: false` (Task 4).
  4. The resend's limit is a map in memory in the route, per IP (Task 5).
- `pnpm check` passes after every task.

## Review Focus

1. **A sign-up from a browser with no guest cookie** (a fresh browser, or cookies cleared). Expected: 200 as usual, `registered_by_guest` null, and verification moves nothing and converts nobody. Task 1 tests the sign-up; Task 4 tests the verification.
2. **An address in another case** (`Ania@Example.com` after `ania@example.com`). Expected: the same account: Better Auth lowercases it, and the replacement's match is in lower case. Task 1 tests a replacement across cases.
3. **A converted guest's tab still open on Lists, reading and writing.** Expected: a read and a write both send it to `/login?confirmed`, and neither signs in a new guest behind the notice. Task 4 tests the API side for a read and a write; Task 7 tests the client side for both.
4. **The verify page opened with no `token`, or reloaded after the token was removed from the address.** Expected: "Link not valid" at once, with no call. Task 7 tests it.
5. **The register page reached with an account's session** (after a verification, Back). Expected: it goes to Lists. Task 6 tests it.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/db/auth-schema.ts`, `apps/api/drizzle/0004_*.sql` | The three `users` columns and their migration |
| `packages/shared/src/accounts.ts`, `accounts.test.ts` | `displayNameSchema`, `passwordLimits`, `registrationSchema` (the form and the hook) |
| `apps/api/src/auth/auth.ts` | `createAuth`: the options, `additionalFields`, `databaseHooks`, `hooks`, `logger` |
| `apps/api/src/auth/sign-up.ts`, `sign-up.test.ts` | The sign-up's before and after hooks |
| `apps/api/src/auth/breach.ts`, `breach.test.ts` | `isBreached`: the Have I Been Pwned range check |
| `apps/api/src/auth/verify.ts`, `verify.test.ts` | The `/verify-email` after hook and `beforeEmailVerification`, the move |
| `apps/api/src/auth/session.ts`, `session.test.ts` | `sessionHook(auth, db)`: `guest_converted` |
| `apps/api/src/auth/routes.ts` | The allowlist |
| `apps/api/src/email/templates.ts`, `templates.test.ts` | `verificationEmail`, `existingAccountEmail` |
| `apps/api/src/registration/routes.ts`, `routes.test.ts` | `POST /api/registration/resend` and its limit |
| `apps/api/src/app.ts` | `AppDeps.email`, the resend route |
| `apps/api/src/lists/routes.ts`, `packages/shared/src/lists.ts` | `hasWorkspace` on `GET /api/lists` |
| `apps/web/src/api/client.ts`, `apps/web/src/api/auth.ts` | `ApiRequestError.code`, `guest_converted`; `signUp`, `verifyEmail`, `resendLink`, `getSession` |
| `apps/web/src/registration/*` | The registration pages, `/verify`, `/login`, the registered address in `localStorage` |
| `apps/web/src/shell/use-session.ts`, `menu.tsx`, `account-box.tsx` | The session hook and the account box |
| `apps/web/src/brand/*.svg` | The owner's illustrations |
| `e2e/support/mailpit.ts`, `e2e/tests/registration.spec.ts` | The E2E email helper and the journeys |

---

### Task 1: Better Auth's configuration and sign-up

**Files:**
- Modify: `apps/api/src/db/auth-schema.ts`; Create: the migration, with `pnpm --filter @szop/api db:generate`
- Create: `packages/shared/src/accounts.ts`, `accounts.test.ts`; Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/auth/auth.ts`, `apps/api/src/auth/routes.ts`, `apps/api/src/app.ts`
- Create: `apps/api/src/auth/sign-up.ts`, `sign-up.test.ts`
- Create: `apps/api/src/email/templates.ts`, `templates.test.ts`
- Modify: `docs/architecture/architecture.md` (registration, the `users` columns), `docs/architecture/threat-model.md` (the sign-up entry point, replacing unverified accounts and the two abuses it leaves open, the display name kept out of emails), `docs/glossary.md` (account pre-hijacking), ADR 0079 "Settled while building" (decision 1 of the Global Constraints)

**Interfaces:**
- Produces, in `@szop/shared`:

  ```ts
  export const displayNameSchema: z.ZodType<string>; // trims; 1–50; no control characters
  export const passwordLimits: { min: 15; max: 128 };
  export const registrationSchema: z.ZodObject<{ name; email; password; keepGuestData: z.ZodOptional<z.ZodBoolean> }>;
  ```

- Produces, in `apps/api`:

  ```ts
  // auth.ts
  createAuth(options: { db; secret; origin; trustedProxies?; email: EmailSender; log: FastifyBaseLogger }): Auth
  // users gains: registeredByGuest: uuid | null, keepGuestData: boolean, convertedAt: Date | null
  // templates.ts
  verificationEmail(link: string): Omit<Email, "to">
  existingAccountEmail(loginLink: string): Omit<Email, "to">
  // app.ts
  AppDeps.email?: EmailSender
  ```

- [x] **Step 1: The columns.** In `auth-schema.ts`'s `users`: `registeredByGuest: uuid("registered_by_guest")` referencing `users.id` with `onDelete: "set null"` (a `foreignKey` in the table's extras, as the file does), `keepGuestData: boolean("keep_guest_data").default(false).notNull()`, `convertedAt: timestamptz("converted_at")`. Generate the migration; run `pnpm --filter @szop/api test src/db` → PASS (`schema.test.ts` and the migration checks).

- [x] **Step 2: The shared schemas, test first.** `accounts.test.ts`: `displayNameSchema` accepts `"  Ania  "` as `"Ania"`, 50 characters; refuses `""`, `"   "`, 51 characters, `"An\u0007ia"`, `"An\nia"`. `registrationSchema` refuses a password of 14 and 129 code units, accepts 15 and 128, and counts `"😀"` as 2. Run → FAIL; implement; run → PASS.

- [x] **Step 3: The emails, test first.** `templates.test.ts`: `verificationEmail("https://szop.test/verify?token=a<b")` has the subject `Confirm your email for Szop`, a text starting `Hi,`, the link in the text, the link HTML-escaped in the HTML (`a&lt;b`), the button `Confirm my address`, and the closing line of the spec. `existingAccountEmail(...)` has the subject `You already have a Szop account`, the button `Log in`, and no "Forgot your password" line. Neither contains a name. Implement with a small `escapeHtml`; run → PASS.

- [x] **Step 4: The sign-up's tests.** `sign-up.test.ts`, with `buildApp({ ..., email: fake })` where `fake` records emails, and a helper `signUp(app, body, { cookie?, ip? })`:
  - `ACC-2.1 ACC-2.2: a sign-up answers 200 with no session and one verification email` — no `set-cookie`; one email to the address, its text holding `<appOrigin>/verify?token=`; the user row has `email_verified = false`, the trimmed name.
  - `ACC-2.2: 14 and 129 code units are refused, 15 and 128 and "  😀  …" accepted` — 400 for the first two.
  - `ACC-2.12: an empty, a 51-character and a control-character name answer 400`.
  - `refuses a keepGuestData that is not a boolean, and an address on the anonymous plugin's domain` — 400, no row.
  - `sets registered_by_guest from a guest's session, and keep_guest_data from the body` — with `signIn(app)`'s cookie; the hook proof.
  - `leaves registered_by_guest null with no session` (Review Focus 1).
  - `ACC-2.5 ACC-2.6: a new, an unverified and a verified address answer the same keys and values` — compare `JSON.parse(body)` for the three with the same body and a guest cookie, after removing `user.id`, `createdAt`, `updatedAt` (check first which keys Better Auth's synthetic user holds; whatever differs beyond these is a finding); the verified one (set `email_verified = true` by SQL) gets one "You already have a Szop account" email and no verification email.
  - `ACC-2.9: a second sign-up for an unverified address replaces it` — one row, the new name; the first user's sessions and accounts gone. Again with the address in upper case (Review Focus 2).
  - `ACC-2.9: a refused sign-up leaves the unverified account and the guests` — a 1-character password, then a placeholder-domain address: the unverified row and every anonymous row still there.
  - `ACC-2.9: two sign-ups at once end in one account and two equal answers` — `Promise.all` of two; one user row; both 200 with equal bodies (same exclusions).
  - `logs no address` — with `captureLog()` at `info`, after the verified-address case and the race, no line's JSON contains the address.

  Run → FAIL.

- [x] **Step 5: Configure `createAuth`** as the spec's [Better Auth's configuration](../specs/2026-11-20-PH-18b-registration-design.md#better-auths-configuration) lists, with `email` and `log` from `buildApp` (`app.log`). `sendVerificationEmail({ user, token })` and `onExistingUserSignUp({ user })` call `sendInBackground(email, { to: user.email, ...template }, kind, log)` with the kinds `verification` and `existing-account`. `logger: { log: (level, message) => log[level === "debug" ? "debug" : level](message) }`, never the arguments. `AppDeps.email` defaults to `createEmailSender(config.email)`.

- [x] **Step 6: The hooks in `sign-up.ts`.** `signUpBefore(db)` and `signUpAfter`, wired through `hooks.before`/`hooks.after` with `createAuthMiddleware`, acting only when `ctx.path === "/sign-up/email"`:
  - before: `registrationSchema` on the body (400 `APIError` with the first message), then the body handed on with the trimmed name (`return { context: { body } }`), then, in a transaction, `SELECT id FROM users WHERE lower(email) = lower($1) AND is_anonymous = false AND email_verified = false FOR UPDATE` and its delete. The breach check slots between the name and the delete in Task 2.
  - after: when `ctx.context.returned` is an `APIError` with the code `FAILED_TO_CREATE_USER`, answer what an existing address gets (`{ token: null, user }`, the user built from the body as `sign-up.mjs` builds it).
  - `databaseHooks.user.create.before(user, ctx)`: when `ctx?.path === "/sign-up/email"`, read the session (`getSessionFromCtx(ctx)`); when its user is anonymous and its `convertedAt` is null (a query), return `{ data: { ...user, registeredByGuest: session.user.id } }`.

- [x] **Step 7: The allowlist** gains `POST /api/auth/sign-up/email`. Run `pnpm --filter @szop/api test src/auth src/email` → PASS; `pnpm check` → PASS.

- [x] **Step 8: The docs** named under Files; commit `feat(api): sign up with email and password`; push. 🛑 Stop: report to the owner which hook behaved as read and which did not.

### Task 2: The breach check

**Files:**
- Create: `apps/api/src/auth/breach.ts`, `breach.test.ts`
- Modify: `apps/api/src/auth/sign-up.ts`, `sign-up.test.ts`
- Modify: `docs/architecture/threat-model.md` (the outbound call), `docs/architecture/stack-overview.md` (k-anonymity), `docs/glossary.md` (k-anonymity)

**Interfaces:**
- Produces: `isBreached(password: string, log: Pick<FastifyBaseLogger, "warn">, fetchFn = fetch): Promise<boolean>` — `false` on any failure, after one `warn` line.

- [x] **Step 1: Unit tests** with a stubbed `fetchFn`: `found` (a line `<suffix>:3` → true, the request to `https://api.pwnedpasswords.com/range/<first 5 of the upper-case SHA-1>` with `Add-Padding: true`); `not found` → false; `a padding line with a count of 0 is not a match` → false; `an error status`, `a timeout` (a fetch that never settles, the limit 3000 ms, fake timers), `an unreadable body` → false with exactly one `warn` line whose JSON holds neither the password, the hash nor its prefix. Run → FAIL; implement with `node:crypto` and `AbortSignal.timeout(3000)`; run → PASS.
- [x] **Step 2: Into the before hook**, after the name: found → 400 `APIError` with the code `password_breached` and `This password appears in known data leaks. Choose another.` `createAuth` takes an optional `breachFetch` for tests; `sign-up.test.ts`'s other cases pass one that answers "not found".
- [x] **Step 3: Tests** `ACC-2.3: a breached password answers 400 password_breached` and `ACC-2.4: the service failing accepts the password`. Run → PASS; `pnpm check` → PASS.
- [x] **Step 4:** the docs; commit `feat(api): refuse passwords found in data leaks`; push.

### Task 3: The verification link

**Files:**
- Create: `apps/api/src/auth/verify.ts`, `verify.test.ts`
- Modify: `apps/api/src/auth/auth.ts`, `apps/api/src/auth/routes.ts`, `apps/api/src/auth/routes.test.ts`, the "token never in the log" test
- Modify: `docs/architecture/threat-model.md` (verify), `docs/architecture/stack-overview.md` (a signed token, JWT), `docs/glossary.md` (JWT)

**Interfaces:**
- Produces: `verifyAfter` (the `/verify-email` after hook) answering `{ verified: boolean }` with 200; errors unchanged (`{ code, message }`, 401). `beforeVerification(db): (user) => Promise<void>`, wired as `emailVerification.beforeEmailVerification`; in this task only its step 1 (re-read with `FOR UPDATE`, throw when gone); Task 4 adds the move.
- Test helper, exported from `verify.test.ts`'s neighbor `apps/api/src/test/registration.ts`: `registerAndGetLink(app, fake, body, opts) => Promise<{ token: string }>`, reused by Tasks 4 and 5.

- [x] **Step 1: Tests:**
  - `ACC-3.9: a verification answers { verified: true } and signs in` — `GET /api/auth/verify-email?token=…`, a session cookie; `email_verified` true.
  - `ACC-3.9: a second use answers { verified: false } with no cookie`.
  - `ACC-3.9: a link past 24 hours answers TOKEN_EXPIRED` — `vi.useFakeTimers({ toFake: ["Date"] })`, the clock moved by 24 h and 1 s.
  - `ACC-2.9: the first link after a replacement answers INVALID_TOKEN`.
  - `beforeEmailVerification runs before the account is verified` — a hook that throws (a `createAuth` test seam, or the account deleted between sign-up and verify) leaves `email_verified` false, and the link opened again verifies.
  - `NFR-4.12: sign-up and verify-email answer; send-verification-email answers 404` in `routes.test.ts`.
  - The "token never in the log" test covers `verify-email` (OP-053).
  Run → FAIL.
- [x] **Step 2: Implement**: the allowlist gains `GET /api/auth/verify-email`; `verifyAfter` answers `{ verified: ctx.context.newSession !== null }` when the path is `/verify-email` and the answer is not an error. Run → PASS; `pnpm check` → PASS.
- [x] **Step 3:** the docs; commit `feat(api): verify the address through the emailed link`; push.

### Task 4: Moving the workspace

**Files:**
- Modify: `apps/api/src/auth/verify.ts`, `verify.test.ts`
- Modify: `apps/api/src/auth/session.ts`, `session.test.ts`, and its callers in `catalog/routes.ts`, `items/routes.ts`, `lists/routes.ts`
- Modify: `apps/api/src/lists/routes.ts`, `packages/shared/src/lists.ts` (`hasWorkspace`), their tests
- Modify: `docs/architecture/architecture.md` (the move at verification, `guest_converted`), ADR 0079 "Settled while building" (decisions 2 and 3 of the Global Constraints)

**Interfaces:**
- Produces: `listsResponseSchema = z.object({ lists: z.array(listSchema), hasWorkspace: z.boolean() })`. `sessionHook(auth: Auth, db: Database)`: a converted guest's session kept, 401 `{ error: { code: "guest_converted", message } }`.

- [x] **Step 1: Tests** in `verify.test.ts`, each guest with a workspace made through the API (a list created, so its catalog and categories exist):
  - `ACC-2.7: ticked, the guest's workspace with its lists, catalog and categories is the account's` — after verifying, the account's `GET /api/lists` holds the guest's list; `workspaces.user_id` is the account's.
  - `ACC-2.7: with no workspace at sign-up and a list added before verification, the list is the account's` (`keepGuestData: true`).
  - `ACC-2.10: unticked, the account starts with the default catalog and no lists, and the guest's workspace is untouched`.
  - `ACC-2.11: verified with a second guest's cookie, that browser is the account's, its own workspace untouched, and the registering guest's next read and write answer 401 guest_converted` (Review Focus 3, API side); the second guest's `converted_at` stays null.
  - `the move run twice leaves one workspace and one conversion` — call `beforeVerification(db)(user)` twice.
  - `a verification with no registering guest moves nothing and converts nobody` (Review Focus 1).
  - In `lists` tests: `hasWorkspace` false for a new guest, true after a list.
  Run → FAIL.
- [x] **Step 2: Implement** the spec's [Moving the workspace](../specs/2026-11-20-PH-18b-registration-design.md#moving-the-workspace), steps 1 to 4, in one `db.transaction`, each step a no-op the second time (`WHERE converted_at IS NULL`, `WHERE user_id = <guest>`). `sessionHook`: when the session's user `isAnonymous`, read `converted_at`; when set, `sendError(reply, 401, "guest_converted", "Your address was confirmed in another browser")`. Run → PASS; `pnpm check` → PASS.
- [x] **Step 3:** the docs and the ADR notes; commit `feat(api): move the guest's workspace into the account at verification`; push. 🛑 Stop.

### Task 5: Resending the link

**Files:**
- Create: `apps/api/src/registration/routes.ts`, `routes.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `docs/architecture/threat-model.md` (the resend and its limit), ADR 0079 "Settled while building" (decision 4)

**Interfaces:**
- Produces: `POST /api/registration/resend` with `{ email: string }`: 204, 400 (app error shape) for an invalid address, 429 past 3 in 60 s per `request.ip`.

- [x] **Step 1: Tests:** `ACC-3.5: the same answer for an unknown, an unverified and a verified address; only the unverified gets an email` (the fake sender); `answers 400 to an invalid address`; `ACC-3.5: the fourth request in 60 seconds from one IP answers 429, another IP 204` (`x-forwarded-for`); `a resent link verifies` (with Task 3's helper). Run → FAIL.
- [x] **Step 2: Implement** with `auth.api.sendVerificationEmail({ body: { email } })` and no headers; the limit a `Map<string, number[]>` of timestamps with a comment `// shortcut: per task and lost on restart, until PH-20's quotas`. Run → PASS; `pnpm check` → PASS.
- [x] **Step 3:** the docs; commit `feat(api): resend the verification link`; push. 🛑 Stop: ask the owner for the three SVG illustrations before Task 6.

### Task 6: The registration pages

**Files:**
- Add: `apps/web/src/brand/mailbox.svg`, `hourglass.svg`, `broken-link.svg` (the owner's)
- Create: `apps/web/src/api/auth.ts`, `auth.test.ts`; Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/src/registration/register-page.tsx`, `sent-page.tsx`, `resend-page.tsx`, `registered-address.ts`, their tests; Modify: `apps/web/src/routes.tsx`
- Modify: `docs/architecture/visual-design.md` (the form pages, with the mockup)

**Interfaces:**
- Produces, in `api/auth.ts`: `signUp(body: Registration): Promise<void>` (throws `ApiRequestError` with Better Auth's `code`), `resendLink(email: string): Promise<void>`, `getSession(): Promise<{ user: { name: string; email: string; isAnonymous: boolean } } | null>`. In `client.ts`: `ApiRequestError` gains `code?: string`, read from either error shape.
- `registered-address.ts`: `saveRegisteredAddress(email)`, `registeredAddress(): string | null`, `forgetRegisteredAddress()`, one `localStorage` key.
- The pages are one lazy chunk, like `ListPage` in `routes.tsx`; Task 7 adds its pages to the same chunk.

- [x] **Step 1: Component tests**, one per state of the mockup: `/register` — the four fields with Show, errors on leaving a field and on submit, `password_breached` shown under Password; `ACC-2.7: the checkbox shows, ticked, with the list count when hasWorkspace` and `is hidden without a workspace and keepGuestData: true is sent`; Cancel back to the previous page, or Lists; `with an account's session, goes to Lists` (Review Focus 5). `/register/sent` — the saved address, "Back to my lists", "Wrong address? Start again" keeping the name, "Send the link again" sending at once with a toast. `/register/resend` — "Send link" then `/register/sent` with that address, whatever the answer. Run → FAIL.
- [x] **Step 2: Implement** with the design system's form style and `registrationSchema`. Run → PASS; check the entry chunk's size with `pnpm build` against NFR-3.1's budget; `pnpm check` → PASS.
- [x] **Step 3:** the docs; commit `feat(web): the registration pages`; push.

### Task 7: The verify page and the login placeholder

**Files:**
- Create: `apps/web/src/registration/verify-page.tsx`, `login-page.tsx`, their tests; Modify: `apps/web/src/routes.tsx`, `apps/web/src/api/auth.ts`, `apps/web/src/api/client.ts`, `client.test.ts`

**Interfaces:**
- Produces: `verifyEmail(token: string): Promise<boolean>` — `true` for `{ verified: true }`; `false` for `{ verified: false }` or any error; a plain `fetch`, not `withSession`.

- [x] **Step 1: Tests:** `NFR-4.8: the token leaves the address before the call` (`history.replaceState` to `/verify` observed before `fetch`); the hourglass while waiting; verified → Lists with `Welcome! Your lists are in your account now.`, or `Welcome!` when not kept, and the registered address forgotten; `ACC-3.9: not verified or an error shows Link not valid`, with "Send a new link" and "Already confirmed your address? Log in"; `no token, or a reload after its removal, shows Link not valid with no call` (Review Focus 4); `an error from verify signs in no guest`. `/login` and `/login?confirmed` as the spec's table; Cancel. In `client.test.ts`: `ACC-2.11: guest_converted from a write and from a read sends to /login?confirmed and signs in no guest` (Review Focus 3). Run → FAIL.
- [x] **Step 2: Implement.** Run → PASS; `pnpm check` → PASS.
- [x] **Step 3:** commit `feat(web): the verify page and the login placeholder`; push.

### Task 8: The menu's account box

**Files:**
- Create: `apps/web/src/shell/use-session.ts`, `account-box.tsx`, `account-box.test.tsx`; Modify: `apps/web/src/shell/menu.tsx`
- Modify: `docs/architecture/visual-design.md` (the account box)

**Interfaces:**
- Consumes: `getSession()` (Task 6). Produces: `useSession(): { user: {...} | null; refresh(): void }`; the verify page calls `refresh()` after a verification.

- [x] **Step 1: Tests:** guest — "Keep your lists on every device.", "Log in" as the main button, "No account? Create account" below; on `/login` and `/register` the entry in the current-page look with `aria-current="page"`; account — the name and the email under it; after a verification the box shows the account without a reload. Run → FAIL.
- [x] **Step 2: Implement**, at the bottom of the menu above the API status, in the drawer and the sidebar alike. Run → PASS; `pnpm check` → PASS.
- [x] **Step 3:** the docs; commit `feat(web): the menu's account box`; push.

### Task 9: The E2E journeys

**Files:**
- Create: `e2e/support/mailpit.ts`, `e2e/tests/registration.spec.ts`
- Modify: `docs/development/testing.md` (the E2E email helper)

**Interfaces:**
- Produces: `latestEmail(to: string, options?: { timeoutMs?: number }): Promise<{ subject: string; text: string; verifyLink: string }>`, polling `http://localhost:8025/api/v1/search?query=to:<address>` for up to 10 s.

- [x] **Step 1: The journeys:** `ACC-2.1 ACC-2.7: a guest with a list registers, opens the link and sees that list as the account's`; `ACC-2.11: the link opened in a second context signs that one in, and the first shows the confirmed notice`; `ACC-3.9: a used link shows Link not valid`; `NFR-4.8: the address bar holds no token after /verify`; the axe check on `/register`, `/register/sent`, `/register/resend`, `/verify` (both states) and `/login`. Each registers `${randomUUID()}@example.com`.
- [x] **Step 2: Run** `pnpm test:e2e` → PASS; `pnpm check` → PASS.
- [x] **Step 3:** the docs; commit `test(e2e): registration journeys through Mailpit`; push.

### Task 10: The dialog strip

**Files:**
- Modify: what the reproduction points to (`apps/web/src/index.css`, or the dialog components in `apps/web/src/components/ui/`)

- [x] **Step 1: Reproduce** [#424](https://github.com/luiki-dev/szop/issues/424) in a desktop browser (the delete-lists dialog on Lists): the strip at the right edge while the dialog is open.
- [x] **Step 2: Fix** by making the backdrop cover the gutter, or moving the scroll lock so the gutter stays, whichever is smaller; an E2E or component check that the backdrop spans the window's width with the dialog open. `pnpm check` → PASS.
- [ ] **Step 3:** commit `fix(web): cover the scrollbar gutter behind a dialog`; push. Then `/finish-phase`.
