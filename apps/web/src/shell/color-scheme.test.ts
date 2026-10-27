import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "../test/match-media.ts";
import {
  applyColorScheme,
  darkQuery,
  followSystemColorScheme,
  readColorScheme,
  storageKey,
  storeColorScheme,
} from "./color-scheme.ts";

const html = document.documentElement;

afterEach(() => {
  vi.restoreAllMocks();
  // With the storage working again, this also forgets a session's choice.
  storeColorScheme("system");
  html.classList.remove("dark");
});

describe("readColorScheme", () => {
  it.each(["light", "dark", "system"] as const)("reads %s", (choice) => {
    localStorage.setItem(storageKey, choice);

    expect(readColorScheme()).toBe(choice);
  });

  it("APR-1.2: is system when nothing is stored", () => {
    expect(readColorScheme()).toBe("system");
  });

  it("is system for a value it does not know", () => {
    localStorage.setItem(storageKey, "blue");

    expect(readColorScheme()).toBe("system");
  });

  it("APR-1.5: is system when the storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readColorScheme()).toBe("system");
  });
});

describe("storeColorScheme", () => {
  it("stores dark", () => {
    storeColorScheme("dark");

    expect(localStorage.getItem(storageKey)).toBe("dark");
  });

  it("removes the key for system", () => {
    localStorage.setItem(storageKey, "dark");

    storeColorScheme("system");

    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("does not throw when the storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => {
      storeColorScheme("dark");
    }).not.toThrow();
  });
});

describe("applyColorScheme", () => {
  it("adds the class for dark and removes it for light", () => {
    applyColorScheme("dark");
    expect(html).toHaveClass("dark");

    applyColorScheme("light");
    expect(html).not.toHaveClass("dark");
  });

  it("follows the system for system", () => {
    stubMatchMedia({ [darkQuery]: true });

    applyColorScheme("system");

    expect(html).toHaveClass("dark");
  });
});

describe("followSystemColorScheme", () => {
  it("APR-1.2: follows the system while the choice is system, with nothing rendered", () => {
    const media = stubMatchMedia();
    const stop = followSystemColorScheme();

    media.set(darkQuery, true);
    expect(html).toHaveClass("dark");
    media.set(darkQuery, false);
    expect(html).not.toHaveClass("dark");

    stop();
  });

  it("APR-1.3: keeps a stored light choice when the system turns dark", () => {
    localStorage.setItem(storageKey, "light");
    const media = stubMatchMedia();
    const stop = followSystemColorScheme();

    media.set(darkQuery, true);

    expect(html).not.toHaveClass("dark");
    stop();
  });

  it("keeps the session's choice when the storage throws and the system changes", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const media = stubMatchMedia({ [darkQuery]: true });
    const stop = followSystemColorScheme();
    storeColorScheme("dark");
    applyColorScheme("dark");

    media.set(darkQuery, false);

    expect(html).toHaveClass("dark");
    stop();
  });

  it("stops following once stopped", () => {
    const media = stubMatchMedia();
    const stop = followSystemColorScheme();

    stop();
    media.set(darkQuery, true);

    expect(html).not.toHaveClass("dark");
  });
});
