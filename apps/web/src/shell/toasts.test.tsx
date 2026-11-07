import { render, screen, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { showNotSaved, Toasts } from "./toasts.tsx";

describe("the toast region", () => {
  it("APP-7.2: says what was not saved, in a polite region, with no button", () => {
    render(<Toasts />);

    act(() => {
      showNotSaved("Bananas");
    });

    const region = screen.getByRole("region");
    expect(
      within(region).getByText(
        "Bananas wasn't saved. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("APP-3.4: a failure is announced at once, in the destructive color", () => {
    render(<Toasts />);

    act(() => {
      showNotSaved("Bananas");
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bananas wasn't saved. Check your connection and try again.",
    );
    expect(screen.getByRole("alertdialog", { hidden: true })).toHaveClass(
      "bg-destructive",
    );
  });

  it("a new toast replaces the shown one", () => {
    render(<Toasts />);

    act(() => {
      showNotSaved("Bananas");
    });
    act(() => {
      showNotSaved("Milk");
    });

    const region = screen.getByRole("region");
    expect(within(region).getByText(/^Milk wasn't saved/)).toBeInTheDocument();
    expect(
      within(region).queryByText(/^Bananas wasn't saved/),
    ).not.toBeInTheDocument();
  });
});
