import type { preHandlerAsyncHookHandler } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { sql } from "drizzle-orm";
import type { Database } from "../db/database.ts";
import { sendError } from "../errors.ts";
import type { Auth } from "./auth.ts";

export interface SessionUser {
  id: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

// Sets request.user from the session cookie, or null. Better Auth slides the
// session on a read and answers a fresh Set-Cookie; forwarding it keeps the
// browser's cookie as long-lived as the row (PH-16a plan, Review Focus 1).
// Every request with the session of a guest converted by a verification in
// another browser answers 401 guest_converted; `converted_at` is not returned
// by Better Auth, so it is read with a query.
export function sessionHook(
  auth: Auth,
  db: Database,
): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    const { headers, response } = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
      returnHeaders: true,
    });
    if (response?.user.isAnonymous) {
      const { rows } = await db.execute(
        sql`SELECT 1 FROM users WHERE id = ${response.user.id} AND converted_at IS NOT NULL`,
      );
      if (rows.length > 0) {
        return sendError(
          reply,
          401,
          "guest_converted",
          "Your address was confirmed in another browser",
        );
      }
    }
    const cookies = headers.getSetCookie();
    if (cookies.length > 0) reply.header("set-cookie", cookies);
    request.user = response ? { id: response.user.id } : null;
  };
}
