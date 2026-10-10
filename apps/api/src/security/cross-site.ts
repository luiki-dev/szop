import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

// GET, HEAD and OPTIONS never change anything (ADR 0012, decision 7).
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

// Whether the request comes from the app itself. Sec-Fetch-Site is set by the
// browser, and page scripts cannot change it; without it, the Origin's host
// must be the request's own Host. A request with neither is refused (ADR 0025,
// decisions 1 and 2). The raw Host header, not request.host, which reads
// X-Forwarded-Host behind a trusted proxy.
function comesFromTheApp(request: FastifyRequest): boolean {
  const site = request.headers["sec-fetch-site"];
  if (site !== undefined) return site === "same-origin";
  const origin = request.headers.origin;
  if (origin === undefined) return false;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    // Not a URL, such as the opaque origin "null".
    return false;
  }
}

// Refuses every unsafe request that does not come from the app: the defense
// against cross-site request forgery (CSRF). It protects users' browsers from
// other sites; scripts calling the API directly are met by sessions, limits
// and quotas instead.
function crossSiteCheck(app: FastifyInstance): void {
  app.addHook("onRequest", (request, reply, done) => {
    if (safeMethods.has(request.method) || comesFromTheApp(request)) {
      done();
      return;
    }
    // Fastify's error shape until the app has its own (OP-071).
    void reply.code(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Cross-site request refused",
    });
  });
}

// fastify-plugin turns off encapsulation, so the check reaches every route.
export const crossSite = fp(crossSiteCheck, { name: "szop-cross-site" });
