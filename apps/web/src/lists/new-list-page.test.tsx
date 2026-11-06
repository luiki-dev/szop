import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { routes } from "../routes.tsx";
import { desktopQuery } from "../shell/use-media-query.ts";
import { stubMatchMedia } from "../test/match-media.ts";
import { threeLists } from "../test/lists.ts";
import { server } from "../test/server.ts";

// Starts on the lists page and goes to /lists/new, so "back" has somewhere
// to land. Every request the page makes is recorded.
function setup(cachedLists: typeof threeLists = []) {
  const posts: { id: string; name: string }[] = [];
  let status = 201;
  server.use(
    http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
    http.post("/api/lists", async ({ request }) => {
      const body = (await request.json()) as { id: string; name: string };
      posts.push(body);
      return status === 201
        ? HttpResponse.json(
            {
              ...body,
              sortByCategory: true,
              createdAt: "2026-10-30T12:00:00.000Z",
            },
            { status: 201 },
          )
        : HttpResponse.json(
            { error: { code: "internal_error", message: "Boom" } },
            { status },
          );
    }),
    http.get("/api/lists/:id", ({ params }) =>
      HttpResponse.json({
        id: params.id,
        name: "Weekly shop",
        sortByCategory: true,
        createdAt: "2026-10-30T12:00:00.000Z",
      }),
    ),
  );
  const router = createMemoryRouter(routes, {
    initialEntries: ["/", "/lists/new"],
    initialIndex: 1,
  });
  const queryClient = new QueryClient();
  if (cachedLists.length > 0) queryClient.setQueryData(["lists"], cachedLists);
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return {
    router,
    posts,
    answer: (code: number) => {
      status = code;
    },
    field: () => screen.getByRole("textbox", { name: "List name" }),
  };
}

describe("NewListPage", () => {
  it("LST-1.5: focuses the empty List name field and offers no list actions", () => {
    const { field } = setup();

    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute("placeholder", "List name");
    expect(
      screen.queryByRole("button", { name: "List actions" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "New list",
    );
    expect(document.title).toBe("New list · Szop");
  });

  it("LST-1.1, LST-1.5: Enter creates the list and replaces the address", async () => {
    const user = userEvent.setup();
    const { router, posts } = setup();

    await user.type(screen.getByRole("textbox"), "Weekly shop{Enter}");

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(
        /^\/lists\/[0-9a-f-]{36}$/,
      );
    });
    expect(posts).toHaveLength(1);
    expect(posts[0]?.name).toBe("Weekly shop");
    expect(posts[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(router.state.location.pathname).toBe(`/lists/${posts[0]?.id ?? ""}`);
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe("/");
  });

  it("LST-1.5: Esc goes back to the lists page and sends nothing", async () => {
    const user = userEvent.setup();
    const { router, posts } = setup();

    await user.type(screen.getByRole("textbox"), "Draft{Escape}");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(posts).toHaveLength(0);
  });

  it.each(["", "   "])("LST-1.5: Enter with %j sends nothing", async (text) => {
    const user = userEvent.setup();
    const { router, posts } = setup();

    await user.type(screen.getByRole("textbox"), `${text}{Enter}`);

    expect(posts).toHaveLength(0);
    expect(router.state.location.pathname).toBe("/lists/new");
  });

  it("LST-1.5: the back link with an empty name goes to the lists page", async () => {
    const user = userEvent.setup();
    const { router, posts } = setup();

    await user.click(screen.getByRole("link", { name: "Back to lists" }));

    expect(router.state.location.pathname).toBe("/");
    expect(posts).toHaveLength(0);
  });

  it("LIM-2.2: refuses a name over 100 characters before sending", async () => {
    const user = userEvent.setup();
    const { posts } = setup();

    await user.type(screen.getByRole("textbox"), `${"a".repeat(101)}{Enter}`);

    expect(
      await screen.findByText("Name is too long (at most 100 characters)"),
    ).toBeVisible();
    expect(posts).toHaveLength(0);
  });

  it("LST-1.9: shows the error of a too long name without Enter", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByRole("textbox"), "a".repeat(101));

    expect(
      await screen.findByText("Name is too long (at most 100 characters)"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("LST-1.9: shows the error of a name with a control character, and clearing the field removes it", async () => {
    const user = userEvent.setup();
    const { field } = setup();

    await user.type(field(), "a");
    fireEvent.change(field(), { target: { value: "a\u0007b" } });
    expect(
      await screen.findByText("Name can't contain control characters"),
    ).toBeVisible();

    await user.clear(field());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("NET-1.7: after a failed create the name stays and Create sends it again", async () => {
    const user = userEvent.setup();
    const { router, posts, answer, field } = setup();
    answer(500);

    await user.type(field(), "Weekly shop{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Not saved. Check your connection and create again.",
    );
    expect(field()).toHaveValue("Weekly shop");
    expect(router.state.location.pathname).toBe("/lists/new");

    answer(201);
    await user.type(field(), "{Enter}");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/lists/${posts[0]?.id ?? ""}`,
      );
    });
    expect(posts).toHaveLength(2);
    expect(posts[1]?.id).toBe(posts[0]?.id);
  });

  it("makes the field read-only while saving, so two Enters make one list", async () => {
    const user = userEvent.setup();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { posts, field } = setup();
    server.use(
      http.post("/api/lists", async ({ request }) => {
        const body = (await request.json()) as { id: string; name: string };
        posts.push(body);
        await gate;
        return HttpResponse.json(
          {
            ...body,
            sortByCategory: true,
            createdAt: "2026-10-30T12:00:00.000Z",
          },
          { status: 201 },
        );
      }),
    );

    await user.type(field(), "Weekly shop{Enter}{Enter}");

    await waitFor(() => {
      expect(field()).toHaveAttribute("readonly");
    });
    expect(posts).toHaveLength(1);
    release();
  });

  it("LST-1.9: Create makes the list, as Enter does", async () => {
    const user = userEvent.setup();
    const { router, posts, field } = setup();
    const create = screen.getByRole("button", { name: "Create" });

    expect(create).toBeDisabled();
    await user.type(field(), "Weekly shop");
    expect(create).toBeEnabled();
    await user.click(create);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/lists/${posts[0]?.id ?? ""}`,
      );
    });
    expect(posts).toHaveLength(1);
    expect(posts[0]?.name).toBe("Weekly shop");
  });

  it.each(["   ", "a".repeat(101)])(
    "LST-1.9: Create is disabled for the name %j",
    async (text) => {
      const user = userEvent.setup();
      const { field } = setup();

      await user.type(field(), text);

      expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    },
  );

  it("LST-1.9: Create is disabled while the create is in flight", async () => {
    const user = userEvent.setup();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { posts, field } = setup();
    server.use(
      http.post("/api/lists", async ({ request }) => {
        posts.push((await request.json()) as { id: string; name: string });
        await gate;
        return HttpResponse.json(
          {
            ...posts[0],
            sortByCategory: true,
            createdAt: "2026-10-30T12:00:00.000Z",
          },
          { status: 201 },
        );
      }),
    );

    await user.type(field(), "Weekly shop");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    });
    expect(posts).toHaveLength(1);
    release();
  });

  it("NET-1.8: while a list is created, Create reads Creating… and the screen cannot be left", async () => {
    const user = userEvent.setup();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { router, field } = setup();
    server.use(
      http.post("/api/lists", async ({ request }) => {
        const body = (await request.json()) as { id: string; name: string };
        await gate;
        return HttpResponse.json(
          {
            ...body,
            sortByCategory: true,
            createdAt: "2026-10-30T12:00:00.000Z",
          },
          { status: 201 },
        );
      }),
    );

    await user.type(field(), "Weekly shop");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await screen.findByRole("button", { name: "Creating…" });

    expect(screen.getByRole("link", { name: "Back to lists" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe("/lists/new");

    release();
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(
        /^\/lists\/[0-9a-f-]{36}$/,
      );
    });
  });

  it("NET-1.6: Create after a failed Create sends the same ID", async () => {
    const user = userEvent.setup();
    const { posts, answer, field } = setup();
    answer(500);

    await user.type(field(), "Weekly shop");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await screen.findByRole("alert");
    answer(201);
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(posts).toHaveLength(2);
    });
    expect(posts[1]?.id).toBe(posts[0]?.id);
  });

  it("NET-1.7: a refusal with its own message shows that message", async () => {
    const user = userEvent.setup();
    const { field } = setup();
    server.use(
      http.post("/api/lists", () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "Name is taken" } },
          { status: 400 },
        ),
      ),
    );

    await user.type(field(), "Weekly shop{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Name is taken");
  });

  it("NET-1.5: a create whose answer was lost opens the new list", async () => {
    const user = userEvent.setup();
    const { router, field } = setup();
    let created: { id: string; name: string } | undefined;
    server.use(
      http.post("/api/lists", async ({ request }) => {
        created = (await request.json()) as { id: string; name: string };
        return HttpResponse.error();
      }),
      http.get("/api/lists", () =>
        HttpResponse.json({
          lists: created
            ? [
                {
                  ...created,
                  sortByCategory: true,
                  createdAt: "2026-10-30T12:00:00.000Z",
                },
              ]
            : [],
        }),
      ),
    );

    await user.type(field(), "Weekly shop{Enter}");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/lists/${created?.id ?? ""}`,
      );
    });
    // The address was replaced: Back skips the New list page.
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe("/");
  });

  it("NET-1.5: a failed create stays on the page when the server does not hold the list", async () => {
    const user = userEvent.setup();
    const { router, field } = setup();
    let reads = 0;
    server.use(
      http.post("/api/lists", () => HttpResponse.error()),
      http.get("/api/lists", () => {
        reads += 1;
        return HttpResponse.json({ lists: threeLists });
      }),
    );

    await user.type(field(), "Weekly shop{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Not saved.");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
    });
    // The refetch must have answered before the page is checked.
    await waitFor(() => {
      expect(reads).toBe(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(router.state.location.pathname).toBe("/lists/new");
  });

  it("NET-1.5: an idle New list page with lists in the cache renders and does not take them for an applied create", () => {
    setup(threeLists);

    expect(screen.getByRole("textbox", { name: "List name" })).toBeVisible();
  });

  it("LST-1.9: the field keeps its border when the focus leaves it", async () => {
    const user = userEvent.setup();
    const { field } = setup();

    await user.type(field(), "Weekly shop");
    await user.tab();

    expect(field()).not.toHaveFocus();
    expect(field()).toHaveClass("border-2");
    expect(field()).not.toHaveClass("underline");
  });

  it("LST-1.9: on a desktop Create stands in the field's row", () => {
    stubMatchMedia({ [desktopQuery]: true });
    const { field } = setup();

    expect(screen.getByRole("button", { name: "Create" }).parentElement).toBe(
      field().parentElement,
    );
  });

  it("LST-1.9: on a phone Create is pinned at the bottom", () => {
    setup();

    expect(
      screen.getByRole("button", { name: "Create" }).parentElement,
    ).toHaveClass("fixed", "bottom-0");
  });
});
