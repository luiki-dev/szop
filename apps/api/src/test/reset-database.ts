import pg from "pg";
import { testDatabaseSettings } from "./database.ts";

async function run(database: string, statements: string[]): Promise<boolean> {
  const settings = testDatabaseSettings(database);
  const client = new pg.Client({
    host: settings.host,
    port: settings.port,
    database: settings.name,
    user: settings.user,
    password: settings.password,
  });
  await client.connect();
  try {
    let found = false;
    for (const statement of statements) {
      found = ((await client.query(statement)).rowCount ?? 0) > 0;
    }
    return found;
  } finally {
    await client.end();
  }
}

// An empty database named `name` (and owned by `owner`, a role that exists),
// without DROP DATABASE: each DROP DATABASE, and each CREATE DATABASE with the
// default FILE_COPY strategy, waits for a checkpoint, and under load (many
// workers, a busy CPU) that wait outlasts the hook timeout (#317). The database
// is created once (WAL_LOG, which needs no checkpoint) and emptied by dropping
// its schemas. Names go into the statements unquoted: they are numbered,
// never input.
// shortcut: clears only the `drizzle` and `public` schemas, so other schemas,
// `ALTER DATABASE … SET` and default privileges survive; upgrade when a
// migration adds another schema or a database-level setting.
export async function resetDatabase(
  name: string,
  owner?: string,
): Promise<void> {
  const exists = await run("postgres", [
    `SELECT 1 FROM pg_database WHERE datname = '${name}'`,
  ]);
  if (!exists) {
    await run("postgres", [
      `CREATE DATABASE ${name} STRATEGY = WAL_LOG${owner ? ` OWNER ${owner}` : ""}`,
    ]);
  } else if (owner) {
    await run("postgres", [`ALTER DATABASE ${name} OWNER TO ${owner}`]);
  }
  await run(name, [
    "DROP SCHEMA IF EXISTS drizzle CASCADE",
    "DROP SCHEMA IF EXISTS public CASCADE",
    "CREATE SCHEMA public AUTHORIZATION pg_database_owner",
    "GRANT USAGE ON SCHEMA public TO PUBLIC",
  ]);
}
