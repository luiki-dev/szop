import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "../test/match-media.ts";
import { ColorSchemeControl } from "./color-scheme-control.tsx";
import { darkQuery, storageKey, storeColorScheme } from "./color-scheme.ts";

const html = document.documentElement;

afterEach(() => {
  vi.restoreAllMocks();
  // With the storage working again, this also forgets a session's choice.
  storeColorScheme("system");
  html.classList.remove("dark");
});

describe("ColorSchemeControl", () => {
  it("APR-1.1, APR-1.2: offers System, Light and Dark, with System chosen by default", () => {
    render(<ColorSchemeControl />);

    const group = screen.getByRole("radiogroup", { name: "Color scheme" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Light" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
  });

  it("APR-1.4: starts from the stored choice", () => {
    localStorage.setItem(storageKey, "light");

    render(<ColorSchemeControl />);

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  });

  it("APR-1.4: stores and applies Dark when chosen", () => {
    render(<ColorSchemeControl />);

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(localStorage.getItem(storageKey)).toBe("dark");
    expect(html).toHaveClass("dark");
  });

  it("APR-1.2: forgets the choice and follows the system when System is chosen", () => {
    stubMatchMedia({ [darkQuery]: false });
    localStorage.setItem(storageKey, "dark");
    html.classList.add("dark");
    render(<ColorSchemeControl />);

    fireEvent.click(screen.getByRole("radio", { name: "System" }));

    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(html).not.toHaveClass("dark");
  });

  it("APR-1.5: still switches the page when the storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<ColorSchemeControl />);

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(html).toHaveClass("dark");
  });

  it("APR-1.5: shows the session's choice again when the storage throws and the menu reopens", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { unmount } = render(<ColorSchemeControl />);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    unmount();

    render(<ColorSchemeControl />);

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });
});
