import { availableParallelism } from "node:os";
import pg from "pg";
import type { TestProject } from "vitest/node";
import type { DatabaseSettings } from "../config.ts";
import { createDatabase } from "../db/database.ts";
import { runMigrations } from "../db/migrate.ts";
import { testDatabaseSettings } from "./database.ts";

const template = "szop_test_template";

// Once per run, before any test: a freshly migrated template, then one copy
// per Vitest worker (ADR 0007, decision 12; ADR 0020, decision 7). Nothing
// is dropped afterwards, so the databases can be inspected after a failure.
export default async function setup(project: TestProject): Promise<void> {
  // Vitest numbers its workers from 1 to maxWorkers. Unless it is set, it is
  // undefined here (despite its type) and computed inside Vitest, never above
  // the number of CPUs.
  const maxWorkers = project.config.maxWorkers as number | undefined;
  const workers = maxWorkers ?? availableParallelism();
  const copies = Array.from(
    { length: workers },
    (_, i) => `szop_test_${String(i + 1)}`,
  );
  // The maintenance database, never the development one.
  const admin = testDatabaseSettings("postgres");

  await checkReachable(admin);
  // The names are fixed or numbered, never input, so they are safe to put
  // into the statements. FORCE closes connections a crashed run left.
  await runEach(
    admin,
    [...copies, template].map(
      (name) => `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`,
    ),
  );
  await runEach(admin, [`CREATE DATABASE ${template}`]);

  const db = createDatabase(testDatabaseSettings(template));
  try {
    await runMigrations(db);
  } finally {
    // PostgreSQL copies a template only when nothing is connected to it.
    await db.$client.end();
  }

  await runEach(
    admin,
    copies.map((name) => `CREATE DATABASE ${name} TEMPLATE ${template}`),
  );
}

// Stops the run with a clear message instead of a pile of failed tests.
async function checkReachable(settings: DatabaseSettings): Promise<void> {
  try {
    await runEach(settings, ["SELECT 1"]);
  } catch (error) {
    const reason =
      (error as { code?: string }).code ?? (error as Error).message;
    throw new Error(
      `Cannot reach PostgreSQL at ${settings.host}:${String(settings.port)} (${reason}). Start it with \`docker compose up -d\`.`,
      { cause: error },
    );
  }
}

// Runs the statements at once, one connection each. Each DROP DATABASE waits
// for a checkpoint, and concurrent ones share it: 16 drops take about 0.1 s
// instead of 2 s.
async function runEach(
  settings: DatabaseSettings,
  statements: string[],
): Promise<void> {
  await Promise.all(
    statements.map(async (statement) => {
      const client = new pg.Client({
        host: settings.host,
        port: settings.port,
        database: settings.name,
        user: settings.user,
        password: settings.password,
        connectionTimeoutMillis: 2000,
      });
      await client.connect();
      try {
        await client.query(statement);
      } finally {
        await client.end();
      }
    }),
  );
}
