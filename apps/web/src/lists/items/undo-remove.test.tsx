import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListItem, ListWithItems } from "@szop/shared";
import { bananas, listId, listWith, milk } from "../../test/items.ts";
import { server } from "../../test/server.ts";
import { Toasts } from "../../shell/toasts.tsx";
import { useRemoveItem } from "../use-items.ts";
import { UndoRemove } from "./undo-remove.tsx";

const checked = { ...bananas, checkedAt: "2026-11-06T10:00:00.000Z" };

function Remover({ item }: { item: ListItem }) {
  const remove = useRemoveItem(listId, item.id);
  return (
    <button
      onClick={() => {
        remove.mutate();
      }}
    >
      remove {item.name}
    </button>
  );
}

function setup(...items: ListItem[]) {
  const client = new QueryClient();
  client.setQueryData(["lists", listId], listWith(...items));
  const view = (shown: ListItem | null) => (
    <QueryClientProvider client={client}>
      <Toasts />
      {items.map((item) => (
        <Remover key={item.id} item={item} />
      ))}
      {shown && <UndoRemove key={shown.id} listId={listId} item={shown} />}
    </QueryClientProvider>
  );
  const rendered = render(view(items[0] ?? null));
  return {
    rerender: (shown: ListItem) => {
      rendered.rerender(view(shown));
    },
    items: () => client.getQueryData<ListWithItems>(["lists", listId])?.items,
  };
}

describe("UndoRemove", () => {
  it("ITM-7.3: the toast says what was removed and offers Undo", async () => {
    setup(bananas);
    expect(await screen.findByText("Removed Bananas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("APP-3.1: Undo creates the item again with every field, checked or not", async () => {
    const posts: ListItem[] = [];
    server.use(
      http.post(`/api/lists/${listId}/items`, async ({ request }) => {
        const body = (await request.json()) as ListItem;
        posts.push(body);
        return HttpResponse.json(body, { status: 201 });
      }),
    );
    const { items } = setup(checked);

    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(posts).toEqual([checked]);
    });
    expect(items()?.map((i) => i.id)).toContain(checked.id);
  });

  it("APP-3.2: the toast stays while hovered, then goes after 5 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      setup(bananas);
      await screen.findByText("Removed Bananas");
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.hover(screen.getByText("Removed Bananas"));
      await act(() => vi.advanceTimersByTimeAsync(8000));
      expect(screen.getByText("Removed Bananas")).toBeInTheDocument();

      await user.unhover(screen.getByText("Removed Bananas"));
      await act(() => vi.advanceTimersByTimeAsync(6000));
      await waitFor(() => {
        expect(screen.queryByText("Removed Bananas")).not.toBeInTheDocument();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("APP-3.1: Undo while the delete is held is sent after it", async () => {
    const calls: string[] = [];
    server.use(
      http.delete(`/api/lists/${listId}/items/${bananas.id}`, async () => {
        calls.push("delete");
        await delay(150);
        return new HttpResponse(null, { status: 204 });
      }),
      http.post(`/api/lists/${listId}/items`, async ({ request }) => {
        calls.push("create");
        return HttpResponse.json(await request.json(), { status: 201 });
      }),
    );
    setup(bananas);

    await userEvent.click(
      screen.getByRole("button", { name: "remove Bananas" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(calls).toEqual(["delete", "create"]);
    });
  });

  it("APP-3.1: a second removal replaces the toast", async () => {
    const { rerender } = setup(bananas, milk);
    await screen.findByText("Removed Bananas");

    rerender(milk);

    expect(await screen.findByText("Removed Milk")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Removed Bananas")).not.toBeInTheDocument();
    });
  });
});

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.useRealTimers();
});
