import type { Server } from "node:http";
import type { FastifyBaseLogger } from "fastify";

export interface ShutdownDeadlineOptions {
  server: Pick<Server, "getConnections" | "closeAllConnections">;
  log: Pick<FastifyBaseLogger, "warn" | "error">;
  deadlineMs: number;
  graceMs: number;
  exit: (code: number) => void;
}

// Bounds a graceful shutdown (ADR 0033, decision 6). At the deadline, the
// connections still open, such as a client that never finishes its request,
// are closed, which lets app.close() resolve and the process exit as usual.
// If even that does not end it within the grace period, the process exits
// with code 1. The timers are unref'd: a shutdown that finishes in time is
// never held up by them.
export function startShutdownDeadline({
  server,
  log,
  deadlineMs,
  graceMs,
  exit,
}: ShutdownDeadlineOptions): void {
  setTimeout(() => {
    server.getConnections((_error, openConnections) => {
      log.warn(
        { openConnections },
        "shutdown deadline reached, closing connections",
      );
      server.closeAllConnections();
    });
    setTimeout(() => {
      log.error("shutdown did not finish, exiting");
      exit(1);
    }, graceMs).unref();
  }, deadlineMs).unref();
}
