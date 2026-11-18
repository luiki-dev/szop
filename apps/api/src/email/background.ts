import type { FastifyBaseLogger } from "fastify";
import type { Email, EmailSender } from "./sender.ts";

// Starts a send without waiting for it, so the answer never depends on it; a
// failure is logged with the email's kind and the error's name and code only,
// never its message, which can quote the address (ADR 0078, decision 5).
export function sendInBackground(
  sender: EmailSender,
  email: Email,
  kind: string,
  log: Pick<FastifyBaseLogger, "error">,
): void {
  void sender.send(email).catch((reason: unknown) => {
    const error =
      typeof reason === "object" && reason !== null
        ? (reason as { name?: unknown; code?: unknown })
        : {};
    log.error(
      { emailKind: kind, errorName: error.name, errorCode: error.code },
      "email not sent",
    );
  });
}
