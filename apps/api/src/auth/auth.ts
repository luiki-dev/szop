import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { passwordLimits, uuidv7 } from "@szop/shared";
import { anonymous } from "better-auth/plugins";
import type { FastifyBaseLogger } from "fastify";
import type { Database } from "../db/database.ts";
import * as schema from "../db/schema.ts";
import { sendInBackground } from "../email/background.ts";
import type { EmailSender } from "../email/sender.ts";
import { existingAccountEmail, verificationEmail } from "../email/templates.ts";
import { registeringGuest, signUpAfter, signUpBefore } from "./sign-up.ts";

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
  email: EmailSender;
  // Better Auth's own lines go here, with their message only (ADR 0078,
  // decision 5).
  log: FastifyBaseLogger;
  // Asks the breach service; the global fetch when left out, a fake in tests.
  breachFetch?: typeof fetch;
}) {
  const { email, log } = options;
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
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: passwordLimits.min,
      maxPasswordLength: passwordLimits.max,
      autoSignIn: false,
      // A real user's ID is a UUIDv7 from the database; Better Auth's own
      // would be a v4 and tell an existing address from a new one (ACC-2.5).
      customSyntheticUser: ({ coreFields, additionalFields }) => ({
        ...coreFields,
        ...additionalFields,
        id: uuidv7(),
      }),
      onExistingUserSignUp: ({ user }) => {
        sendInBackground(
          email,
          {
            to: user.email,
            ...existingAccountEmail(`${options.origin}/login`),
          },
          "existing-account",
          log,
        );
        return Promise.resolve();
      },
    },
    emailVerification: {
      expiresIn: day,
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: ({ user, token }) => {
        sendInBackground(
          email,
          {
            to: user.email,
            ...verificationEmail(
              `${options.origin}/verify?token=${encodeURIComponent(token)}`,
            ),
          },
          "verification",
          log,
        );
        return Promise.resolve();
      },
    },
    user: {
      modelName: "users",
      // Never returned: an answer carrying the registering guest would tell a
      // new address from an existing one (ACC-2.5).
      additionalFields: {
        registeredByGuest: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
        keepGuestData: {
          type: "boolean",
          required: false,
          input: true,
          returned: false,
        },
        convertedAt: {
          type: "date",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            if (ctx?.path !== "/sign-up/email") return;
            const guest = await registeringGuest(options.db, ctx);
            return guest
              ? { data: { ...user, registeredByGuest: guest } }
              : undefined;
          },
        },
      },
    },
    hooks: {
      before: signUpBefore(options.db, log, options.breachFetch),
      after: signUpAfter,
    },
    // Message only: the arguments can hold an address or a database error
    // quoting one. "info" is off since its sign-up line holds the address.
    logger: {
      level: "warn",
      log: (level, message) => {
        log[level](message);
      },
    },
    plugins: [anonymous({ disableDeleteAnonymousUser: true })],
  });
}

export type Auth = ReturnType<typeof createAuth>;
