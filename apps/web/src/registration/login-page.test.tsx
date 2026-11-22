import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/render-app.tsx";

const notice =
  "Your address was confirmed in another browser. Log in here to see your lists.";

describe("LoginPage", () => {
  it("is a title and a line until PH-18c, with no notice", async () => {
    renderApp("/login");

    expect(
      await screen.findByRole("heading", { name: "Log in" }),
    ).toBeVisible();
    expect(
      await screen.findByText("Logging in comes with the next update."),
    ).toBeVisible();
    expect(screen.queryByText(notice)).toBeNull();
  });

  it("ACC-2.11: /login?confirmed shows the notice", async () => {
    renderApp("/login?confirmed");

    expect(await screen.findByText(notice)).toBeVisible();
  });

  it("Cancel goes back, or to Lists", async () => {
    const user = userEvent.setup();
    const router = renderApp("/login", ["/catalog"]);

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(router.state.location.pathname).toBe("/catalog");
  });
});
