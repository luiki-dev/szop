import { expectAccessible } from "../support/accessibility.ts";
import { expect, test } from "../support/test.ts";

test.use({ viewport: { width: 390, height: 700 } });

test("ITM-2.3, ITM-2.4: a guest adds items one after another with Enter, and the add bar stays pinned", async ({
  page,
}) => {
  await page.goto("/lists/new");
  const name = page.getByRole("textbox", { name: "List name" });
  await name.fill("Weekend groceries");
  await name.press("Enter");
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Nothing on this list yet")).toBeVisible();

  const add = page.getByRole("textbox", {
    name: "Add an item to Weekend groceries",
  });
  const barBottom = () =>
    add.evaluate((el) => el.closest("form")?.getBoundingClientRect().bottom);
  // On an empty list the bar is already at the bottom of the screen.
  expect(await barBottom()).toBeCloseTo(700, 0);
  await add.fill("Bananas");
  await add.press("Enter");
  await expect(add).toBeFocused();
  await add.pressSequentially("Milk");
  await add.press("Enter");
  await add.pressSequentially("Bread");
  await add.press("Enter");

  const card = page.locator("section", {
    has: page.getByRole("heading", { name: "No category" }),
  });
  await expect(card.getByRole("button")).toHaveText([
    /Bananas/,
    /Bread/,
    /Milk/,
  ]);
  await expect(card.getByText("3 left")).toBeVisible();
  await expect.poll(barBottom).toBeCloseTo(700, 0);
  await expectAccessible(page);

  for (let i = 1; i <= 20; i++) {
    await add.pressSequentially(`Item ${String(i)}`);
    await add.press("Enter");
  }
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  const bar = await add.evaluate((el) =>
    el.closest("form")?.getBoundingClientRect(),
  );
  expect(bar?.bottom).toBeCloseTo(700, 0);
  await page.mouse.wheel(0, 400);
  await expect
    .poll(
      async () =>
        (
          await add.evaluate((el) =>
            el.closest("form")?.getBoundingClientRect(),
          )
        )?.bottom,
    )
    .toBeCloseTo(700, 0);
});

test("ITM-6.1, APP-3.1: a guest edits an item in the sheet, removes it and undoes", async ({
  page,
}) => {
  await page.goto("/lists/new");
  const name = page.getByRole("textbox", { name: "List name" });
  await name.fill("Weekend groceries");
  await name.press("Enter");
  const add = page.getByRole("textbox", {
    name: "Add an item to Weekend groceries",
  });
  await add.fill("Bananas");
  await add.press("Enter");

  await page.getByRole("button", { name: /Bananas/ }).click();
  const sheet = page.getByRole("dialog", { name: "Edit item" });
  await sheet.getByRole("textbox", { name: "Quantity" }).fill("6");
  await sheet.getByLabel("Price per unit").fill("0,33");
  await sheet.getByLabel("Note").fill("ripe");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: "Save" }).click();

  const row = page.getByRole("button", { name: /Bananas/ });
  await expect(row).toContainText("6");
  await expect(row).toContainText("€1.98");
  await expect(row).toContainText("ripe");

  await row.click();
  await page
    .getByRole("dialog", { name: "Edit item" })
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByText("Removed Bananas")).toBeVisible();
  await expect(page.getByRole("button", { name: /Bananas/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: /Bananas/ })).toContainText(
    "€1.98",
  );
});
