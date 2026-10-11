import { expect, test } from "../support/test.ts";

// Throwaway, never merged: fails on purpose so the e2e job's failure path
// (the github reporter's annotations and the playwright-report artifact)
// can be seen once on a draft PR.
test("fails on purpose to show the failure path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("API: on fire", {
    timeout: 2000,
  });
});
