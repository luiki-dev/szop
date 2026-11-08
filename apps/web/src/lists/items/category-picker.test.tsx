import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Catalog } from "@szop/shared";
import { smallCatalog } from "../../test/catalog.ts";
import { stubMatchMedia } from "../../test/match-media.ts";
import { desktopQuery } from "../../shell/use-media-query.ts";
import { CategoryPicker } from "./category-picker.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(
  value: string | null = null,
  catalog: Catalog = smallCatalog,
  desktop = true,
) {
  stubMatchMedia({ [desktopQuery]: desktop });
  const onPick = vi.fn();
  const onBack = vi.fn();
  render(
    <CategoryPicker
      catalog={catalog}
      value={value}
      onPick={onPick}
      onBack={onBack}
    />,
  );
  return { onPick, onBack };
}

const radio = (name: string) => screen.getByRole("radio", { name });

describe("CategoryPicker", () => {
  it("ITM-6.1: on a phone it is a sheet with a Close button, on a desktop it fills the dialog with a Back button", () => {
    setup(null, smallCatalog, false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("ITM-6.1: on a desktop it is no sheet of its own", () => {
    setup();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("ITM-6.1: No category comes first, and picking it clears the category", async () => {
    const { onPick } = setup("c5");
    expect(screen.getAllByRole("radio")[0]).toHaveAccessibleName("No category");
    await userEvent.click(radio("No category"));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it("ITM-6.1: the chevron opens subcategories without picking, the rest of the row picks", async () => {
    const { onPick } = setup();
    expect(screen.queryByRole("radio", { name: "Milk" })).toBeNull();

    const chevron = screen.getByRole("button", {
      name: "Dairy & eggs, subcategories",
    });
    await userEvent.click(chevron);
    expect(chevron).toHaveAttribute("aria-expanded", "true");
    expect(onPick).not.toHaveBeenCalled();
    await userEvent.click(chevron);
    expect(screen.queryByRole("radio", { name: "Milk" })).toBeNull();

    await userEvent.click(chevron);
    await userEvent.click(radio("Milk"));
    expect(onPick).toHaveBeenCalledWith("c2");
  });

  it("ITM-6.1: the current category is checked and its ancestors are open", () => {
    setup("c3");
    expect(radio("Plant-based")).toHaveAttribute("aria-checked", "true");
    expect(radio("Milk")).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("radiogroup", { name: "Category" }),
    ).toBeInTheDocument();
  });

  it("ITM-6.1: a category without subcategories has no chevron, the same left offset", () => {
    setup();
    const row = (name: string) => radio(name).parentElement as HTMLElement;
    expect(
      within(row("Empty shelf")).queryByRole("button", { name: /sub/ }),
    ).toBeNull();
    expect(row("Empty shelf").firstElementChild?.className).toContain("w-11");
    expect(row("Bakery").firstElementChild?.className).toContain("w-11");
  });

  it("ITM-6.1: searching keeps the matches with their ancestors, highlighted, with Polish folding", async () => {
    const catalog: Catalog = {
      ...smallCatalog,
      categories: [
        ...smallCatalog.categories,
        { id: "c7", parentId: "c5", position: 0, name: "Żywność" },
      ],
    };
    setup(null, catalog);
    await userEvent.type(screen.getByLabelText("Search categories"), "zywnosc");
    expect(radio("Bakery")).toBeInTheDocument();
    expect(radio("Żywność")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Empty shelf" })).toBeNull();

    await userEvent.clear(screen.getByLabelText("Search categories"));
    await userEvent.type(screen.getByLabelText("Search categories"), "chee");
    expect(screen.getByText("Chee").tagName).toBe("MARK");
    expect(radio("Dairy & eggs")).toBeInTheDocument();
  });
});
