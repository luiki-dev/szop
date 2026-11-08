import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TitleField } from "./list-screen.tsx";

const field = () => screen.getByRole("textbox", { name: "List name" });

describe("TitleField", () => {
  it("LST-1.2: with saveOnBlur, Enter leaves the field, and leaving saves", async () => {
    const onSave = vi.fn();
    render(
      <TitleField
        initial="Party"
        saveOnBlur
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.type(field(), " 2{Enter}");

    expect(field()).not.toHaveFocus();
    expect(onSave).toHaveBeenCalledExactlyOnceWith("Party 2");
  });

  it("LST-1.2: a name that comes while the field is left replaces what it shows", async () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <TitleField
        initial="Party"
        saveOnBlur
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await userEvent.type(field(), " 2");
    await userEvent.tab();

    rerender(
      <TitleField
        initial="PARTY 2"
        saveOnBlur
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    expect(field()).toHaveValue("PARTY 2");
  });
});
