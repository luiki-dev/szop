import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListItem } from "@szop/shared";
import { bananas, listId, listWith } from "../../test/items.ts";
import { smallCatalog } from "../../test/catalog.ts";
import { stubMatchMedia } from "../../test/match-media.ts";
import { server } from "../../test/server.ts";
import { desktopQuery } from "../../shell/use-media-query.ts";
import { EditItem } from "./edit-item.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(item: ListItem = bananas, desktop = false) {
  stubMatchMedia({ [desktopQuery]: desktop });
  const patches: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  server.use(
    http.patch(`/api/lists/${listId}/items/${item.id}`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      patches.push(body);
      return HttpResponse.json({ ...item, ...body });
    }),
    http.delete(`/api/lists/${listId}/items/${item.id}`, () => {
      deletes.push(item.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const client = new QueryClient();
  client.setQueryData(["lists", listId], listWith(item));
  const onOpenChange = vi.fn();
  const onRemoved = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <EditItem
        listId={listId}
        item={item}
        open
        onOpenChange={onOpenChange}
        onRemoved={onRemoved}
        units={smallCatalog.units}
        catalog={smallCatalog}
      />
    </QueryClientProvider>,
  );
  return { patches, deletes, onOpenChange, onRemoved };
}

const six = { ...bananas, quantity: 6000, price: 33, unitId: "u1" };

describe("EditItem", () => {
  it("ITM-6.1: every field is edited and saved", async () => {
    const { patches, onOpenChange } = setup();

    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Apples");
    await userEvent.type(screen.getByLabelText("Quantity"), "1,5");
    await userEvent.selectOptions(screen.getByLabelText("Unit"), "kg");
    await userEvent.type(screen.getByLabelText("Price per unit"), "0.33");
    await userEvent.type(screen.getByLabelText("Note"), "ripe");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(patches).toEqual([
        {
          name: "Apples",
          quantity: 1500,
          unitId: "u3",
          price: 33,
          categoryId: null,
          note: "ripe",
        },
      ]);
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it.each([false, true])(
    "ITM-6.1: the Category field opens the picker, and picking saves the category (desktop %s)",
    async (desktop) => {
      const { patches } = setup(bananas, desktop);
      await userEvent.click(screen.getByRole("button", { name: /^Category/ }));
      await userEvent.click(
        screen.getByRole("button", { name: "Dairy & eggs, subcategories" }),
      );
      await userEvent.click(screen.getByRole("radio", { name: "Cheese" }));

      const field = screen.getByRole("button", { name: /^Category/ });
      await waitFor(() => {
        expect(field).toHaveFocus();
      });
      expect(field).toHaveTextContent("Cheese");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(patches[0]).toMatchObject({ categoryId: "c4" });
      });
    },
  );

  it("APP-6.1: the fields come in order, each with its label, and none has the focus", async () => {
    setup();

    await screen.findByRole("heading", { name: "Edit item" });
    const labels = [
      "Name",
      "Quantity",
      "Unit",
      "Price per unit",
      "Category",
      "Note",
    ];
    const places = labels.map((label) =>
      screen.getByText(label, { selector: "label, span" }),
    );
    places.reduce((before, place) => {
      expect(
        before.compareDocumentPosition(place) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      return place;
    });
    expect(screen.getByLabelText("Name")).not.toHaveFocus();
    expect(document.body.contains(document.activeElement)).toBe(true);
    expect(
      ["INPUT", "TEXTAREA", "SELECT"].includes(
        document.activeElement?.tagName ?? "",
      ),
    ).toBe(false);
    expect(screen.getByRole("option", { name: "No unit" })).toBeInTheDocument();
  });

  it("ITM-6.1: + on an empty quantity gives 1, and − is disabled at 1", async () => {
    setup();
    const minus = screen.getByRole("button", { name: "Decrease quantity" });
    expect(minus).toBeDisabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Increase quantity" }),
    );
    expect(screen.getByLabelText("Quantity")).toHaveValue("1");
    expect(minus).toBeDisabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Increase quantity" }),
    );
    expect(screen.getByLabelText("Quantity")).toHaveValue("2");
    await userEvent.click(minus);
    expect(screen.getByLabelText("Quantity")).toHaveValue("1");
  });

  it("ITM-6.1: + is disabled at the largest quantity, and ArrowUp and ArrowDown step like + and −", async () => {
    setup(six);
    const quantity = screen.getByLabelText("Quantity");
    await userEvent.type(quantity, "{ArrowUp}");
    expect(quantity).toHaveValue("7");
    await userEvent.type(quantity, "{ArrowDown}{ArrowDown}");
    expect(quantity).toHaveValue("5");

    await userEvent.clear(quantity);
    await userEvent.type(quantity, "9999");
    const plus = screen.getByRole("button", { name: "Increase quantity" });
    expect(plus).toBeDisabled();
    await userEvent.type(quantity, "{ArrowUp}");
    expect(quantity).toHaveValue("9999");
    await userEvent.type(quantity, "{ArrowDown}");
    expect(quantity).toHaveValue("9998");
    expect(plus).toBeEnabled();
  });

  it("ITM-5.1: the line total shows under the price", () => {
    setup(six);
    expect(screen.getByText("6 × €0.33 = €1.98")).toBeInTheDocument();
  });

  it("LIM-2.2: the name and note take no character past 100 and 500", async () => {
    setup();
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "a".repeat(101));
    expect(screen.getByLabelText("Name")).toHaveValue("a".repeat(100));
    await userEvent.click(screen.getByLabelText("Note"));
    await userEvent.paste("b".repeat(501));
    expect(screen.getByLabelText("Note")).toHaveValue("b".repeat(500));
  });

  it("APP-6.2: an error shows on leaving the field and on Save, and nothing is sent", async () => {
    const { patches, onOpenChange } = setup();

    await userEvent.type(screen.getByLabelText("Price per unit"), "12.345");
    await userEvent.tab();
    expect(
      await screen.findByText("Enter a number, such as 1.5."),
    ).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(patches).toEqual([]);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("ITM-6.3: Cancel, ✕ and Esc close without saving", async () => {
    const { patches, onOpenChange } = setup();
    await userEvent.type(screen.getByLabelText("Name"), "x");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledTimes(3);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(patches).toEqual([]);
  });

  it("APP-3.2: Remove takes the item off without asking", async () => {
    const { deletes, onRemoved, onOpenChange } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onRemoved).toHaveBeenCalledWith(bananas);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => {
      expect(deletes).toEqual([bananas.id]);
    });
  });

  it("ITM-6.1: on a desktop it is a dialog with the same fields", () => {
    setup(bananas, true);
    expect(
      screen.getByRole("dialog", { name: "Edit item" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Bananas");
  });
});
