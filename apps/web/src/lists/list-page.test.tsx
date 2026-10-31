import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { routes } from "../routes.tsx";
import { server } from "../test/server.ts";

const id = "0198a000-0000-7000-8000-0000000000aa";
const list = { id, name: "Weekly shop", createdAt: "2026-10-30T12:00:00.000Z" };

function setup() {
  const patches: { name: string }[] = [];
  server.use(
    http.get(`/api/lists/${id}`, () => HttpResponse.json(list)),
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
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, patches };
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
      expect(screen.getByRole("textbox")).toHaveValue("PARTY");
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

    expect(screen.getByRole("textbox")).toHaveValue("Weekly shop");
    expect(patches).toHaveLength(0);
  });

  it("LST-1.2: Enter then blur sends one request", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.type(await field(), " 2{Enter}");
    await user.click(document.body);

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("WEEKLY SHOP 2");
    });
    expect(patches).toHaveLength(1);
  });

  it("LST-1.2: an empty name is not saved and the old one returns", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.clear(await field());
    await user.tab();

    expect(screen.getByRole("textbox")).toHaveValue("Weekly shop");
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

  it("says the list does not exist on a 404, with a link to the lists page", async () => {
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

    expect(await screen.findByText("This list does not exist.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to lists" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Show my lists" })).toHaveAttribute(
      "href",
      "/",
    );
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

    expect(screen.getByRole("textbox")).not.toHaveFocus();
  });

  it("LST-1.2: a name of spaces is not saved and the old one returns", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.clear(await field());
    await user.type(screen.getByRole("textbox"), "   ");
    await user.tab();

    expect(screen.getByRole("textbox")).toHaveValue("Weekly shop");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(patches).toHaveLength(0);
  });

  it("LST-1.2: a name over 100 characters shows an invalid field that a valid name or Esc clears", async () => {
    const user = userEvent.setup();
    const { patches } = setup();
    const long = "a".repeat(101);

    await user.clear(await field());
    await user.type(screen.getByRole("textbox"), long);
    await user.tab();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Name is too long",
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(patches).toHaveLength(0);

    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Short");
    await user.tab();
    await waitFor(() => {
      expect(patches).toEqual([{ name: "Short" }]);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), long);
    await user.tab();
    expect(await screen.findByRole("alert")).toBeVisible();
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("LST-1.2: editing again after Esc saves on leaving the field", async () => {
    const user = userEvent.setup();
    const { patches } = setup();

    await user.type(await field(), " 2{Escape}");
    await user.click(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), " 3");
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
          { error: { code: "internal_error", message: "Boom" } },
          { status: 500 },
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
          { error: { code: "internal_error", message: "Boom" } },
          { status: 500 },
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
});
