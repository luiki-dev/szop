import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import pg from "pg";

// Run by Playwright's webServer (playwright.config.ts): resets the E2E
// database, then starts the API on the built SPA (ADR 0026, decision 6).
// Each problem stops it with a message saying what to do.

const apiDir = new URL("../apps/api/", import.meta.url);
const webDist = new URL("../apps/web/dist/", import.meta.url);
// Fixed, never input, so it is safe to put into the statements below.
const database = "szop_e2e";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// Without the build, the API would start and answer 404 on every page.
if (!existsSync(new URL("index.html", webDist))) {
  fail(
    "apps/web/dist is missing: run `pnpm build` first (`pnpm test:e2e` does it for you)",
  );
}

const port = process.env.E2E_PORT;
if (!port) fail("E2E_PORT is not set: run the suite with `pnpm test:e2e`");

// The API's own settings, read the way its test helper reads them.
let fileEnv: NodeJS.Dict<string>;
try {
  fileEnv = parseEnv(readFileSync(new URL(".env", apiDir), "utf8"));
} catch {
  fail(
    "apps/api/.env is missing: copy apps/api/.env.example to apps/api/.env (see docs/development/setup.md)",
  );
}

// Reset once per run (ADR 0007, decision 15), through the maintenance
// database, never the development one. FORCE closes connections a crashed run
// left. Nothing is dropped afterwards, so a failed run's data can be read.
const admin = new pg.Client({
  host: fileEnv.DATABASE_HOST,
  port: Number(fileEnv.DATABASE_PORT),
  database: "postgres",
  user: fileEnv.DATABASE_USER,
  password: fileEnv.DATABASE_PASSWORD,
  connectionTimeoutMillis: 2000,
});
try {
  await admin.connect();
} catch (error) {
  const reason = (error as { code?: string }).code ?? (error as Error).message;
  fail(
    `Cannot reach PostgreSQL at ${String(fileEnv.DATABASE_HOST)}:${String(fileEnv.DATABASE_PORT)} (${reason}). Start it with \`docker compose up -d\`.`,
  );
}
try {
  await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${database}`);
} finally {
  await admin.end();
}

// The order of the spread is the rule: the shell's variables, then the API's
// .env, then the E2E settings over both. The API migrates the empty database
// before it listens, so Playwright's wait for /api/health covers that too.
const overrides = {
  DATABASE_NAME: database,
  HOST: "127.0.0.1",
  PORT: port,
  LOG_LEVEL: "warn",
  WEB_ROOT: fileURLToPath(webDist),
};
const api = spawn(process.execPath, ["src/server.ts"], {
  cwd: apiDir,
  env: { ...process.env, ...fileEnv, ...overrides },
  stdio: "inherit",
});

// Playwright stops its server by signalling the whole process group, so the
// API gets the signal itself. Caught here only so this script outlives the
// API; never passed on, which would give the API a second signal after its
// process.once handler is used up and kill it mid-shutdown.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    // Nothing to do: the API's exit, below, ends this script.
  });
}
api.on("exit", (code) => {
  process.exit(code ?? 1);
});
