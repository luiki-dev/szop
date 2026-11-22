import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { sql } from "drizzle-orm";
import type { Database } from "../db/database.ts";

// Runs after Better Auth has checked the token and before it records the
// result, so a failure here leaves the account unverified and the link usable
// again. Re-reads the user with a lock; a pending account replaced or deleted
// in the meantime is gone. Then marks the address verified, moves the
// registering guest's workspace and converts the guest in one transaction: a
// replacing sign-up (which only deletes unverified accounts) can never delete
// an account whose workspace has moved. Each step does nothing a second time,
// so opening the link again finishes it.
export const beforeVerification =
  (db: Database) =>
  async (user: { id: string }): Promise<void> => {
    await db.transaction(async (tx) => {
      const { rows } = await tx.execute<{
        guest: string | null;
        keep: boolean;
      }>(
        sql`SELECT registered_by_guest AS guest, keep_guest_data AS keep
            FROM users WHERE id = ${user.id} FOR UPDATE`,
      );
      if (rows.length === 0) {
        throw APIError.from("UNAUTHORIZED", {
          code: "INVALID_TOKEN",
          message: "Invalid token",
        });
      }
      await tx.execute(
        sql`UPDATE users SET email_verified = true WHERE id = ${user.id}`,
      );
      const guest = rows[0]?.guest;
      if (!guest) return;
      if (rows[0]?.keep) {
        await tx.execute(
          sql`UPDATE workspaces SET user_id = ${user.id} WHERE user_id = ${guest}`,
        );
      }
      await tx.execute(
        sql`UPDATE users SET converted_at = now()
            WHERE id = ${guest} AND converted_at IS NULL`,
      );
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
