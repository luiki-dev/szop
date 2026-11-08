import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coarseQuery } from "../../shell/use-media-query.ts";
import { stubMatchMedia } from "../../test/match-media.ts";
import { useKeyboardOpen } from "./use-keyboard-open.ts";

// A stand-in for window.visualViewport, which jsdom lacks.
function fakeViewport(width: number, height: number) {
  const viewport = Object.assign(new EventTarget(), { width, height });
  vi.stubGlobal("visualViewport", viewport);
  return (next: { width?: number; height: number }) => {
    act(() => {
      Object.assign(viewport, next);
      viewport.dispatchEvent(new Event("resize"));
    });
  };
}

describe("useKeyboardOpen", () => {
  // A touch screen, unless a test says otherwise.
  beforeEach(() => {
    stubMatchMedia({ [coarseQuery]: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ORD-1.8: tells the keyboard open from a viewport 150 px shorter at the same width", () => {
    const resize = fakeViewport(390, 700);
    const { result } = renderHook(() => useKeyboardOpen());
    expect(result.current).toBe(false);
    // An address bar hiding and coming back is not a keyboard.
    resize({ height: 644 });
    resize({ height: 700 });
    expect(result.current).toBe(false);
    resize({ height: 551 });
    expect(result.current).toBe(false);
    resize({ height: 550 });
    expect(result.current).toBe(true);
    resize({ height: 700 });
    expect(result.current).toBe(false);
  });

  it("ORD-1.8: measures at once, so the first resize can already be a keyboard", () => {
    const resize = fakeViewport(390, 700);
    const { result } = renderHook(() => useKeyboardOpen());
    resize({ height: 500 });
    expect(result.current).toBe(true);
  });

  it("ORD-1.8: stops listening to the viewport when its screen goes", () => {
    fakeViewport(390, 700);
    const viewport = window.visualViewport as unknown as EventTarget;
    const remove = vi.spyOn(viewport, "removeEventListener");
    const { unmount } = renderHook(() => useKeyboardOpen());
    unmount();
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("ORD-1.8: starts over when the width changes, as when the phone turns", () => {
    const resize = fakeViewport(390, 700);
    const { result } = renderHook(() => useKeyboardOpen());
    resize({ width: 700, height: 390 });
    expect(result.current).toBe(false);
    resize({ width: 700, height: 200 });
    expect(result.current).toBe(true);
  });

  it("ORD-1.8: counts a shortened window closed on a fine pointer, as on a desktop", () => {
    stubMatchMedia({ [coarseQuery]: false });
    const resize = fakeViewport(1280, 800);
    const { result } = renderHook(() => useKeyboardOpen());
    resize({ height: 500 });
    expect(result.current).toBe(false);
  });

  it("ORD-1.8: counts the keyboard closed without visualViewport", () => {
    vi.stubGlobal("visualViewport", undefined);
    const { result } = renderHook(() => useKeyboardOpen());
    expect(result.current).toBe(false);
  });
});
