import { expect, test } from "../support/test.ts";

// The walking skeleton's page: the SPA, served by the API, shows the API's
// health, which reads PostgreSQL. No use case is complete yet, so the file is
// named after the page; it goes when the page does (OP-087).
test("the health page shows the API and the database up", async ({ page }) => {
  await page.goto("/");
  const status = page.getByRole("status");
  await expect(status).toContainText("API: ok");
  await expect(status).toContainText("Database: up");
});
