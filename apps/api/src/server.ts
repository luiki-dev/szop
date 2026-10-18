import { buildApp } from "./app.ts";
import { loadConfig, type Config } from "./config.ts";
import { createDatabase } from "./db/database.ts";
import { runMigrations } from "./db/migrate.ts";
import { checkMigrations } from "./db/migration-check.ts";
import { currentSchemaVersion, readJournal } from "./db/schema-version.ts";
import { startShutdownDeadline } from "./shutdown.ts";

// The only file that reads process.env. Checked by hand, not by tests:
// everything it calls is tested (ADR 0019, decision 10).
let config: Config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

// server.ts creates the pool, so server.ts closes it (ADR 0020, decision 12).
const db = createDatabase(config.database);
const app = buildApp({ config, db });
// Not logged whole: pg-pool attaches the whole client to the error.
db.$client.on("error", (error: Error & { code?: string }) => {
  app.log.warn(
    { code: error.code, reason: error.message },
    "idle database connection lost",
  );
});

// Let requests in flight finish before exiting: on Ctrl+C, on tsx's
// restarts, and when ECS stops the task.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    // ECS kills a task 30 seconds after asking it to stop, so the shutdown
    // ends well before that, even with a client that never finishes its
    // request (ADR 0033, decision 6).
    startShutdownDeadline({
      server: app.server,
      log: app.log,
      deadlineMs: 10_000,
      graceMs: 5_000,
      exit: (code) => process.exit(code),
    });
    app
      .close()
      .then(() => db.$client.end())
      .then(
        () => process.exit(0),
        (error: unknown) => {
          app.log.error(error, "shutdown failed");
          process.exit(1);
        },
      );
  });
}

// Migrations run before the API accepts requests (ADR 0008, decision 14). A
// failed start, such as an unreachable database or a port already in use, is
// logged like everything else, then the process exits with code 1: on ECS a
// new task tries again (ADR 0020, decision 11).
try {
  const journal = readJournal();
  // Drizzle silently passes over a database migrated by other code, so the
  // API refuses to start on one instead (ADR 0033, decision 3).
  await checkMigrations(db, journal);
  await runMigrations(db);
  const schemaVersion = await currentSchemaVersion(db, journal);
  app.log.info({ schemaVersion }, "migrations applied");
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error, "startup failed");
  await db.$client.end();
  process.exit(1);
}
