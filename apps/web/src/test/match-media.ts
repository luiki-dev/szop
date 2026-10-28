import { vi } from "vitest";

// jsdom has no matchMedia. This fake answers each query from a table the
// test controls, and set() changes an answer and fires the query's change
// listeners, as a resized window or a changed system setting would. A query
// missing from the table does not match: a phone in the light scheme.
export function stubMatchMedia(matches: Record<string, boolean> = {}): {
  set(query: string, matches: boolean): void;
  listenerCount(query: string): number;
} {
  const answers = new Map(Object.entries(matches));
  const listeners = new Map<
    string,
    Set<(event: MediaQueryListEvent) => void>
  >();

  vi.stubGlobal("matchMedia", (query: string) => {
    const queryListeners = listeners.get(query) ?? new Set();
    listeners.set(query, queryListeners);
    return {
      media: query,
      get matches() {
        return answers.get(query) ?? false;
      },
      // Only "change" is wired, so a listener for another event never fires.
      addEventListener(type: string, listener: () => void) {
        if (type === "change") queryListeners.add(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        if (type === "change") queryListeners.delete(listener);
      },
    } as unknown as MediaQueryList;
  });

  return {
    listenerCount: (query) => listeners.get(query)?.size ?? 0,
    set(query, value) {
      answers.set(query, value);
      for (const listener of listeners.get(query) ?? []) {
        listener({ matches: value, media: query } as MediaQueryListEvent);
      }
    },
  };
}
