import helmet from "@fastify/helmet";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

// The security headers on every response (ADR 0012, decision 8). The CSP is
// written out in full, with helmet's defaults off: they would allow inline
// styles and data: fonts (ADR 0025, decision 4). HSTS covers subdomains, for
// a year, without preload (ADR 0025, decision 5). Helmet's other headers keep
// their defaults.
async function securityHeaders(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: false,
    },
    referrerPolicy: { policy: "no-referrer" },
  });
}

// fastify-plugin turns off encapsulation, so the headers reach every route,
// the SPA's files and the not-found handler included.
export const headers = fp(securityHeaders, { name: "szop-security-headers" });
