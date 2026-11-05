import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { routes } from "../routes.tsx";

describe("the not-found page", () => {
  it("APP-5.1: a path that is not a page shows it inside the shell, with a way back", async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ["/no/such/page"],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Nothing here" }),
    ).toBeVisible();
    expect(screen.getByText("This page doesn't exist.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to lists" })).toHaveAttribute(
      "href",
      "/",
    );
    // Inside the shell: its menu is there and the tab names the page.
    expect(screen.getByRole("button", { name: "Open menu" })).toBeVisible();
    expect(document.title).toBe("Not found · Szop");
    expect(document.querySelector("img")).toHaveAttribute("alt", "");
  });
});
