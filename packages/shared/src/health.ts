import { z } from "zod";

// The body of GET /api/health: 200 when the database is up, 503 when it is
// down (ADR 0020, decision 5). The schema says nothing about the HTTP status;
// that stays the client's concern. schemaVersion is the latest migration's
// name, or "unknown" when the database holds one this code does not know.
export const healthSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    database: z.object({
      status: z.literal("up"),
      schemaVersion: z.string(),
    }),
  }),
  z.object({
    status: z.literal("error"),
    database: z.object({ status: z.literal("down") }),
  }),
]);

export type Health = z.infer<typeof healthSchema>;
