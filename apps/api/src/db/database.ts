import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { DatabaseSettings } from "../config.ts";

// Drizzle over a node-postgres pool; the pool itself is `db.$client`.
export type Database = NodePgDatabase & { $client: pg.Pool };

// Opens no connection: the pool connects on the first query. Whoever creates
// the database closes it with `db.$client.end()` (ADR 0020, decision 12).
export function createDatabase(settings: DatabaseSettings): Database {
  const pool = new pg.Pool({
    host: settings.host,
    port: settings.port,
    database: settings.name,
    user: settings.user,
    password: settings.password,
    // Fail fast when the database is unreachable, including in the health
    // check, instead of waiting for the operating system's timeout.
    connectionTimeoutMillis: 2000,
  });
  // An idle connection that drops (the server restarted or stopped) makes the
  // pool emit "error"; without a listener, Node would crash the process. The
  // pool discards that connection and opens a new one on the next query.
  pool.on("error", () => {});
  return drizzle({ client: pool });
}
