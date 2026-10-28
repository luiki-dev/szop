import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import pg from "pg";
import { z } from "zod";
import type { DatabaseSettings } from "../config.ts";
import type { Database } from "./database.ts";

const port = z.coerce.number().int().min(1).max(65535);

// db-setup's own settings, none of the app's others. The names of the first
// six are the app's, so the same task definition entries serve both; here
// they describe the master user (ADR 0008, decision 19).
const envSchema = z.object({
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: port,
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_TLS: z.enum(["none", "verify-full"]),
  // A plain lower-case identifier, at most PostgreSQL's 63 bytes.
  APP_DATABASE_USER: z.string().regex(/^[a-z_][a-z0-9_]{0,62}$/),
  // Printable ASCII only: PostgreSQL would normalize other characters
  // (SASLprep) before hashing, and scramVerifier does not.
  APP_DATABASE_PASSWORD: z
    .string()
    .regex(
      /^[\x20-\x7e]+$/,
      "must be printable ASCII characters (no SASLprep normalization)",
    ),
});

export interface AppRole {
  name: string;
  password: string;
}

export interface SetupConfig {
  // The master user, who creates the role.
  database: DatabaseSettings;
  appRole: AppRole;
}

export function loadSetupConfig(
  env: Record<string, string | undefined>,
): SetupConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Names and Zod's messages only, never the values: they are secrets.
    const problems = result.error.issues.map((issue) => {
      const name = String(issue.path[0]);
      return env[name] === undefined
        ? `  ${name}: missing`
        : `  ${name}: ${issue.message}`;
    });
    throw new Error(`Invalid configuration:\n${problems.join("\n")}`);
  }
  const data = result.data;
  return {
    database: {
      host: data.DATABASE_HOST,
      port: data.DATABASE_PORT,
      name: data.DATABASE_NAME,
      user: data.DATABASE_USER,
      password: data.DATABASE_PASSWORD,
      tls: data.DATABASE_TLS,
    },
    appRole: {
      name: data.APP_DATABASE_USER,
      password: data.APP_DATABASE_PASSWORD,
    },
  };
}

// The password as PostgreSQL stores it, a SCRAM-SHA-256 verifier (RFC 5802),
// made here so the cleartext never reaches the server: a failed CREATE ROLE
// or ALTER ROLE has its statement written to the server's log, and with the
// password inside it that would be a secret in a log line. PostgreSQL keeps a
// string in this format as it is.
export function scramVerifier(password: string): string {
  const iterations = 4096; // PostgreSQL's default scram_iterations
  const salt = randomBytes(16);
  const saltedPassword = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const hmac = (key: Buffer, data: string) =>
    createHmac("sha256", key).update(data).digest();
  const storedKey = createHash("sha256")
    .update(hmac(saltedPassword, "Client Key"))
    .digest("base64");
  const serverKey = hmac(saltedPassword, "Server Key").toString("base64");
  return `SCRAM-SHA-256$${String(iterations)}:${salt.toString("base64")}$${storedKey}:${serverKey}`;
}

export interface SetupTimeouts {
  // PostgreSQL duration strings, such as "30s".
  statement: string;
  lock: string;
}

export const setupTimeouts: SetupTimeouts = { statement: "30s", lock: "10s" };

// Creates the app's role, or sets its password again, and makes it the owner
// of the database `db` is connected to, which on PostgreSQL 15 and later makes
// it the owner of the public schema too. `db` is the master user, who holds
// CREATEROLE and CREATEDB but is no superuser, as on RDS. All in one
// transaction, so a failure leaves nothing half done.
export async function setupAppRole(
  db: Database,
  appRole: AppRole,
  timeouts: SetupTimeouts = setupTimeouts,
): Promise<{ created: boolean }> {
  // The statements take no parameters, so the name and the verifier are
  // quoted into the text.
  const name = pg.escapeIdentifier(appRole.name);
  const password = pg.escapeLiteral(scramVerifier(appRole.password));
  const client = await db.$client.connect();
  try {
    await client.query("BEGIN");
    // A hanging db-setup would hold demo-up for 10 minutes and block
    // demo-down (OP-101), so it fails instead. Set for this transaction only
    // (the third argument), which leaves the pooled connection as it was.
    await client.query(
      "SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', $2, true)",
      [timeouts.statement, timeouts.lock],
    );
    const { rowCount } = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1",
      [appRole.name],
    );
    const created = rowCount === 0;
    if (created) {
      await client.query(
        `CREATE ROLE ${name} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD ${password}`,
      );
    } else {
      // Only the password: a non-superuser may not name SUPERUSER, even to
      // keep it off.
      await client.query(`ALTER ROLE ${name} PASSWORD ${password}`);
    }
    // PostgreSQL 16 and later give a role's creator ADMIN OPTION on it but
    // not membership, and ALTER DATABASE … OWNER TO needs the right to SET
    // ROLE to the new owner as well as CREATEDB.
    await client.query(`GRANT ${name} TO CURRENT_USER`);
    await client.query(
      `ALTER DATABASE ${pg.escapeIdentifier(await currentDatabase(client))} OWNER TO ${name}`,
    );
    await client.query("COMMIT");
    return { created };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function currentDatabase(client: pg.PoolClient): Promise<string> {
  const { rows } = await client.query<{ name: string }>(
    "SELECT current_database() AS name",
  );
  // Stryker disable next-line OptionalChaining: `current_database()` always returns one row, so `rows[0]` is defined
  // Stryker disable next-line StringLiteral: `current_database()` always returns one row, so the `?? ""` fallback is unreachable
  return rows[0]?.name ?? "";
}
