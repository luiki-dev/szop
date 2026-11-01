import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { resetDatabase } from "../test/reset-database.ts";
import { testDatabaseSettings } from "../test/database.ts";
import { createDatabase, type Database } from "./database.ts";
import { withMigrationLock } from "./migration-lock.ts";

// The audit's check A, as a test: two migrators started at once on one
// database (ADR 0036, decision 2). Without the lock, a pending data migration
// runs twice, or both create Drizzle's schema and one fails.
const name = `szop_test_lock_${process.env.VITEST_POOL_ID ?? "0"}`;

const migrations = [
  {
    tag: "0000_counters",
    when: 1700000000000,
    sql: "CREATE TABLE counters (n integer NOT NULL);",
  },
  {
    tag: "0001_zero",
    when: 1700000001000,
    sql: "INSERT INTO counters VALUES (0);",
  },
  {
    tag: "0002_increment",
    when: 1700000002000,
    sql: "UPDATE counters SET n = n + 1;",
  },
];

// A folder in Drizzle's format holding the first `count` migrations.
async function writeFolder(root: string, count: number): Promise<string> {
  const folder = join(root, String(count));
  await mkdir(join(folder, "meta"), { recursive: true });
  const entries = migrations.slice(0, count);
  await writeFile(
    join(folder, "meta", "_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "postgresql",
      entries: entries.map(({ tag, when }, idx) => ({
        idx,
        version: "7",
        when,
        tag,
        breakpoints: true,
      })),
    }),
  );
  for (const { tag, sql: statement } of entries) {
    await writeFile(join(folder, `${tag}.sql`), statement);
  }
  return folder;
}

const silentLog = { info: (): void => {} };

describe("withMigrationLock", () => {
  let root: string;
  let twoMigrations: string;
  let threeMigrations: string;
  let pools: Database[] = [];

  const open = (): Database => {
    const db = createDatabase(testDatabaseSettings(name));
    pools.push(db);
    return db;
  };

  const counter = async (db: Database): Promise<unknown> =>
    (await db.execute<{ n: number }>(sql`SELECT n FROM counters`)).rows.map(
      ({ n }) => n,
    );

  const recorded = async (db: Database): Promise<number> =>
    Number(
      (
        await db.execute<{ count: string }>(
          sql`SELECT count(*) FROM drizzle.__drizzle_migrations`,
        )
      ).rows[0]?.count,
    );

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "szop-lock-"));
    twoMigrations = await writeFolder(root, 2);
    threeMigrations = await writeFolder(root, 3);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetDatabase(name);
  });

  afterEach(async () => {
    await Promise.all(pools.map((db) => db.$client.end()));
    pools = [];
  });

  it("applies a pending data migration once when two migrators start at once", async () => {
    const setup = open();
    await migrate(setup, { migrationsFolder: twoMigrations });
    const [a, b] = [open(), open()];

    await Promise.all(
      [a, b].map((db) =>
        withMigrationLock(db, silentLog, () =>
          migrate(db, { migrationsFolder: threeMigrations }),
        ),
      ),
    );

    expect(await counter(setup)).toEqual([1]);
    expect(await recorded(setup)).toBe(3);
  });

  it("creates Drizzle's schema once on a fresh database", async () => {
    const [a, b] = [open(), open()];

    await Promise.all(
      [a, b].map((db) =>
        withMigrationLock(db, silentLog, () =>
          migrate(db, { migrationsFolder: threeMigrations }),
        ),
      ),
    );

    expect(await counter(a)).toEqual([1]);
    expect(await recorded(a)).toBe(3);
  });

  it("leaves no advisory lock behind", async () => {
    const db = open();
    const advisoryLocks = async (): Promise<number> =>
      Number(
        (
          await db.execute<{ count: string }>(
            sql`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`,
          )
        ).rows[0]?.count,
      );

    await withMigrationLock(db, silentLog, () => Promise.resolve());
    expect(await advisoryLocks()).toBe(0);

    await expect(
      withMigrationLock(db, silentLog, () => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
    expect(await advisoryLocks()).toBe(0);
  });

  it("passes on the work's error and lets the next migrator in", async () => {
    const db = open();

    await expect(
      withMigrationLock(db, silentLog, () => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
    await expect(
      withMigrationLock(db, silentLog, () => Promise.resolve("next")),
    ).resolves.toBe("next");
  });

  it("logs while it waits and once it holds the lock", async () => {
    const messages: string[] = [];

    await withMigrationLock(
      open(),
      { info: (message) => messages.push(message) },
      () => Promise.resolve(),
    );

    expect(messages).toEqual([
      "waiting for the migration lock",
      "migration lock taken",
    ]);
  });
});
