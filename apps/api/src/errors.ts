import { STATUS_CODES } from "node:http";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type { ApiError } from "@szop/shared";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";

// Answers with the API's one error body: { error: { code, message } }.
export function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
): FastifyReply {
  const body: ApiError = { error: { code, message } };
  return reply.code(status).send(body);
}

// "Unsupported Media Type" -> "unsupported_media_type".
function codeFor(status: number): string {
  // Stryker disable next-line Regex: no status name has two adjacent non-alphanumeric characters, so `+` changes nothing
  const separators = /[^a-z0-9]+/g;
  return (STATUS_CODES[status] ?? "error")
    .toLowerCase()
    .replace(separators, "_");
}

// Every error a route, hook or Fastify itself raises ends here. A client
// error (4xx) keeps its status and message; anything else is logged in full
// and answered with a generic 500, so no detail leaks (NFR-4.11).
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return sendError(reply, 400, "invalid_input", error.message);
  }
  const status = error.statusCode;
  // Stryker disable next-line ConditionalExpression: `undefined >= 400` is false, so the first check is redundant
  if (status !== undefined && status >= 400 && status < 500) {
    return sendError(reply, status, codeFor(status), error.message);
  }
  request.log.error(error, "request failed");
  return sendError(reply, 500, "internal_error", "Internal server error");
}
