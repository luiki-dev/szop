import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { itemCards, orderCategories, type ListItem } from "@szop/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { smallCatalog } from "../../test/catalog.ts";
import { bananas as bananasItem, milk as milkItem } from "../../test/items.ts";
import { storeCheckboxSide } from "../../shell/checkbox-side.ts";
import { ItemCards } from "./item-cards.tsx";
import { ItemRow } from "./item-row.tsx";

// Widened: the fixtures' literal types would pin every field to null.
const bananas: ListItem = bananasItem;
const milk: ListItem = milkItem;

const categories = orderCategories(smallCatalog.categories);
const cards = (items = [bananas, milk], sort = true) =>
  itemCards(items, categories, sort);

function show(
  items = [bananas, milk],
  sort = true,
  onEdit: (item: unknown) => void = () => undefined,
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ItemCards
        listId="list"
        cards={cards(items, sort)}
        units={smallCatalog.units}
        onEdit={onEdit}
      />
    </QueryClientProvider>,
  );
}

describe("ItemCards", () => {
  it("ORD-1.2, ORD-2.3: a card per category with N left, headed by its own name", () => {
    show([
      { ...milk, categoryId: "c2" },
      { ...bananas, categoryId: "c5" },
      {
        ...bananas,
        id: "0198b000-0000-7000-8000-000000000003",
        categoryId: "c5",
      },
    ]);

    const names = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(["Milk", "Bakery"]);
    const bakery = screen
      .getByRole("heading", { name: "Bakery" })
      .closest("section");
    expect(within(bakery as HTMLElement).getByText("2 left")).toBeVisible();
  });

  it("ORD-2.4: the No category card is italic and last", () => {
    show([bananas, { ...milk, categoryId: "c5" }]);

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.at(-1)).toHaveTextContent("No category");
    expect(headings.at(-1)).toHaveClass("italic");
  });

  it("ORD-5.5: with sorting off one card says only N left", () => {
    show([bananas, milk], false);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("2 left")).toBeVisible();
  });

  it("ITM-6.3: tapping the name opens the edit", async () => {
    const onEdit = vi.fn();
    show([bananas], true, onEdit);

    await userEvent.click(screen.getByRole("button", { name: /Bananas/ }));

    expect(onEdit).toHaveBeenCalledWith(
      bananas,
      false,
      expect.any(HTMLElement),
    );
  });

  it("shows the quantity with its unit and the line total", () => {
    show([
      { ...bananas, quantity: 6000, unitId: "u1", price: 33, note: "ripe" },
    ]);

    expect(screen.getByText("6 pcs")).toBeVisible();
    expect(screen.getByText("€1.98")).toBeVisible();
    expect(screen.getByText("ripe")).toHaveClass("line-clamp-1");
  });

  it("shows the quantity alone for an unknown unit", () => {
    show([
      {
        ...bananas,
        quantity: 1500,
        unitId: "0198b000-0000-7000-8000-0000000000ff",
      },
    ]);

    expect(screen.getByText("1.5")).toBeVisible();
  });
});

describe("the checkboxes' side", () => {
  afterEach(() => {
    storeCheckboxSide("right");
  });
  const order = () =>
    screen
      .getAllByRole("listitem")
      .map((row) => row.firstElementChild?.tagName);

  it("APR-2.1, APR-2.2: the checkbox is after the name by default and before it with Left", () => {
    render(
      <ItemRow
        item={bananas}
        unitName={null}
        onEdit={() => undefined}
        checkbox={<input type="checkbox" aria-label="Bananas" />}
      />,
    );
    expect(screen.getByRole("listitem").lastElementChild?.tagName).toBe(
      "INPUT",
    );

    act(() => {
      storeCheckboxSide("left");
    });

    expect(order()).toEqual(["INPUT"]);
  });
});
