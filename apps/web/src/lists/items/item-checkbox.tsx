import type { ListItem } from "@szop/shared";
import { useUpdateItem } from "../use-items.ts";

// A checkbox named after the item. It sends the state wanted, `checked: true`
// (ITM-7.2); the row then leaves its card for the haul.
export function ItemCheckbox({
  listId,
  item,
}: {
  listId: string;
  item: ListItem;
}) {
  const update = useUpdateItem(listId, item.id);
  return (
    <span className="flex size-12 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        aria-label={item.name}
        checked={false}
        onChange={() => {
          update.mutate({ checked: true });
        }}
        className="size-7 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-input outline-none focus-visible:ring-3 focus-visible:ring-ring"
      />
    </span>
  );
}
