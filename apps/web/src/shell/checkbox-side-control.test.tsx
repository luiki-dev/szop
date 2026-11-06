import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { checkboxSideKey, storeCheckboxSide } from "./checkbox-side.ts";
import { CheckboxSideControl } from "./checkbox-side-control.tsx";

afterEach(() => {
  storeCheckboxSide("right");
});

describe("CheckboxSideControl", () => {
  it("APR-2.1: offers Left and Right, with Right chosen by default", () => {
    render(<CheckboxSideControl />);

    expect(
      screen.getByRole("radiogroup", { name: "Checkboxes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Right" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Left" })).not.toBeChecked();
  });

  it("APR-2.3: stores Left when chosen and starts from it", () => {
    const { unmount } = render(<CheckboxSideControl />);
    fireEvent.click(screen.getByRole("radio", { name: "Left" }));
    expect(localStorage.getItem(checkboxSideKey)).toBe("left");
    unmount();

    render(<CheckboxSideControl />);
    expect(screen.getByRole("radio", { name: "Left" })).toBeChecked();
  });
});
