import { useEffect, useState } from "react";

// The phone's keyboard is open when the visual viewport is at least this much
// shorter than the tallest it has been at the same width; a hiding address bar
// is shorter than that (ADR 0073, decision 3). A desktop shows no keyboard, and
// a browser without visualViewport counts as keyboard closed.
const KEYBOARD_PX = 150;

export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let width = 0;
    let tallest = 0;
    const measure = () => {
      // A turned phone or a zoom starts over.
      if (viewport.width !== width) {
        width = viewport.width;
        tallest = 0;
      }
      tallest = Math.max(tallest, viewport.height);
      setOpen(tallest - viewport.height >= KEYBOARD_PX);
    };
    measure();
    viewport.addEventListener("resize", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
    };
  }, []);
  return open;
}
