# Drizzle

Drizzle is a TypeScript object–relational mapper (ORM) that stays close to SQL: `drizzle-orm` runs the queries and applies the migrations, and `drizzle-kit` generates migrations from the schema.

## Why Szop uses it

- **Close to SQL, with types and no code generation:** [ADR 0002](../../decisions/0002-technical-architecture.md), decision 5. Prisma and Kysely were considered.
- **Version 0.45, not the 1.0 release candidate, and node-postgres as the driver:** [ADR 0020](../../decisions/0020-database-details.md), decisions 1 and 2.

## Configuration

- **`apps/api/drizzle.config.ts`:** drizzle-kit's settings. `dialect` is `postgresql`, `schema` points to `./src/db/schema.ts` and `out` to `./drizzle`. There are no credentials: `generate` compares the schema with the last snapshot and never connects to a database.
- **`apps/api/src/db/schema.ts`:** the schema, every table the API stores: `workspaces` and `lists`, and the re-export of `auth-schema.ts`.
- **`apps/api/src/db/auth-schema.ts`:** Better Auth's four tables (`users`, `sessions`, `accounts`, `verifications`). Better Auth's command-line interface (CLI) generated it once (`pnpm dlx @better-auth/cli generate --config src/auth/cli.ts`, which reads a dummy instance in `src/auth/cli.ts`); it was then edited by hand to the conventions below and is ours. After upgrading `better-auth`, generate into a scratch file, compare the columns and copy over only what a new version added.
- **`apps/api/drizzle/`:** committed. It holds each migration's SQL file, `meta/_journal.json` (every migration with its index, `when` timestamp and `tag`) and a snapshot per migration, which the next `generate` compares against.
- **`.prettierignore`:** lists `apps/api/drizzle/meta/`, so the journal and the snapshots stay as drizzle-kit writes them.
- **`apps/api/src/db/migrate.ts`:** calls `migrate()` with the migrations folder resolved from the file's own location, so it works from any working directory.

## Table conventions

[ADR 0057](../../decisions/0057-guests-first-list-phase-details.md), decision 14, holds for every table:

- Tables are plural and `snake_case`, columns `snake_case`, fields `camelCase`.
- `created_at` and `updated_at` are `timestamptz NOT NULL DEFAULT now()` (`{ withTimezone: true }` in Drizzle, since its `timestamp` is otherwise without a time zone), and `updated_at` has `$onUpdate(() => new Date())`.
- IDs are `uuid` with `DEFAULT uuidv7()` where the server creates the row. A list's ID has no default: the browser creates it.
- Constraints and indexes are named explicitly, in PostgreSQL's style: `<table>_pkey`, `<table>_<columns>_key` (unique), `<table>_<columns>_fkey`, `<table>_<columns>_idx`. Drizzle's generated names are longer and differ in style.
- Deleting a user cascades to the user's sessions, accounts, workspace and lists.

`db/schema.test.ts` checks the timestamps, the keys, the cascade and the ID defaults against a real database.

## Everyday use

- **`pnpm --filter @szop/api db:generate`:** after changing `schema.ts`, writes the next numbered migration. Read the SQL before committing it. CI runs the same command and fails if it writes anything ([the migration check](#the-schema-and-migrations-in-ci)).
- **`--custom --name=<name>`:** writes an empty migration for hand-written SQL, as `0000_init` was.
- **Migrations run by themselves** when the API starts (`migrations applied` in the log, with the schema version) and when the tests start.
- **The record of applied migrations:** Drizzle keeps it in `drizzle.__drizzle_migrations`. In `psql`, `\dt drizzle.*` lists the table and `SELECT * FROM drizzle.__drizzle_migrations;` shows the rows.

Pitfalls:

- **Never edit a migration once it is on `main`.** Drizzle 0.45 records a hash of each applied migration but never compares it, so an edited migration would silently not be applied again: databases that ran the old version would keep it, and only new ones would get the edit. The API refuses to start on such a database ([the migration check](#the-migration-check), "edited"). Write a new migration instead.
- **Drizzle applies only migrations newer than the latest one recorded,** by the `when` timestamp. A migration generated on an older branch and merged after a newer one would be skipped silently, and the API refuses to start instead ([the migration check](#the-migration-check), "skipped"): regenerate it on top of `main` before merging.
- **A migration runs inside one transaction** with the others of the same start.
- **`pnpm audit` reports the GitHub Security Advisory (GHSA) [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)** (moderate) in esbuild 0.24.2 or older, which drizzle-kit 0.31 reaches through the deprecated `@esbuild-kit` packages. It is harmless here: the advisory concerns esbuild's development server (`serve`), which drizzle-kit never runs, and drizzle-kit is a development dependency. It goes away with Drizzle 1.0 ([OP-077](https://github.com/luiki-dev/szop/issues/120)). Dependabot raises an alert for it; dismissing it or adding an override is the owner's call.

## The migration check

Before Drizzle migrates, the API compares the migrations recorded in `drizzle.__drizzle_migrations` with the ones in `apps/api/drizzle/`, matching them by their `when` timestamp ([ADR 0033](../../decisions/0033-app-ready-for-the-cloud-details.md), decision 3). Drizzle itself would pass over each of these cases in silence; the API refuses to start instead:

- **unknown:** the database recorded a migration this code does not have. For example, you started the API on a branch that adds `0001_lists`, then switched back to `main`.
- **skipped:** a migration in this code is older than the newest applied one and was never applied, so Drizzle would never apply it. For example, you generated `0001_items` on one branch, then generated and applied `0001_lists` on a newer branch, and then switched to a branch that has both.
- **edited:** a migration's SQL changed after it was applied. For example, you started the API on your branch, then changed the branch's migration and started it again.

A new, empty database passes, and so does a normal upgrade: migrations newer than every applied one are pending, not skipped. The check is the code in `apps/api/src/db/migration-check.ts`.

**The check and the migration run under a lock.** Drizzle takes none, so two instances starting together would both read the same "last applied" migration and both apply what follows: a data migration would run twice. `server.ts` runs the check and `runMigrations` inside `withMigrationLock` (`apps/api/src/db/migration-lock.ts`), which holds a PostgreSQL advisory lock on a pooled connection; the other instances wait, then find nothing pending ([ADR 0036](../../decisions/0036-scalability-and-isolation.md), decision 2; [ADR 0040](../../decisions/0040-two-tasks-details.md), decisions 4 to 6). The log shows `waiting for the migration lock` and `migration lock taken`. `db/migration-lock.test.ts` proves it with two migrators at once, and `pnpm check:scale` with two containers.

On a mismatch the log shows `startup failed`, the API exits with code 1, and the error's message lists each migration with its case, then the remedy:

```text
The database's migrations do not match this code's:
  unknown: applied at 1891307052475, not in this code
Reset the database: `pnpm db:reset` locally; on the demo, `demo-down` then `demo-up`.
```

- **Locally:** `pnpm db:reset` wipes the database ([scripts](../scripts.md#the-database-and-the-container-image)); the next start migrates the empty one.
- **On the demo:** `demo-down`, then `demo-up`, which the owner triggers.

The remedy belongs to the environment, not to the check. Both environments keep no data worth saving today; once one does, it needs a different remedy, such as fixing the migrations by hand ([OP-097](https://github.com/luiki-dev/szop/issues/224)).

## The schema and migrations in CI

The `lint` job of `ci.yml` runs `pnpm --filter @szop/api db:generate` and fails, with a message naming the fix, if `git status` then shows a change under `apps/api/drizzle/`: the schema was changed without its migration ([ADR 0057](../../decisions/0057-guests-first-list-phase-details.md), decision 16; [OP-076](https://github.com/luiki-dev/szop/issues/95)). To reproduce it, run `pnpm db:generate` and look at `git status`. This is a different check from the one above, which compares a database with the migrations at startup.

## Migrations and rolling deploys

During a deploy, the old version runs for a minute or more on the new schema: ECS starts the new task, which migrates the database when it starts, and stops the old task only once the new one is healthy ([ADR 0036](../../decisions/0036-scalability-and-isolation.md), decision 3). So **every migration must work with the code of the release before it.** The rule is **expand, then contract**:

- **Expand first:** add tables, add columns that are nullable or have a default, add indexes. The old code ignores them.
- **Switch the code over** in the same release or a later one.
- **Contract later:** drop or rename only in a release after the one that stopped using the old shape, once no task runs the old code.
- **A rename is three steps:** add the new column, backfill it and read from it, and drop the old column in a later release. During the overlap the new code writes both columns, since rows the old code writes lack the new one.

A migration that breaks the old code makes the old task fail its requests while the new one starts. A failed deploy is fixed forward, not rolled back, because a rollback would start the old version on a schema its [migration check](#the-migration-check) refuses (`unknown`): the fix is another migration. Szop has no tables yet; the rule applies from the first one ([PH-16](../../roadmap.md#ph-16-guest-workspace-and-lists)).

**The startup budget:** the migrations run before the server listens, and with the 60-second grace period ([ADR 0039](../../decisions/0039-safe-redeploys-details.md), decision 8) a task must be listening within about a minute of starting, or the load balancer marks it unhealthy, ECS replaces it, and after three tries the deployment fails.

## Official documentation

- Drizzle with PostgreSQL: <https://orm.drizzle.team/docs/get-started-postgresql>
- Migrations: <https://orm.drizzle.team/docs/migrations>
- `drizzle-kit generate`: <https://orm.drizzle.team/docs/drizzle-kit-generate>
- node-postgres's pool: <https://node-postgres.com/apis/pool>
