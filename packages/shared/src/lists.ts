import { z } from "zod";
import { listItemSchema } from "./items.ts";
import { nameSchema } from "./names.ts";

export const listNameSchema = nameSchema("Name is required");

export const listSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sortByCategory: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const listWithItemsSchema = listSchema.extend({
  items: z.array(listItemSchema),
});

export const listsResponseSchema = z.object({ lists: z.array(listSchema) });

export const createListSchema = z.object({
  id: z.uuid(),
  name: listNameSchema,
});

export const renameListSchema = z.object({ name: listNameSchema });

export const updateListSchema = z
  .object({
    name: listNameSchema.optional(),
    sortByCategory: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Send at least one field",
  });

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
export type ListWithItems = z.infer<typeof listWithItemsSchema>;
export type CreateList = z.infer<typeof createListSchema>;
export type RenameList = z.infer<typeof renameListSchema>;
export type UpdateList = z.infer<typeof updateListSchema>;
export type DeleteLists = z.infer<typeof deleteListsSchema>;
