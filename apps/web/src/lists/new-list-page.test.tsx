import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { routes } from "../routes.tsx";
import { server } from "../test/server.ts";

// Starts on the lists page and goes to /lists/new, so "back" has somewhere
// to land. Every request the page makes is recorded.
function setup() {
  const posts: { id: string; name: string }[] = [];
  let status = 201;
  server.use(
    http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
    http.post("/api/lists", async ({ request }) => {
      const body = (await request.json()) as { id: string; name: string };
      posts.push(body);
      return status === 201
        ? HttpResponse.json(
            { ...body, createdAt: "2026-10-30T12:00:00.000Z" },
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
        createdAt: "2026-10-30T12:00:00.000Z",
      }),
    ),
  );
  const router = createMemoryRouter(routes, {
    initialEntries: ["/", "/lists/new"],
    initialIndex: 1,
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
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

  it("keeps the text after a failure and retries with the same ID", async () => {
    const user = userEvent.setup();
    const { router, posts, answer, field } = setup();
    answer(500);

    await user.type(field(), "Weekly shop{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
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
          { ...body, createdAt: "2026-10-30T12:00:00.000Z" },
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
});
