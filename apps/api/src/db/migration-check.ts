import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { Database } from "./database.ts";
import { migrationsFolder } from "./migrate.ts";
import type { Journal } from "./schema-version.ts";

// A migration in apps/api/drizzle/: its name, the journal's timestamp and
// the SHA-256 of its SQL, as Drizzle computes it.
export interface LocalMigration {
  name: string;
  createdAt: number;
  hash: string;
}

// A row of drizzle.__drizzle_migrations: what Drizzle applied.
export interface RecordedMigration {
  createdAt: number;
  hash: string;
}

// Why the database and this code disagree (ADR 0033, decision 3):
// - unknown: applied, but this code has no migration with its timestamp;
// - skipped: in this code, older than the newest applied one, never
//   applied. Drizzle would never apply it either;
// - edited: applied, but its SQL has changed since.
export interface MigrationMismatch {
  unknown: RecordedMigration[];
  skipped: LocalMigration[];
  edited: LocalMigration[];
}

// Matches by timestamp, not by hash: two migrations with the same SQL (two
// empty ones, say) hash alike. A migration newer than every recorded one is
// pending, which is a normal upgrade.
export function compareMigrations(
  local: LocalMigration[],
  recorded: RecordedMigration[],
): MigrationMismatch {
  const localTimes = new Set(local.map(({ createdAt }) => createdAt));
  const recordedByTime = new Map(
    recorded.map((migration) => [migration.createdAt, migration]),
  );
  const newest = Math.max(...recorded.map(({ createdAt }) => createdAt));

  return {
    unknown: recorded.filter(({ createdAt }) => !localTimes.has(createdAt)),
    skipped: local.filter(({ createdAt }) => {
      // Stryker disable next-line EqualityOperator: a local migration at `newest` time is recorded, so the first clause is already false
      const isOlder = createdAt < newest;
      return !recordedByTime.has(createdAt) && isOlder;
    }),
    edited: local.filter(({ createdAt, hash }) => {
      const twin = recordedByTime.get(createdAt);
      return twin !== undefined && twin.hash !== hash;
    }),
  };
}

export function describeMismatch(mismatch: MigrationMismatch): string {
  return [
    "The database's migrations do not match this code's:",
    ...mismatch.unknown.map(
      ({ createdAt }) =>
        `  unknown: applied at ${String(createdAt)}, not in this code`,
    ),
    ...mismatch.skipped.map(
      ({ name }) => `  skipped: ${name}, older than the newest applied one`,
    ),
    ...mismatch.edited.map(
      ({ name }) => `  edited: ${name}, changed since it was applied`,
    ),
    "Reset the database: `pnpm db:reset` locally; on the demo, `demo-down` then `demo-up`.",
  ].join("\n");
}

export class MigrationMismatchError extends Error {
  readonly mismatch: MigrationMismatch;

  constructor(mismatch: MigrationMismatch) {
    super(describeMismatch(mismatch));
    this.name = "MigrationMismatchError";
    this.mismatch = mismatch;
  }
}

// Drizzle's own reading of the folder, so the hashes are the ones it
// records; the journal adds each migration's name.
export function readLocalMigrations(journal: Journal): LocalMigration[] {
  return readMigrationFiles({ migrationsFolder }).map(
    ({ folderMillis, hash }) => ({
      name:
        journal.entries.find(({ when }) => when === folderMillis)?.tag ??
        String(folderMillis),
      createdAt: folderMillis,
      hash,
    }),
  );
}

// Nothing is recorded before the first migration creates Drizzle's table.
export async function readRecordedMigrations(
  db: Database,
): Promise<RecordedMigration[]> {
  const table = await db.execute<{ exists: boolean }>(
    sql`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists`,
  );
  if (!table.rows[0]?.exists) return [];
  // created_at is a bigint, which node-postgres returns as a string.
  const result = await db.execute<{ hash: string; created_at: string }>(
    sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`,
  );
  return result.rows.map(({ hash, created_at }) => ({
    createdAt: Number(created_at),
    hash,
  }));
}

// Runs before Drizzle migrates, which would otherwise pass over every one
// of these cases in silence (ADR 0033, decision 3).
export async function checkMigrations(
  db: Database,
  journal: Journal,
): Promise<void> {
  const mismatch = compareMigrations(
    readLocalMigrations(journal),
    await readRecordedMigrations(db),
  );
  const { unknown, skipped, edited } = mismatch;
  if (unknown.length + skipped.length + edited.length > 0) {
    throw new MigrationMismatchError(mismatch);
  }
}
