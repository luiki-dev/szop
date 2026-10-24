import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button.tsx";

// The Button shadcn/ui copied in, restyled to Szop's roles
// (visual-design.md, sections 2 and 3).
describe("Button", () => {
  it("styles each variant with its roles", () => {
    render(
      <>
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Delete</Button>
      </>,
    );

    const classes = (name: string) =>
      screen.getByRole("button", { name }).className.split(" ");
    expect(classes("Primary")).toEqual(
      expect.arrayContaining(["bg-primary", "text-primary-foreground"]),
    );
    expect(classes("Outline")).toEqual(
      expect.arrayContaining(["bg-card", "border-input"]),
    );
    expect(classes("Ghost")).toEqual(expect.arrayContaining(["text-link"]));
    expect(classes("Delete")).toEqual(
      expect.arrayContaining(["bg-destructive", "text-destructive-foreground"]),
    );
  });

  it("is at least 48 px tall in every size", () => {
    expect(buttonVariants({ size: "default" }).split(" ")).toContain(
      "min-h-12",
    );
    expect(buttonVariants({ size: "icon" }).split(" ")).toContain("size-12");
  });
});
