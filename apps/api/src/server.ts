import { buildApp } from "./app.ts";
import { loadConfig, type Config } from "./config.ts";

// The only file that reads process.env. Checked by hand, not by tests:
// everything it calls is tested (ADR 0019, decision 10).
let config: Config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const app = buildApp({ config });

// Let requests in flight finish before exiting: on Ctrl+C, on tsx's
// restarts, and when ECS stops the task.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error(error, "shutdown failed");
        process.exit(1);
      },
    );
  });
}

// A failed start, such as a port already in use, is logged like everything
// else, then the process exits with code 1.
try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error, "startup failed");
  process.exit(1);
}
