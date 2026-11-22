import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { routes } from "../routes.tsx";

// The real route table; a phone unless a test says otherwise (setup.ts).
export function renderApp(
  path: string | { pathname: string; state: unknown },
  before: string[] = [],
) {
  const router = createMemoryRouter(routes, {
    initialEntries: [...before, path],
    initialIndex: before.length,
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
