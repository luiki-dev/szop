import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { itemLimits, itemNameSchema, uuidv7 } from "@szop/shared";
import { Button } from "@/components/ui/button.tsx";
import { useAddItem } from "../use-items.ts";

const formSchema = z.object({ name: itemNameSchema });

// The add bar: a band in the page color, pinned to the bottom of the column
// (ITM-2). The next item's ID is made up front and renewed after each add, so
// every add is its own mutation scope. An empty name adds nothing, with no
// message (LIM-2.2: the field's maxLength keeps the name short).
export function AddBar({
  listId,
  listName,
  onFocusChange,
}: {
  listId: string;
  listName: string;
  onFocusChange: (focused: boolean) => void;
}) {
  const [nextId, setNextId] = useState(uuidv7);
  const add = useAddItem(listId, nextId);
  const { register, handleSubmit, reset } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });
  const onSubmit = handleSubmit(({ name }) => {
    add.mutate(name);
    setNextId(uuidv7());
    reset();
  });
  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="sticky bottom-0 z-10 -mx-4 mt-4 flex gap-2 rounded-t-surface border-t border-border bg-background px-4 py-3 shadow-[0_-4px_12px_rgb(0_0_0/0.08)] md:-mx-6 md:px-6"
    >
      <input
        {...register("name", {
          onBlur: () => {
            onFocusChange(false);
          },
        })}
        onFocus={() => {
          onFocusChange(true);
        }}
        maxLength={itemLimits.name}
        placeholder="+ Add item"
        aria-label={`Add an item to ${listName}`}
        autoComplete="off"
        className="h-12 min-w-0 flex-1 rounded-control border-2 border-input bg-card px-3 outline-none focus:ring-3 focus:ring-ring"
      />
      {/* Pressing Add must not take the focus from the field: on a phone the keyboard stays open. */}
      <Button
        type="submit"
        className="h-12 px-5"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
      >
        Add
      </Button>
    </form>
  );
}
