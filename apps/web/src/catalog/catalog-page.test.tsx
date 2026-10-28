import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { routes } from "../routes.tsx";
import { stubMatchMedia } from "../test/match-media.ts";
import { smallCatalog, longName } from "../test/catalog.ts";
import { server } from "../test/server.ts";
import { desktopQuery } from "../shell/use-media-query.ts";

// The real route table, as in shell.test.tsx; a phone unless a test says
// otherwise (setup.ts). The shell's menu asks /api/health only on a desktop.
function renderApp(path = "/catalog") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function serveCatalog(body: JsonBodyType = smallCatalog) {
  server.use(http.get("/api/catalog", () => HttpResponse.json(body)));
}

const category = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}, \\d+ products?$`) });

describe("CatalogPage", () => {
  it("PRD-2.1, APP-1.9: Catalog sits under Setup in the menu and opens the page", async () => {
    stubMatchMedia({ [desktopQuery]: true });
    serveCatalog();
    renderApp("/");

    const menu = screen.getByRole("navigation", { name: "Menu" });
    const setup = within(menu).getByText("Setup");
    const developer = within(menu).getByText("Developer");
    expect(
      setup.compareDocumentPosition(developer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const link = within(menu).getByRole("link", { name: "Catalog" });
    expect(link).toHaveAttribute("href", "/catalog");

    fireEvent.click(link);

    expect(
      screen.getByRole("heading", { level: 1, name: "Catalog" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Catalog · Szop");
    expect(await screen.findByText("3 categories · 10 products")).toBeVisible();
  });

  it("PRD-2.8, APP-4.1: shows skeleton cards while loading", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get("/api/catalog", async () => {
        await gate;
        return HttpResponse.json(smallCatalog);
      }),
    );
    renderApp();

    expect(screen.getAllByTestId("skeleton-card").length).toBeGreaterThan(0);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    release();
    expect(
      await screen.findByRole("button", { name: /^Bakery/ }),
    ).toBeVisible();
    expect(screen.queryByTestId("skeleton-card")).not.toBeInTheDocument();
  });

  it("PRD-2.2, PRD-2.3: shows the top-level categories collapsed, with their counts", async () => {
    serveCatalog();
    renderApp();

    for (const name of [
      "Dairy & eggs, 7 products",
      "Bakery, 3 products",
      "Empty shelf, 0 products",
    ]) {
      expect(await screen.findByRole("button", { name })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    }
    expect(screen.getByText("3 categories · 10 products")).toBeInTheDocument();
    expect(screen.queryByText("Bread")).not.toBeInTheDocument();
  });

  it("PRD-2.2, PRD-2.5: opens a category to its products first, then its subcategories", async () => {
    serveCatalog();
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /^Dairy/ }));

    const panel = document.getElementById(
      category("Dairy & eggs").getAttribute("aria-controls") ?? "",
    );
    expect(panel).not.toBeNull();
    const rows = within(panel as HTMLElement)
      .getAllByRole("listitem")
      .filter((row) => (panel as HTMLElement) === row.parentElement);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Crème fraîche"),
      expect.stringContaining("Eggs"),
      expect.stringMatching(/^Milk3/),
      expect.stringMatching(/^Cheese2/),
    ]);
    expect(category("Dairy & eggs")).toHaveAttribute("aria-expanded", "true");
  });

  it("PRD-2.11: announces the number of matches in a status region", async () => {
    serveCatalog();
    renderApp();
    await screen.findByRole("button", { name: /^Dairy/ });
    expect(screen.getByRole("status")).toHaveTextContent("3 categories");

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search the catalog" }),
      { target: { value: "oat milk" } },
    );
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("1 product");
    });
  });

  it("PRD-2.4: expands and collapses everything", async () => {
    serveCatalog();
    renderApp();
    await screen.findByRole("button", { name: /^Dairy/ });

    const expand = screen.getByRole("button", { name: "Expand all" });
    const collapse = screen.getByRole("button", { name: "Collapse all" });
    // On a phone only the icon shows; from lg the label does too.
    expect(expand).toHaveAttribute("aria-label", "Expand all");
    expect(collapse).toHaveAttribute("aria-label", "Collapse all");
    expect(within(expand).getByText("Expand all")).toHaveClass(
      "hidden",
      "lg:inline",
    );
    expect(within(collapse).getByText("Collapse all")).toHaveClass(
      "hidden",
      "lg:inline",
    );

    fireEvent.click(expand);
    const disclosures = screen
      .getAllByRole("button", { name: /, \d+ products?$/ })
      .map((button) => button.getAttribute("aria-expanded"));
    expect(disclosures).toHaveLength(6);
    expect(new Set(disclosures)).toEqual(new Set(["true"]));
    expect(screen.getByText("Oat milk")).toBeInTheDocument();

    fireEvent.click(collapse);
    const closed = screen
      .getAllByRole("button", { name: /, \d+ products?$/ })
      .map((button) => button.getAttribute("aria-expanded"));
    expect(new Set(closed)).toEqual(new Set(["false"]));
    expect(screen.queryByText("Oat milk")).not.toBeInTheDocument();
  });

  it("PRD-2.2: keeps a child open when its parent is closed and reopened", async () => {
    serveCatalog();
    renderApp();
    const dairy = await screen.findByRole("button", { name: /^Dairy/ });
    fireEvent.click(dairy);
    fireEvent.click(category("Milk"));
    fireEvent.click(category("Plant-based"));
    expect(screen.getByText("Oat milk")).toBeInTheDocument();

    fireEvent.click(dairy);
    expect(screen.queryByText("Oat milk")).not.toBeInTheDocument();
    fireEvent.click(dairy);

    expect(category("Milk")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Oat milk")).toBeInTheDocument();
  });

  it("PRD-2.8, APP-4.3: says the catalog could not be loaded and offers Try again", async () => {
    let answers = 0;
    server.use(
      http.get("/api/catalog", () => {
        answers += 1;
        return answers === 1
          ? HttpResponse.json(
              {
                error: {
                  code: "internal_error",
                  message: "Internal server error",
                },
              },
              { status: 500 },
            )
          : HttpResponse.json(smallCatalog);
      }),
    );
    renderApp();

    expect(
      await screen.findByText("The catalog could not be loaded."),
    ).toBeVisible();
    expect(screen.getByText("Internal server error")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("button", { name: /^Bakery/ }),
    ).toBeVisible();
    expect(
      screen.queryByText("The catalog could not be loaded."),
    ).not.toBeInTheDocument();
  });

  it("PRD-2.8: shows the same error card for a body that does not match the schema", async () => {
    serveCatalog({
      ...smallCatalog,
      categories: [{ id: "c1", parentId: null, position: 0 }],
    });
    renderApp();

    expect(
      await screen.findByText("The catalog could not be loaded."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("PRD-2.9: wraps a long product name", async () => {
    serveCatalog();
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /^Bakery/ }));

    const name = screen.getByText(longName);
    expect(name).toHaveClass("wrap-break-word");
    expect(name).not.toHaveClass("truncate");
  });

  it("shows no unit text for a product without a unit", async () => {
    serveCatalog();
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /^Bakery/ }));

    const bread = screen.getByText("Bread").closest("li");
    expect(bread).toHaveTextContent(/^Bread$/);
    expect(screen.getByText("Croissant").closest("li")).toHaveTextContent(
      "Croissantpcs",
    );
  });

  it("opens a category with nothing in it without an error", async () => {
    serveCatalog();
    renderApp();
    const empty = await screen.findByRole("button", { name: /^Empty shelf/ });

    fireEvent.click(empty);

    await waitFor(() => {
      expect(empty).toHaveAttribute("aria-expanded", "true");
    });
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("3 categories · 10 products")).toBeInTheDocument();
  });
});
