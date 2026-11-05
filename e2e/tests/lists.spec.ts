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

test("LST-1.3, APP-3.3: a guest deletes a list from its screen after a confirmation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "New list" }).click();
  await page.getByRole("textbox", { name: "List name" }).fill("Weekly shop");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "List actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: 'Delete list "Weekly shop"?',
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await expect(dialog).toHaveCSS("opacity", "1");
  await expectAccessible(page);

  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/");
  await expect(emptyState(page)).toBeVisible();
  await expect(page.getByText("Weekly shop")).toHaveCount(0);
});

async function createList(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("link", { name: "New list" }).click();
  const field = page.getByRole("textbox", { name: "List name" });
  // Typing before the field has the focus loses the Enter.
  await expect(field).toBeFocused();
  await field.fill(name);
  await field.press("Enter");
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: "Back to lists" }).click();
  await expect(page.getByText(name)).toBeVisible();
}

test("LST-1.6, LST-1.7, LST-1.8: a guest selects lists with Select and deletes them at once", async ({
  page,
}) => {
  await page.goto("/");
  await createList(page, "Weekly shop");
  await createList(page, "Party");

  await page.getByRole("button", { name: "Select" }).click();
  await expect(page.getByText("0 selected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Party" }).check();
  await expect(page.getByText("1 selected")).toBeVisible();
  await expectAccessible(page);

  // Esc stops selecting and keeps the page.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Party" })).toBeVisible();
  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: "Select" }).click();
  await page.getByRole("button", { name: "Select all" }).click();
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete 2 lists?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();

  await expect(emptyState(page)).toBeVisible();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("LST-1.6, LST-1.7: on a phone a long press selects a list, and Back stops selecting", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "a long press needs a coarse pointer");
  await page.goto("/");
  await createList(page, "Weekly shop");

  // Playwright cannot hold a touch, so the pointer events are dispatched.
  // The row stays when its link turns into a checkbox.
  const link = page.getByRole("listitem").filter({ hasText: "Weekly shop" });
  const touch = { pointerType: "touch", clientX: 20, clientY: 200 };
  await link.dispatchEvent("pointerdown", touch);
  await page.waitForTimeout(600);
  await link.dispatchEvent("pointerup", touch);
  await expect(page.getByText("1 selected")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Weekly shop" }),
  ).toBeChecked();
  await expect(page).toHaveURL("/");

  await page.goBack();
  await expect(page.getByRole("link", { name: "Weekly shop" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page).toHaveURL("/");
});
