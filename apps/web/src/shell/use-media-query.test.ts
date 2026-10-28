import { renderHook } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { stubMatchMedia } from "../test/match-media.ts";
import { desktopQuery, useMediaQuery } from "./use-media-query.ts";

describe("useMediaQuery", () => {
  it("desktopQuery is Tailwind's lg breakpoint", () => {
    stubMatchMedia({ "(min-width: 64rem)": true });

    const { result } = renderHook(() => useMediaQuery(desktopQuery));

    expect(result.current).toBe(true);
  });

  it("follows a change and lets go of the query when unmounted", () => {
    const media = stubMatchMedia();
    const { result, unmount } = renderHook(() => useMediaQuery("(a)"));
    expect(media.listenerCount("(a)")).toBe(1);

    act(() => {
      media.set("(a)", true);
    });
    expect(result.current).toBe(true);

    unmount();
    expect(media.listenerCount("(a)")).toBe(0);
  });

  it("moves its listener when the query changes", () => {
    const media = stubMatchMedia();
    const { result, rerender } = renderHook(
      ({ query }) => useMediaQuery(query),
      {
        initialProps: { query: "(a)" },
      },
    );

    rerender({ query: "(b)" });
    expect(media.listenerCount("(a)")).toBe(0);
    act(() => {
      media.set("(b)", true);
    });

    expect(result.current).toBe(true);
  });
});
