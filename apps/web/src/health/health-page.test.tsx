import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { routes } from "../routes.tsx";
import { healthyBody } from "../test/server.ts";

// The real route table and the real client, hook and schema; only the
// network is faked (ADR 0007, decision 10). A fresh QueryClient per test, so
// a cached answer cannot leak into the next test.
function renderApp() {
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("HealthPage", () => {
  it("shows the schema version once the API and the database answer", async () => {
    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("Checking the API…");
    expect(await screen.findByText("API: ok")).toBeInTheDocument();
    expect(screen.getByText("Database: up")).toBeInTheDocument();
    expect(
      screen.getByText(`Schema version: ${healthyBody.database.schemaVersion}`),
    ).toBeInTheDocument();
  });
});
