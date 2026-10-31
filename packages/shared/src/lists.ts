import { z } from "zod";

// A list name: trimmed, NFC-normalized, 1 to 100 Unicode code points (not
// UTF-16 units, so one emoji counts once).
export const listNameSchema = z
  .string()
  .transform((value) => value.trim().normalize("NFC"))
  .refine((value) => Array.from(value).length >= 1, {
    message: "Name is required",
  })
  .refine((value) => Array.from(value).length <= 100, {
    message: "Name is too long (at most 100 characters)",
  });

export const listSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
});

export const listsResponseSchema = z.object({ lists: z.array(listSchema) });

export const createListSchema = z.object({
  id: z.uuid(),
  name: listNameSchema,
});

export const renameListSchema = z.object({ name: listNameSchema });

export type List = z.infer<typeof listSchema>;
export type CreateList = z.infer<typeof createListSchema>;
export type RenameList = z.infer<typeof renameListSchema>;
