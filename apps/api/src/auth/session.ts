import type { preHandlerAsyncHookHandler } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
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
export function sessionHook(auth: Auth): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    const { headers, response } = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
      returnHeaders: true,
    });
    const cookies = headers.getSetCookie();
    if (cookies.length > 0) reply.header("set-cookie", cookies);
    request.user = response ? { id: response.user.id } : null;
  };
}
