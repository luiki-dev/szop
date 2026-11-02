import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance } from "fastify";
import { sendError } from "../errors.ts";
import type { Auth } from "./auth.ts";

// The only endpoints the app uses (NFR-4.12). An allowlist, so an endpoint a
// Better Auth upgrade adds stays closed until it is listed here.
const allowed = new Set([
  "POST /api/auth/sign-in/anonymous",
  "GET /api/auth/get-session",
  "POST /api/auth/sign-out",
]);

// Better Auth's own endpoints under /api/auth/*, handed the request as a
// Fetch API Request. Registered after the web baseline, so the cross-site and
// JSON-only checks have run before Better Auth sees anything.
export function authRoutes(app: FastifyInstance, options: { auth: Auth }) {
  const { auth } = options;
  // createAuth always sets baseURL to the configured origin.
  const origin = auth.options.baseURL;

  app.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    handler: async (request, reply) => {
      const { pathname } = new URL(request.url, origin);
      if (!allowed.has(`${request.method} ${pathname}`)) {
        return sendError(reply, 404, "not_found", "Not found");
      }
      // Stryker disable next-line ConditionalExpression,LogicalOperator,StringLiteral: GET never has a body and a POST without one stringifies to undefined, so the guard only documents it
      const hasBody = request.method !== "GET" && request.body !== undefined;
      const response = await auth.handler(
        new Request(new URL(request.url, origin), {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          body: hasBody ? JSON.stringify(request.body) : undefined,
        }),
      );
      reply.status(response.status);
      response.headers.forEach((value, name) => {
        // Set-Cookie values must stay separate: forEach would join them.
        if (name !== "set-cookie") reply.header(name, value);
      });
      const cookies = response.headers.getSetCookie();
      // Stryker disable next-line ConditionalExpression,EqualityOperator: an empty set-cookie array sends no header, so setting it always is the same
      if (cookies.length > 0) reply.header("set-cookie", cookies);
      return reply.send(await response.text());
    },
  });
}
