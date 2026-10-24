import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { routes } from "../routes.tsx";
import { colorRoles } from "./roles.ts";

// The real route table, as in health-page.test.tsx. /design makes no request.
function renderDesign() {
  const router = createMemoryRouter(routes, { initialEntries: ["/design"] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("DesignPage", () => {
  it("shows a swatch for every color role", () => {
    renderDesign();

    for (const role of colorRoles) {
      const swatch = document.querySelector(`[data-role="${role.name}"]`);
      expect(swatch, role.name).not.toBeNull();
      expect(swatch).toHaveTextContent(role.name);
    }
  });

  it("shows the sections", () => {
    renderDesign();

    expect(
      screen.getByRole("heading", { level: 1, name: "Design system" }),
    ).toBeInTheDocument();
    for (const name of ["Colors", "Type", "Buttons", "Icons", "Shape"]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
    }
  });

  it("links back to the start", () => {
    renderDesign();

    expect(screen.getByRole("link", { name: "← Back" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("does not take focus on load", () => {
    renderDesign();

    expect(document.activeElement).toBe(document.body);
  });
});
