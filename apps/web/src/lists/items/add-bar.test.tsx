import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { listId } from "../../test/items.ts";
import { server } from "../../test/server.ts";
import { AddBar } from "./add-bar.tsx";

function setup() {
  const posts: { id: string; name: string }[] = [];
  server.use(
    http.post(`/api/lists/${listId}/items`, async ({ request }) => {
      const body = (await request.json()) as { id: string; name: string };
      posts.push(body);
      return HttpResponse.json(
        {
          ...body,
          quantity: null,
          unitId: null,
          price: null,
          categoryId: null,
          note: null,
          checkedAt: null,
        },
        { status: 201 },
      );
    }),
  );
  const onFocusChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AddBar
        listId={listId}
        listName="Weekend groceries"
        onFocusChange={onFocusChange}
      />
    </QueryClientProvider>,
  );
  return {
    posts,
    onFocusChange,
    field: () =>
      screen.getByRole("textbox", { name: "Add an item to Weekend groceries" }),
  };
}

describe("AddBar", () => {
  it("ITM-2.3: Enter adds the typed name with nothing else", async () => {
    const { posts, field } = setup();

    await userEvent.type(field(), "  Bananas {Enter}");

    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(posts[0]?.name).toBe("Bananas");
    expect(Object.keys(posts[0] ?? {}).sort()).toEqual(["id", "name"]);
  });

  it("ITM-2.4: the field clears and keeps the focus, and the next item has its own ID", async () => {
    const { posts, field } = setup();

    await userEvent.type(field(), "Milk{Enter}Eggs{Enter}");

    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
    await waitFor(() => {
      expect(posts.map((post) => post.name)).toEqual(["Milk", "Eggs"]);
    });
    expect(posts[0]?.id).not.toBe(posts[1]?.id);
  });

  it("APP-6.1: the Add button adds too, and keeps the focus in the field", async () => {
    const { posts, field } = setup();

    await userEvent.type(field(), "Bread");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute("placeholder", "+ Add item");
  });

  it("ITM-2.3: whitespace adds nothing and shows no message", async () => {
    const { posts, field } = setup();

    await userEvent.type(field(), "   {Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(posts).toHaveLength(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("LIM-2.2: the add bar takes no character past 100", async () => {
    const { field } = setup();

    await userEvent.type(field(), "a".repeat(101));

    expect(field()).toHaveAttribute("maxlength", "100");
    expect(field()).toHaveValue("a".repeat(100));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tells the haul when the field gains and loses the focus", async () => {
    const { field, onFocusChange } = setup();

    await userEvent.click(field());
    await userEvent.tab();

    expect(onFocusChange.mock.calls).toEqual([[true], [false]]);
  });
});
