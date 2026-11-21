import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { sql } from "drizzle-orm";
import type { Database } from "../db/database.ts";

// Runs before Better Auth marks the address verified, so a failure here
// leaves the account unverified and the link usable again. Re-reads the user
// with a lock; a pending account replaced or deleted in the meantime is gone.
export const beforeVerification =
  (db: Database) =>
  async (user: { id: string }): Promise<void> => {
    await db.transaction(async (tx) => {
      const { rows } = await tx.execute(
        sql`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`,
      );
      if (rows.length === 0) {
        throw APIError.from("UNAUTHORIZED", {
          code: "INVALID_TOKEN",
          message: "Invalid token",
        });
      }
    });
  };

// The link answers whether it verified: a second use is no error, only
// `verified: false`, since Better Auth signs in (newSession) only the first
// time. A Response, since Better Auth keeps the handler's body otherwise.
export const verifyAfter = createAuthMiddleware(
  (ctx): Promise<Response | undefined> => {
    if (ctx.path !== "/verify-email" || isAPIError(ctx.context.returned)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(
      Response.json({ verified: ctx.context.newSession !== null }),
    );
  },
);
