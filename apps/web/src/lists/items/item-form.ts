import { z } from "zod";
import {
  formatAmountInput,
  itemLimits,
  itemNameSchema,
  itemNoteSchema,
  parseAmount,
  type ListItem,
} from "@szop/shared";

// The edit form's values are the fields' text, so a decimal comma or point
// reaches parseAmount as typed. unitId is "" for "No unit".
export type ItemFormValues = {
  name: string;
  quantity: string;
  unitId: string;
  price: string;
  categoryId: string | null;
  note: string;
};

export function toFormValues(item: ListItem): ItemFormValues {
  return {
    name: item.name,
    quantity: item.quantity === null ? "" : formatAmountInput(item.quantity, 3),
    unitId: item.unitId ?? "",
    price: item.price === null ? "" : formatAmountInput(item.price, 2),
    categoryId: item.categoryId,
    note: item.note ?? "",
  };
}

// One message for every bad number (ADR 0071): a text parseAmount refuses, or
// a value outside the limits.
const badNumber = "Enter a number, such as 1.5.";

const amount = (decimals: 2 | 3, min: number, max: number) =>
  z.string().transform((text, ctx) => {
    const parsed = parseAmount(text, decimals);
    if (
      parsed.ok &&
      (parsed.value === null || (parsed.value >= min && parsed.value <= max))
    )
      return parsed.value;
    ctx.addIssue({ code: "custom", message: badNumber });
    return z.NEVER;
  });

export const itemFormSchema = z.object({
  name: itemNameSchema,
  quantity: amount(3, itemLimits.quantity.min, itemLimits.quantity.max),
  unitId: z.string().transform((id) => (id === "" ? null : id)),
  price: amount(2, itemLimits.price.min, itemLimits.price.max),
  categoryId: z.string().nullable(),
  note: z.string().pipe(itemNoteSchema),
});
