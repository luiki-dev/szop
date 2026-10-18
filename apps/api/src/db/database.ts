import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { DatabaseSettings } from "../config.ts";

// Drizzle over a node-postgres pool; the pool itself is `db.$client`.
export type Database = NodePgDatabase & { $client: pg.Pool };

// Amazon's certificate authorities for RDS, every region, from
// apps/api/certs/, wherever the process was started from.
export const rdsCaBundle = fileURLToPath(
  new URL("../../certs/rds-global-bundle.pem", import.meta.url),
);

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
    // verify-full: the server's certificate must chain to the bundle and name
    // the host (ADR 0033, decision 5). Read here, so a missing bundle stops
    // startup instead of the first query.
    ssl:
      settings.tls === "verify-full"
        ? { ca: readFileSync(rdsCaBundle, "utf8"), rejectUnauthorized: true }
        : false,
  });
  // An idle connection that drops (the server restarted or stopped) makes the
  // pool emit "error"; without a listener, Node would crash the process. The
  // pool discards that connection and opens a new one on the next query.
  pool.on("error", () => {});
  return drizzle({ client: pool });
}
