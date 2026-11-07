import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import {
  itemCards,
  orderCategories,
  type ListItem,
  type ListWithItems,
} from "@szop/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { smallCatalog } from "../../test/catalog.ts";
import { bananas, listId, listWith, milk } from "../../test/items.ts";
import { server } from "../../test/server.ts";
import { storeCheckboxSide } from "../../shell/checkbox-side.ts";
import { Haul } from "./haul.tsx";
import { ItemCards } from "./item-cards.tsx";

const bread: ListItem = {
  ...bananas,
  id: "0198b000-0000-7000-8000-000000000003",
  name: "Bread",
};
const caviar: ListItem = {
  ...bananas,
  id: "0198b000-0000-7000-8000-000000000004",
  name: "Extremely long caviar name",
  quantity: 2000,
  price: 150,
};
const at = (minute: number) => `2026-11-06T10:0${String(minute)}:00.000Z`;

// The list and the haul over one cache, as the list page wires them.
function Screen({ focused = false }: { focused?: boolean }) {
  const { data } = useQuery<ListWithItems>({
    queryKey: ["lists", listId],
    queryFn: () => Promise.reject(new Error("seeded")),
    staleTime: Infinity,
  });
  if (!data) return null;
  return (
    <>
      <ItemCards
        listId={listId}
        cards={itemCards(
          data.items,
          orderCategories(smallCatalog.categories),
          true,
        )}
        units={smallCatalog.units}
        onEdit={() => undefined}
      />
      <Haul
        listId={listId}
        items={data.items}
        units={smallCatalog.units}
        folded={focused}
      />
    </>
  );
}

function setup(items: ListItem[], focused = false) {
  const patches: unknown[] = [];
  server.use(
    http.patch(
      `/api/lists/${listId}/items/:id`,
      async ({ request, params }) => {
        const body = (await request.json()) as { checked: boolean };
        patches.push(body);
        const item = items.find((i) => i.id === params["id"]);
        return HttpResponse.json({
          ...item,
          checkedAt: body.checked ? at(9) : null,
        });
      },
    ),
    http.get(`/api/lists/${listId}`, () =>
      HttpResponse.json(listWith(...items)),
    ),
  );
  const client = new QueryClient();
  client.setQueryData(["lists", listId], listWith(...items));
  render(
    <QueryClientProvider client={client}>
      <Screen focused={focused} />
    </QueryClientProvider>,
  );
  return patches;
}

afterEach(() => {
  storeCheckboxSide("right");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Haul", () => {
  it("ITM-7.1, ORD-1.1: checking moves the item to the haul, its chip first", async () => {
    const patches = setup([bananas, milk, { ...bread, checkedAt: at(1) }]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Milk" }));

    await waitFor(() => {
      expect(screen.queryByRole("checkbox", { name: "Milk" })).toBeNull();
    });
    const chips = screen.getAllByRole("button", { name: /^Put .* back$/ });
    expect(chips.map((c) => c.getAttribute("aria-label"))).toEqual([
      "Put Milk back",
      "Put Bread back",
    ]);
    expect(patches).toContainEqual({ checked: true });
  });

  it("ORD-1.3: the chips are newest first", () => {
    setup([
      { ...bananas, checkedAt: at(1) },
      { ...milk, checkedAt: at(3) },
      { ...bread, checkedAt: at(2) },
    ]);
    expect(
      screen
        .getAllByRole("button", { name: /^Put .* back$/ })
        .map((c) => c.getAttribute("aria-label")),
    ).toEqual(["Put Milk back", "Put Bread back", "Put Bananas back"]);
  });

  it("ORD-1.4: a chip puts its item back, sending checked: false", async () => {
    const patches = setup([bananas, { ...milk, checkedAt: at(1) }]);
    await userEvent.click(
      screen.getByRole("button", { name: "Put Milk back" }),
    );
    expect(
      await screen.findByRole("checkbox", { name: "Milk" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(patches).toContainEqual({ checked: false });
    });
  });

  it("ORD-1.4: a chip shows the name and the line total, or the name alone", () => {
    setup([
      { ...caviar, checkedAt: at(1) },
      { ...milk, checkedAt: at(2) },
    ]);
    const priced = screen.getByRole("button", {
      name: "Put Extremely long caviar name back",
    });
    expect(priced).toHaveTextContent("€3.00");
    expect(priced.firstElementChild).toHaveClass("max-w-[12ch]", "truncate");
    expect(
      screen.getByRole("button", { name: "Put Milk back" }),
    ).toHaveTextContent(/^Milk$/);
  });

  it("ORD-1.9: before any check the haul says to check items off", () => {
    setup([bananas, milk]);
    expect(screen.getByText("Check items off to drop them here")).toBeVisible();
    expect(screen.getByText("0 of 2 items")).toBeVisible();
  });

  it("ORD-1.5, ORD-1.10: the header counts k of n and the bar exposes value and maximum", () => {
    setup([bananas, milk, { ...bread, checkedAt: at(1) }]);
    expect(screen.getByText("1 of 3 items")).toBeVisible();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "3");
  });

  it("ORD-1.2: a card disappears when its last item is checked", async () => {
    setup([bananas]);
    expect(screen.getByText("1 left")).toBeVisible();
    await userEvent.click(screen.getByRole("checkbox", { name: "Bananas" }));
    await waitFor(() => {
      expect(screen.queryByText("1 left")).toBeNull();
    });
  });

  it("ORD-1.8: with the add bar focused the haul folds to one line", () => {
    setup([bananas, { ...milk, checkedAt: at(1) }], true);
    expect(screen.getByText("The haul · 1 of 2 items")).toBeVisible();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("button", { name: "Put Milk back" })).toBeNull();
  });

  it("ORD-1.6, ORD-1.7, ORD-2.5: the header opens the drawer, newest first, and Esc closes it", async () => {
    const patches = setup([
      { ...bananas, checkedAt: at(1) },
      { ...milk, checkedAt: at(2) },
    ]);
    await userEvent.click(screen.getByRole("button", { name: /The haul/ }));
    const dialog = await screen.findByRole("dialog", { name: "The haul" });
    expect(
      within(dialog).getByText("Newest first · ↶ puts an item back"),
    ).toBeVisible();
    expect(
      within(dialog)
        .getAllByRole("button", { name: /^Put .* back$/ })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Put Milk back", "Put Bananas back"]);

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Put Milk back" }),
    );
    await waitFor(() => {
      expect(patches).toContainEqual({ checked: false });
    });

    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("APR-2.2: the drawer's ↶ is after the name by default and before it with Left", async () => {
    setup([{ ...bananas, checkedAt: at(1) }]);
    const undoIsFirst = async () => {
      await userEvent.click(screen.getByRole("button", { name: /The haul/ }));
      const dialog = await screen.findByRole("dialog", { name: "The haul" });
      const row = within(dialog).getByRole("listitem");
      const first = row.firstElementChild;
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      return first?.getAttribute("aria-label") === "Put Bananas back";
    };
    expect(await undoIsFirst()).toBe(false);
    act(() => {
      storeCheckboxSide("left");
    });
    expect(await undoIsFirst()).toBe(true);
  });

  it("ORD-1.3, ORD-1.6, ORD-1.10: chips that do not fit become +N more, which opens the drawer", async () => {
    // Every chip and the +N more button measure 40 px in a row of 100 px.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    setup([
      { ...bananas, checkedAt: at(1) },
      { ...milk, checkedAt: at(2) },
      { ...bread, checkedAt: at(3) },
    ]);
    expect(
      screen.getAllByRole("button", { name: /^Put .* back$/ }),
    ).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Show all 3 items in the haul" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "The haul" }),
    ).toBeVisible();
  });
});
