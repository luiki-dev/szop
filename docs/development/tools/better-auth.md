# Better Auth

Better Auth is a TypeScript authentication library: it creates users and sessions, stores them through a database adapter and sends the browser a session cookie. Szop uses its **anonymous plugin** only, so far: a guest gets a user and a session without an email or password.

## Contents

- [Why Szop uses it](#why-szop-uses-it)
- [Configuration](#configuration)
- [Mounted on Fastify](#mounted-on-fastify)
- [Regenerating the tables after an upgrade](#regenerating-the-tables-after-an-upgrade)
- [Official documentation](#official-documentation)

## Why Szop uses it

- **Sessions, cookies and later registration without writing them ourselves:** [ADR 0002](../../decisions/0002-technical-architecture.md) and [ADR 0012](../../decisions/0012-security-baseline.md).
- **Anonymous sessions are a plugin:** [ADR 0057](../../decisions/0057-guests-first-list-phase-details.md), decisions 11 to 13.

## Configuration

`createAuth` in `apps/api/src/auth/auth.ts` is the whole configuration:

- **`secret`** (`BETTER_AUTH_SECRET`, at least 32 characters): signs the session cookie. Never logged. The demo's comes from SSM.
- **`baseURL` and `trustedOrigins`** (`APP_ORIGIN`): the address the browser opens, with no path. Better Auth's own origin check refuses a request from any other origin, on top of the API's cross-site check.
- **`database`:** the Drizzle adapter (`provider: "pg"`). Its `schema` is keyed by our table names (`users`, `sessions`, `accounts`, `verifications`), which `modelName` also names.
- **`session`:** `expiresIn` 30 days, `updateAge` 1 day. A read after a day moves `expires_at` back to 30 days ahead and answers a fresh `Set-Cookie`. No `cookieCache`, so a deleted session row stops working at once.
- **`advanced.useSecureCookies`:** true on an `https` origin. The cookie is then `__Secure-better-auth.session_token` with `Secure`; on `http` (development, CI) it is `better-auth.session_token` without. Always `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`. Better Auth always prefixes `__Secure-` and offers no way to a `__Host-` prefix.
- **`advanced.database.generateId: "uuid"`:** Better Auth leaves the ID to the database, whose default is `uuidv7()`. `uuidv7()` in `@szop/shared` is for IDs the browser creates.

## Mounted on Fastify

- **`auth/routes.ts`:** a catch-all `/api/auth/*` for GET and POST. It turns the Fastify request into a Fetch `Request`, calls `auth.handler` and copies the answer back, keeping every `Set-Cookie` header separate. It is registered after the web baseline, so the cross-site and JSON-only checks run before Better Auth.
- **`auth/session.ts`:** `sessionHook(auth)`, a `preHandler` for the routes that need a user. It sets `request.user` to `{ id }` or `null` and forwards Better Auth's `Set-Cookie`, so a guest who only reads keeps a cookie as long-lived as the row. Routes outside its scope set no cookie ([ACC-1](../../requirements/ACC-accounts-and-guest-mode.md#acc-1).3).

## Regenerating the tables after an upgrade

`apps/api/src/db/auth-schema.ts` was generated once and is now ours. After upgrading `better-auth`, run the CLI against `src/auth/cli.ts` into a scratch file and compare the columns: `pnpm dlx @better-auth/cli generate --config src/auth/cli.ts` in `apps/api`. Copy over only what a new version added, then run `pnpm --filter @szop/api db:generate` ([Drizzle](drizzle.md)).

## Official documentation

- [Better Auth: introduction](https://www.better-auth.com/docs/introduction)
- [Anonymous plugin](https://www.better-auth.com/docs/plugins/anonymous)
- [Fastify integration](https://www.better-auth.com/docs/integrations/fastify)
