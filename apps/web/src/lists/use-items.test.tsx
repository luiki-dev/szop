import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ListItem, ListWithItems } from "@szop/shared";
import { bananas, listId, listWith, milk } from "../test/items.ts";
import { server } from "../test/server.ts";
import * as toasts from "../shell/toasts.tsx";
import {
  useAddItem,
  useRemoveItem,
  useRestoreItem,
  useSortByCategory,
  useUpdateItem,
} from "./use-items.ts";

const listPath = `/api/lists/${listId}`;
const itemPath = (id: string) => `${listPath}/items/${id}`;
const key = ["lists", listId];

function setup(initial: ListWithItems) {
  const client = new QueryClient();
  client.setQueryData(key, initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const items = () => client.getQueryData<ListWithItems>(key)?.items;
  return { client, wrapper, items };
}

// A promise the test settles by hand, to hold an answer back.
function gate() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

const withSession = http.get("/api/auth/get-session", () =>
  HttpResponse.json({ ok: true }),
);

describe("the item hooks", () => {
  it("APP-7.1: an added item is in the list before the server answers", async () => {
    server.use(
      withSession,
      http.post(`${listPath}/items`, () => delay("infinite")),
    );
    const { wrapper, items } = setup(listWith());
    const { result } = renderHook(() => useAddItem(listId, bananas.id), {
      wrapper,
    });

    act(() => {
      result.current.mutate("Bananas");
    });

    await waitFor(() => {
      expect(items()).toEqual([
        expect.objectContaining({ id: bananas.id, name: "Bananas" }),
      ]);
    });
  });

  it("an answered add puts the server's item in the list", async () => {
    server.use(
      withSession,
      http.post(`${listPath}/items`, () =>
        HttpResponse.json({ ...bananas, name: "Bananas!" }, { status: 201 }),
      ),
    );
    const { wrapper, items } = setup(listWith());
    const { result } = renderHook(() => useAddItem(listId, bananas.id), {
      wrapper,
    });

    act(() => {
      result.current.mutate("Bananas");
    });

    await waitFor(() => {
      expect(items()?.[0]?.name).toBe("Bananas!");
    });
  });

  it("APP-7.2: a refused change goes back and says it wasn't saved", async () => {
    const shown = vi.spyOn(toasts.toastManager, "add");
    const refusal = gate();
    let refetched = 0;
    server.use(
      withSession,
      http.patch(itemPath(bananas.id), async () => {
        await refusal.opened;
        return HttpResponse.json({ error: { message: "x" } }, { status: 500 });
      }),
      http.get(listPath, () => {
        refetched += 1;
        return HttpResponse.json(listWith(bananas));
      }),
    );
    const { wrapper, items } = setup(listWith(bananas));
    const { result } = renderHook(
      () => ({
        update: useUpdateItem(listId, bananas.id),
        // The refetch needs an observer.
        observed: useObservedList(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.update.mutate({ checked: true });
    });
    await waitFor(() => {
      expect(items()?.[0]?.checkedAt).not.toBeNull();
    });
    refusal.open();

    await waitFor(() => {
      expect(shown).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            "Bananas wasn't saved. Check your connection and try again.",
        }),
      );
    });
    expect(items()).toEqual([bananas]);
    await waitFor(() => {
      expect(refetched).toBe(1);
    });
    shown.mockRestore();
  });

  it("ITM-7.1: two changes of one item are sent in order and the screen ends in the last one", async () => {
    const received: unknown[] = [];
    let releaseFirst: () => void = () => undefined;
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    server.use(
      withSession,
      http.patch(itemPath(bananas.id), async ({ request }) => {
        const body = (await request.json()) as { name?: string };
        received.push(body);
        if (received.length === 1) await firstHeld;
        return HttpResponse.json({ ...bananas, name: body.name ?? "?" });
      }),
    );
    const { wrapper, items } = setup(listWith(bananas));
    const { result } = renderHook(() => useUpdateItem(listId, bananas.id), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ name: "First" });
    });
    await waitFor(() => {
      expect(received).toHaveLength(1);
    });
    act(() => {
      result.current.mutate({ name: "Second" });
    });
    await waitFor(() => {
      expect(items()?.[0]?.name).toBe("Second");
    });
    // The second waits for the first's answer.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(received).toHaveLength(1);

    releaseFirst();

    await waitFor(() => {
      expect(received).toEqual([{ name: "First" }, { name: "Second" }]);
    });
    // The first's answer did not put "First" back over the screen.
    expect(items()?.[0]?.name).toBe("Second");
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(items()?.[0]?.name).toBe("Second");
  });

  it("a failed change of one item leaves another item's change as it is", async () => {
    server.use(
      withSession,
      http.patch(itemPath(bananas.id), () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
      http.patch(itemPath(milk.id), () => delay("infinite")),
      http.get(listPath, () => delay("infinite")),
    );
    const { wrapper, items } = setup(listWith(bananas, milk));
    const { result } = renderHook(
      () => ({
        a: useUpdateItem(listId, bananas.id),
        b: useUpdateItem(listId, milk.id),
      }),
      { wrapper },
    );

    act(() => {
      result.current.b.mutate({ name: "Oat milk" });
      result.current.a.mutate({ name: "Plantains" });
    });
    await waitFor(() => {
      expect(result.current.a.isError).toBe(true);
    });

    const byId = (id: string): ListItem | undefined =>
      items()?.find((item) => item.id === id);
    expect(byId(bananas.id)?.name).toBe("Bananas");
    expect(byId(milk.id)?.name).toBe("Oat milk");
  });

  it("a removed item leaves the list and comes back when the remove fails", async () => {
    const refusal = gate();
    server.use(
      withSession,
      http.delete(itemPath(bananas.id), async () => {
        await refusal.opened;
        return HttpResponse.json({ error: { message: "x" } }, { status: 500 });
      }),
      http.get(listPath, () => delay("infinite")),
    );
    const { wrapper, items } = setup(listWith(bananas, milk));
    const { result } = renderHook(() => useRemoveItem(listId, bananas.id), {
      wrapper,
    });

    act(() => {
      result.current.mutate();
    });
    await waitFor(() => {
      expect(items()).toEqual([milk]);
    });
    refusal.open();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(items()).toEqual([bananas, milk]);
  });

  it("a restored item is sent with every field", async () => {
    let body: unknown;
    server.use(
      withSession,
      http.post(`${listPath}/items`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(bananas, { status: 201 });
      }),
    );
    const { wrapper, items } = setup(listWith(milk));
    const { result } = renderHook(() => useRestoreItem(listId, bananas.id), {
      wrapper,
    });

    act(() => {
      result.current.mutate(bananas);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(body).toEqual(bananas);
    expect(items()).toContainEqual(bananas);
  });

  it("ORD-1.1: the sort setting shows at once and goes back, with its own words, when refused", async () => {
    const shown = vi.spyOn(toasts.toastManager, "add");
    const refusal = gate();
    server.use(
      withSession,
      http.patch(listPath, async () => {
        await refusal.opened;
        return HttpResponse.json({ error: { message: "x" } }, { status: 500 });
      }),
      http.get(listPath, () => delay("infinite")),
    );
    const { client, wrapper } = setup(listWith(bananas));
    const { result } = renderHook(() => useSortByCategory(listId), {
      wrapper,
    });
    const sorted = () =>
      client.getQueryData<ListWithItems>(key)?.sortByCategory;

    act(() => {
      result.current.mutate(false);
    });
    await waitFor(() => {
      expect(sorted()).toBe(false);
    });
    refusal.open();

    await waitFor(() => {
      expect(shown).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            "Sorting wasn't saved. Check your connection and try again.",
        }),
      );
    });
    expect(sorted()).toBe(true);
    expect(client.getQueryData<ListWithItems>(key)?.items).toEqual([bananas]);
    shown.mockRestore();
  });
});

import { useQuery } from "@tanstack/react-query";
import { getList } from "../api/client.ts";
function useObservedList() {
  return useQuery({
    queryKey: key,
    queryFn: () => getList(listId),
    retry: false,
    staleTime: Infinity,
  });
}
