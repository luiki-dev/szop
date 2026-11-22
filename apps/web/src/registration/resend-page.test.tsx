import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderApp } from "../test/render-app.tsx";
import { server } from "../test/server.ts";
import { registeredAddress } from "./registered-address.ts";

beforeEach(() => {
  localStorage.clear();
});

describe("ResendPage", () => {
  it("asks for an address, refuses an invalid one without a call", async () => {
    const user = userEvent.setup();
    const router = renderApp("/register/resend");

    await user.click(await screen.findByRole("button", { name: "Send link" }));

    expect(screen.getByText("Enter an email address.")).toBeVisible();
    expect(router.state.location.pathname).toBe("/register/resend");
  });

  it("Send link goes to /register/sent with that address", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post("/api/registration/resend", async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    const router = renderApp("/register/resend");

    await user.type(await screen.findByLabelText("Email"), "ania@example.com");
    await user.click(screen.getByRole("button", { name: "Send link" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/register/sent");
    });
    expect(bodies).toEqual([{ email: "ania@example.com" }]);
    expect(registeredAddress()).toBe("ania@example.com");
  });

  it("goes to /register/sent whatever the answer", async () => {
    server.use(
      http.post("/api/registration/resend", () =>
        HttpResponse.json(
          { error: { code: "too_many_requests", message: "Too many." } },
          { status: 429 },
        ),
      ),
    );
    const user = userEvent.setup();
    const router = renderApp("/register/resend");

    await user.type(await screen.findByLabelText("Email"), "ania@example.com");
    await user.click(screen.getByRole("button", { name: "Send link" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/register/sent");
    });
  });

  it("Cancel goes back, or to Lists", async () => {
    const user = userEvent.setup();
    const router = renderApp("/register/resend");
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(router.state.location.pathname).toBe("/");
  });
});
