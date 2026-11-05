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
  })
  // Control and format characters, except the joiner and the tag characters
  // that build emoji sequences (ZWJ families, flags of regions).
  .refine(
    (value) => !/(?![\u200D\u{E0020}-\u{E007F}])[\p{Cc}\p{Cf}]/u.test(value),
    {
      message: "Name can't contain control characters",
    },
  );

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

export const deleteListsSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "IDs must be unique",
    }),
});

export type List = z.infer<typeof listSchema>;
export type CreateList = z.infer<typeof createListSchema>;
export type RenameList = z.infer<typeof renameListSchema>;
export type DeleteLists = z.infer<typeof deleteListsSchema>;
