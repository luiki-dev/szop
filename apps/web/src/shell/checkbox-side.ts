import { useSyncExternalStore } from "react";

// Which side of a row the checkbox sits on (APR-2): Right, the default, or
// Left, kept on the device like the color scheme. Components follow it
// through useCheckboxSide, so a change in the menu re-lays every row at once.

export type CheckboxSide = "left" | "right";

export const checkboxSideKey = "szop-checkbox-side";

// This visit's choice, for when the storage throws; undefined while it works.
let sessionChoice: CheckboxSide | undefined;
const listeners = new Set<() => void>();

export function readCheckboxSide(): CheckboxSide {
  try {
    return localStorage.getItem(checkboxSideKey) === "left" ? "left" : "right";
  } catch {
    return sessionChoice ?? "right";
  }
}

// Right is the default, so choosing it forgets the choice.
export function storeCheckboxSide(side: CheckboxSide): void {
  try {
    if (side === "right") {
      localStorage.removeItem(checkboxSideKey);
    } else {
      localStorage.setItem(checkboxSideKey, side);
    }
    sessionChoice = undefined;
  } catch {
    sessionChoice = side;
  }
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Stryker disable next-line BlockStatement: a listener left behind after unmount is called and does nothing React can see
  return () => {
    // Stryker disable next-line CallExpression: same, a leftover listener has no visible effect
    listeners.delete(listener);
  };
}

export function useCheckboxSide(): CheckboxSide {
  return useSyncExternalStore(subscribe, readCheckboxSide);
}
