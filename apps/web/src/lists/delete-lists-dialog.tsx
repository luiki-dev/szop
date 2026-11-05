import { useEffect, useRef } from "react";
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
import { notSaved } from "../api/client.ts";
import { useDeleteLists, useLists } from "./use-lists.ts";

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
  // Only lists fetched after the delete was sent can tell whether it was applied.
  const fresh = useLists(remove.isError);
  const applied =
    remove.isError &&
    fresh.dataUpdatedAt > remove.submittedAt &&
    fresh.data !== undefined &&
    !fresh.data.some((list) => remove.variables.includes(list.id));
  const [first] = lists;
  const title =
    lists.length === 1
      ? // Stryker disable next-line StringLiteral: first exists when lists.length is 1
        // Stryker disable next-line OptionalChaining: first exists when lists.length is 1
        `Delete list "${first?.name ?? ""}"?`
      : `Delete ${String(lists.length)} lists?`;

  // The answer was lost but the lists are gone: do what onSuccess does. The
  // mutation has settled here, so the shell's blocker does not hold the
  // navigation onDeleted starts.
  useEffect(() => {
    if (!applied) return;
    remove.reset();
    onOpenChange(false);
    onDeleted();
  }, [applied, remove, onOpenChange, onDeleted]);

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
            {notSaved(remove.error)
              ? " Check your connection and try again."
              : ""}
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
            {remove.isPending ? "Deleting…" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
