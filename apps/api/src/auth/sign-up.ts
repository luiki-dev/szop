import { registrationSchema, uuidv7 } from "@szop/shared";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api";
import { buildSyntheticUserOutput, parseUserOutput } from "better-auth/db";
import { sql } from "drizzle-orm";
import type { Database } from "../db/database.ts";

const signUpPath = "/sign-up/email";

// The anonymous, not yet converted user of the request's session: the guest
// whose browser registers (PH-18b spec, "Better Auth's configuration").
export async function registeringGuest(
  db: Database,
  ctx: Parameters<typeof getSessionFromCtx>[0],
): Promise<string | null> {
  const session = await getSessionFromCtx(ctx);
  if (!session?.user.isAnonymous) return null;
  const { rows } = await db.execute(
    sql`SELECT 1 FROM users WHERE id = ${session.user.id} AND converted_at IS NULL`,
  );
  return rows.length > 0 ? session.user.id : null;
}

// Before Better Auth's own checks: the body is checked first, so a sign-up
// that will be refused never deletes someone's pending account, then an
// unverified account with the address is replaced. Guests are never matched.
export const signUpBefore = (db: Database) =>
  createAuthMiddleware(async (ctx) => {
    if (ctx.path !== signUpPath) return;
    const parsed = registrationSchema.safeParse(ctx.body);
    if (!parsed.success) {
      throw APIError.from("BAD_REQUEST", {
        code: "INVALID_BODY",
        message: parsed.error.issues[0]?.message ?? "Invalid request.",
      });
    }
    const body = { ...(ctx.body as object), ...parsed.data };
    await db.transaction(async (tx) => {
      const { rows } = await tx.execute<{ id: string }>(
        sql`SELECT id FROM users WHERE lower(email) = lower(${parsed.data.email}) AND is_anonymous = false AND email_verified = false FOR UPDATE`,
      );
      for (const { id } of rows) {
        await tx.execute(sql`DELETE FROM users WHERE id = ${id}`);
      }
    });
    return { context: { body } };
  });

// Two sign-ups at once: the loser's insert breaks the unique address and
// Better Auth answers 422 FAILED_TO_CREATE_USER. It gets the answer an
// existing address gets, built as sign-up.mjs builds it.
export const signUpAfter = createAuthMiddleware(
  (ctx): Promise<Response | undefined> => {
    if (ctx.path !== signUpPath) return Promise.resolve(undefined);
    const returned = ctx.context.returned;
    if (
      !isAPIError(returned) ||
      returned.body?.code !== "FAILED_TO_CREATE_USER"
    ) {
      return Promise.resolve(undefined);
    }
    const body = ctx.body as { name: string; email: string; image?: string };
    const now = new Date();
    const user = buildSyntheticUserOutput(ctx.context.options, {
      name: body.name,
      email: body.email.toLowerCase(),
      emailVerified: false,
      image: body.image ?? null,
      createdAt: now,
      updatedAt: now,
      id: uuidv7(),
    });
    // A Response, since Better Auth keeps the handler's 422 for anything else.
    return Promise.resolve(
      Response.json({
        token: null,
        user: parseUserOutput(
          ctx.context.options,
          user as Parameters<typeof parseUserOutput>[1],
        ),
      }),
    );
  },
);
