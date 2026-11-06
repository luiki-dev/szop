import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it, vi } from "vitest";
import { coarseQuery, desktopQuery } from "../shell/use-media-query.ts";
import { threeLists } from "../test/lists.ts";
import { stubMatchMedia } from "../test/match-media.ts";
import { server } from "../test/server.ts";
import { routes } from "../routes.tsx";
import { isSelecting } from "./lists-page.tsx";

// The real route table; a phone unless a test says otherwise (setup.ts).
function renderApp(path = "/", before: string[] = []) {
  const router = createMemoryRouter(routes, {
    initialEntries: [...before, path],
    initialIndex: before.length,
  });
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, client };
}

function serveLists(lists = threeLists) {
  server.use(http.get("/api/lists", () => HttpResponse.json({ lists })));
}

describe("ListsPage", () => {
  it("LST-2.3, APP-4.2: invites to create the first list when there are none", async () => {
    serveLists([]);
    renderApp();

    expect(await screen.findByText("Create your first list")).toBeVisible();
    // The raccoon is decorative: alt="" gives it the role "presentation".
    expect(screen.getByRole("presentation")).toHaveAttribute("alt", "");
    expect(screen.getByRole("link", { name: "New list" })).toHaveAttribute(
      "href",
      "/lists/new",
    );
  });

  it("LST-2.1, APP-1.5: lists the server's lists in its order, each a link", async () => {
    serveLists();
    renderApp();

    const main = screen.getByRole("main");
    await within(main).findByRole("link", { name: "Party" });
    const links = within(main)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") !== "/lists/new");
    expect(links.map((link) => link.textContent)).toEqual(
      threeLists.map((list) => list.name),
    );
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      threeLists.map((list) => `/lists/${list.id}`),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Lists" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Lists · Szop");
  });

  it("APP-4.1: shows skeleton cards while loading", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get("/api/lists", async () => {
        await gate;
        return HttpResponse.json({ lists: threeLists });
      }),
    );
    renderApp();

    expect(screen.getAllByTestId("skeleton-card").length).toBeGreaterThan(0);

    release();
    expect(await screen.findByRole("link", { name: "Party" })).toBeVisible();
    expect(screen.queryByTestId("skeleton-card")).not.toBeInTheDocument();
  });

  it("APP-4.3: says the lists could not be loaded and offers Try again", async () => {
    let answers = 0;
    server.use(
      http.get("/api/lists", () => {
        answers += 1;
        return answers === 1
          ? HttpResponse.json(
              { error: { code: "internal_error", message: "Boom" } },
              { status: 500 },
            )
          : HttpResponse.json({ lists: threeLists });
      }),
    );
    renderApp();

    expect(
      await screen.findByText("The lists could not be loaded."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Party" })).toBeVisible();
    expect(
      screen.queryByText("The lists could not be loaded."),
    ).not.toBeInTheDocument();
  });

  it("LST-1.4, APP-1.8: on a phone the one New list link sits in the sticky bar", async () => {
    serveLists();
    renderApp();

    const link = await screen.findByRole("link", { name: "New list" });
    expect(screen.getAllByRole("link", { name: "New list" })).toHaveLength(1);
    expect(link.parentElement).toHaveClass("fixed", "bottom-0");
  });

  it("LST-1.4, APP-1.8: on a phone the New list link stays when the lists fail to load", async () => {
    server.use(
      http.get("/api/lists", () =>
        HttpResponse.json(
          { error: { code: "internal_error", message: "Boom" } },
          { status: 500 },
        ),
      ),
    );
    renderApp();

    await screen.findByText("The lists could not be loaded.");
    const link = screen.getByRole("link", { name: "New list" });
    expect(link.parentElement).toHaveClass("fixed", "bottom-0");
  });

  it("LST-1.4, APP-1.8: on a desktop the one New list link sits in the header beside the h1", async () => {
    stubMatchMedia({ [desktopQuery]: true });
    serveLists();
    renderApp();

    await screen.findByRole("link", { name: "Party" });
    const links = screen.getAllByRole("link", { name: "New list" });
    expect(links).toHaveLength(1);
    const heading = screen.getByRole("heading", { level: 1, name: "Lists" });
    expect(heading.parentElement).toContainElement(links[0] ?? null);
  });

  it.each([
    [undefined, false],
    [null, false],
    ["selecting", false],
    [1, false],
    [{}, false],
    [{ selecting: false }, false],
    [{ selecting: "yes" }, false],
    [{ selecting: true }, true],
  ])("LST-1.7: isSelecting(%j) is %s", (state, expected) => {
    expect(isSelecting(state)).toBe(expected);
  });

  it("LST-1.7: Esc on the lists page, not selecting, goes nowhere", async () => {
    serveLists();
    const { router } = renderApp("/", ["/other"]);
    await screen.findByRole("link", { name: "Party" });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(router.state.location.pathname).toBe("/");
  });

  describe("selecting", () => {
    const [party, groceries, hardware] = threeLists;
    const row = (name: string) => screen.getByRole("checkbox", { name });
    const select = async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Select" }));
    };

    it("LST-1.6: Select shows a bar with a count and a checkbox on every list", async () => {
      serveLists();
      renderApp();
      await select();

      expect(screen.getAllByRole("checkbox")).toHaveLength(3);
      expect(screen.getByText("0 selected")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancel selection" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
      expect(
        screen.queryByRole("link", { name: "New list" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Party" })).toBeNull();

      fireEvent.click(row("Party"));
      fireEvent.click(row("Hardware store"));
      expect(screen.getByText("2 selected")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
    });

    it.each([false, true])(
      "OP-131: selecting keeps the page's heading and puts the controls where Select was (desktop %s)",
      async (desktop) => {
        stubMatchMedia({ [desktopQuery]: desktop });
        serveLists();
        renderApp();
        const selectButton = await screen.findByRole("button", {
          name: "Select",
        });
        const rowOfSelect = selectButton.parentElement;
        fireEvent.click(selectButton);

        const heading = screen.getByRole("heading", {
          level: 1,
          name: "Lists",
        });
        expect(heading).not.toHaveClass("sr-only");
        if (desktop) {
          expect(
            within(heading.parentElement as HTMLElement).getByRole("link", {
              name: "New list",
            }),
          ).toBeVisible();
        } else {
          expect(
            screen.getByRole("button", { name: "Open menu" }),
          ).toBeVisible();
        }
        const bar = screen.getByRole("button", {
          name: "Cancel selection",
        }).parentElement;
        expect(bar).toBe(rowOfSelect);
        for (const name of ["Select all", "Delete"]) {
          expect(
            within(bar as HTMLElement).getByRole("button", { name }),
          ).toBeVisible();
        }
        expect(
          within(bar as HTMLElement).getByText("0 selected"),
        ).toBeVisible();
      },
    );

    it("LST-1.6: Select is not shown with no lists", async () => {
      serveLists([]);
      renderApp();
      await screen.findByText("Create your first list");
      expect(screen.queryByRole("button", { name: "Select" })).toBeNull();
    });

    it("LST-1.6: Space toggles the focused checkbox", async () => {
      const user = userEvent.setup();
      serveLists();
      renderApp();
      await select();

      row("Party").focus();
      await user.keyboard(" ");
      expect(row("Party")).toBeChecked();
    });

    it("LST-1.7: Select all selects every list and becomes Deselect all", async () => {
      serveLists();
      renderApp();
      await select();

      fireEvent.click(screen.getByRole("button", { name: "Select all" }));
      expect(screen.getByText("3 selected")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Deselect all" }));
      expect(screen.getByText("0 selected")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select all" })).toBeVisible();
    });

    it("LST-1.7: the count is announced politely", async () => {
      serveLists();
      renderApp();
      await select();
      expect(screen.getByText("0 selected")).toHaveAttribute(
        "aria-live",
        "polite",
      );
    });

    it("LST-1.7: the cancel button, Esc and Back stop selecting and keep /", async () => {
      serveLists();
      const { router } = renderApp();
      await select();
      fireEvent.click(row("Party"));

      fireEvent.click(screen.getByRole("button", { name: "Cancel selection" }));
      await screen.findByRole("link", { name: "Party" });
      expect(router.state.location.pathname).toBe("/");

      await select();
      fireEvent.click(row("Party"));
      fireEvent.keyDown(document, { key: "Escape" });
      await screen.findByRole("link", { name: "Party" });

      await select();
      fireEvent.click(row("Party"));
      await act(() => router.navigate(-1));
      await screen.findByRole("link", { name: "Party" });
      expect(router.state.location.pathname).toBe("/");

      await select();
      expect(screen.getByText("0 selected")).toBeInTheDocument();
    });

    it("LST-1.7: a repeated Esc and two quick taps on cancel go back only once", async () => {
      serveLists();
      const { router } = renderApp();
      await screen.findByRole("link", { name: "Party" });
      const before = window.history.length;
      await select();
      const cancel = screen.getByRole("button", { name: "Cancel selection" });
      fireEvent.click(cancel);
      fireEvent.click(cancel);
      fireEvent.keyDown(document, { key: "Escape" });
      await screen.findByRole("link", { name: "Party" });
      expect(router.state.location.pathname).toBe("/");
      expect(window.history.length).toBe(before);
      expect(router.state.location.state).toBeNull();
    });

    it("LST-1.7: two Esc and taps in one go leave the page only once", async () => {
      serveLists();
      const { router } = renderApp("/", ["/other"]);
      await select();
      const cancel = screen.getByRole("button", { name: "Cancel selection" });

      act(() => {
        fireEvent.click(cancel);
        fireEvent.click(cancel);
        fireEvent.keyDown(document, { key: "Escape" });
      });

      await screen.findByRole("link", { name: "Party" });
      expect(router.state.location.pathname).toBe("/");
    });

    it("LST-1.7: after selecting stops, Esc does nothing", async () => {
      serveLists();
      const { router } = renderApp("/", ["/other"]);
      await select();
      fireEvent.click(screen.getByRole("button", { name: "Cancel selection" }));
      await screen.findByRole("link", { name: "Party" });

      fireEvent.keyDown(document, { key: "Escape" });

      expect(router.state.location.pathname).toBe("/");
    });

    it("LST-1.7: Esc in the delete dialog closes the dialog and keeps selecting", async () => {
      serveLists();
      const { router } = renderApp("/", ["/other"]);
      await select();
      fireEvent.click(row("Party"));
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      await screen.findByRole("alertdialog");

      fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
      expect(screen.getByText("1 selected")).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/");
    });

    it("LST-1.7: stopping leaves the history as it was before the mode started", async () => {
      serveLists();
      const { router } = renderApp();
      await screen.findByRole("link", { name: "Party" });
      const before = window.history.length;
      await select();
      // Starting adds no "?index" to the address.
      expect(router.state.location.search).toBe("");
      fireEvent.click(screen.getByRole("button", { name: "Cancel selection" }));
      await screen.findByRole("link", { name: "Party" });
      expect(router.state.historyAction).toBe("POP");
      expect(window.history.length).toBe(before);
    });

    it("LST-1.8: Delete confirms for the selected lists, deletes them and stops selecting", async () => {
      const deleted: string[] = [];
      let remaining = [...threeLists];
      server.use(
        http.get("/api/lists", () => HttpResponse.json({ lists: remaining })),
        http.get("/api/auth/get-session", () =>
          HttpResponse.json({ ok: true }),
        ),
        http.post("/api/lists/delete", async ({ request }) => {
          const body = (await request.json()) as { ids: string[] };
          deleted.push(...body.ids);
          remaining = remaining.filter((l) => !body.ids.includes(l.id));
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const { router } = renderApp();
      await select();
      fireEvent.click(row("Party"));
      fireEvent.click(row("Hardware store"));
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      const dialog = await screen.findByRole("alertdialog", {
        name: "Delete 2 lists?",
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      await screen.findByRole("link", { name: "Weekend groceries" });
      expect(deleted.sort()).toEqual([party?.id, hardware?.id].sort());
      expect(screen.queryByRole("link", { name: "Party" })).toBeNull();
      expect(screen.queryByRole("checkbox")).toBeNull();
      expect(router.state.location.pathname).toBe("/");
    });

    it.each([false, true])(
      "NET-1.8: during a delete Back keeps the selection, and after it the selection ends with the focus on the title (desktop %s)",
      async (desktop) => {
        stubMatchMedia({ [desktopQuery]: desktop });
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        server.use(
          http.get("/api/lists", () =>
            HttpResponse.json({ lists: threeLists }),
          ),
          http.get("/api/auth/get-session", () =>
            HttpResponse.json({ ok: true }),
          ),
          http.post("/api/lists/delete", async () => {
            await gate;
            return new HttpResponse(null, { status: 204 });
          }),
        );
        const { router } = renderApp();
        await select();
        fireEvent.click(row("Party"));
        fireEvent.click(row("Hardware store"));
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        const dialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
        await within(dialog).findByRole("button", { name: "Deleting…" });

        await act(() => router.navigate(-1));
        expect(screen.getByText("2 selected")).toBeInTheDocument();

        release();
        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "Lists" })).toHaveFocus();
        });
        expect(screen.queryByRole("checkbox")).toBeNull();
      },
    );

    it.each([false, true])(
      "APP-3.3: after a confirmed delete the focus is on the Lists heading (desktop %s)",
      async (desktop) => {
        stubMatchMedia({ [desktopQuery]: desktop });
        server.use(
          http.get("/api/lists", () =>
            HttpResponse.json({ lists: threeLists }),
          ),
          http.get("/api/auth/get-session", () =>
            HttpResponse.json({ ok: true }),
          ),
          http.post(
            "/api/lists/delete",
            () => new HttpResponse(null, { status: 204 }),
          ),
        );
        renderApp();
        await select();
        fireEvent.click(row("Party"));
        fireEvent.click(row("Hardware store"));
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        const dialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

        await waitFor(() => {
          expect(screen.getByRole("heading", { name: "Lists" })).toHaveFocus();
        });
      },
    );

    it("NET-1.5: a failed delete and a failed refetch keep the page, the selection and the dialog", async () => {
      const posts: string[][] = [];
      server.use(
        http.get("/api/lists", () => HttpResponse.json({ lists: threeLists })),
        http.get("/api/auth/get-session", () =>
          HttpResponse.json({ ok: true }),
        ),
        http.post("/api/lists/delete", async ({ request }) => {
          posts.push(((await request.json()) as { ids: string[] }).ids);
          return HttpResponse.error();
        }),
      );
      renderApp();
      await select();
      fireEvent.click(row("Party"));
      fireEvent.click(row("Hardware store"));
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      const dialog = await screen.findByRole("alertdialog");
      // From now on the lists answer fails too.
      let reads = 0;
      server.use(
        http.get("/api/lists", () => {
          reads += 1;
          return HttpResponse.error();
        }),
      );
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      expect(
        await within(dialog).findByText(
          "Couldn't delete the lists. Check your connection and try again.",
        ),
      ).toBeVisible();
      await waitFor(() => {
        expect(reads).toBe(1);
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(
        screen.queryByText("The lists could not be loaded."),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("alertdialog")).toBeVisible();
      expect(screen.getByText("2 selected")).toBeInTheDocument();
      expect(screen.getAllByRole("checkbox", { hidden: true })).toHaveLength(3);
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
      await waitFor(() => {
        expect(posts).toHaveLength(2);
      });
    });

    it("LST-1.8: a delete does not wait for the lists refetch, and the deleted lists do not flash back", async () => {
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let reads = 0;
      server.use(
        http.get("/api/lists", async () => {
          reads += 1;
          if (reads > 1) await gate;
          return HttpResponse.json({ lists: threeLists });
        }),
        http.get("/api/auth/get-session", () =>
          HttpResponse.json({ ok: true }),
        ),
        http.post(
          "/api/lists/delete",
          () => new HttpResponse(null, { status: 204 }),
        ),
      );
      renderApp();
      await select();
      fireEvent.click(row("Party"));
      fireEvent.click(row("Hardware store"));
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(reads).toBe(2);
      });
      expect(screen.queryByRole("checkbox")).toBeNull();
      expect(screen.queryByRole("link", { name: "Party" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Hardware store" })).toBeNull();
      expect(
        screen.getByRole("link", { name: "Weekend groceries" }),
      ).toBeVisible();
      release();
    });

    it("LST-1.8: one selected list is named in the dialog", async () => {
      serveLists();
      renderApp();
      await select();
      fireEvent.click(row("Party"));
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      expect(
        await screen.findByRole("alertdialog", {
          name: 'Delete list "Party"?',
        }),
      ).toBeVisible();
    });

    it("LST-1.7: a selected list missing from a refetched query is not counted", async () => {
      serveLists();
      const { client } = renderApp();
      await select();
      fireEvent.click(row("Party"));
      fireEvent.click(row("Weekend groceries"));
      expect(screen.getByText("2 selected")).toBeInTheDocument();

      server.use(
        http.get("/api/lists", () =>
          HttpResponse.json({ lists: [groceries, hardware] }),
        ),
      );
      await act(() => client.refetchQueries({ queryKey: ["lists"] }));

      await waitFor(() => {
        expect(screen.getByText("1 selected")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      expect(
        await screen.findByRole("alertdialog", {
          name: 'Delete list "Weekend groceries"?',
        }),
      ).toBeVisible();
    });

    describe("on a coarse pointer", () => {
      // Fake timers hang findBy*, so the link is found before they start.
      async function longPress(name: string) {
        const link = screen.getByRole("link", { name });
        fireEvent.pointerDown(link, { clientX: 5, clientY: 5 });
        await act(() => {
          vi.advanceTimersByTime(500);
          return Promise.resolve();
        });
        return link;
      }

      it("LST-1.6: a long press selects the list, and the click after it neither deselects nor opens it", async () => {
        stubMatchMedia({ [coarseQuery]: true });
        serveLists();
        const { router } = renderApp();
        await screen.findByRole("link", { name: "Party" });
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        try {
          await longPress("Party");
          vi.useRealTimers();
          const checkbox = await screen.findByRole("checkbox", {
            name: "Party",
          });
          expect(checkbox).toBeChecked();
          expect(screen.getByText("1 selected")).toBeInTheDocument();
          expect(
            screen.queryByRole("link", { name: "New list" }),
          ).not.toBeInTheDocument();

          fireEvent.pointerUp(checkbox);
          fireEvent.click(checkbox);
          expect(row("Party")).toBeChecked();
          expect(router.state.location.pathname).toBe("/");

          // The last deselect after a long-press start stops selecting.
          fireEvent.click(row("Party"));
          expect(screen.queryByRole("checkbox")).toBeNull();
        } finally {
          vi.useRealTimers();
        }
      });

      it("LST-1.6: while selecting, a 600 ms hold on a row then the click still toggles it", async () => {
        stubMatchMedia({ [coarseQuery]: true });
        serveLists();
        renderApp();
        await select();
        const checkbox = row("Party");
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        try {
          fireEvent.pointerDown(checkbox, { clientX: 5, clientY: 5 });
          await act(() => {
            vi.advanceTimersByTime(600);
            return Promise.resolve();
          });
          fireEvent.pointerUp(checkbox);
          fireEvent.click(checkbox);
        } finally {
          vi.useRealTimers();
        }
        expect(row("Party")).toBeChecked();
      });

      it("LST-1.6: while selecting, a hold on a row adds no history entry", async () => {
        stubMatchMedia({ [coarseQuery]: true });
        serveLists();
        renderApp();
        await select();
        const checkbox = row("Party");
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        try {
          fireEvent.pointerDown(checkbox, { clientX: 5, clientY: 5 });
          await act(() => {
            vi.advanceTimersByTime(600);
            return Promise.resolve();
          });
          fireEvent.pointerUp(checkbox);
        } finally {
          vi.useRealTimers();
        }

        fireEvent.click(
          screen.getByRole("button", { name: "Cancel selection" }),
        );
        expect(
          await screen.findByRole("link", { name: "Party" }),
        ).toBeVisible();
        expect(screen.queryByRole("checkbox")).toBeNull();
      });

      it("LST-1.6: a second list tapped after a long press keeps selecting", async () => {
        stubMatchMedia({ [coarseQuery]: true });
        serveLists();
        renderApp();
        await screen.findByRole("link", { name: "Party" });
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        try {
          await longPress("Party");
        } finally {
          vi.useRealTimers();
        }
        const checkbox = await screen.findByRole("checkbox", { name: "Party" });
        fireEvent.pointerUp(checkbox);
        fireEvent.click(checkbox);

        fireEvent.click(row("Hardware store"));

        expect(screen.getByText("2 selected")).toBeInTheDocument();
      });

      it("LST-1.6: the long-press flag does not outlive the selecting it started", async () => {
        stubMatchMedia({ [coarseQuery]: true });
        serveLists();
        renderApp();
        await screen.findByRole("link", { name: "Party" });
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        try {
          await longPress("Party");
        } finally {
          vi.useRealTimers();
        }
        const held = await screen.findByRole("checkbox", { name: "Party" });
        fireEvent.pointerUp(held);
        fireEvent.click(held);
        fireEvent.click(
          screen.getByRole("button", { name: "Cancel selection" }),
        );
        await screen.findByRole("link", { name: "Party" });

        await select();
        fireEvent.click(row("Party"));
        fireEvent.click(row("Party"));

        expect(screen.getByText("0 selected")).toBeInTheDocument();
      });

      it("LST-1.6: a finger that moves during the press starts nothing", async () => {
        stubMatchMedia({ [coarseQuery]: true });
        serveLists();
        renderApp();
        const link = await screen.findByRole("link", { name: "Party" });
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        try {
          fireEvent.pointerDown(link, { clientX: 5, clientY: 5 });
          fireEvent.pointerMove(link, { clientX: 5, clientY: 40 });
          act(() => {
            vi.advanceTimersByTime(600);
          });
          expect(screen.queryByRole("checkbox")).toBeNull();
        } finally {
          vi.useRealTimers();
        }
      });

      it("LST-1.6: selecting started by Select stays at zero", async () => {
        stubMatchMedia({ [coarseQuery]: true });
        serveLists();
        renderApp();
        await select();
        fireEvent.click(row("Party"));
        fireEvent.click(row("Party"));
        expect(screen.getByText("0 selected")).toBeInTheDocument();
      });
    });

    it("LST-1.6: on a pointer that is not coarse a long press does nothing", async () => {
      serveLists();
      renderApp();
      const link = await screen.findByRole("link", { name: "Party" });
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        fireEvent.pointerDown(link, { clientX: 5, clientY: 5 });
        act(() => {
          vi.advanceTimersByTime(600);
        });
        expect(screen.queryByRole("checkbox")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
