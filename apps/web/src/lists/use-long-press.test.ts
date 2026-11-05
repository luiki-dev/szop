import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "./use-long-press.ts";

const at = (clientX: number, clientY: number) => ({
  clientX,
  clientY,
  preventDefault: vi.fn(),
});

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    return { onLongPress, hook: result.current };
  }

  it("LST-1.6: fires after 500 ms of holding still", () => {
    const { onLongPress, hook } = setup();
    hook.handlers.onPointerDown(at(10, 10));
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("LST-1.6: does not fire after a pointerup at 300 ms", () => {
    const { onLongPress, hook } = setup();
    hook.handlers.onPointerDown(at(10, 10));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    hook.handlers.onPointerUp();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    expect(hook.pressed()).toBe(false);
  });

  it("LST-1.6: does not fire after a move of more than 10 px (a scroll)", () => {
    const { onLongPress, hook } = setup();
    hook.handlers.onPointerDown(at(10, 10));
    hook.handlers.onPointerMove(at(10, 15));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    hook.handlers.onPointerMove(at(10, 21));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("LST-1.6: does not fire after a pointercancel", () => {
    const { onLongPress, hook } = setup();
    hook.handlers.onPointerDown(at(10, 10));
    hook.handlers.onPointerCancel();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("LST-1.6: pressed() is true once, for the click that ends a long press", () => {
    const { hook } = setup();
    hook.handlers.onPointerDown(at(10, 10));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    hook.handlers.onPointerUp();
    expect(hook.pressed()).toBe(true);
    expect(hook.pressed()).toBe(false);
  });

  it("LST-1.6: onContextMenu is prevented while a press is held, not otherwise", () => {
    const { hook } = setup();
    const idle = at(0, 0);
    hook.handlers.onContextMenu(idle);
    expect(idle.preventDefault).not.toHaveBeenCalled();

    hook.handlers.onPointerDown(at(10, 10));
    const held = at(10, 10);
    hook.handlers.onContextMenu(held);
    expect(held.preventDefault).toHaveBeenCalled();
  });

  it("LST-1.6: a short tap leaves the browser's context menu alone", () => {
    const { hook } = setup();
    hook.handlers.onPointerDown(at(10, 10));
    hook.handlers.onPointerUp();
    const after = at(10, 10);
    hook.handlers.onContextMenu(after);
    expect(after.preventDefault).not.toHaveBeenCalled();
  });

  it("LST-1.6: does not fire once the component is gone", () => {
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() => useLongPress(onLongPress));
    result.current.handlers.onPointerDown(at(10, 10));
    unmount();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("LST-1.6: a second press restarts the wait", () => {
    const { onLongPress, hook } = setup();
    hook.handlers.onPointerDown(at(10, 10));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    hook.handlers.onPointerDown(at(10, 10));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("LST-1.6: a disabled press fires nothing and holds back no context menu", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress(onLongPress, { disabled: true }),
    );
    result.current.handlers.onPointerDown(at(10, 10));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    const menu = at(10, 10);
    result.current.handlers.onContextMenu(menu);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(menu.preventDefault).not.toHaveBeenCalled();
  });

  it("LST-1.6: a move without a press does nothing", () => {
    const { hook } = setup();
    expect(() => {
      hook.handlers.onPointerMove(at(10, 10));
    }).not.toThrow();
  });

  it("LST-1.6: a small move, and a move of exactly 10 px, still fire", () => {
    const { onLongPress, hook } = setup();
    hook.handlers.onPointerDown(at(100, 100));
    hook.handlers.onPointerMove(at(103, 104));
    hook.handlers.onPointerMove(at(106, 108));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
