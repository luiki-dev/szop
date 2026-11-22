import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderApp } from "../test/render-app.tsx";
import { threeLists } from "../test/lists.ts";
import { server } from "../test/server.ts";
import { registeredAddress } from "./registered-address.ts";

const password = "a long enough phrase";

beforeEach(() => {
  localStorage.clear();
});

function serveWorkspace(lists = threeLists) {
  server.use(
    http.get("/api/lists", () =>
      HttpResponse.json({ lists, hasWorkspace: true }),
    ),
  );
}

function captureSignUp(status = 200, body: JsonBodyType = { token: null }) {
  const bodies: unknown[] = [];
  server.use(
    http.post("/api/auth/sign-up/email", async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(body, { status });
    }),
  );
  return bodies;
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Your name"), "Ania");
  await user.type(screen.getByLabelText("Email"), "ania@example.com");
  await user.type(screen.getByLabelText("Password"), password);
  await user.type(screen.getByLabelText("Repeat password"), password);
}

describe("RegisterPage", () => {
  it("shows the four fields, each password with Show", async () => {
    renderApp("/register");

    expect(
      await screen.findByRole("heading", { name: "Create account" }),
    ).toBeVisible();
    for (const label of ["Your name", "Email", "Password", "Repeat password"]) {
      expect(await screen.findByLabelText(label)).toBeVisible();
    }
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Show password" }),
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Repeat password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("ACC-2.1: shows an error on leaving a field, and all of them on submit", async () => {
    const user = userEvent.setup();
    renderApp("/register");

    await user.type(await screen.findByLabelText("Email"), "ania");
    await user.tab();
    expect(screen.getByText("Enter a valid email address.")).toBeVisible();

    await user.type(screen.getByLabelText("Password"), "short");
    await user.type(screen.getByLabelText("Repeat password"), "other");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Enter your name.")).toBeVisible();
    expect(screen.getByText("Use at least 15 characters.")).toBeVisible();
    expect(screen.getByText("The passwords don't match.")).toBeVisible();
    expect(screen.getByLabelText("Your name")).toBeInvalid();
  });

  it("ACC-2.2: counts the password as the server does, an emoji as 2", async () => {
    const bodies = captureSignUp();
    const user = userEvent.setup();
    renderApp("/register");
    const emoji = "😀".repeat(7); // 14 code units
    await user.type(await screen.findByLabelText("Your name"), "Ania");
    await user.type(screen.getByLabelText("Email"), "ania@example.com");
    await user.type(screen.getByLabelText("Password"), emoji);
    await user.type(screen.getByLabelText("Repeat password"), emoji);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Use at least 15 characters.")).toBeVisible();
    expect(bodies).toEqual([]);
  });

  it("ACC-2.1: signs up, remembers the address and goes to the sent page", async () => {
    const bodies = captureSignUp();
    const user = userEvent.setup();
    const router = renderApp("/register");

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/register/sent");
    });
    expect(bodies).toEqual([
      {
        name: "Ania",
        email: "ania@example.com",
        password,
        keepGuestData: true,
      },
    ]);
    expect(registeredAddress()).toBe("ania@example.com");
  });

  it("ACC-2.3: shows password_breached under Password", async () => {
    captureSignUp(400, {
      code: "password_breached",
      message: "This password appears in known data leaks. Choose another.",
    });
    const user = userEvent.setup();
    const router = renderApp("/register");

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText(
        "This password appears in known data leaks. Choose another.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Password")).toBeInvalid();
    expect(router.state.location.pathname).toBe("/register");
    expect(registeredAddress()).toBeNull();
  });

  it("shows another refusal, or an unreachable API, above the button", async () => {
    server.use(
      http.post("/api/auth/sign-up/email", () => HttpResponse.error()),
    );
    const user = userEvent.setup();
    renderApp("/register");

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't create the account. Check your connection and try again.",
    );
  });

  it("ACC-2.7: the checkbox shows, ticked, with the list count when hasWorkspace", async () => {
    serveWorkspace();
    const bodies = captureSignUp();
    const user = userEvent.setup();
    renderApp("/register");

    const box = await screen.findByRole("checkbox", {
      name: "Keep this browser's lists",
    });
    expect(box).toBeChecked();
    expect(
      screen.getByText(/3 lists and your catalog move into the account/),
    ).toBeVisible();

    await fill(user);
    await user.click(box);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({ keepGuestData: false });
  });

  it("ACC-2.7: is hidden without a workspace and keepGuestData: true is sent", async () => {
    server.use(
      http.get("/api/lists", () =>
        HttpResponse.json({ lists: [], hasWorkspace: false }),
      ),
    );
    const bodies = captureSignUp();
    const user = userEvent.setup();
    renderApp("/register");

    await fill(user);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({ keepGuestData: true });
  });

  it("Cancel goes back to the page the user came from, or to Lists", async () => {
    const user = userEvent.setup();
    const router = renderApp("/register", ["/catalog"]);
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(router.state.location.pathname).toBe("/catalog");
  });

  it("Cancel with no page before goes to Lists", async () => {
    const user = userEvent.setup();
    const router = renderApp("/register");
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(router.state.location.pathname).toBe("/");
  });

  it("with an account's session, goes to Lists", async () => {
    server.use(
      http.get("/api/auth/get-session", () =>
        HttpResponse.json({
          user: { name: "Ania", email: "ania@example.com", isAnonymous: false },
        }),
      ),
    );
    const router = renderApp("/register");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
  });

  it("stays on the form for a guest's session", async () => {
    server.use(
      http.get("/api/auth/get-session", () =>
        HttpResponse.json({
          user: {
            name: "Anonymous",
            email: "x@y.placeholder.invalid",
            isAnonymous: true,
          },
        }),
      ),
    );
    const router = renderApp("/register");

    expect(await screen.findByLabelText("Your name")).toBeVisible();
    expect(router.state.location.pathname).toBe("/register");
  });
});
