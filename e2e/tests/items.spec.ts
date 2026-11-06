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
    add.evaluate(
      (el) => el.closest("form")?.parentElement?.getBoundingClientRect().bottom,
    );
  // On an empty list the bar is already at the bottom of the screen; the bar and the haul under it move as one.
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
    el.closest("form")?.parentElement?.getBoundingClientRect(),
  );
  expect(bar?.bottom).toBeCloseTo(700, 0);
  await page.mouse.wheel(0, 400);
  await expect
    .poll(
      async () =>
        (
          await add.evaluate((el) =>
            el.closest("form")?.parentElement?.getBoundingClientRect(),
          )
        )?.bottom,
    )
    .toBeCloseTo(700, 0);
});

test("ITM-6.1, APP-3.1: a guest edits an item in the sheet, picks its category, removes it and undoes", async ({
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

  // The category picker by keyboard on both layouts, in this test to save a
  // guest's sign-in. The desktop pass proves its layout by ← Back.
  const picks = [
    {
      size: { width: 390, height: 700 },
      parent: "Fruit & vegetables",
      sub: "Fresh fruit",
      desktop: false,
    },
    {
      size: { width: 1280, height: 800 },
      parent: "Bakery",
      sub: "",
      desktop: true,
    },
  ];
  for (const { size, parent, sub: wanted, desktop } of picks) {
    await page.setViewportSize(size);
    await page.getByRole("button", { name: /Bananas/ }).press("Enter");
    const field = page.getByRole("button", { name: /^Category/ });
    await field.focus();
    await field.press("Enter");

    const picker = page.getByRole("radiogroup", { name: "Category" });
    const chevron = picker.getByRole("button", {
      name: `${parent}, subcategories`,
    });
    if ((await chevron.getAttribute("aria-expanded")) === "false") {
      await chevron.focus();
      await chevron.press("Enter");
    }
    // The first subcategory of the parent: the radio after its own.
    const radios = picker.getByRole("radio");
    const at = await radios.evaluateAll(
      (all, name) => all.findIndex((r) => r.textContent === name),
      parent,
    );
    const sub = radios.nth(at + 1);
    const subName = (await sub.textContent()) ?? "";
    expect(subName).toBeTruthy();
    if (wanted) expect(subName).toBe(wanted);
    if (desktop) {
      await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    } else {
      await expect(
        page.getByRole("button", { name: "Close" }).last(),
      ).toBeVisible();
    }
    await expectAccessible(page);
    await sub.focus();
    const saved = page.waitForResponse(
      (r) => r.request().method() === "PATCH" && r.url().includes("/items/"),
    );
    await sub.press("Enter");

    await expect(field).toBeFocused();
    await expect(field).toContainText(subName);
    await page.getByRole("button", { name: "Save" }).press("Enter");
    expect((await saved).status()).toBe(200);
    await expect(page.getByRole("dialog", { name: "Edit item" })).toBeHidden();
    await expect(page.getByText("wasn't saved")).toHaveCount(0);

    // Reopened, the field holds what was picked.
    await page.getByRole("button", { name: /Bananas/ }).press("Enter");
    await expect(page.getByRole("button", { name: /^Category/ })).toContainText(
      subName,
    );
    await page.keyboard.press("Escape");
  }
});

test("ITM-7.1, ORD-1.4, ORD-1.6, ORD-1.7, ORD-1.11: a guest checks items into the haul and puts them back from a chip and from the drawer", async ({
  page,
}) => {
  await page.goto("/lists/new");
  const name = page.getByRole("textbox", { name: "List name" });
  await name.fill("Weekend groceries");
  await name.press("Enter");
  const add = page.getByRole("textbox", {
    name: "Add an item to Weekend groceries",
  });
  for (const item of ["Bananas", "Milk", "Bread"]) {
    await add.fill(item);
    await add.press("Enter");
  }
  // Each add keeps its own ID, so the rows are not doubled and a check right
  // after the adds reaches the right item (no "wasn't saved" toast).
  await expect(page.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("3 left")).toBeVisible();
  await expect(page.getByText("0 of 3 items")).toBeVisible();

  await page.getByRole("checkbox", { name: "Bananas" }).click();
  await page.getByRole("checkbox", { name: "Milk" }).click();
  await expect(page.getByText("2 of 3 items")).toBeVisible();
  await expect(page.getByText("wasn't saved")).toHaveCount(0);
  await expect(page.getByText("1 left")).toBeVisible();
  await expectAccessible(page);

  // The haul sits under the add bar, at the bottom of the screen.
  const tray = page.getByRole("region", { name: "Haul summary" });
  expect(
    await tray.evaluate((el) => el.getBoundingClientRect().bottom),
  ).toBeCloseTo(700, 0);

  // A toast sits above the add bar while the haul shows chips.
  await page.getByRole("button", { name: "Bread" }).click();
  await page
    .getByRole("dialog", { name: "Edit item" })
    .getByRole("button", { name: "Remove" })
    .click();
  const toast = page.getByText("Removed Bread");
  await expect(toast).toBeVisible();
  const toastBottom = await toast.evaluate(
    (el) => el.parentElement?.getBoundingClientRect().bottom ?? 0,
  );
  const barTop = await add.evaluate(
    (el) => el.closest("form")?.getBoundingClientRect().top ?? 0,
  );
  expect(toastBottom).toBeLessThanOrEqual(barTop);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("checkbox", { name: "Bread" })).toBeVisible();

  await page.getByRole("button", { name: "Put Milk back" }).click();
  await expect(page.getByRole("checkbox", { name: "Milk" })).toBeVisible();

  // Drag the handle up to open the drawer.
  const header = page.getByRole("button", { name: /^The haul/ });
  const box = (await header.boundingBox()) ?? { x: 0, y: 0, width: 0 };
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(x, box.y - 80, { steps: 5 });
  await page.mouse.up();
  const drawer = page.getByRole("dialog", { name: "The haul" });
  await expect(drawer).toBeVisible();
  await expectAccessible(page);
  await drawer.getByRole("button", { name: "Put Bananas back" }).click();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page.getByText("3 left")).toBeVisible();
  await expect(
    page.getByText("Check items off to drop them here"),
  ).toBeVisible();

  // On a desktop the haul and the drawer stay within the 720 px column.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("checkbox", { name: "Bread" }).click();
  const wide = await tray.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: r.width, bottom: r.bottom };
  });
  expect(wide.width).toBeLessThanOrEqual(720);
  expect(wide.bottom).toBeCloseTo(800, 0);
  await page.getByRole("button", { name: /^The haul/ }).click();
  const popup = await drawer.boundingBox();
  expect(popup?.width).toBeLessThanOrEqual(720);
});

test("ORD-5.1, ORD-5.2, ORD-5.3, APR-2.2, APR-2.3: a guest turns sorting off and on, keeps it after a reload, and moves the checkboxes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/lists/new");
  const name = page.getByRole("textbox", { name: "List name" });
  await name.fill("Weekend groceries");
  await name.press("Enter");
  const add = page.getByRole("textbox", {
    name: "Add an item to Weekend groceries",
  });
  await add.fill("Bananas");
  await add.press("Enter");
  await expect(
    page.getByRole("heading", { name: "No category" }),
  ).toBeVisible();

  const sortItem = async () => {
    await page.getByRole("button", { name: "List actions" }).click();
    return page.getByRole("menuitemcheckbox", { name: "Sort by category" });
  };
  await (await sortItem()).click();
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.getByRole("heading", { name: "No category" })).toBeHidden();
  await page.reload();
  await expect(page.getByText("1 left")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No category" })).toBeHidden();
  await expect(await sortItem()).not.toBeChecked();
  await page.keyboard.press("Escape");

  // Checked items go to the haul with sorting off too.
  await page.getByRole("checkbox", { name: "Bananas" }).click();
  await expect(page.getByText("Everything's in the haul")).toBeVisible();
  await page.getByRole("button", { name: "Put Bananas back" }).click();

  await (await sortItem()).click();
  await expect(
    page.getByRole("heading", { name: "No category" }),
  ).toBeVisible();

  // The checkboxes' side: Right by default, Left after the choice, kept on reload.
  const box = async () =>
    (await page.getByRole("checkbox", { name: "Bananas" }).boundingBox())?.x ??
    0;
  const right = await box();
  await page.getByRole("radio", { name: "Left" }).click();
  expect(await box()).toBeLessThan(right);
  await page.reload();
  await expect(page.getByRole("radio", { name: "Left" })).toBeChecked();
  await page.getByRole("radio", { name: "Right" }).click();
  expect(await box()).toBeCloseTo(right, 0);
});

for (const size of [
  { name: "phone", width: 390, height: 700 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test(`ITM-2.1, ITM-6.1, ITM-7.1, ITM-5.1, ORD-5.1, ORD-1.6: the list items journey on a ${size.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/lists/new");
    const listName = page.getByRole("textbox", { name: "List name" });
    await listName.fill("Weekend groceries");
    await listName.press("Enter");
    const add = page.getByRole("textbox", {
      name: "Add an item to Weekend groceries",
    });
    for (const item of ["Bananas", "Milk", "Bread"]) {
      await add.fill(item);
      await add.press("Enter");
    }
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(3);
    await expectAccessible(page);

    // Edit Bananas: quantity, price and category (the first subcategory of Bakery).
    await page.getByRole("button", { name: /Bananas/ }).click();
    const sheet = page.getByRole("dialog", { name: "Edit item" });
    await sheet.getByRole("textbox", { name: "Quantity" }).fill("6");
    await sheet.getByLabel("Price per unit").fill("0,33");
    await expectAccessible(page);
    await page.getByRole("button", { name: /^Category/ }).click();
    const picker = page.getByRole("radiogroup", { name: "Category" });
    await picker
      .getByRole("button", { name: "Fruit & vegetables, subcategories" })
      .click();
    await expectAccessible(page);
    await picker.getByRole("radio", { name: "Fresh fruit" }).click();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(sheet).toBeHidden();
    const bananas = page.getByRole("button", { name: /Bananas/ });
    await expect(bananas).toContainText("6");
    await expect(bananas).toContainText("€1.98");
    await expect(
      page.getByRole("heading", { name: /Fresh fruit/ }),
    ).toBeVisible();

    // Check two; put one back from its chip and one from the drawer.
    await page.getByRole("checkbox", { name: "Bananas" }).click();
    await page.getByRole("checkbox", { name: "Milk" }).click();
    await expect(page.getByText("2 of 3 items")).toBeVisible();
    await page.getByRole("button", { name: "Put Milk back" }).click();
    await expect(page.getByRole("checkbox", { name: "Milk" })).toBeVisible();
    await page.getByRole("button", { name: /^The haul/ }).click();
    const drawer = page.getByRole("dialog", { name: "The haul" });
    await expect(drawer).toBeVisible();
    await expectAccessible(page);
    await drawer.getByRole("button", { name: "Put Bananas back" }).click();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(page.getByText("0 of 3 items")).toBeVisible();

    // Remove Milk and undo.
    await page.getByRole("button", { name: /Milk/ }).click();
    await sheet.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Removed Milk")).toBeVisible();
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(2);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(3);

    // Bread in the haul, sorting off and on.
    await page.getByRole("checkbox", { name: "Bread" }).click();
    await expect(page.getByText("1 of 3 items")).toBeVisible();
    const sortItem = async () => {
      await page.getByRole("button", { name: "List actions" }).click();
      return page.getByRole("menuitemcheckbox", { name: "Sort by category" });
    };
    await (await sortItem()).click();
    await expect(
      page.getByRole("heading", { name: /Fresh fruit/ }),
    ).toBeHidden();
    await (await sortItem()).click();
    await expect(
      page.getByRole("heading", { name: /Fresh fruit/ }),
    ).toBeVisible();

    // Everything is kept after a reload.
    await page.reload();
    await expect(page.getByText("1 of 3 items")).toBeVisible();
    await expect(page.getByText("1 left")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "Put Bread back" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Bananas/ })).toContainText(
      "€1.98",
    );
    await expect(
      page.getByRole("heading", { name: /Fresh fruit/ }),
    ).toBeVisible();
    await expect(page.getByText("wasn't saved")).toHaveCount(0);
  });
}
