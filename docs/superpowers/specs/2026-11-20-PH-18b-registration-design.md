# PH-18b Registration: design

## Contents

- [Goal](#goal)
- [Decisions](#decisions)
- [The design](#the-design)
  - [The screens](#the-screens)
  - [Better Auth's configuration](#better-auths-configuration)
  - [Sign-up](#sign-up)
  - [The verification link](#the-verification-link)
  - [Moving the workspace](#moving-the-workspace)
  - [Resending the link](#resending-the-link)
  - [The emails](#the-emails)
  - [The data model](#the-data-model)
  - [The web client](#the-web-client)
  - [The E2E email helper](#the-e2e-email-helper)
  - [The dialog strip](#the-dialog-strip)
- [Acceptance criteria](#acceptance-criteria)
- [Tests](#tests)
- [Documentation](#documentation)
- [Demo check](#demo-check)
- [Risks](#risks)
- [Out of scope](#out-of-scope)
- [Left to the builder](#left-to-the-builder)

## Goal

A guest creates an account with a display name, an email address and a password, confirms the address through an emailed link, and keeps this browser's lists as the account's ([PH-18b](../../roadmap.md#ph-18b-registration)).

## Decisions

[ADR 0079](../../decisions/0079-registration-phase-details.md#decisions).

## The design

### The screens

The approved mockup is [`ph-18b-journey-v5.html`](../../architecture/visual-design/ph-18b-journey-v5.html): every screen and transition of registration and of [PH-18c](../../roadmap.md#ph-18c-login-and-logout)'s login, on a phone and on a desktop. Two later decisions change it: resending is built here, not in PH-18c ([ADR 0079](../../decisions/0079-registration-phase-details.md), decision 14), and the emails open with "Hi," alone (decision 18).

Every screen is a page in the app shell, a card 400 px wide at most on a desktop, in the design system's form style ([visual-design.md](../../architecture/visual-design.md)).

| Page | What it shows | Built here |
|---|---|---|
| `/register` | "Your name", "Email", "Password" and "Repeat password" (each with Show), "Keep this browser's lists" when the guest has a workspace, "Create account", Cancel, "Already have an account? Log in". Errors under their field, checked when leaving the field and on submit; the breached-password message comes from the server on submit. The password's length is counted as the server counts it, in UTF-16 code units (`password.length`), so an emoji counts as 2. | ✅ |
| `/register/sent` | "Check your inbox", the envelope, the address from this browser, "Back to my lists", "Wrong address? Start again" (back to `/register` with the name filled in), "Nothing arrived? Send the link again" (sends at once, a toast confirms). | ✅ |
| `/register/resend` | "Send a new link", Email, "Send link", Cancel; then `/register/sent` with that address, whatever happened. | ✅ |
| `/verify?token=…` | The hourglass and "Confirming your address…" while the call runs; then Lists with the toast "Welcome! Your lists are in your account now." (or "Welcome!" when the lists were not kept), or "Link not valid". | ✅ |
| "Link not valid" (on `/verify`) | The broken link, "This link no longer works. It may have expired, or you may have used it already.", "Send a new link" (to `/register/resend`), "Already confirmed your address? Log in". | ✅ |
| `/login` | Here: the title, the notice "Your address was confirmed in another browser. Log in here to see your lists." when opened as `/login?confirmed`, the line "Logging in comes with the next update.", and Cancel. The form is PH-18c's. | in part |
| The menu's account box | Guest: "Keep your lists on every device.", "Log in" as the main button, "No account? Create account" as a link below; the current page's entry in the current-page look with `aria-current="page"`. Account: the name and the email under it ("Log out" is PH-18c's). | ✅ |

Cancel goes back to the page the user came from, or Lists. `/register` with an account's session goes to Lists. The owner supplies the illustrations (envelope, hourglass, broken link) as SVG before the screen tasks; the mockup's emoji are placeholders.

### Better Auth's configuration

`createAuth` in `apps/api/src/auth/auth.ts` gains:

- `emailAndPassword`: `enabled`, `requireEmailVerification: true`, `minPasswordLength: 15`, `maxPasswordLength: 128`, `autoSignIn: false`, and `onExistingUserSignUp`, which sends the "already have an account" email.
- `emailVerification`: `expiresIn: 24 * 60 * 60`, `sendOnSignUp: true`, `autoSignInAfterVerification: true`, `sendVerificationEmail` (the link of [The verification link](#the-verification-link)), and `beforeEmailVerification` (the move).
- `user.additionalFields`: the columns of [The data model](#the-data-model), all three with `returned: false`, so no answer carries them; only `keepGuestData` is accepted from the body (`input: true`), the other two with `input: false`. With `returned` left on, a new address's answer would carry the registering guest's ID and an existing address's answer `null`, which tells them apart ([ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).5).
- `databaseHooks.user.create.before`, only when the path is `/sign-up/email`: sets `registeredByGuest` from the request's session, when that session's user is anonymous and not converted. A before hook cannot add an `input: false` field, and the body may not carry it (Better Auth answers `FIELD_NOT_ALLOWED`).
- `anonymous({ disableDeleteAnonymousUser: true })`, with no `onLinkAccount`.
- `hooks.before` for `/sign-up/email`: the checks and the replacement of [Sign-up](#sign-up), steps 1 to 4.
- `hooks.after` for `/sign-up/email`: a `FAILED_TO_CREATE_USER` error becomes the generic answer ([Sign-up](#sign-up), step 6).
- `hooks.after` for `/verify-email`: the answer `{ verified }` ([The verification link](#the-verification-link)).
- `logger`: Better Auth's lines go to the app's logger with their message only, never their arguments, which can carry an address or a database error with one ([ADR 0078](../../decisions/0078-sending-email-phase-details.md), decision 5). Better Auth logs a failed user creation at `error` with the error object, and "Sign-up attempt for existing email: <address>" at `info`.
- `rateLimit` keeps Better Auth's default for `/sign-up*`, 3 in 10 seconds per IP; per-email limits are [PH-20](../../roadmap.md#ph-20-quotas-and-rate-limits)'s.
- `AppDeps` gains `email: EmailSender`, built in `server.ts` from the config; the tests pass a fake that records emails, or the real sender against Mailpit.

The allowlist of `apps/api/src/auth/routes.ts` gains `POST /api/auth/sign-up/email` and `GET /api/auth/verify-email`.

### Sign-up

`POST /api/auth/sign-up/email` with `{ name, email, password, keepGuestData }`, with the browser's guest cookie when it has one. In order:

1. **The body** is checked before anything changes, since the before hook runs ahead of Better Auth's own checks: a valid email address, not on the anonymous plugin's placeholder domain; a password of 15 to 128 UTF-16 code units, as Better Auth counts it; `keepGuestData` a boolean or absent. A failure answers 400. Without this, a sign-up with someone's address and a 1-character password would delete their pending account before Better Auth refused it.
2. **The display name** is checked with a schema in `packages/shared` (1 to 50 characters after trimming, no control characters), the one the form uses; a failure answers 400 with its message. The hook hands Better Auth the body with the trimmed name, so the stored name is trimmed.
3. **The breach check** ([ADR 0079](../../decisions/0079-registration-phase-details.md), decision 15): the SHA-1 of the password, its first 5 characters sent to `https://api.pwnedpasswords.com/range/<prefix>` with `Add-Padding: true`, a time limit of about 3 seconds. Found: 400 with the code `password_breached` and "This password appears in known data leaks. Choose another." Any failure: one `warn` line with no password, hash or address, and the password is accepted.
4. **An unverified account with that address** (`is_anonymous = false`, `email_verified = false`, the address matched in lower case) is deleted in a transaction that first locks its row (`SELECT … FOR UPDATE`), with its accounts and sessions. Guests are never matched: they are unverified users too.
5. **Better Auth's sign-up.** A new address: the user is created, with the registering guest (set by `databaseHooks.user.create.before`) and the checkbox, and the verification email is sent. A verified address: `onExistingUserSignUp` sends the other email. Both answer 200 with no session.
6. **Two sign-ups at once** for one address: the loser's insert breaks the unique address, and Better Auth answers 422 `FAILED_TO_CREATE_USER`. The after hook turns that answer into the one an existing address gets (`{ token: null, user }`, the user built from the body as Better Auth builds it), so the loser too sees "check your inbox".

The answers to a new, an unverified and a verified address carry the same keys and values for the same body ([ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).5).

The answer never depends on the send ([ADR 0078](../../decisions/0078-sending-email-phase-details.md), decision 5): every email goes through `sendInBackground`.

### The verification link

The email's link is `<origin>/verify?token=<JWT>`, built by the app from the `token` Better Auth hands `sendVerificationEmail`, not Better Auth's own URL. The SPA's `/verify`:

1. reads the token and at once replaces the address with `/verify` (`history.replaceState`), so the token leaves the address bar and the history ([NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4).8);
2. calls `GET /api/auth/verify-email?token=…` without `callbackURL`, so Better Auth answers JSON, with a plain `fetch`, not through `withSession`, so an error never signs in a guest and retries;
3. `{ verified: true }`: the account is verified and this browser signed in; the SPA goes to Lists with the toast. `{ verified: false }` (the account was verified already) or any error (`TOKEN_EXPIRED`, `INVALID_TOKEN`, `USER_NOT_FOUND`, read from Better Auth's `{ code, message }` body): "Link not valid".

Better Auth answers `{ status: true, user: null }` both to a verification and to an account verified already; only the session it sets tells them apart. The after hook on `/verify-email` therefore answers `{ verified: true }` when Better Auth set a new session (`ctx.context.newSession`) and `{ verified: false }` otherwise, and leaves errors as they are.

A link works once because a verified account ignores every later link, and a replaced account has a new ID; it expires after 24 hours ([ADR 0079](../../decisions/0079-registration-phase-details.md), decision 13). The request log already hides every query value ([ADR 0025](../../decisions/0025-web-security-baseline-details.md), decision 6).

### Moving the workspace

In `beforeEmailVerification(user)`, in one transaction:

1. the account is read again with `SELECT … FOR UPDATE`; when it is gone (replaced meanwhile), the hook throws and the verification fails;
2. the account's registering guest is read; with none, nothing happens;
3. when `keepGuestData` and the guest has a workspace, `workspaces.user_id` changes from the guest to the account (the account has none yet; the column is unique);
4. the guest's `convertedAt` is set.

Each step does nothing a second time, so a failure that leaves the account unverified is finished by opening the link again. The opening browser's own guest is not touched.

`sessionHook` (`apps/api/src/auth/session.ts`): a session whose user is an anonymous one with `convertedAt` set is deleted, and the request answers 401 with the code `guest_converted`, on every route. The browser that opened the link never meets it, since the sign-in replaced its cookie.

### Resending the link

`POST /api/registration/resend` with `{ email }`, a route of the app in `apps/api/src/registration/`: it calls `auth.api.sendVerificationEmail({ body: { email } })` with no headers, so Better Auth takes its path without a session, sends only to an unverified account, and answers `{ status: true }` after at least 500 ms for any address. The route answers 204 for a valid address and 400 for an invalid one; Better Auth's own `/send-verification-email` stays closed. The web baseline applies to it like any route.

Called from the app, `auth.api` skips Better Auth's rate limiter, which runs only on requests to its handler. Without a limit of its own, anyone could sign up someone's address and then send it links without end. The route allows 3 requests in 60 seconds per IP, Better Auth's own rule for `/send-verification-email`, and answers 429 past it. The count is kept in memory, like Better Auth's (shortcut: per task, until [PH-20](../../roadmap.md#ph-20-quotas-and-rate-limits)'s quotas); the IP is the one the API resolves from `TRUSTED_PROXIES`.

### The emails

`apps/api/src/email/templates.ts`, one function per email returning `{ subject, text, html }`, from Szop's address:

- **Confirm your email for Szop:** "Hi," / "confirm your address to finish creating your Szop account:" / the button "Confirm my address" / "The link works once, for 24 hours. If you didn't create an account, ignore this email; nothing happens."
- **You already have a Szop account:** "Hi," / "someone, maybe you, tried to create a Szop account with this address. It already has one." / the button "Log in" (to `/login`) / "Forgot your password? Reset it from the login page." is left out until PH-29 / "If it wasn't you, ignore this email."

Only the origin and the token are put into the HTML, both escaped; no user input appears in either email.

### The data model

A migration adds to `users`:

| Column | Type | Set by | Meaning |
|---|---|---|---|
| `registered_by_guest` | `uuid`, null, references `users`, `on delete set null` | sign-up | the guest whose browser registered |
| `keep_guest_data` | `boolean`, not null, default `false` | sign-up's checkbox, or `true` when it is not shown | move the guest's workspace at verification |
| `converted_at` | `timestamptz`, null | verification, on the guest | the guest's sessions stop working |

### The web client

- **A session hook** reads `GET /api/auth/get-session` once, for the menu's account box (anonymous or not, the name and the email), and refreshes it after a verification.
- **`withSession` and the reads** (`apps/web/src/api/client.ts`): a 401 with the code `guest_converted` does not sign in a new guest; it sends the browser to `/login?confirmed`. Any other 401 keeps today's behavior. Today `withSession` retries every 401 with a guest sign-in, and the reads throw an `ApiRequestError` with no code, so both read the code from the app's error body (`{ error: { code, message } }`, `apiErrorSchema`) and `ApiRequestError` gains it. Better Auth's own errors (`{ code, message }`, on sign-up and verify) are read by the registration pages, not by `apiErrorSchema`.
- **The registered address** is kept in `localStorage` from the sign-up, for `/register/sent`, "Send the link again" and `/login?confirmed`'s email, and removed after a verification.
- **The checkbox** shows when the guest has a workspace; how the SPA learns it is left to the builder. When it is not shown, the form sends `keepGuestData: true`: a guest's workspace is created at its first write, so a guest who registers first and then adds a list from "Back to my lists" has that list moved at verification, not left behind with a guest that no longer works.
- The registration pages are their own chunk, like the list's screen, so the entry chunk stays within [NFR-3](../../requirements/NFR-non-functional-requirements.md#nfr-3).1's budget.

### The E2E email helper

`e2e/` gains a helper that finds the newest email to an address through Mailpit's API (`/api/v1/search?query=to:<address>`), waiting a few seconds for it, and returns its subject, text and the first link to `/verify`. Each test registers a unique address, as the API tests do ([testing.md](../../development/testing.md)).

### The dialog strip

[#424](https://github.com/luiki-dev/szop/issues/424): a dialog leaves a strip about 15 px wide at the window's right edge, where `scrollbar-gutter: stable` keeps space for the scrollbar that the dialog's scroll lock removed. The fix keeps the gutter and makes the backdrop cover it, or moves the lock so the gutter stays; the builder picks after reproducing it.

## Acceptance criteria

The texts are in [ACC](../../requirements/ACC-accounts-and-guest-mode.md) as reviewed in the brainstorm.

- [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).1, .2, .3, .4, .5, .6, .7, .9, .10, .11, .12: whole. [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).8 is PH-18c's.
- [ACC-3](../../requirements/ACC-accounts-and-guest-mode.md#acc-3).5: whole.
- [ACC-3](../../requirements/ACC-accounts-and-guest-mode.md#acc-3).9: in part, the verification link; the reset link is PH-29's.
- [NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4).8: in part, the verification token; the reset and share tokens come with their phases.

## Tests

Following [testing.md](../../development/testing.md), each test of a criterion named with its ID:

- **Unit:** the display name's schema; the breach check against a stubbed fetch (found, not found, padding lines with a count of 0, an error status, a timeout and an unreadable body, each of the last three accepting with one `warn` line); the email functions (subjects, links, escaping, no name).
- **Integration (API, PostgreSQL, the fake sender or Mailpit):** Better Auth allows 3 sign-ups in 10 seconds per IP, so each case sends its own client IP (`X-Forwarded-For` from a trusted proxy) or builds its own app; each registers a unique address.
  - [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).1, [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).2: a sign-up answers 200 with no session and one verification email; 14 and 129 UTF-16 code units are refused, 15 and 128 accepted, a password of spaces and emoji accepted (an emoji counting as 2); the stored name is trimmed.
  - [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).3, [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).4: a breached password answers 400 `password_breached`; the service failing accepts it.
  - [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).5, [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).6: the answers to a new, an unverified and a verified address, with a guest's cookie, carry the same keys and values; the verified one gets the "already have an account" email and no verification email.
  - [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).9: a second sign-up for an unverified address replaces it, and the first link answers `INVALID_TOKEN`; two at once end in one account and two answers like the first; a sign-up with a too-short password or a placeholder-domain address leaves the unverified account and every guest in place.
  - [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).7, [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).10: ticked, the guest's workspace with its lists, catalog and categories (Szop has no templates yet) is the account's after verification; with no checkbox (no workspace at sign-up) and a list added before verification, that list is the account's; unticked, the account's first use creates a workspace with the default catalog and no lists, and the guest's is untouched.
  - [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).11: verified with a second guest's cookie, that browser is the account's, its own workspace untouched, and the registering guest's next request answers 401 `guest_converted`.
  - [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).12: an empty, a 51-character and a control-character name answer 400.
  - [ACC-3](../../requirements/ACC-accounts-and-guest-mode.md#acc-3).5: the resend answers the same for an unknown, an unverified and a verified address, and only the unverified one gets an email; the fourth request in 60 seconds from one IP answers 429.
  - [ACC-3](../../requirements/ACC-accounts-and-guest-mode.md#acc-3).9: a verification answers `{ verified: true }` with a session cookie; a second use of the link answers `{ verified: false }` with none; a link past 24 hours answers `TOKEN_EXPIRED`. The clock is moved by faking `Date` only, since the resend's 500 ms floor is a `setTimeout` that fake timers would stop.
  - The move run twice (the hook called again) leaves one workspace and one conversion; the hook run for an account deleted meanwhile fails and moves nothing.
  - No log line holds an address, from a sign-up for an existing address or from two sign-ups at once.
  - [NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4).12: the new paths answer, `/send-verification-email` answers 404.
  - The "token never in the log" test covers `verify-email` ([OP-053](https://github.com/luiki-dev/szop/issues/26)).
- **Component (web):** each page's states as in the mockup; the checkbox shown only with a workspace, and `keepGuestData: true` sent without it; Cancel's destination; the account box's current-page look and `aria-current`; `guest_converted` sending to `/login?confirmed`, from `withSession` and from a read; an error from verify not signing in a guest; [NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4).8: the token removed before the call.
- **E2E (Playwright, Mailpit):** a guest with a list registers, opens the link from Mailpit, and sees that list as the account's ([ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).1, [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).7); the link opened in a second browser context signs that one in, and the first shows the confirmed notice ([ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).11); a used link shows "Link not valid" ([ACC-3](../../requirements/ACC-accounts-and-guest-mode.md#acc-3).9); the address bar holds no token after `/verify` ([NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4).8).
- **Accessibility:** the axe checks of the E2E suite on every new page.

## Documentation

- [ACC](../../requirements/ACC-accounts-and-guest-mode.md), [UC](../../requirements/UC-use-cases.md) and the [index](../../requirements/functional-requirements.md): the reviewed criteria, already in this commit; their statuses as they are delivered.
- [`architecture.md`](../../architecture/architecture.md): registration and verification, the move at verification, the `users` columns, `guest_converted`.
- [`threat-model.md`](../../architecture/threat-model.md): the new entry points (sign-up, verify, resend), the outbound call to Have I Been Pwned, the resend's limit per IP, replacing unverified accounts and what it leaves open (see [Risks](#risks)), the display name kept out of emails.
- [`stack-overview.md`](../../architecture/stack-overview.md): email verification with a signed token (JWT), k-anonymity in the breach check.
- [`visual-design.md`](../../architecture/visual-design.md): the account box and the form pages, with the mockup.
- [`testing.md`](../../development/testing.md): the E2E email helper.
- [`glossary.md`](../../glossary.md): JWT, k-anonymity and account pre-hijacking, if not there yet.

## Demo check

- **Local (the production-like environment):** register as a guest with lists; the email in Mailpit; the link opens Lists with the lists kept; the link again shows "Link not valid"; register unticked and see an empty account; the link opened in a private window signs that window in, and the first window shows the confirmed notice; resend from `/register/sent` and `/register/resend`; a breached password ("password123456789") refused; the address bar after `/verify`.
- **AWS:** the breach check reaches Have I Been Pwned from the task (a breached password refused), and a registration's email arrives through SES at a verified address.

Checked by hand: [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).3, [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).7, [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).11, [NFR-4](../../requirements/NFR-non-functional-requirements.md#nfr-4).8.

## Risks

- **Better Auth's hooks do not run as read.** The flow relies on `beforeEmailVerification`, `onExistingUserSignUp` and the before hook seeing the request's session; the first task proves them against PostgreSQL before anything is built on them, and the execution stops there.
- **The anonymous plugin's hooks on verification.** With `disableDeleteAnonymousUser` and no `onLinkAccount`, the plugin should leave every guest alone; a test checks the opening browser's guest after verification.
- **A Better Auth upgrade changes the verify answer.** `{ verified }` depends on Better Auth setting a new session only when it verifies; the integration test pins both answers.
- **Replacing an unverified account leaves two abuses open.** Replacing closes the blocked address and an account prepared in advance for its owner to verify. But anyone can cancel someone's pending registration by signing up the same address, so the owner's first link stops working; and someone who signs up another person's address with their own password sends that person a genuine "Confirm" email: if the person opens it, perhaps thinking it is their own after their own sign-up was replaced, they verify the stranger's account, with the stranger's guest workspace in it, and the stranger knows its password once [PH-18c](../../roadmap.md#ph-18c-login-and-logout) lands. Accepted for now and recorded in the threat model; [PH-20](../../roadmap.md#ph-20-quotas-and-rate-limits)'s per-email limits narrow the first.
- **Replacement during a verification.** Better Auth marks the account verified by its address, after `beforeEmailVerification`. If a replacement lands between the two, the old link verifies the new account. The move's re-read narrows the window to Better Auth's own few statements; accepted.
- **A guest's write during the verification.** A request that passed `sessionHook` before the move can create a new workspace for the guest after it, and that write stays with the guest. Accepted: it needs the same guest writing in another tab at the moment of the verification.
- **Link scanners.** An email scanner that opens links and runs JavaScript (such as Microsoft's Safe Links) would verify the account and use the link up: the user then sees "Link not valid", and the registering browser the confirmed notice, with no working login form until PH-18c. Accepted; "Already confirmed your address? Log in" points the way.
- **The gap until PH-18c.** A verified user who loses their session cannot log in again until PH-18c merges; accepted ([ADR 0079](../../decisions/0079-registration-phase-details.md), decision 6).
- **SES's sandbox** delivers only to verified addresses, so on the demo only the owner's verified addresses can register.

## Out of scope

- Logging in, logging out, the unverified sign-in, [ACC-2](../../requirements/ACC-accounts-and-guest-mode.md#acc-2).8 and SEC-04 ([#344](https://github.com/luiki-dev/szop/issues/344)): [PH-18c](../../roadmap.md#ph-18c-login-and-logout).
- The `/import` page: [PH-19](../../roadmap.md#ph-19-guest-data-on-login).
- Password reset and change, and the reset link in the "already have an account" email: [PH-29](../../roadmap.md#ph-29-password-reset-and-change).
- Changing the display name: [PH-30](../../roadmap.md#ph-30-settings-and-account-deletion).
- Per-email limits and the daily email cap: [PH-20](../../roadmap.md#ph-20-quotas-and-rate-limits).
- Deleting unverified accounts after 7 days: [PH-31](../../roadmap.md#ph-31-automatic-cleanup).

## Left to the builder

- How the SPA learns that the guest has a workspace (a field on an existing answer or a small endpoint), and the count of lists the checkbox's hint shows.
- The names of the files, the hook functions and the `localStorage` key.
- The breach check's exact time limit and the shape of its `warn` line.
- How the resend's limit counts (a small map in the route, or a request to Better Auth's handler so its own limiter applies), with the limit of [Resending the link](#resending-the-link).
- How `sessionHook` reads `convertedAt` (from the session's user, or a query).
- The fix of [#424](https://github.com/luiki-dev/szop/issues/424).
- The exact wording of messages the mockup does not show.
