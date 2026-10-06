# Drizzle

Drizzle is a TypeScript object–relational mapper (ORM) that stays close to SQL: `drizzle-orm` runs the queries and applies the migrations, and `drizzle-kit` generates migrations from the schema.

## Why Szop uses it

- **Close to SQL, with types and no code generation:** [ADR 0002](../../decisions/0002-technical-architecture.md), decision 5. Prisma and Kysely were considered.
- **Version 0.45, not the 1.0 release candidate, and node-postgres as the driver:** [ADR 0020](../../decisions/0020-database-details.md), decisions 1 and 2.

## Configuration

- **`apps/api/drizzle.config.ts`:** drizzle-kit's settings. `dialect` is `postgresql`, `schema` points to `./src/db/schema.ts` and `out` to `./drizzle`. There are no credentials: `generate` compares the schema with the last snapshot and never connects to a database.
- **`apps/api/src/db/schema.ts`:** the schema, every table the API stores. Empty until the first table.
- **`apps/api/drizzle/`:** committed. It holds each migration's SQL file, `meta/_journal.json` (every migration with its index, `when` timestamp and `tag`) and a snapshot per migration, which the next `generate` compares against.
- **`.prettierignore`:** lists `apps/api/drizzle/meta/`, so the journal and the snapshots stay as drizzle-kit writes them.
- **`apps/api/src/db/migrate.ts`:** calls `migrate()` with the migrations folder resolved from the file's own location, so it works from any working directory.

## Everyday use

- **`pnpm --filter @szop/api db:generate`:** after changing `schema.ts`, writes the next numbered migration. Read the SQL before committing it.
- **`--custom --name=<name>`:** writes an empty migration for hand-written SQL, as `0000_init` was.
- **Migrations run by themselves** when the API starts (`migrations applied` in the log, with the schema version) and when the tests start.
- **The record of applied migrations:** Drizzle keeps it in `drizzle.__drizzle_migrations`. In `psql`, `\dt drizzle.*` lists the table and `SELECT * FROM drizzle.__drizzle_migrations;` shows the rows.

Pitfalls:

- **Never edit a migration once it is on `main`.** Its hash is recorded; write a new one instead.
- **Drizzle applies only migrations newer than the latest one recorded,** by the `when` timestamp. A migration generated on an older branch and merged after a newer one is skipped silently: regenerate it on top of `main` before merging.
- **A migration runs inside one transaction** with the others of the same start.

## Official documentation

- Drizzle with PostgreSQL: <https://orm.drizzle.team/docs/get-started-postgresql>
- Migrations: <https://orm.drizzle.team/docs/migrations>
- `drizzle-kit generate`: <https://orm.drizzle.team/docs/drizzle-kit-generate>
- node-postgres's pool: <https://node-postgres.com/apis/pool>
