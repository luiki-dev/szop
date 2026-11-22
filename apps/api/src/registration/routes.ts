import { registrationSchema } from "@szop/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Auth } from "../auth/auth.ts";
import { sendError } from "../errors.ts";

// Better Auth's own rule for /send-verification-email: 3 in 60 seconds.
const limit = 3;
const windowMs = 60_000;

// POST /api/registration/resend: sends the verification link again. Called
// from the app, auth.api skips Better Auth's rate limiter, so the route keeps
// its own, per IP (the one the API resolves from TRUSTED_PROXIES).
export function registrationRoutes(
  app: FastifyInstance,
  { auth }: { auth: Auth },
): void {
  // shortcut: per task and lost on restart, until PH-20's quotas; each request
  // sweeps the IPs whose window is empty, so the map holds the last minute's IPs
  // only, at a cost of one pass over them
  const requests = new Map<string, number[]>();

  app.withTypeProvider<ZodTypeProvider>().post(
    "/registration/resend",
    {
      schema: { body: registrationSchema.pick({ email: true }) },
    },
    async (request, reply) => {
      const now = Date.now();
      for (const [ip, times] of requests) {
        if (now - (times.at(-1) ?? 0) >= windowMs) requests.delete(ip);
      }
      const recent = (requests.get(request.ip) ?? []).filter(
        (at) => now - at < windowMs,
      );
      if (recent.length >= limit) {
        requests.set(request.ip, recent);
        return sendError(
          reply,
          429,
          "too_many_requests",
          "Too many requests. Try again in a minute.",
        );
      }
      requests.set(request.ip, [...recent, now]);
      // No headers: Better Auth takes its no-session path, sends only to an
      // unverified account and answers alike for any address.
      await auth.api.sendVerificationEmail({
        body: { email: request.body.email },
      });
      return reply.code(204).send();
    },
  );
}
