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
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.host, port: config.port });
