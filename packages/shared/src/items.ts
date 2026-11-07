import { z } from "zod";
import { nameSchema } from "./names.ts";

// The limits, once (LIM-2.1). Quantity is in thousandths, price in cents.
export const itemLimits = {
  name: 100,
  note: 500,
  quantity: { min: 1, max: 9_999_000 },
  price: { min: 0, max: 9_999_999 },
} as const;

export const itemNameSchema = nameSchema("Enter a name.", itemLimits.name);

export const itemNoteSchema = z
  .string()
  .refine((value) => Array.from(value).length <= itemLimits.note, {
    message: `Note is too long (at most ${String(itemLimits.note)} characters)`,
  })
  .transform((value) => (value === "" ? null : value));

const quantitySchema = z
  .int()
  .min(itemLimits.quantity.min)
  .max(itemLimits.quantity.max);
const priceSchema = z.int().min(itemLimits.price.min).max(itemLimits.price.max);

export const listItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  quantity: z.int().nullable(),
  unitId: z.uuid().nullable(),
  price: z.int().nullable(),
  categoryId: z.uuid().nullable(),
  note: z.string().nullable(),
  checkedAt: z.iso.datetime().nullable(),
});

// The editable fields; null clears one.
const fields = {
  name: itemNameSchema,
  quantity: quantitySchema.nullable().optional(),
  unitId: z.uuid().nullable().optional(),
  price: priceSchema.nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  note: itemNoteSchema.nullable().optional(),
};

// Undo sends every field back, checkedAt included.
export const createItemSchema = z.object({
  id: z.uuid(),
  ...fields,
  checkedAt: z.iso.datetime().nullable().optional(),
});

export const updateItemSchema = z
  .object({
    ...fields,
    name: itemNameSchema.optional(),
    checked: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Send at least one field",
  });

export type ListItem = z.infer<typeof listItemSchema>;
export type CreateItem = z.infer<typeof createItemSchema>;
export type UpdateItem = z.infer<typeof updateItemSchema>;
