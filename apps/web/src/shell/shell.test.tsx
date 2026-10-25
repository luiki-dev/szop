import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { routes } from "../routes.tsx";
import { stubMatchMedia } from "../test/match-media.ts";
import { desktopQuery } from "./use-media-query.ts";

// The real route table; the menu's status asks the API, which MSW answers
// as healthy. setup.ts stubs matchMedia as a phone before each test.
function renderApp(path = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  return screen.getByRole("dialog", { name: "Menu" });
}

describe("AppShell", () => {
  it("shows Start at / with its title and the menu in a sidebar on a desktop", () => {
    stubMatchMedia({ [desktopQuery]: true });
    renderApp();

    expect(
      screen.getByRole("heading", { level: 1, name: "Start" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Start · Szop");
    const menu = screen.getByRole("navigation", { name: "Menu" });
    expect(
      within(menu).getByRole("link", { name: "Szop, Start" }),
    ).toHaveAttribute("href", "/");
    expect(within(menu).getByRole("link", { name: "Start" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(menu).getByRole("link", { name: "Design system" }),
    ).toHaveAttribute("href", "/design");
    expect(within(menu).getByText("Developer")).toBeInTheDocument();
    expect(screen.getByText("Welcome to Szop")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open menu" }),
    ).not.toBeInTheDocument();
  });

  it("follows a link to the design system", () => {
    stubMatchMedia({ [desktopQuery]: true });
    renderApp();

    fireEvent.click(screen.getByRole("link", { name: "Design system" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Design system" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Design system · Szop");
    expect(screen.getByRole("link", { name: "Design system" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens the menu from ☰ on a phone and closes it with Esc", async () => {
    renderApp();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    const dialog = openMenu();
    expect(
      within(dialog).getByRole("link", { name: "Design system" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();
  });

  it.each(["Szop, Start", "Start", "Design system"])(
    "closes the drawer after following %s",
    async (name) => {
      renderApp("/design");

      fireEvent.click(within(openMenu()).getByRole("link", { name }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    },
  );

  it("swaps the drawer for the sidebar when the screen grows past lg", async () => {
    const media = stubMatchMedia();
    renderApp();
    openMenu();

    media.set(desktopQuery, true);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("navigation", { name: "Menu" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open menu" }),
    ).not.toBeInTheDocument();

    // Back on a phone, the drawer does not reopen by itself.
    media.set(desktopQuery, false);
    expect(
      await screen.findByRole("button", { name: "Open menu" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cuts a long title and keeps ☰ whole", () => {
    renderApp();

    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveClass("min-w-0", "truncate");
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveClass(
      "shrink-0",
    );
  });
});
