import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useCatalog } from "../catalog/use-catalog.ts";
import { smallCatalog } from "../test/catalog.ts";
import { server } from "../test/server.ts";
import { getCatalog, getHealth } from "./client.ts";

describe("getHealth", () => {
  it("names the status it did not expect", async () => {
    server.use(
      http.get("/api/health", () => new HttpResponse(null, { status: 500 })),
    );

    await expect(getHealth()).rejects.toThrow("GET /api/health answered 500");
  });
});

describe("getCatalog", () => {
  it("returns the catalog", async () => {
    server.use(http.get("/api/catalog", () => HttpResponse.json(smallCatalog)));

    await expect(getCatalog()).resolves.toEqual(smallCatalog);
  });

  it("names the status when an error body is not an API error", async () => {
    server.use(
      http.get(
        "/api/catalog",
        () => new HttpResponse("<html>", { status: 502 }),
      ),
    );

    await expect(getCatalog()).rejects.toThrow("GET /api/catalog answered 502");
  });

  it("says so when a 200 is not a catalog", async () => {
    server.use(
      http.get("/api/catalog", () => HttpResponse.json({ units: [] })),
    );

    await expect(getCatalog()).rejects.toThrow(
      "The catalog came in a shape this page does not know",
    );
  });
});

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
