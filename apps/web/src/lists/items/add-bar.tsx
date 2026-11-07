import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { itemLimits, itemNameSchema, uuidv7 } from "@szop/shared";
import { Button } from "@/components/ui/button.tsx";
import { useAddItem } from "../use-items.ts";

const formSchema = z.object({ name: itemNameSchema });

// The blur fires at pointerdown. The haul must not unfold under the finger
// before the tap ends, or the click lands elsewhere: wait for pointerup.
function useUnfoldAfterTap(onFocusChange: (focused: boolean) => void) {
  const pressed = useRef(false);
  useEffect(() => {
    const down = () => {
      pressed.current = true;
    };
    const up = () => {
      pressed.current = false;
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, []);
  return () => {
    if (!pressed.current) {
      onFocusChange(false);
      return;
    }
    // The click follows pointerup in the same task: unfold after it.
    const end = () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setTimeout(() => {
        onFocusChange(false);
      }, 0);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
}

// The add bar: a band in the page color; the list page pins it, with the haul
// under it, to the bottom of the column (ITM-2). The next item's ID is made up
// front and renewed after each add, so every add is its own mutation scope.
// An empty name adds nothing, with no message (LIM-2.2: the field's maxLength
// keeps the name short).
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
  const unfold = useUnfoldAfterTap(onFocusChange);
  const { register, handleSubmit, reset } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });
  const onSubmit = handleSubmit(({ name }) => {
    add.mutate(name);
    // Detach the pending add: the observer copies new options onto a mutation
    // it still observes, which would send this add with the next add's ID.
    add.reset();
    setNextId(uuidv7());
    reset();
  });
  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="flex gap-2 rounded-t-surface border-t border-border bg-background px-4 py-3 shadow-[0_-4px_12px_rgb(0_0_0/0.08)] md:px-6"
    >
      <input
        {...register("name", {
          onBlur: () => {
            unfold();
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
      {/* Pressing Add must not take the focus from the field: on a phone the
          keyboard stays open. */}
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
