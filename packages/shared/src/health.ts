import { z } from "zod";

// The body of GET /api/health: 200 when the database is up, 503 when it is
// down (ADR 0020, decision 5). The schema says nothing about the HTTP status;
// that stays the client's concern. schemaVersion is the latest migration's
// name, or "unknown" when the database holds one this code does not know.
// commit is the full hash of the commit the API was built from, or "unknown"
// outside the image (PH-12d spec, decision 3); it is in both variants, so a
// redeploy shows which version answers even when the database is down.
// instance names the process that answered, 8 hexadecimal characters drawn
// at its start, so the answers show which task behind the load balancer
// gave them (PH-37 spec, decision 3).
export const healthSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    commit: z.string(),
    instance: z.string(),
    database: z.object({
      status: z.literal("up"),
      schemaVersion: z.string(),
    }),
  }),
  z.object({
    status: z.literal("error"),
    commit: z.string(),
    instance: z.string(),
    database: z.object({ status: z.literal("down") }),
  }),
]);

export type Health = z.infer<typeof healthSchema>;
