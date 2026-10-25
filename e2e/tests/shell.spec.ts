import { expectAccessible } from "../support/accessibility.ts";
import { openMenu } from "../support/menu.ts";
import { expect, test } from "../support/test.ts";

// The shell around every page (PH-14b). The menu's status replaces the
// walking skeleton's health page as the one proof that the SPA, the API and
// PostgreSQL talk to each other (OP-087).
test("the shell shows the menu, the API's status and the pages", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Start" }),
  ).toBeVisible();

  const menu = await openMenu(page, isMobile);
  const status = menu.getByRole("status");
  await expect(status).toContainText("API: ok");
  await expect(status).toContainText("Database: up");
  await expectAccessible(page);

  await menu.getByRole("link", { name: "Design system" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Design system" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
