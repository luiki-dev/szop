import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import type { Database } from "../db/database.ts";
import * as schema from "../db/schema.ts";

const day = 24 * 60 * 60;

// Better Auth over our Drizzle tables, with anonymous sessions only. Its
// cookie is HttpOnly and SameSite=Lax by default, with no Domain. On an https
// origin the session cookie is named `__Host-better-auth.session_token` and
// every cookie is Secure (ADR 0057). `useSecureCookies` is false: left to its
// default it follows the https baseURL and adds `__Secure-` in front of the name.
export function createAuth(options: {
  db: Database;
  secret: string;
  origin: string;
  // The API's TRUSTED_PROXIES, so the rate limiter resolves the client IP
  // from X-Forwarded-For as the API does (ADR 0057).
  trustedProxies?: string[];
}) {
  const https = options.origin.startsWith("https:");
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
      useSecureCookies: false,
      ipAddress: { trustedProxies: options.trustedProxies ?? [] },
      ...(https && {
        defaultCookieAttributes: { secure: true },
        cookies: {
          session_token: { name: "__Host-better-auth.session_token" },
        },
      }),
      database: { generateId: "uuid" },
    },
    // Anyone can mint a guest, so signing in is limited per address (SEC-02).
    // shortcut: memory storage is per task, so two tasks allow up to 60 an hour;
    // upgrade with the quotas of PH-20. `enabled` because Better Auth only
    // limits in production by default.
    rateLimit: {
      enabled: true,
      customRules: { "/sign-in/anonymous": { window: 60 * 60, max: 30 } },
    },
    plugins: [anonymous()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
