import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { timeoutMessage } from "../api/client.ts";
import type { ListItem } from "@szop/shared";
import { bananas, milk } from "../test/items.ts";
import { routes } from "../routes.tsx";
import { ListPage } from "./list-page.tsx";
import { server } from "../test/server.ts";

const id = "0198a000-0000-7000-8000-0000000000aa";
const list = {
  id,
  name: "Weekly shop",
  sortByCategory: true,
  createdAt: "2026-10-30T12:00:00.000Z",
  items: [],
};

function setup(items: ListItem[] = []) {
  const patches: { name: string }[] = [];
  server.use(
    http.get(`/api/lists/${id}`, () => HttpResponse.json({ ...list, items })),
    http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
    http.patch(`/api/lists/${id}`, async ({ request }) => {
      const body = (await request.json()) as { name: string };
      patches.push(body);
      return HttpResponse.json({ ...list, name: body.name.toUpperCase() });
    }),
  );
  const router = createMemoryRouter(routes, {
    initialEntries: [`/lists/${id}`],
  });
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, patches, queryClient };
}

const field = () => screen.findByRole("textbox", { name: "List name" });

describe("ListPage", () => {
  it("APP-1.6: has a back link to the lists page instead of the menu, and the name in the tab", async () => {
    setup();

    expect(await field()).toHaveValue("Weekly shop");
    expect(screen.getByRole("link", { name: "Back to lists" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("button", { name: "Open menu" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Weekly shop" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Weekly shop · Szop");
  });

  it("LST-1.2: renames by editing the title and shows the server's name", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.clear(await field());
    await user.type(await field(), "Party{Enter}");

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
        "PARTY",
      );
    });
    expect(patches).toEqual([{ name: "Party" }]);
    expect(document.title).toBe("PARTY · Szop");
  });

  it("LST-1.2: Rename in the list's menu focuses the title with its text selected", async () => {
    const user = userEvent.setup();
    setup();
    const input = (await field()) as HTMLInputElement;

    await user.click(screen.getByRole("button", { name: "List actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));

    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Weekly shop".length);
  });

  it("LST-1.2: leaving the field with a changed name saves once", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.type(await field(), " 2");
    await user.tab();

    await waitFor(() => {
      expect(patches).toEqual([{ name: "Weekly shop 2" }]);
    });
  });

  it("LST-1.2: Esc restores the old name and the blur after it sends nothing", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.type(await field(), " 2{Escape}");
    await user.click(document.body);

    expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
      "Weekly shop",
    );
    expect(patches).toHaveLength(0);
  });

  it("LST-1.2: Enter then blur sends one request", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.type(await field(), " 2{Enter}");
    await user.click(document.body);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
        "WEEKLY SHOP 2",
      );
    });
    expect(patches).toHaveLength(1);
  });

  it("LST-1.2: an empty name is not saved and the old one returns", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.clear(await field());
    await user.tab();

    expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
      "Weekly shop",
    );
    expect(patches).toHaveLength(0);
  });

  it("APP-4.2: says the list is empty and hides the raccoon from the accessibility tree", async () => {
    setup();

    expect(await screen.findByText("Nothing on this list yet")).toBeVisible();
    expect(document.querySelector('img[src*="raccoon"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("ORD-1.9: says everything is in the haul when every item is checked, and the add bar stays", async () => {
    setup([{ ...bananas, checkedAt: "2026-11-06T10:00:00.000Z" }]);

    expect(await screen.findByText("Everything's in the haul")).toBeVisible();
    expect(
      screen.queryByText("Nothing on this list yet"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Add an item to Weekly shop" }),
    ).toBeVisible();
  });

  it("ITM-1.1: shows the items in cards, and an added item at once", async () => {
    const user = userEvent.setup();
    server.use(http.post(`/api/lists/${id}/items`, () => delay("infinite")));
    setup([milk]);

    expect(await screen.findByText("Milk")).toBeVisible();
    expect(
      screen.queryByText("Nothing on this list yet"),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: "Add an item to Weekly shop" }),
      "Bread{Enter}",
    );
    expect(await screen.findByText("Bread")).toBeVisible();
  });

  it("APP-5.2: says the list does not exist or was deleted on a 404, with a link to the lists page", async () => {
    server.use(
      http.get(`/api/lists/${id}`, () =>
        HttpResponse.json(
          { error: { code: "not_found", message: "Not found" } },
          { status: 404 },
        ),
      ),
    );
    const router = createMemoryRouter(routes, {
      initialEntries: [`/lists/${id}`],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("This list doesn't exist or was deleted."),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeVisible();
    const links = screen.getAllByRole("link", { name: "Back to lists" });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/");
  });

  it("APP-5.2: an address that is not a list ID shows the same page and sends no request", async () => {
    // No handler for /api/lists/not-a-uuid: MSW fails a request nobody handles.
    const router = createMemoryRouter(routes, {
      initialEntries: ["/lists/not-a-uuid"],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("This list doesn't exist or was deleted."),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "List" }),
    ).toBeInTheDocument();
  });

  it("APP-1.6: a list that fails to load still has a way back", async () => {
    server.use(
      http.get(`/api/lists/${id}`, () =>
        HttpResponse.json(
          { error: { code: "internal_error", message: "Boom" } },
          { status: 500 },
        ),
      ),
    );
    const router = createMemoryRouter(routes, {
      initialEntries: [`/lists/${id}`],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("The list could not be loaded."),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to lists" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("keeps the tab's title Szop until the list is loaded", async () => {
    setup();

    expect(document.title).toBe("Szop");
    await field();
  });

  it("LST-1.2: closing the list's menu without Rename returns focus to the menu button, also after a Rename", async () => {
    const user = userEvent.setup();
    setup();
    const input = (await field()) as HTMLInputElement;
    const trigger = screen.getByRole("button", { name: "List actions" });

    await user.click(trigger);
    await screen.findByRole("menuitem", { name: "Rename" });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });

    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    expect(input.selectionEnd).toBe("Weekly shop".length);

    await user.click(trigger);
    await screen.findByRole("menuitem", { name: "Rename" });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("LST-1.2: Esc in the title leaves the field", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(await field(), " 2{Escape}");

    expect(
      screen.getByRole("textbox", { name: "List name" }),
    ).not.toHaveFocus();
  });

  it("LST-1.2: a name of spaces is not saved and the old one returns", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.clear(await field());
    await user.type(screen.getByRole("textbox", { name: "List name" }), "   ");
    await user.tab();

    expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
      "Weekly shop",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(patches).toHaveLength(0);
  });

  it("LIM-2.2: the list name takes no character past 100", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.clear(await field());
    await user.type(
      screen.getByRole("textbox", { name: "List name" }),
      "a".repeat(101),
    );

    expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
      "a".repeat(100),
    );
    await user.tab();
    await waitFor(() => {
      expect(patches).toEqual([{ name: "a".repeat(100) }]);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("LST-1.2: editing again after Esc saves on leaving the field", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.type(await field(), " 2{Escape}");
    await user.click(screen.getByRole("textbox", { name: "List name" }));
    await user.type(screen.getByRole("textbox", { name: "List name" }), " 3");
    await user.tab();

    await waitFor(() => {
      expect(patches).toEqual([{ name: "Weekly shop 3" }]);
    });
  });

  it("LST-1.2: shows the server's message under the title when the rename fails", async () => {
    const user = userEvent.setup();
    setup();
    server.use(
      http.patch(`/api/lists/${id}`, () =>
        HttpResponse.json(
          { error: { code: "invalid", message: "Boom" } },
          { status: 400 },
        ),
      ),
    );

    await user.type(await field(), " 2{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
  });

  it("LST-1.2: Esc after a failed rename clears the server's message", async () => {
    const user = userEvent.setup();
    setup();
    server.use(
      http.patch(`/api/lists/${id}`, () =>
        HttpResponse.json(
          { error: { code: "invalid", message: "Boom" } },
          { status: 400 },
        ),
      ),
    );

    await user.type(await field(), " 2{Enter}");
    await screen.findByRole("alert");
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(await field()).toHaveValue("Weekly shop");
  });

  it("asks again when Try again is pressed after a failed load", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get(`/api/lists/${id}`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: { code: "internal_error", message: "Boom" } },
              { status: 500 },
            )
          : HttpResponse.json(list);
      }),
    );
    const router = createMemoryRouter(routes, {
      initialEntries: [`/lists/${id}`],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await field()).toHaveValue("Weekly shop");
  });

  it("LST-1.3: Delete in the list's menu, confirmed, sends the request and lands on the lists page", async () => {
    const user = userEvent.setup();
    let deleted = 0;
    const seen: string[] = [];
    const { router } = setup();
    server.use(
      http.get(`/api/lists/${id}`, () => {
        seen.push("GET");
        return HttpResponse.json(list);
      }),
      http.delete(`/api/lists/${id}`, () => {
        deleted += 1;
        seen.push("DELETE");
        return new HttpResponse(null, { status: 204 });
      }),
      http.get("/api/lists", () => HttpResponse.json({ lists: [] })),
    );
    await field();

    await user.click(screen.getByRole("button", { name: "List actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(
      await screen.findByRole("alertdialog", {
        name: 'Delete list "Weekly shop"?',
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(deleted).toBe(1);
    // The list's page was replaced, so Back does not return to it.
    expect(router.state.historyAction).toBe("REPLACE");
    // No refetch of the deleted list after the DELETE.
    expect(seen).toEqual(["GET", "DELETE"]);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Lists" })).toHaveFocus();
    });
  });

  it("LST-1.3: a deleted list is not shown again from the cache", async () => {
    const user = userEvent.setup();
    const { router } = setup();
    server.use(
      http.delete(
        `/api/lists/${id}`,
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get("/api/lists", () => HttpResponse.json({ lists: [] })),
    );
    await field();
    await user.click(screen.getByRole("button", { name: "List actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    // The lists page is on screen, so the list's screen has unmounted (and
    // dropped its cache entry): the router's state changes before that.
    await screen.findByText("Create your first list");
    expect(router.state.location.pathname).toBe("/");

    // The next visit's request is held: nothing may show the name meanwhile.
    server.use(
      http.get(`/api/lists/${id}`, () => new Promise(() => undefined)),
    );
    await router.navigate(`/lists/${id}`);

    // With no cached list the page shows its loading heading, not the name.
    expect(
      await screen.findByRole("heading", { name: "List" }),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Weekly shop")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Weekly shop" }),
    ).not.toBeInTheDocument();
  });

  it.each(["Escape", "Cancel"])(
    "APP-3.3: closing the dialog with %s returns the focus to the list's menu button",
    async (how) => {
      const user = userEvent.setup();
      setup();
      await field();
      const trigger = screen.getByRole("button", { name: "List actions" });

      await user.click(trigger);
      await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
      await screen.findByRole("alertdialog");
      if (how === "Escape") await user.keyboard("{Escape}");
      else await user.click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    },
  );

  it("LST-1.3: deleting a list evicts only its own cache entry", async () => {
    const user = userEvent.setup();
    const { router, queryClient } = setup();
    const other = { ...list, id: "0198a000-0000-7000-8000-0000000000bb" };
    server.use(
      http.delete(
        `/api/lists/${id}`,
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get("/api/lists", () => HttpResponse.json({ lists: [] })),
    );
    await field();
    queryClient.setQueryData(["lists", other.id], other);

    await user.click(screen.getByRole("button", { name: "List actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await screen.findByText("Create your first list");

    expect(router.state.location.pathname).toBe("/");
    expect(queryClient.getQueryData(["lists", id])).toBeUndefined();
    expect(queryClient.getQueryData(["lists", other.id])).toEqual(other);
  });

  it("LST-1.3: leaving a list that was not deleted keeps its cache entry", async () => {
    const user = userEvent.setup();
    const { queryClient } = setup();
    server.use(http.get("/api/lists", () => HttpResponse.json({ lists: [] })));
    await field();

    await user.click(screen.getByRole("link", { name: "Back to lists" }));
    await screen.findByText("Create your first list");

    expect(queryClient.getQueryData(["lists", id])).toEqual(list);
  });

  it("APP-3.3: after a cancelled delete, closing the menu returns the focus to its button", async () => {
    const user = userEvent.setup();
    setup();
    await field();
    const trigger = screen.getByRole("button", { name: "List actions" });

    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });

    await user.click(trigger);
    await screen.findByRole("menuitem", { name: "Rename" });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  describe("a rename that is not saved", () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    const failing = () => {
      const requests: string[] = [];
      server.use(
        http.patch(`/api/lists/${id}`, async ({ request }) => {
          requests.push(((await request.json()) as { name: string }).name);
          return HttpResponse.error();
        }),
      );
      return requests;
    };

    it("NET-1.3: a rename started offline is sent at once and nothing is sent later", async () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      const user = userEvent.setup();
      setup();
      const requests = failing();

      await user.type(await field(), " 2{Enter}");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Not saved. Try again",
      );
      expect(requests).toHaveLength(1);
      window.dispatchEvent(new Event("online"));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(requests).toHaveLength(1);
    });

    it("NET-1.5: a failed rename marks the lists stale and no other query", async () => {
      const user = userEvent.setup();
      const { queryClient } = setup();
      failing();
      queryClient.setQueryData(["lists"], []);
      queryClient.setQueryData(["lists", "other"], list);
      queryClient.setQueryData(["catalog"], {});
      const stale = (key: string[]) =>
        queryClient.getQueryState(key)?.isInvalidated;

      await user.type(await field(), " 2{Enter}");
      await screen.findByRole("alert");

      expect(stale(["lists"])).toBe(true);
      expect(stale(["lists", "other"])).toBe(false);
      expect(stale(["catalog"])).toBe(false);
    });

    it("NET-1.4: a rename with no answer shows Not saved. after the limit", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      setup();
      server.use(http.patch(`/api/lists/${id}`, () => delay("infinite")));

      await user.type(await field(), " 2{Enter}");
      expect(await screen.findByText("Saving…")).toBeVisible();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(await screen.findByRole("alert")).toHaveTextContent("Not saved.");
      expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
        "Weekly shop 2",
      );
    });

    it("NET-1.4: a rename and its refetch with no answer: Not saved. comes at the limit, not after the refetch", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      setup();
      await field();
      server.use(
        http.patch(`/api/lists/${id}`, () => delay("infinite")),
        http.get(`/api/lists/${id}`, () => delay("infinite")),
      );

      await user.type(await field(), " 2{Enter}");
      expect(await screen.findByText("Saving…")).toBeVisible();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Not saved. Try again",
      );
      expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
        "Weekly shop 2",
      );
      expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Back to lists" }),
      ).not.toHaveAttribute("aria-disabled");
    });

    it("NET-1.4: a rename and its refetch that both fail at once keep the screen and Not saved.", async () => {
      const user = userEvent.setup();
      setup();
      await field();
      server.use(
        http.patch(`/api/lists/${id}`, () => HttpResponse.error()),
        http.get(`/api/lists/${id}`, () => HttpResponse.error()),
      );

      await user.type(await field(), " 2{Enter}");
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Not saved. Try again",
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
        "Weekly shop 2",
      );
      expect(screen.getByRole("alert")).toHaveTextContent("Not saved.");
      expect(
        screen.queryByText("The list could not be loaded."),
      ).not.toBeInTheDocument();
    });

    it("NET-1.4: a list read with no answer shows its error card", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      setup();
      server.use(http.get(`/api/lists/${id}`, () => delay("infinite")));

      await vi.advanceTimersByTimeAsync(10_000);

      expect(
        await screen.findByText("The list could not be loaded."),
      ).toBeVisible();
      expect(screen.getByText(timeoutMessage)).toBeVisible();
    });

    it("NET-1.5: a rename whose answer was lost shows the saved name", async () => {
      const user = userEvent.setup();
      setup();
      const requests = failing();
      // From the first PATCH on, the server holds the new name.
      server.use(
        http.get(`/api/lists/${id}`, () =>
          HttpResponse.json(
            requests.length > 0 ? { ...list, name: "Weekly shop 2" } : list,
          ),
        ),
      );

      await user.type(await field(), " 2{Enter}");

      await waitFor(() => {
        expect(requests).toHaveLength(1);
      });
      // Only the refetch changes the heading, which follows the saved name.
      expect(
        await screen.findByRole("heading", { name: "Weekly shop 2" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
        "Weekly shop 2",
      );
    });

    it("NET-1.7: Try again leaves the focus in the name field", async () => {
      const user = userEvent.setup();
      setup();
      failing();

      await user.type(await field(), " 2{Enter}");
      await user.click(
        await screen.findByRole("button", { name: "Try again" }),
      );

      expect(screen.getByRole("textbox", { name: "List name" })).toHaveFocus();
    });

    it("NET-1.7: after a failed rename the typed name stays and only a retry sends it", async () => {
      const user = userEvent.setup();
      setup();
      const requests = failing();

      await user.type(await field(), " 2{Enter}");
      await screen.findByRole("alert");
      expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
        "Weekly shop 2",
      );
      await user.tab();
      expect(requests).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() => {
        expect(requests).toHaveLength(2);
      });
      await screen.findByRole("alert");
      await user.click(screen.getByRole("textbox", { name: "List name" }));
      await user.keyboard("{Enter}");
      await waitFor(() => {
        expect(requests).toHaveLength(3);
      });
      await screen.findByRole("alert");

      await user.keyboard("{Escape}");

      expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
        "Weekly shop",
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("a rename in flight", () => {
    function held() {
      let answer: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        answer = resolve;
      });
      const requests: string[] = [];
      server.use(
        http.patch(`/api/lists/${id}`, async ({ request }) => {
          requests.push(((await request.json()) as { name: string }).name);
          await gate;
          return HttpResponse.json({ ...list, name: "Weekly shop 2" });
        }),
      );
      return { answer, requests };
    }

    it("NET-1.8: while a rename is saved, the screen cannot be left", async () => {
      const user = userEvent.setup();
      const router = createMemoryRouter(routes, {
        initialEntries: ["/", `/lists/${id}`],
        initialIndex: 1,
      });
      server.use(
        http.get("/api/lists", () => HttpResponse.json({ lists: [] })),
        http.get(`/api/lists/${id}`, () => HttpResponse.json(list)),
        http.get("/api/auth/get-session", () =>
          HttpResponse.json({ ok: true }),
        ),
      );
      const { answer } = held();
      render(
        <QueryClientProvider client={new QueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );

      await user.type(await field(), " 2{Enter}");
      expect(await screen.findByText("Saving…")).toBeVisible();
      const back = screen.getByRole("link", { name: "Back to lists" });
      expect(back).toHaveAttribute("aria-disabled", "true");
      await user.click(back);
      await user.keyboard("{Escape}");
      await router.navigate(-1);

      expect(router.state.location.pathname).toBe(`/lists/${id}`);
      // A blocked navigation is dropped, not kept waiting for the change to end.
      await waitFor(() => {
        expect([...router.state.blockers.values()].map((b) => b.state)).toEqual(
          ["unblocked"],
        );
      });
      expect(screen.getByRole("textbox", { name: "List name" })).toHaveValue(
        "Weekly shop 2",
      );
      expect(screen.getByText("Saving…")).toBeVisible();

      answer();
      await waitFor(() => {
        expect(back).not.toHaveAttribute("aria-disabled");
      });
      await user.click(back);
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/");
      });
    });

    it("NET-1.7: a refusal shows its own message and no Try again", async () => {
      const user = userEvent.setup();
      setup();
      server.use(
        http.patch(`/api/lists/${id}`, () =>
          HttpResponse.json(
            { error: { code: "invalid", message: "Not a good name" } },
            { status: 400 },
          ),
        ),
      );

      await user.type(await field(), " 2{Enter}");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Not a good name",
      );
      expect(
        screen.queryByRole("button", { name: "Try again" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Not saved.")).not.toBeInTheDocument();
    });

    it("NET-1.7: a 404 shows its message as before", async () => {
      const user = userEvent.setup();
      setup();
      server.use(
        http.patch(`/api/lists/${id}`, () =>
          HttpResponse.json(
            { error: { code: "not_found", message: "List not found" } },
            { status: 404 },
          ),
        ),
      );

      await user.type(await field(), " 2{Enter}");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "List not found",
      );
    });

    it("NET-1.8: the back link does not navigate while a rename is saved, without the shell's blocker", async () => {
      const user = userEvent.setup();
      // Only the page: nothing but the link itself can hold the screen.
      const router = createMemoryRouter(
        [
          { path: "/", element: <p>Lists</p> },
          { path: "/lists/:id", element: <ListPage /> },
        ],
        { initialEntries: [`/lists/${id}`] },
      );
      server.use(
        http.get(`/api/lists/${id}`, () => HttpResponse.json(list)),
        http.get("/api/auth/get-session", () =>
          HttpResponse.json({ ok: true }),
        ),
      );
      const { answer } = held();
      render(
        <QueryClientProvider client={new QueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );

      await user.type(await field(), " 2{Enter}");
      await screen.findByText("Saving…");
      await user.click(screen.getByRole("link", { name: "Back to lists" }));

      expect(router.state.location.pathname).toBe(`/lists/${id}`);
      answer();
      await waitFor(() => {
        expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
      });
    });

    it("NET-1.8: Enter twice, or Enter and then leaving the field, while a rename is saved sends one request", async () => {
      const user = userEvent.setup();
      setup();
      const { answer, requests } = held();

      await user.type(await field(), " 2{Enter}{Enter}");
      await screen.findByText("Saving…");
      await user.keyboard("{Enter}");
      await user.tab();
      answer();

      await waitFor(() => {
        expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
      });
      expect(requests).toEqual(["Weekly shop 2"]);
    });
  });
});
