import { render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { showNotSaved, Toasts } from "./toasts.tsx";

describe("the toast region", () => {
  it("APP-7.2: says what was not saved, in a polite region, with no button", () => {
    render(<Toasts />);

    act(() => {
      showNotSaved("Bananas");
    });

    expect(
      screen.getByText(
        "Bananas wasn't saved. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("region")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("a new toast replaces the shown one", () => {
    render(<Toasts />);

    act(() => {
      showNotSaved("Bananas");
    });
    act(() => {
      showNotSaved("Milk");
    });

    expect(screen.getByText(/^Milk wasn't saved/)).toBeInTheDocument();
    expect(screen.queryByText(/^Bananas wasn't saved/)).not.toBeInTheDocument();
  });
});
