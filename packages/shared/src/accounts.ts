import { z } from "zod";
import { nameSchema } from "./names.ts";

// A display name: 1 to 50 characters after trimming, no control characters.
export const displayNameSchema = nameSchema("Enter your name.", 50);

// In UTF-16 code units, as Better Auth counts them, so an emoji counts as 2.
export const passwordLimits = { min: 15, max: 128 } as const;

export const registrationSchema = z.object({
  name: displayNameSchema,
  // The anonymous plugin's addresses end in placeholder.invalid.
  email: z
    .email()
    .refine((email) => !email.toLowerCase().endsWith(".placeholder.invalid"), {
      message: "Enter a valid email address.",
    }),
  // Not z.string().min(): Zod counts code points, Better Auth code units.
  password: z
    .string()
    .refine((value) => value.length >= passwordLimits.min, {
      message: "Password is too short (at least 15 characters).",
    })
    .refine((value) => value.length <= passwordLimits.max, {
      message: "Password is too long (at most 128 characters).",
    }),
  keepGuestData: z.boolean().optional(),
});
