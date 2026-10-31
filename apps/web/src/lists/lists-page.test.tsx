import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { desktopQuery } from "../shell/use-media-query.ts";
import { threeLists } from "../test/lists.ts";
import { stubMatchMedia } from "../test/match-media.ts";
import { server } from "../test/server.ts";
import { routes } from "../routes.tsx";

// The real route table; a phone unless a test says otherwise (setup.ts).
function renderApp(path = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
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
});
