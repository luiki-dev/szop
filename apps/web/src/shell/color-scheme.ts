// The user's color scheme (APR-1; ADR 0049): System, the default, Light or
// Dark, kept on the device. Dark mode is the class "dark" on <html>, which
// Tailwind's dark: variant and the dark roles in index.css follow.
//
// public/color-scheme.js applies the same rules before the first paint, since
// it must run before this bundle; the two are kept in step by hand.

export type ColorScheme = "system" | "light" | "dark";

export const storageKey = "szop-color-scheme";
export const darkQuery = "(prefers-color-scheme: dark)";

// The choice of this visit, for when the storage throws (private mode,
// blocked site data): the menu and the system listener read it, so the
// choice holds until the page is closed. Undefined while the storage works.
let sessionChoice: ColorScheme | undefined;

// A stored value other than light or dark means System. A storage that
// throws means this visit's choice, or System.
export function readColorScheme(): ColorScheme {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return sessionChoice ?? "system";
  }
}

// System is the default, so choosing it forgets the choice. A storage that
// throws keeps it for this visit only.
export function storeColorScheme(choice: ColorScheme): void {
  try {
    if (choice === "system") {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, choice);
    }
    sessionChoice = undefined;
  } catch {
    sessionChoice = choice;
  }
}

export function applyColorScheme(choice: ColorScheme): void {
  const dark =
    choice === "dark" || (choice === "system" && matchMedia(darkQuery).matches);
  document.documentElement.classList.toggle("dark", dark);
}

// While the choice is System, a change of the system setting switches the
// page at once, whether or not the menu is open. Returns the unsubscribe.
export function followSystemColorScheme(): () => void {
  const list = matchMedia(darkQuery);
  const onChange = () => {
    applyColorScheme(readColorScheme());
  };
  list.addEventListener("change", onChange);
  return () => {
    list.removeEventListener("change", onChange);
  };
}
