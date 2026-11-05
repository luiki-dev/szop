import { useEffect, useRef } from "react";

// A finger that moves further than this is scrolling, not pressing.
const moveLimit = 10;

interface PointerPoint {
  clientX: number;
  clientY: number;
}

// Calls onLongPress once the pointer has been held still for delay ms. The
// handlers go on the pressed element; pressed() is true once, for the click
// that ends a long press, so the element's click handler can ignore it.
export function useLongPress(
  onLongPress: () => void,
  {
    delay = 500,
    disabled = false,
  }: { delay?: number; disabled?: boolean } = {},
) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const origin = useRef<PointerPoint | undefined>(undefined);
  const holding = useRef(false);
  const fired = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    origin.current = undefined;
    holding.current = false;
  };
  // Stryker disable next-line ArrayDeclaration: a constant dependency list is the same as an empty one
  useEffect(() => cancel, []);

  return {
    handlers: {
      onPointerDown(event: PointerPoint) {
        cancel();
        fired.current = false;
        // Disabled: a press only forgets the last long press.
        if (disabled) return;
        holding.current = true;
        origin.current = { clientX: event.clientX, clientY: event.clientY };
        timer.current = setTimeout(() => {
          fired.current = true;
          onLongPress();
        }, delay);
      },
      onPointerMove(event: PointerPoint) {
        const start = origin.current;
        if (
          start &&
          Math.hypot(
            event.clientX - start.clientX,
            event.clientY - start.clientY,
          ) > moveLimit
        ) {
          cancel();
        }
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      // The browser's context menu opens on a long press; hold it back while
      // a press runs and until its click has been seen.
      onContextMenu(event: { preventDefault(): void }) {
        if (holding.current || fired.current) event.preventDefault();
      },
    },
    pressed() {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
