import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import type { Database } from "../db/database.ts";
import * as schema from "../db/schema.ts";

const day = 24 * 60 * 60;

// Better Auth over our Drizzle tables. Task 2 completes the options and
// mounts it on Fastify.
export function createAuth(options: {
  db: Database;
  secret: string;
  origin: string;
}) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.origin,
    trustedOrigins: [options.origin],
    database: drizzleAdapter(options.db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    user: { modelName: "users" },
    session: { modelName: "sessions", expiresIn: 30 * day, updateAge: day },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    advanced: { database: { generateId: "uuid" } },
    plugins: [anonymous()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
