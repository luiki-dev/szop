import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderApp } from "../test/render-app.tsx";
import { server } from "../test/server.ts";
import {
  registeredAddress,
  saveRegisteredAddress,
} from "./registered-address.ts";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

// Records each call to verify and answers it; `guest` records a guest's
// sign-in, which an error must never cause.
function stubVerify(answer: () => Response | Promise<Response>) {
  const seen = {
    urls: [] as string[],
    addressAtCall: [] as string[],
    signIns: 0,
  };
  server.use(
    http.get("/api/auth/verify-email", ({ request }) => {
      seen.urls.push(request.url);
      seen.addressAtCall.push(
        window.location.pathname + window.location.search,
      );
      return answer();
    }),
    http.post("/api/auth/sign-in/anonymous", () => {
      seen.signIns += 1;
      return HttpResponse.json({});
    }),
  );
  return seen;
}

describe("VerifyPage", () => {
  it("NFR-4.8: the token leaves the address before the call", async () => {
    const seen = stubVerify(() => HttpResponse.json({ verified: true }));
    window.history.replaceState(null, "", "/verify?token=abc");
    renderApp("/verify?token=abc");

    await waitFor(() => {
      expect(seen.urls).toHaveLength(1);
    });
    expect(seen.urls[0]).toContain("token=abc");
    expect(seen.addressAtCall).toEqual(["/verify"]);
  });

  it("shows the hourglass while the call runs", async () => {
    stubVerify(() => new Promise<Response>(() => undefined));
    renderApp("/verify?token=abc");

    expect(await screen.findByText("Confirming your address…")).toBeVisible();
    expect(screen.getByRole("presentation")).toHaveAttribute("alt", "");
  });

  it("ACC-2.1: verified goes to Lists, with the lists kept, and forgets the address", async () => {
    saveRegisteredAddress("ania@example.com");
    stubVerify(() => HttpResponse.json({ verified: true }));
    server.use(
      http.get("/api/lists", () =>
        HttpResponse.json({ lists: [], hasWorkspace: true }),
      ),
    );
    const router = renderApp("/verify?token=abc");

    expect(
      await screen.findByText("Welcome! Your lists are in your account now."),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/");
    expect(registeredAddress()).toBeNull();
  });

  it("says only Welcome! when the lists were not kept", async () => {
    stubVerify(() => HttpResponse.json({ verified: true }));
    server.use(
      http.get("/api/lists", () =>
        HttpResponse.json({ lists: [], hasWorkspace: false }),
      ),
    );
    renderApp("/verify?token=abc");

    expect(await screen.findByText("Welcome!")).toBeVisible();
  });

  it.each([
    ["not verified", () => HttpResponse.json({ verified: false })],
    [
      "an error",
      () =>
        HttpResponse.json(
          { code: "TOKEN_EXPIRED", message: "x" },
          { status: 401 },
        ),
    ],
  ])(
    "ACC-3.9: %s shows Link not valid and signs in no guest",
    async (_, answer) => {
      const seen = stubVerify(answer);
      renderApp("/verify?token=abc");

      expect(await screen.findByText("Link not valid")).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Send a new link" }),
      ).toHaveAttribute("href", "/register/resend");
      expect(screen.getByText("Already confirmed your address?")).toBeVisible();
      expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
        "href",
        "/login",
      );
      expect(seen.signIns).toBe(0);
    },
  );

  it("with no token, or after a reload without it, shows Link not valid with no call", async () => {
    const seen = stubVerify(() => HttpResponse.json({ verified: true }));
    renderApp("/verify");

    expect(await screen.findByText("Link not valid")).toBeVisible();
    expect(seen.urls).toEqual([]);
  });
});
