import { expectAccessible } from "../support/accessibility.ts";
import { expect, test } from "../support/test.ts";

const emptyState = (page: import("@playwright/test").Page) =>
  page.getByText("Create your first list");

test("ACC-1.1, LST-1.1, LST-1.2, LST-1.5, LST-2.1, LST-2.3: a guest creates, renames and finds a list", async ({
  page,
}) => {
  await page.goto("/");
  await expect(emptyState(page)).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("link", { name: "New list" }).click();
  const field = page.getByRole("textbox", { name: "List name" });
  await expect(field).toBeFocused();
  await expectAccessible(page);

  await field.fill("Weekly shop");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);
  await expect(field).toHaveValue("Weekly shop");

  await page.getByRole("button", { name: "List actions" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await expect(field).toBeFocused();
  await field.fill("Saturday shop");
  await field.press("Enter");
  // The h1 is screen-reader-only, so it is read through its accessible role.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Saturday shop",
  );
  await expect(page).toHaveTitle("Saturday shop · Szop");
  await expectAccessible(page);

  await page.getByRole("link", { name: "Back to lists" }).click();
  await expect(page.getByText("Saturday shop")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Saturday shop")).toBeVisible();
});

test("NFR-4.10, ACC-1.3, ACC-1.8: another visitor sees nothing, and clearing the cookies loses the lists", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  // A read creates no session.
  await page.goto("/");
  await expect(emptyState(page)).toBeVisible();
  expect(await context.cookies()).toEqual([]);

  await page.getByRole("link", { name: "New list" }).click();
  await page.getByRole("textbox", { name: "List name" }).fill("Weekly shop");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop();

  // A new context is a new guest. It is outside the CSP guard (testing.md).
  const other = await browser.newContext({ baseURL });
  try {
    const otherPage = await other.newPage();
    await otherPage.goto("/");
    await expect(emptyState(otherPage)).toBeVisible();
    const response = await otherPage.request.get(`/api/lists/${String(id)}`);
    expect(response.status()).toBe(404);
  } finally {
    await other.close();
  }

  // The first guest still has the list until the cookies go.
  await page.goto("/");
  await expect(page.getByText("Weekly shop")).toBeVisible();
  await context.clearCookies();
  await page.goto("/");
  await expect(emptyState(page)).toBeVisible();
});
