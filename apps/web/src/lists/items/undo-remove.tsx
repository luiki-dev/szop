import { useEffect } from "react";
import type { ListItem } from "@szop/shared";
import { toastManager } from "../../shell/toasts.tsx";
import { useRestoreItem } from "../use-items.ts";

// "Removed Bananas" with Undo, for 5 seconds (APP-3.1). ListPage renders it
// with the removed item's key, so a second removal replaces the toast. Undo
// is a create in the item's own mutation scope: it is sent after the delete.
export function UndoRemove({
  listId,
  item,
}: {
  listId: string;
  item: ListItem;
}) {
  const { mutate } = useRestoreItem(listId, item.id);
  useEffect(() => {
    const id = toastManager.add({
      description: `Removed ${item.name}`,
      timeout: 5000,
      actionProps: {
        children: "Undo",
        onClick: () => {
          mutate(item);
          toastManager.close(id);
        },
      },
    });
    return () => {
      toastManager.close(id);
    };
  }, [item, mutate]);
  return null;
}
