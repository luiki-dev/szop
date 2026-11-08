import { useEffect, useState } from "react";
import { coarseQuery } from "../../shell/use-media-query.ts";

// The phone's keyboard is open when the visual viewport is at least this much
// shorter than the tallest it has been at the same width; a hiding address bar
// is shorter than that (ADR 0073, decision 3). Only a touch screen has one: a
// shortened desktop window is not a keyboard. A browser without visualViewport
// counts as keyboard closed.
const KEYBOARD_PX = 150;

export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  // Stryker disable ArrayDeclaration: the dependency list of a run-once effect; a constant item behaves the same
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
      setOpen(
        matchMedia(coarseQuery).matches &&
          tallest - viewport.height >= KEYBOARD_PX,
      );
    };
    measure();
    viewport.addEventListener("resize", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
    };
  }, []);
  // Stryker restore ArrayDeclaration
  return open;
}
