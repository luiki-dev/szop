// Stryker disable all: only Better Auth's CLI loads it
import { createDatabase } from "../db/database.ts";
import { createAuth } from "./auth.ts";

// The instance `pnpm dlx @better-auth/cli generate` reads to learn the tables.
// The database settings are dummies: createDatabase opens no connection.
export const auth = createAuth({
  db: createDatabase({
    host: "localhost",
    port: 5432,
    name: "x",
    user: "x",
    password: "x",
    tls: "none",
  }),
  secret: "x".repeat(32),
  origin: "http://localhost",
});
