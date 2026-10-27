import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { routes } from "../routes.tsx";
import { smallCatalog } from "../test/catalog.ts";
import { server } from "../test/server.ts";

async function renderCatalog() {
  server.use(http.get("/api/catalog", () => HttpResponse.json(smallCatalog)));
  const router = createMemoryRouter(routes, { initialEntries: ["/catalog"] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: /^Bakery/ });
  return userEvent.setup();
}

const category = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}, \\d+ products?$`) });
const queryCategory = (name: string) =>
  screen.queryByRole("button", {
    name: new RegExp(`^${name}, \\d+ products?$`),
  });
// A highlighted name is split by its <mark>, so match the whole text.
const row = (name: string) =>
  screen.getByText(
    (_, element) => element?.tagName === "SPAN" && element.textContent === name,
  );
const field = () =>
  screen.getByRole("searchbox", { name: "Search the catalog" });

describe("Catalog search", () => {
  it("has a labelled search field inside a search landmark", async () => {
    await renderCatalog();

    const landmark = screen.getByRole("search");
    expect(within(landmark).getByRole("searchbox")).toBe(field());
    expect(field()).toHaveAttribute("placeholder", "Search the catalog");
    expect(screen.queryByText("Search the catalog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument();
  });

  it("PRD-2.6: shows a product match under its opened path, highlighted", async () => {
    const user = await renderCatalog();

    await user.type(field(), "oat");

    for (const name of ["Dairy & eggs", "Milk", "Plant-based"]) {
      expect(category(name)).toHaveAttribute("aria-expanded", "true");
    }
    expect(screen.getByText("Oat", { selector: "mark" })).toBeInTheDocument();
    expect(queryCategory("Bakery")).not.toBeInTheDocument();
    expect(screen.getByText("1 product")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Expand all" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Collapse all" }),
    ).not.toBeInTheDocument();
  });

  it("PRD-2.7: shows a matching category collapsed, and whole when opened by hand", async () => {
    const user = await renderCatalog();

    await user.type(field(), "plant");

    const plant = category("Plant-based");
    expect(plant).toHaveAttribute("aria-expanded", "false");
    expect(plant.querySelector("mark")).toHaveTextContent("Plant");
    expect(screen.queryByText("Oat milk")).not.toBeInTheDocument();

    await user.click(plant);

    expect(screen.getByText("Oat milk")).toBeInTheDocument();
  });

  it("PRD-2.7: opens a matching category with matches inside, showing only those", async () => {
    const user = await renderCatalog();

    await user.type(field(), "milk");

    expect(category("Milk")).toHaveAttribute("aria-expanded", "true");
    expect(row("Lactose-free milk")).toBeInTheDocument();
    expect(category("Plant-based")).toHaveAttribute("aria-expanded", "true");
    expect(row("Oat milk")).toBeInTheDocument();
    expect(queryCategory("Cheese")).not.toBeInTheDocument();
    expect(screen.queryByText("Eggs")).not.toBeInTheDocument();
  });

  it("PRD-2.10: ignores case and accents", async () => {
    const user = await renderCatalog();

    await user.type(field(), "CREME");

    expect(screen.getByText("fraîche", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Crème", { selector: "mark" })).toBeInTheDocument();
  });

  it("opens the new matches again when the query changes after toggling", async () => {
    const user = await renderCatalog();
    await user.type(field(), "oat");
    await user.click(category("Plant-based"));
    expect(category("Plant-based")).toHaveAttribute("aria-expanded", "false");

    await user.clear(field());
    await user.type(field(), "oat m");

    expect(category("Plant-based")).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the matches again when the same query comes back", async () => {
    const user = await renderCatalog();
    await user.type(field(), "oat");
    await user.click(category("Plant-based"));
    await user.clear(field());
    await user.type(field(), "oat");

    for (const name of ["Dairy & eggs", "Milk", "Plant-based"]) {
      expect(category(name)).toHaveAttribute("aria-expanded", "true");
    }

    await user.click(category("Plant-based"));
    await user.type(field(), " m");
    await user.type(field(), "{Backspace}{Backspace}");

    expect(field()).toHaveValue("oat");
    expect(category("Plant-based")).toHaveAttribute("aria-expanded", "true");
  });

  it("PRD-2.11: restores the expansion from before the search when cleared", async () => {
    const user = await renderCatalog();
    await user.click(category("Bakery"));

    await user.type(field(), "oat");
    await user.click(category("Plant-based"));
    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(field()).toHaveValue("");
    expect(category("Bakery")).toHaveAttribute("aria-expanded", "true");
    expect(category("Dairy & eggs")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Expand all" })).toBeVisible();

    await user.type(field(), "oat");
    await user.click(category("Milk"));
    await user.click(field());
    await user.keyboard("{Escape}");

    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
    expect(category("Bakery")).toHaveAttribute("aria-expanded", "true");
    expect(category("Dairy & eggs")).toHaveAttribute("aria-expanded", "false");
  });

  it("PRD-2.12: says no products match", async () => {
    const user = await renderCatalog();

    await user.type(field(), "xyz");

    expect(screen.getByText('No products match "xyz"')).toBeInTheDocument();
    expect(screen.getByText("0 products")).toBeInTheDocument();
  });

  it("shows the normal tree for a query of only spaces", async () => {
    const user = await renderCatalog();

    await user.type(field(), "   ");

    expect(screen.getByText("3 categories · 10 products")).toBeInTheDocument();
    expect(category("Bakery")).toBeInTheDocument();
  });
});
