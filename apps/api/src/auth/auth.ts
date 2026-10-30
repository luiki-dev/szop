import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import type { Database } from "../db/database.ts";
import * as schema from "../db/schema.ts";

const day = 24 * 60 * 60;

// Better Auth over our Drizzle tables, with anonymous sessions only. Its
// cookie is HttpOnly and SameSite=Lax by default, with no Domain. On an https
// origin it is Secure and named `__Secure-better-auth.session_token`:
// Better Auth always prefixes `__Secure-` and cannot yield `__Host-` (ADR 0057).
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
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
      },
    }),
    user: { modelName: "users" },
    session: { modelName: "sessions", expiresIn: 30 * day, updateAge: day },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    advanced: {
      useSecureCookies: options.origin.startsWith("https:"),
      database: { generateId: "uuid" },
    },
    plugins: [anonymous()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
