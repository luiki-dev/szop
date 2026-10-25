import { useCallback, useSyncExternalStore } from "react";

// Tailwind's lg breakpoint: from here the menu is a sidebar, below it a
// drawer (visual-design.md, section 5).
export const desktopQuery = "(min-width: 64rem)";

// Whether a media query matches now, re-rendering when that changes.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches);
}
