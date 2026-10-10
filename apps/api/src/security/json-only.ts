import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

// Bodies must be JSON (ADR 0012, decision 7). Fastify parses JSON and plain
// text out of the box; without the text parser, every content type but JSON
// gets Fastify's 415, which closes the last body an HTML form on another
// site could send (ADR 0025, decision 3).
function jsonOnlyBodies(app: FastifyInstance): void {
  app.removeContentTypeParser("text/plain");
}

// fastify-plugin turns off encapsulation, so every route loses the parser.
export const jsonOnly = fp(jsonOnlyBodies, { name: "szop-json-only" });
