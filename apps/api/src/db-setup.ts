import { createDatabase } from "./db/database.ts";
import { loadSetupConfig, setupAppRole } from "./db/setup-role.ts";

// Creates the role the app connects as, from the master user's settings. Run
// once per deploy as a one-off ECS task: `node src/db-setup.ts`. The second
// file that reads process.env, checked by hand like server.ts: everything it
// calls is tested (ADR 0019, decision 10).
let config: ReturnType<typeof loadSetupConfig>;
try {
  config = loadSetupConfig(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

// This file creates the pool, so this file closes it (ADR 0020, decision 12).
const db = createDatabase(config.database);
try {
  const { created } = await setupAppRole(db, config.appRole);
  // The role's name only, never a password.
  console.log(
    JSON.stringify({
      msg: "db-setup done",
      role: config.appRole.name,
      created,
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      msg: "db-setup failed",
      error: (error as Error).message,
    }),
  );
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
