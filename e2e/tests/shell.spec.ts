import { expectAccessible } from "../support/accessibility.ts";
import { contrastRatio, readRoleColors } from "../support/contrast.ts";
import { openMenu } from "../support/menu.ts";
import { expect, test } from "../support/test.ts";

// The shell around every page (PH-14b). The menu's status replaces the
// walking skeleton's health page as the one proof that the SPA, the API and
// PostgreSQL talk to each other (OP-087).
test("APP-1.4: the shell shows the menu, the API's status and the pages", async ({
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

// The user's color scheme (APR-1): kept on the device, and applied by
// public/color-scheme.js before the app's bundle runs, so the page never
// flashes in the wrong scheme.
test("APR-1.4: the color scheme survives a reload and is set before the app runs", async ({
  page,
  isMobile,
}) => {
  const html = page.locator("html");
  await page.goto("/");

  let menu = await openMenu(page, isMobile);
  await menu.getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  const [background] = Object.values(
    await readRoleColors(page, ["background"]),
  );
  expect(
    contrastRatio(background ?? [255, 255, 255], [255, 255, 255]),
  ).toBeGreaterThan(10);

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  // With the app's bundle blocked, only the script can have set the class.
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.unroute("**/assets/*.js");

  await page.reload();
  menu = await openMenu(page, isMobile);
  await menu.getByRole("radio", { name: "System" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).not.toHaveClass(/\bdark\b/);
});
