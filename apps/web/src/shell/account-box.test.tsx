import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { server } from "../test/server.ts";
import { AccountBox } from "./account-box.tsx";

function renderBox(path = "/") {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AccountBox />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

const account = (isAnonymous = false) =>
  http.get("/api/auth/get-session", () =>
    HttpResponse.json({
      user: { name: "Ania", email: "ania@example.com", isAnonymous },
    }),
  );

describe("PH-18b: the menu's account box", () => {
  it("offers a guest to log in or to create an account", () => {
    renderBox();

    expect(
      screen.getByText("Keep your lists on every device."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Log in" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByText(/No account\?/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create account" }),
    ).toHaveAttribute("href", "/register");
  });

  it("treats an anonymous session as a guest", async () => {
    server.use(account(true));
    renderBox();

    expect(await screen.findByRole("link", { name: "Log in" })).toBeVisible();
    expect(screen.queryByText("Ania")).not.toBeInTheDocument();
  });

  it.each([
    ["/login", "Log in"],
    ["/register", "Create account"],
  ])("marks the entry of %s as the current page", (path, name) => {
    renderBox(path);

    expect(screen.getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows an account's name and email", async () => {
    server.use(account());
    renderBox();

    expect(await screen.findByText("Ania")).toBeInTheDocument();
    expect(screen.getByText("ania@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  });

  it("shows the account after a reset, as the verify page does, with no reload", async () => {
    const queryClient = renderBox();
    expect(screen.getByRole("link", { name: "Log in" })).toBeVisible();
    await screen.findByRole("link", { name: "Log in" });

    server.use(account());
    await queryClient.resetQueries();

    expect(await screen.findByText("Ania")).toBeInTheDocument();
  });
});
