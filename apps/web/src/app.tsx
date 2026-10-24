import { CSPProvider } from "@base-ui/react/csp-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { routes } from "./routes.tsx";

const queryClient = new QueryClient();
const router = createBrowserRouter(routes);

export function App() {
  // The CSP allows no <style> elements, so Base UI renders none; the CSS it
  // would inject is in index.css (ADR 0013, decision 9).
  return (
    <CSPProvider disableStyleElements>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </CSPProvider>
  );
}
