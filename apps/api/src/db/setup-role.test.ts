import pg from "pg";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { testDatabaseSettings } from "../test/database.ts";
import { createDatabase, type Database } from "./database.ts";
import { runMigrations } from "./migrate.ts";
import { loadSetupConfig, setupAppRole } from "./setup-role.ts";

const valid = {
  DATABASE_HOST: "127.0.0.1",
  DATABASE_PORT: "5432",
  DATABASE_NAME: "szop",
  DATABASE_USER: "szop_admin",
  DATABASE_PASSWORD: "admin-secret",
  DATABASE_TLS: "verify-full",
  APP_DATABASE_USER: "szop_app",
  APP_DATABASE_PASSWORD: "app-secret",
};

// The message loadSetupConfig throws for env.
function errorFor(env: Record<string, string | undefined>): string {
  try {
    loadSetupConfig(env);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected loadSetupConfig to throw");
}

// What PostgreSQL said when `query` failed: Drizzle's own message only names
// the statement, and keeps PostgreSQL's in the cause.
async function reasonOf(query: Promise<unknown>): Promise<string> {
  try {
    await query;
  } catch (error) {
    return ((error as Error).cause as Error).message;
  }
  throw new Error("expected the query to fail");
}

describe("loadSetupConfig", () => {
  it("returns the master user's database and the app's role", () => {
    expect(loadSetupConfig(valid)).toEqual({
      database: {
        host: "127.0.0.1",
        port: 5432,
        name: "szop",
        user: "szop_admin",
        password: "admin-secret",
        tls: "verify-full",
      },
      appRole: { name: "szop_app", password: "app-secret" },
    });
  });

  it("ignores the app's other settings", () => {
    expect(
      loadSetupConfig({ ...valid, HOST: "0.0.0.0", PORT: "3000" }),
    ).toEqual(loadSetupConfig(valid));
  });

  it("names a missing setting", () => {
    expect(errorFor({ ...valid, APP_DATABASE_PASSWORD: undefined })).toBe(
      "Invalid configuration:\n  APP_DATABASE_PASSWORD: missing",
    );
  });

  it.each(["Szop-App", "a; DROP ROLE x", "1app", "", "a".repeat(64)])(
    "rejects APP_DATABASE_USER=%j",
    (name) => {
      expect(errorFor({ ...valid, APP_DATABASE_USER: name })).toMatch(
        /APP_DATABASE_USER: (?!missing)/,
      );
    },
  );

  it("accepts the longest and the shortest role names", () => {
    for (const name of ["_", "a".repeat(63)]) {
      expect(
        loadSetupConfig({ ...valid, APP_DATABASE_USER: name }).appRole.name,
      ).toBe(name);
    }
  });

  it("never puts a password in the message", () => {
    const message = errorFor({
      ...valid,
      APP_DATABASE_USER: "Szop-App",
      DATABASE_PORT: "abc",
    });

    expect(message).toContain("APP_DATABASE_USER");
    expect(message).toContain("DATABASE_PORT");
    expect(message).not.toContain(valid.APP_DATABASE_PASSWORD);
    expect(message).not.toContain(valid.DATABASE_PASSWORD);
  });
});

// A database and a master user of its own, built like RDS's: the admin can
// create roles and databases and owns the database, but is no superuser. Roles
// belong to the whole server, so their names are numbered per worker as the
// database's is.
describe("setupAppRole", () => {
  const superuser = testDatabaseSettings("postgres");
  const adminPassword = "setup-admin-password";
  const appPassword = "setup-app-password";
  let databaseName: string;
  let adminName: string;
  let appName: string;
  let opened: Database[];
  let admin: Database;

  // The names are numbered, never input, so they are safe in the statements.
  async function runSuperuser(statement: string): Promise<void> {
    const client = new pg.Client({
      host: superuser.host,
      port: superuser.port,
      database: superuser.name,
      user: superuser.user,
      password: superuser.password,
    });
    await client.connect();
    try {
      await client.query(statement);
    } finally {
      await client.end();
    }
  }

  // The database, connected as `user`; closed after the test.
  function connect(user: string, password: string): Database {
    const db = createDatabase({
      ...superuser,
      name: databaseName,
      user,
      password,
    });
    opened.push(db);
    return db;
  }

  async function ownerOfDatabase(): Promise<string> {
    const { rows } = await admin.execute<{ owner: string }>(
      sql`SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = ${databaseName}`,
    );
    return rows[0]?.owner ?? "";
  }

  beforeEach(async () => {
    const worker = process.env.VITEST_POOL_ID;
    if (!worker) throw new Error("these tests run only under Vitest");
    databaseName = `szop_setup_${worker}`;
    adminName = `szop_setup_admin_${worker}`;
    appName = `szop_setup_app_${worker}`;
    opened = [];
    await runSuperuser(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await runSuperuser(`DROP ROLE IF EXISTS ${appName}`);
    await runSuperuser(`DROP ROLE IF EXISTS ${adminName}`);
    await runSuperuser(
      `CREATE ROLE ${adminName} LOGIN CREATEROLE CREATEDB PASSWORD '${adminPassword}'`,
    );
    await runSuperuser(`CREATE DATABASE ${databaseName} OWNER ${adminName}`);
    admin = connect(adminName, adminPassword);
  });

  afterEach(async () => {
    await Promise.all(opened.map((db) => db.$client.end()));
    await runSuperuser(`DROP DATABASE ${databaseName} WITH (FORCE)`);
    await runSuperuser(`DROP ROLE IF EXISTS ${appName}`);
    await runSuperuser(`DROP ROLE IF EXISTS ${adminName}`);
  });

  it("creates the role, which owns the database", async () => {
    const result = await setupAppRole(admin, {
      name: appName,
      password: appPassword,
    });

    expect(result).toEqual({ created: true });
    expect(await ownerOfDatabase()).toBe(appName);
    const { rows } = await admin.execute(
      sql`SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = ${appName}`,
    );
    expect(rows).toEqual([
      {
        rolcanlogin: true,
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
      },
    ]);
  });

  it("lets the role migrate and use the database", async () => {
    await setupAppRole(admin, { name: appName, password: appPassword });
    const app = connect(appName, appPassword);

    await runMigrations(app);
    await app.execute(sql`CREATE TABLE t (x int)`);
    await app.execute(sql`INSERT INTO t VALUES (1)`);

    const { rows } = await app.execute(sql`SELECT x FROM t`);
    expect(rows).toEqual([{ x: 1 }]);
  });

  it("refuses the role a new role or database", async () => {
    await setupAppRole(admin, { name: appName, password: appPassword });
    const app = connect(appName, appPassword);

    expect(await reasonOf(app.execute(sql`CREATE ROLE x`))).toMatch(
      /permission denied/,
    );
    expect(await reasonOf(app.execute(sql`CREATE DATABASE x`))).toMatch(
      /permission denied/,
    );
  });

  it("is safe to run again", async () => {
    await setupAppRole(admin, { name: appName, password: appPassword });

    const second = await setupAppRole(admin, {
      name: appName,
      password: appPassword,
    });

    expect(second).toEqual({ created: false });
    expect(await ownerOfDatabase()).toBe(appName);
  });

  it("applies a changed password", async () => {
    await setupAppRole(admin, { name: appName, password: appPassword });

    await setupAppRole(admin, { name: appName, password: "another-password" });

    expect(
      await reasonOf(connect(appName, appPassword).execute(sql`SELECT 1`)),
    ).toMatch(/password authentication failed/);
    await expect(
      connect(appName, "another-password").execute(sql`SELECT 1`),
    ).resolves.toBeDefined();
  });

  it("takes a password that holds quotes without running it as SQL", async () => {
    const password = `it's a "pass"; DROP ROLE ${adminName}; --`;

    await setupAppRole(admin, { name: appName, password });

    await expect(
      connect(appName, password).execute(sql`SELECT 1`),
    ).resolves.toBeDefined();
  });

  it("never puts the password in the error of a failed setup", async () => {
    await setupAppRole(admin, { name: appName, password: appPassword });
    // The app's role may not create roles, so this run fails.
    const app = connect(appName, appPassword);

    const failure = setupAppRole(app, {
      name: `${appName}_other`,
      password: "second-password",
    });

    await expect(failure).rejects.toThrow(/permission denied/);
    await expect(failure).rejects.not.toThrow("second-password");
  });
});
