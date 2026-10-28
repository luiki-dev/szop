import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import pg from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testDatabaseName, testDatabaseSettings } from "../test/database.ts";
import { createDatabase, type Database } from "./database.ts";
import {
  checkMigrations,
  compareMigrations,
  describeMismatch,
  MigrationMismatchError,
  readLocalMigrations,
  readRecordedMigrations,
  type LocalMigration,
  type MigrationMismatch,
  type RecordedMigration,
} from "./migration-check.ts";
import { migrationsFolder, runMigrations } from "./migrate.ts";
import { readJournal } from "./schema-version.ts";

// The real reader unless a test sets a folder's content for one call.
vi.mock("drizzle-orm/migrator", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("drizzle-orm/migrator")>();
  return {
    ...original,
    readMigrationFiles: vi.fn(original.readMigrationFiles),
  };
});

const L = (name: string, createdAt: number, hash: string): LocalMigration => ({
  name,
  createdAt,
  hash,
});
const R = (createdAt: number, hash: string): RecordedMigration => ({
  createdAt,
  hash,
});

describe("compareMigrations", () => {
  it.each([
    {
      case: "nothing recorded",
      local: [L("0000", 100, "h0")],
      recorded: [],
      expected: { unknown: [], skipped: [], edited: [] },
    },
    {
      case: "in step",
      local: [L("0000", 100, "h0")],
      recorded: [R(100, "h0")],
      expected: { unknown: [], skipped: [], edited: [] },
    },
    {
      case: "pending only",
      local: [L("0000", 100, "h0"), L("0001", 200, "h1")],
      recorded: [R(100, "h0")],
      expected: { unknown: [], skipped: [], edited: [] },
    },
    {
      case: "unknown",
      local: [L("0000", 100, "h0")],
      recorded: [R(100, "h0"), R(300, "hx")],
      expected: { unknown: [300], skipped: [], edited: [] },
    },
    {
      case: "skipped",
      local: [L("0000", 100, "h0"), L("0001", 150, "h1")],
      recorded: [R(100, "h0"), R(200, "h2")],
      expected: { unknown: [200], skipped: ["0001"], edited: [] },
    },
    {
      case: "edited",
      local: [L("0000", 100, "h0")],
      recorded: [R(100, "hX")],
      expected: { unknown: [], skipped: [], edited: ["0000"] },
    },
    {
      case: "same hash, two timestamps",
      local: [L("0000", 100, "hE"), L("0001", 200, "hE")],
      recorded: [R(100, "hE"), R(200, "hE")],
      expected: { unknown: [], skipped: [], edited: [] },
    },
  ])("$case", ({ local, recorded, expected }) => {
    const mismatch = compareMigrations(local, recorded);

    expect({
      unknown: mismatch.unknown.map(({ createdAt }) => createdAt),
      skipped: mismatch.skipped.map(({ name }) => name),
      edited: mismatch.edited.map(({ name }) => name),
    }).toEqual(expected);
  });
});

describe("describeMismatch", () => {
  const remedy =
    "Reset the database: `pnpm db:reset` locally; on the demo, `demo-down` then `demo-up`.";

  it("names every mismatched migration and its case, then the remedy", () => {
    const mismatch: MigrationMismatch = {
      unknown: [R(1891307052475, "x")],
      skipped: [L("0001_lists", 150, "h1")],
      edited: [L("0000_init", 100, "h0")],
    };

    const text = describeMismatch(mismatch);

    expect(text).toContain(
      "The database's migrations do not match this code's:",
    );
    expect(text).toContain("unknown");
    expect(text).toContain("1891307052475");
    expect(text).toContain("skipped");
    expect(text).toContain("0001_lists");
    expect(text).toContain("edited");
    expect(text).toContain("0000_init");
    expect(text).toContain(remedy);
  });

  it("puts each line on its own line", () => {
    const text = describeMismatch({
      unknown: [],
      skipped: [],
      edited: [L("0000_init", 100, "h0")],
    });

    expect(text.split("\n")).toEqual([
      "The database's migrations do not match this code's:",
      "  edited: 0000_init, changed since it was applied",
      remedy,
    ]);
  });

  it("leaves out a case with nothing in it", () => {
    const text = describeMismatch({
      unknown: [R(1891307052475, "x")],
      skipped: [],
      edited: [],
    });

    expect(text).toContain("unknown");
    expect(text).not.toContain("skipped");
    expect(text).not.toContain("edited");
  });
});

describe("readLocalMigrations", () => {
  it("reads each migration's name, timestamp and the SHA-256 of its SQL", () => {
    const content = readFileSync(
      join(migrationsFolder, "0000_init.sql"),
      "utf8",
    );
    const hash = createHash("sha256").update(content).digest("hex");

    expect(readLocalMigrations(readJournal())).toEqual([
      { name: "0000_init", createdAt: 1791307052475, hash },
    ]);
  });
});

describe("MigrationMismatchError", () => {
  it("is named after itself", () => {
    const error = new MigrationMismatchError({
      unknown: [],
      skipped: [],
      edited: [],
    });

    expect(error.name).toBe("MigrationMismatchError");
  });
});

describe("readLocalMigrations naming", () => {
  it("takes the tag whose timestamp matches, not the first", () => {
    const journal = {
      entries: [
        { when: 1, tag: "0000_other" },
        { when: 1791307052475, tag: "0000_init" },
      ],
    };

    expect(readLocalMigrations(journal).map(({ name }) => name)).toEqual([
      "0000_init",
    ]);
  });

  it("falls back to the timestamp when the journal has no such entry", () => {
    const journal = { entries: [{ when: 1, tag: "0000_other" }] };

    expect(readLocalMigrations(journal).map(({ name }) => name)).toEqual([
      "1791307052475",
    ]);
  });
});

// A database of its own, not this worker's copy: these tests need one that
// has never been migrated, and they change Drizzle's own table.
describe("against a database", () => {
  const admin = testDatabaseSettings("postgres");
  let name: string;
  let db: Database;

  // The name is numbered, never input, so it is safe in the statement.
  async function runAdmin(statement: string): Promise<void> {
    const client = new pg.Client({
      host: admin.host,
      port: admin.port,
      database: admin.name,
      user: admin.user,
      password: admin.password,
    });
    await client.connect();
    try {
      await client.query(statement);
    } finally {
      await client.end();
    }
  }

  beforeEach(async () => {
    const worker = process.env.VITEST_POOL_ID;
    if (!worker) throw new Error("these tests run only under Vitest");
    name = testDatabaseName(`migrations_${worker}`);
    await runAdmin(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await runAdmin(`CREATE DATABASE ${name}`);
    db = createDatabase(testDatabaseSettings(name));
  });

  afterEach(async () => {
    await db.$client.end();
    await runAdmin(`DROP DATABASE ${name} WITH (FORCE)`);
  });

  it("reads nothing recorded from a database never migrated", async () => {
    expect(await readRecordedMigrations(db)).toEqual([]);
  });

  it("passes a database never migrated", async () => {
    await expect(checkMigrations(db, readJournal())).resolves.toBeUndefined();
  });

  it("reads what Drizzle recorded, and passes it", async () => {
    await runMigrations(db);

    const [local] = readLocalMigrations(readJournal());
    expect(await readRecordedMigrations(db)).toEqual([
      { createdAt: 1791307052475, hash: local?.hash },
    ]);
    await expect(checkMigrations(db, readJournal())).resolves.toBeUndefined();
  });

  it("rejects a database with a migration this code does not know", async () => {
    await runMigrations(db);
    await db.execute(
      sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('x', 1891307052475)`,
    );

    const check = checkMigrations(db, readJournal());

    await expect(check).rejects.toBeInstanceOf(MigrationMismatchError);
    await expect(check).rejects.toMatchObject({
      mismatch: { unknown: [{ createdAt: 1891307052475 }] },
    });
  });
});

describe("checkMigrations with a stubbed database", () => {
  // The first query asks whether Drizzle's table exists, the second reads it.
  function stubDb(rows: { hash: string; created_at: string }[]): Database {
    const answers = [{ rows: [{ exists: true }] }, { rows }];
    return {
      execute: () => Promise.resolve(answers.shift()),
    } as unknown as Database;
  }
  const file = (folderMillis: number, hash: string) => ({
    sql: [],
    bps: true,
    folderMillis,
    hash,
  });
  const journal = { entries: [] };

  // stubDb answers by query order and always finds the table, so an empty
  // existence result needs its own stub.
  it("reads nothing recorded when the existence query returns no row", async () => {
    const db = {
      execute: () => Promise.resolve({ rows: [] }),
    } as unknown as Database;

    expect(await readRecordedMigrations(db)).toEqual([]);
  });

  it("rejects when only an edited migration is found", async () => {
    vi.mocked(readMigrationFiles).mockReturnValueOnce([file(100, "h0")]);

    await expect(
      checkMigrations(stubDb([{ hash: "hX", created_at: "100" }]), journal),
    ).rejects.toBeInstanceOf(MigrationMismatchError);
  });

  it("rejects when only a skipped migration is found", async () => {
    vi.mocked(readMigrationFiles).mockReturnValueOnce([
      file(100, "h0"),
      file(200, "h1"),
    ]);

    await expect(
      checkMigrations(stubDb([{ hash: "h1", created_at: "200" }]), journal),
    ).rejects.toBeInstanceOf(MigrationMismatchError);
  });
});
