import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
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
    const oatMilk = { ...milk, name: "Oat milk" };
    const answer = gate();
    let refetched = 0;
    server.use(
      withSession,
      http.patch(itemPath(bananas.id), () =>
        HttpResponse.json({ error: { message: "x" } }, { status: 500 }),
      ),
      http.patch(itemPath(milk.id), async () => {
        await answer.opened;
        return HttpResponse.json(oatMilk);
      }),
      http.get(listPath, () => {
        refetched += 1;
        return HttpResponse.json(listWith(bananas, oatMilk));
      }),
    );
    const { wrapper, items } = setup(listWith(bananas, milk));
    const { result } = renderHook(
      () => ({
        a: useUpdateItem(listId, bananas.id),
        b: useUpdateItem(listId, milk.id),
        observed: useObservedList(),
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
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(refetched).toBe(0);
    expect(byId(milk.id)?.name).toBe("Oat milk");

    answer.open();

    await waitFor(() => {
      expect(refetched).toBe(1);
    });
    expect(byId(milk.id)?.name).toBe("Oat milk");
  });

  it("a failed update with a remove of the same item queued ends with the item gone", async () => {
    const refusal = gate();
    let refetched = 0;
    server.use(
      withSession,
      http.patch(itemPath(bananas.id), async () => {
        await refusal.opened;
        return HttpResponse.json({ error: { message: "x" } }, { status: 500 });
      }),
      http.delete(
        itemPath(bananas.id),
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get(listPath, () => {
        refetched += 1;
        return HttpResponse.json(listWith(milk));
      }),
    );
    const { wrapper, items } = setup(listWith(bananas, milk));
    const { result } = renderHook(
      () => ({
        update: useUpdateItem(listId, bananas.id),
        remove: useRemoveItem(listId, bananas.id),
        observed: useObservedList(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.update.mutate({ name: "Plantains" });
      result.current.remove.mutate();
    });
    refusal.open();

    await waitFor(() => {
      expect(result.current.remove.isSuccess).toBe(true);
    });
    await waitFor(() => {
      expect(refetched).toBe(1);
    });
    await waitFor(() => {
      expect(items()).toEqual([milk]);
    });
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

describe("the item hooks, edge by edge", () => {
  const noteSaved = " wasn't saved. Check your connection and try again.";
  const refuse = () =>
    HttpResponse.json({ error: { message: "x" } }, { status: 500 });
  const description = (name: string): unknown =>
    expect.objectContaining({ description: `${name}${noteSaved}` });

  it("APP-7.2: a refused add leaves the list as it was and names the item", async () => {
    const shown = vi.spyOn(toasts.toastManager, "add");
    server.use(
      withSession,
      http.post(`${listPath}/items`, refuse),
      http.get(listPath, () => delay("infinite")),
    );
    const { wrapper, items } = setup(listWith(milk));
    const { result } = renderHook(() => useAddItem(listId, bananas.id), {
      wrapper,
    });

    act(() => {
      result.current.mutate("Bananas");
    });

    await waitFor(() => {
      expect(shown).toHaveBeenCalledWith(description("Bananas"));
    });
    expect(items()).toEqual([milk]);
    shown.mockRestore();
  });

  it("APP-7.2: a refused remove of the last item puts it back in its place, and names it", async () => {
    const shown = vi.spyOn(toasts.toastManager, "add");
    server.use(
      withSession,
      http.delete(itemPath(milk.id), refuse),
      http.get(listPath, () => delay("infinite")),
    );
    const { wrapper, items } = setup(listWith(bananas, milk));
    const { result } = renderHook(() => useRemoveItem(listId, milk.id), {
      wrapper,
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(shown).toHaveBeenCalledWith(description("Milk"));
    });
    expect(items()).toEqual([bananas, milk]);
    shown.mockRestore();
  });

  it.each([
    ["in the order of the IDs", [bananas, milk]],
    ["in another order", [milk, bananas]],
  ])(
    "APP-7.2: a refused update of one item restores that item, %s",
    async (_, order) => {
      const shown = vi.spyOn(toasts.toastManager, "add");
      server.use(
        withSession,
        http.patch(itemPath(milk.id), refuse),
        http.get(listPath, () => delay("infinite")),
      );
      const { wrapper, items } = setup(listWith(...order));
      const { result } = renderHook(() => useUpdateItem(listId, milk.id), {
        wrapper,
      });

      act(() => {
        result.current.mutate({ checked: true });
      });

      await waitFor(() => {
        expect(shown).toHaveBeenCalledWith(description("Milk"));
      });
      expect(items()).toEqual(order);
      shown.mockRestore();
    },
  );

  it("a refused restore names the item", async () => {
    const shown = vi.spyOn(toasts.toastManager, "add");
    server.use(
      withSession,
      http.post(`${listPath}/items`, refuse),
      http.get(listPath, () => delay("infinite")),
    );
    const { wrapper } = setup(listWith(milk));
    const { result } = renderHook(() => useRestoreItem(listId, bananas.id), {
      wrapper,
    });

    act(() => {
      result.current.mutate(bananas);
    });

    await waitFor(() => {
      expect(shown).toHaveBeenCalledWith(description("Bananas"));
    });
    shown.mockRestore();
  });

  it("ITM-7.4: a rename shows at once and keeps the item checked", async () => {
    const checked = { ...bananas, checkedAt: "2026-01-02T03:04:05.000Z" };
    server.use(
      withSession,
      http.patch(itemPath(bananas.id), () => delay("infinite")),
    );
    const { wrapper, items } = setup(listWith(checked));
    const { result } = renderHook(() => useUpdateItem(listId, bananas.id), {
      wrapper,
    });

    act(() => {
      result.current.mutate({ name: "Plantains" });
    });

    await waitFor(() => {
      expect(items()?.[0]?.name).toBe("Plantains");
    });
    expect(items()?.[0]?.checkedAt).toBe(checked.checkedAt);
  });

  it("ORD-1.1: two sort changes are sent in order, and the first answer does not undo the second", async () => {
    const first = gate();
    const second = gate();
    const received: boolean[] = [];
    server.use(
      withSession,
      http.patch(listPath, async ({ request }) => {
        const body = (await request.json()) as { sortByCategory: boolean };
        received.push(body.sortByCategory);
        await (received.length === 1 ? first : second).opened;
        return HttpResponse.json({
          ...listWith(),
          sortByCategory: body.sortByCategory,
        });
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
      expect(received).toEqual([false]);
    });
    act(() => {
      result.current.mutate(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(received).toEqual([false]);

    first.open();
    await waitFor(() => {
      expect(received).toEqual([false, true]);
    });
    expect(sorted()).toBe(true);

    second.open();
    await waitFor(() => {
      expect(client.isMutating()).toBe(0);
    });
    expect(sorted()).toBe(true);
  });

  it("ORD-1.1: the server's word on the sort setting wins, whatever else is in flight", async () => {
    server.use(
      withSession,
      http.patch(listPath, () =>
        HttpResponse.json({ ...listWith(), sortByCategory: true }),
      ),
      http.patch(itemPath(milk.id), () => delay("infinite")),
      http.get(listPath, () => delay("infinite")),
    );
    const { client, wrapper } = setup(listWith(bananas, milk));
    const { result } = renderHook(
      () => ({
        sort: useSortByCategory(listId),
        update: useUpdateItem(listId, milk.id),
        // A change with no scope and no key, like another screen's.
        other: useMutation({ mutationFn: () => new Promise<void>(() => {}) }),
      }),
      { wrapper },
    );
    act(() => {
      result.current.other.mutate();
      result.current.update.mutate({ name: "Oat milk" });
    });
    await waitFor(() => {
      expect(client.isMutating()).toBe(2);
    });

    act(() => {
      result.current.sort.mutate(false);
    });

    await waitFor(() => {
      expect(result.current.sort.isSuccess).toBe(true);
    });
    expect(client.getQueryData<ListWithItems>(key)?.sortByCategory).toBe(true);
  });

  it("a change touches only its own list: other queries run on and the list is asked once", async () => {
    let listReads = 0;
    let otherReads = 0;
    let answeredReads = 0;
    server.use(
      withSession,
      http.patch(itemPath(bananas.id), () => HttpResponse.json(bananas)),
      http.patch(listPath, () => HttpResponse.json(listWith(bananas))),
      http.get(listPath, () => {
        listReads += 1;
        return HttpResponse.json(listWith(bananas));
      }),
    );
    const { client, wrapper } = setup(listWith(bananas));
    const { result } = renderHook(
      () => ({
        update: useUpdateItem(listId, bananas.id),
        sort: useSortByCategory(listId),
        observed: useObservedList(),
        // A query of another screen, still waiting for its answer.
        elsewhere: useQuery({
          queryKey: ["elsewhere"],
          queryFn: () => {
            otherReads += 1;
            return new Promise<string>(() => {});
          },
        }),
        // And one that has its answer.
        answered: useQuery({
          queryKey: ["answered"],
          queryFn: () => {
            answeredReads += 1;
            return "x";
          },
          staleTime: Infinity,
        }),
        // A change with no scope and no key, in flight meanwhile.
        other: useMutation({ mutationFn: () => new Promise<void>(() => {}) }),
      }),
      { wrapper },
    );
    act(() => {
      result.current.other.mutate();
    });

    act(() => {
      result.current.update.mutate({ name: "Plantains" });
    });
    await waitFor(() => {
      expect(listReads).toBe(1);
    });
    act(() => {
      result.current.sort.mutate(false);
    });
    await waitFor(() => {
      expect(listReads).toBe(2);
    });

    expect(otherReads).toBe(1);
    expect(answeredReads).toBe(1);
    expect(client.getQueryState(["elsewhere"])?.fetchStatus).toBe("fetching");
  });
});

import { getList } from "../api/client.ts";
function useObservedList() {
  return useQuery({
    queryKey: key,
    queryFn: () => getList(listId),
    retry: false,
    staleTime: Infinity,
  });
}
