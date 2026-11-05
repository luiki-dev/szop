import { useRef } from "react";
import type { List } from "@szop/shared";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useDeleteLists } from "./use-lists.ts";

// The confirmation before lists are deleted. It owns the request: while it
// runs both buttons and Esc are off, and a failure keeps the dialog open.
export function DeleteListsDialog({
  lists,
  open,
  onOpenChange,
  onDeleted,
}: {
  lists: Pick<List, "id" | "name">[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const remove = useDeleteLists();
  const cancel = useRef<HTMLButtonElement>(null);
  const [first] = lists;
  const title =
    lists.length === 1
      ? // Stryker disable next-line StringLiteral: first exists when lists.length is 1
        // Stryker disable next-line OptionalChaining: first exists when lists.length is 1
        `Delete list "${first?.name ?? ""}"?`
      : `Delete ${String(lists.length)} lists?`;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        // Stryker disable next-line ConditionalExpression: the dialog never calls onOpenChange(true), so `true` behaves as `!next`
        if (!next) remove.reset();
        onOpenChange(next);
      }}
    >
      <AlertDialogContent initialFocus={cancel}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        {remove.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {lists.length === 1
              ? "Couldn't delete the list."
              : "Couldn't delete the lists."}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancel} disabled={remove.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            aria-busy={remove.isPending}
            onClick={() => {
              remove.mutate(
                lists.map((list) => list.id),
                {
                  onSuccess: () => {
                    // Stryker disable next-line CallExpression: a successful mutation renders nothing, and the next line closes the dialog
                    remove.reset();
                    onOpenChange(false);
                    onDeleted();
                  },
                },
              );
            }}
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
