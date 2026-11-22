import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderApp } from "../test/render-app.tsx";
import { server } from "../test/server.ts";
import { saveRegisteredAddress } from "./registered-address.ts";

beforeEach(() => {
  localStorage.clear();
});

describe("SentPage", () => {
  it("shows the saved address, the mailbox and the ways on", async () => {
    saveRegisteredAddress("ania@example.com");
    renderApp("/register/sent");

    expect(
      await screen.findByRole("heading", { name: "Check your inbox" }),
    ).toBeVisible();
    expect(await screen.findByText("ania@example.com")).toBeVisible();
    expect(screen.getByRole("presentation")).toHaveAttribute("alt", "");
    expect(
      screen.getByRole("link", { name: "Back to my lists" }),
    ).toHaveAttribute("href", "/");
  });

  it("goes to /register with no saved address", async () => {
    const router = renderApp("/register/sent");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/register");
    });
  });

  it("Wrong address? Start again goes back to /register with the name filled in", async () => {
    saveRegisteredAddress("ania@example.com");
    const user = userEvent.setup();
    const router = renderApp({
      pathname: "/register/sent",
      state: { name: "Ania" },
    });

    await user.click(
      await screen.findByRole("link", { name: "Wrong address? Start again" }),
    );

    expect(router.state.location.pathname).toBe("/register");
    expect(await screen.findByLabelText("Your name")).toHaveValue("Ania");
  });

  it("Send the link again sends at once, and a toast confirms", async () => {
    saveRegisteredAddress("ania@example.com");
    const bodies: unknown[] = [];
    server.use(
      http.post("/api/registration/resend", async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/register/sent");

    await user.click(
      await screen.findByRole("button", { name: "Send the link again" }),
    );

    expect(
      await screen.findByText("Link sent to ania@example.com."),
    ).toBeVisible();
    expect(bodies).toEqual([{ email: "ania@example.com" }]);
  });

  it("tells when the link could not be sent", async () => {
    saveRegisteredAddress("ania@example.com");
    server.use(
      http.post("/api/registration/resend", () =>
        HttpResponse.json(
          {
            error: { code: "too_many_requests", message: "Too many requests." },
          },
          { status: 429 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp("/register/sent");

    await user.click(
      await screen.findByRole("button", { name: "Send the link again" }),
    );

    // An error toast is also read out in a role="alert" copy.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The link wasn't sent. Wait a minute and try again.",
    );
  });
});
