import type { Health } from "@szop/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { routes } from "../routes.tsx";
import { healthyBody, server } from "../test/server.ts";

// The real route table and the real client, hook and schema; only the
// network is faked (ADR 0007, decision 10). A fresh QueryClient per test, so
// a cached answer cannot leak into the next test.
function renderApp() {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient };
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

  it("says the database is down when the API reports it", async () => {
    const databaseDown = {
      status: "error",
      database: { status: "down" },
    } satisfies Health;
    server.use(
      http.get("/api/health", () =>
        HttpResponse.json(databaseDown, { status: 503 }),
      ),
    );

    renderApp();

    expect(await screen.findByText("API: reachable")).toBeInTheDocument();
    expect(screen.getByText("Database: down")).toBeInTheDocument();
  });

  it("says it cannot reach the API when the request fails", async () => {
    server.use(http.get("/api/health", () => HttpResponse.error()));

    renderApp();

    expect(await screen.findByText("Can't reach the API")).toBeInTheDocument();
  });

  it.each([
    [
      "a status other than 200 or 503",
      () => HttpResponse.json(healthyBody, { status: 500 }),
    ],
    [
      "a body that does not match the schema",
      () => HttpResponse.json({ status: "ok", database: { status: "up" } }),
    ],
    [
      "a body that is not JSON",
      () => new HttpResponse("<html>Bad gateway</html>", { status: 200 }),
    ],
  ])("says it cannot reach the API for %s", async (_name, respond) => {
    server.use(http.get("/api/health", respond));

    renderApp();

    expect(await screen.findByText("Can't reach the API")).toBeInTheDocument();
  });

  it("recovers when the API comes back", async () => {
    server.use(http.get("/api/health", () => HttpResponse.error()));
    const { queryClient } = renderApp();
    expect(await screen.findByText("Can't reach the API")).toBeInTheDocument();

    // Handlers added later win, so the next request gets the healthy answer;
    // refetching is what the tab regaining focus does.
    server.use(http.get("/api/health", () => HttpResponse.json(healthyBody)));
    await queryClient.refetchQueries({ queryKey: ["health"] });

    expect(await screen.findByText("API: ok")).toBeInTheDocument();
  });
});
