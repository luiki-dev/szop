import { z } from "zod";

// The body of every error the API answers, whatever the status: a stable,
// snake-case code the client can branch on and a message for people. The
// schema says nothing about the HTTP status; that stays the client's concern.
// Codes: invalid_input (400), forbidden_cross_site (403), not_found (404),
// unsupported_media_type (415), internal_error (500).
export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
