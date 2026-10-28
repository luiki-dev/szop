import { join, sep } from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { sendError } from "../errors.ts";

export interface WebRoutesOptions {
  root: string;
}

// Vite puts a content hash in the name of every file under assets/, so a
// changed file gets a new name and the old one can be cached for good.
const immutable = "public, max-age=31536000, immutable";

// Serves the built SPA (ADR 0013, decision 5; ADR 0023, decisions 5 and 6):
// the .br or .gz copy the request accepts, cache headers by path, and
// index.html for any path that is a page of the app.
export async function webRoutes(
  app: FastifyInstance,
  { root }: WebRoutesOptions,
): Promise<void> {
  const assets = join(root, "assets") + sep;

  await app.register(fastifyStatic, {
    root,
    preCompressed: true,
    // One route per file found at startup; every other path reaches the
    // not-found handler below.
    wildcard: false,
    // The path is the file actually sent, such as index.html.br.
    setHeaders(reply, path) {
      reply.header(
        "cache-control",
        path.startsWith(assets) ? immutable : "no-cache",
      );
    },
  });

  app.setNotFoundHandler((request, reply) => {
    const parts = request.url.split("?", 1);
    // Stryker disable next-line StringLiteral: `split("?", 1)` always returns one element, so the default is unreachable
    const [path = ""] = parts;
    const lastSegment = path.slice(path.lastIndexOf("/") + 1);
    const isApi = path === "/api" || path.startsWith("/api/");
    const isPage =
      (request.method === "GET" || request.method === "HEAD") &&
      !isApi &&
      !lastSegment.includes(".");
    if (isPage) {
      // React Router renders the path; setHeaders above marks it no-cache.
      // Stryker disable next-line StringLiteral: an empty file name resolves to the root's index.html, the same file
      return reply.sendFile("index.html");
    }
    // An API call or a missing file never gets the app's HTML.
    return sendError(
      reply,
      404,
      "not_found",
      `Route ${request.method}:${request.url} not found`,
    );
  });
}
