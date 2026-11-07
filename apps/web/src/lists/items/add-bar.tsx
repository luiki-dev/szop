import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { itemLimits, itemNameSchema, uuidv7 } from "@szop/shared";
import { Button } from "@/components/ui/button.tsx";
import { useAddItem } from "../use-items.ts";

const formSchema = z.object({ name: itemNameSchema });

// A tap on the page blurs the field before its click: on a mouse at
// pointerdown, on a touch screen at the compatibility mousedown after
// pointerup. The haul must not unfold under the finger before the click, or
// the click lands elsewhere. So a blur right after a pointerdown unfolds after
// the click instead. shortcut: a press held over 1 s unfolds mid-tap; the
// fallback timer also covers a pointer that never clicks.
const TAP_MS = 500;
const GIVE_UP_MS = 1000;

function useUnfoldAfterTap(onFocusChange: (focused: boolean) => void) {
  const lastDown = useRef(-Infinity);
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => {
    const down = () => {
      lastDown.current = performance.now();
    };
    // A key (Tab) moving the focus is not a tap.
    const key = () => {
      lastDown.current = -Infinity;
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
      cancel.current?.();
    };
  }, []);
  return () => {
    cancel.current?.();
    if (performance.now() - lastDown.current > TAP_MS) {
      onFocusChange(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      window.removeEventListener("click", done, true);
      window.removeEventListener("pointercancel", done, true);
      clearTimeout(timer);
      cancel.current = null;
    };
    const done = () => {
      stop();
      // The click's own handlers run first; unfold after them.
      timer = setTimeout(() => {
        onFocusChange(false);
      }, 0);
      cancel.current = () => {
        clearTimeout(timer);
      };
    };
    window.addEventListener("click", done, true);
    window.addEventListener("pointercancel", done, true);
    timer = setTimeout(done, GIVE_UP_MS);
    cancel.current = stop;
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
