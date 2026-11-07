import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("ORD-1.8: starts over when the width changes, as when the phone turns", () => {
    const resize = fakeViewport(390, 700);
    const { result } = renderHook(() => useKeyboardOpen());
    resize({ width: 700, height: 390 });
    expect(result.current).toBe(false);
    resize({ width: 700, height: 200 });
    expect(result.current).toBe(true);
  });

  it("ORD-1.8: counts the keyboard closed without visualViewport", () => {
    vi.stubGlobal("visualViewport", undefined);
    const { result } = renderHook(() => useKeyboardOpen());
    expect(result.current).toBe(false);
  });
});
