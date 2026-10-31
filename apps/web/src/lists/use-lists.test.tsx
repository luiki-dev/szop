import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../test/server.ts";
import { threeLists } from "../test/lists.ts";
import {
  useCreateList,
  useList,
  useLists,
  useRenameList,
} from "./use-lists.ts";

const [party] = threeLists;
const id = party?.id ?? "";

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

afterEach(() => {
  onlineManager.setOnline(true);
});

describe("the lists hooks", () => {
  it("LST-1.1: a created list is kept for its screen and refreshes the lists, not the other lists' screens", async () => {
    const calls = { lists: 0, list: 0 };
    server.use(
      http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
      http.get("/api/lists", () => {
        calls.lists += 1;
        return HttpResponse.json({ lists: threeLists });
      }),
      http.get(`/api/lists/${id}`, () => {
        calls.list += 1;
        return HttpResponse.json(party);
      }),
      http.post("/api/lists", () =>
        HttpResponse.json({ ...party, name: "Fresh" }, { status: 201 }),
      ),
    );
    const client = new QueryClient();
    const { result } = renderHook(
      () => ({
        lists: useLists(),
        list: useList(id),
        create: useCreateList(),
      }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => {
      expect(result.current.lists.isSuccess).toBe(true);
      expect(result.current.list.isSuccess).toBe(true);
    });

    result.current.create.mutate({ id, name: "Fresh" });

    await waitFor(() => {
      expect(calls.lists).toBe(2);
    });
    expect(client.getQueryData(["lists", id])).toMatchObject({ name: "Fresh" });
    expect(calls.list).toBe(1);
  });

  it("LST-1.2: a renamed list is kept for its screen", async () => {
    server.use(
      http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
      http.patch(`/api/lists/${id}`, () =>
        HttpResponse.json({ ...party, name: "Renamed" }),
      ),
      http.get("/api/lists", () => HttpResponse.json({ lists: threeLists })),
    );
    const client = new QueryClient();
    const { result } = renderHook(() => useRenameList(id), {
      wrapper: wrapper(client),
    });

    result.current.mutate("Renamed");

    await waitFor(() => {
      expect(client.getQueryData(["lists", id])).toMatchObject({
        name: "Renamed",
      });
    });
  });

  it("a write fails with its error, not a pause, while the browser says it is offline", async () => {
    onlineManager.setOnline(false);
    server.use(
      http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
      http.post("/api/lists", () =>
        HttpResponse.json(
          { error: { code: "internal_error", message: "Boom" } },
          { status: 500 },
        ),
      ),
      http.patch(`/api/lists/${id}`, () =>
        HttpResponse.json(
          { error: { code: "internal_error", message: "Boom" } },
          { status: 500 },
        ),
      ),
    );
    const { result } = renderHook(
      () => ({ create: useCreateList(), rename: useRenameList(id) }),
      { wrapper: wrapper(new QueryClient()) },
    );

    result.current.create.mutate({ id, name: "X" });
    result.current.rename.mutate("X");

    await waitFor(() => {
      expect(result.current.create.error?.message).toBe("Boom");
      expect(result.current.rename.error?.message).toBe("Boom");
    });
  });
});
