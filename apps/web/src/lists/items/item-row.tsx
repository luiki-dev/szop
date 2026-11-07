import type { ReactNode } from "react";
import { useCheckboxSide } from "../../shell/checkbox-side.ts";
import {
  formatPrice,
  formatQuantity,
  lineTotal,
  type ListItem,
} from "@szop/shared";

// One item: the name, note, quantity and line total are a single button that
// opens the edit; the checkbox is its sibling, so it
// only checks.
export function ItemRow({
  item,
  unitName,
  onEdit,
  checkbox,
}: {
  item: ListItem;
  unitName: string | null;
  onEdit: () => void;
  checkbox?: ReactNode;
}) {
  const left = useCheckboxSide() === "left";
  const total = lineTotal(item);
  const quantity =
    item.quantity === null
      ? null
      : [formatQuantity(item.quantity), unitName].filter(Boolean).join(" ");
  return (
    <li className="flex min-h-14 items-center gap-2 border-t border-border first:border-t-0">
      {left && checkbox}
      <button
        type="button"
        onClick={onEdit}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-control px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold break-words">{item.name}</span>
          {item.note && (
            <span className="line-clamp-1 text-sm text-muted-foreground">
              {item.note}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end text-sm">
          {quantity && (
            <span className="text-muted-foreground">{quantity}</span>
          )}
          {total !== null && (
            <span className="font-bold">{formatPrice(total)}</span>
          )}
        </span>
      </button>
      {!left && checkbox}
    </li>
  );
}
