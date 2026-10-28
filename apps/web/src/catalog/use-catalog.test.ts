import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { smallCatalog } from "../test/catalog.ts";
import { server } from "../test/server.ts";
import { useCatalog } from "./use-catalog.ts";

describe("useCatalog", () => {
  it("keeps the catalog under the query key catalog", async () => {
    server.use(http.get("/api/catalog", () => HttpResponse.json(smallCatalog)));
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useCatalog(), { wrapper });

    await waitFor(() => {
      expect(queryClient.getQueryData(["catalog"])).toEqual(smallCatalog);
    });
  });
});
