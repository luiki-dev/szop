import { expectAccessible } from "../support/accessibility.ts";
import { listWith, openKeyboard, tap, touchTap } from "../support/list.ts";
import { expect, test } from "../support/test.ts";

test.use({ viewport: { width: 390, height: 700 } });

test("APP-1.8: Tab never leaves the focused row under the add bar and the haul", async ({
  page,
  isMobile,
}) => {
  // Firefox ignores scroll-padding when it scrolls a focused element into
  // view; the criterion is a phone's, and the phone project is Chromium.
  test.skip(!isMobile, "APP-1.8 is a phone's criterion");
  await listWith(page, 16);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page
    .getByRole("button", { name: /Item 1\b/ })
    .first()
    .focus();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const covered = await page.evaluate(() => {
      const focused = document.activeElement;
      const block = document.querySelector("form")?.parentElement;
      if (!focused || !block || block.contains(focused)) return false;
      return (
        focused.getBoundingClientRect().bottom >
        block.getBoundingClientRect().top + 1
      );
    });
    expect(covered, `Tab ${String(i + 1)}`).toBe(false);
  }
});

test("ITM-2.3, ITM-2.4, APP-1.8: a guest adds items one after another with Enter, and the add bar stays pinned", async ({
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
  const tray = page.getByRole("region", { name: "The haul" });
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
  const block = await tray.boundingBox();
  await page.getByRole("button", { name: /^The haul/ }).click();
  const popup = await drawer.boundingBox();
  expect(popup?.width).toBeLessThanOrEqual(720);
  // The drawer sits within the column, not the viewport: the bottom block's x range.
  expect(popup?.x).toBeGreaterThanOrEqual((block?.x ?? 0) - 1);
  expect((popup?.x ?? 0) + (popup?.width ?? 0)).toBeLessThanOrEqual(
    (block?.x ?? 0) + (block?.width ?? 0) + 1,
  );
});

test("APP-1.8: the list stays put when the keyboard opens for the add bar (#412)", async ({
  page,
}) => {
  const add = await listWith(page, 16);
  await add.blur();
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await tap(page, add);
  await openKeyboard(page);
  await expect(add).toBeFocused();
  await expect(add).toBeInViewport();
  await expect(
    page.getByRole("checkbox", { name: "Item 1", exact: true }),
  ).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("ORD-1.8: the haul folds only while the keyboard is open for the add bar (OP-138)", async ({
  page,
}) => {
  const add = await listWith(page, 2);
  const tray = page.getByRole("region", { name: "The haul" });
  const folded = page.getByRole("button", { name: /^The haul · 0 of 2/ });
  // Focused with the keyboard closed, as on a desktop: the haul stays open.
  await expect(add).toBeFocused();
  await expect(tray).toBeVisible();
  await openKeyboard(page);
  await expect(folded).toBeVisible();
  // The keyboard closes and the field keeps the focus: the haul opens again.
  await page.setViewportSize({ width: 390, height: 700 });
  await expect(tray).toBeVisible();
  await expect(folded).toHaveCount(0);
  await expect(add).toBeFocused();
});

test("ORD-1.8: the first tap after typing opens the drawer from the folded line", async ({
  page,
}) => {
  await listWith(page, 2);
  // The add bar still has the focus and the keyboard is open, so the haul is
  // folded to one line.
  await openKeyboard(page);
  await tap(page, page.getByRole("button", { name: /^The haul · 0 of 2/ }));
  await expect(page.getByRole("dialog", { name: "The haul" })).toBeVisible();
});

test("ITM-2.6: with the keyboard open, a tap on the dimmed list only closes the keyboard, and the list still scrolls", async ({
  page,
}) => {
  const add = await listWith(page, 16);
  await openKeyboard(page);
  await page.mouse.move(195, 150);
  await page.mouse.wheel(0, 2000);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  const item = page.getByRole("checkbox", { name: "Item 16" });
  await tap(page, item);
  await expect(add).not.toBeFocused();
  await expect(page.getByRole("region", { name: "The haul" })).toBeVisible();
  await expect(page.getByText("0 of 16 items")).toBeVisible();
  // The dimming is gone: the next tap checks the item, once the taller haul no
  // longer covers it.
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await tap(page, item);
  await expect(page.getByText("1 of 16 items")).toBeVisible();
});

test("ORD-1.3: the collapsed haul keeps its height at the first check", async ({
  page,
}) => {
  await listWith(page, 2);
  await page
    .getByRole("textbox", { name: "Add an item to Weekend groceries" })
    .blur();
  const tray = page.getByRole("region", { name: "The haul" });
  const height = async () => (await tray.boundingBox())?.height ?? 0;
  const before = await height();
  await page.getByRole("checkbox", { name: "Item 1" }).click();
  await expect(
    page.getByRole("button", { name: "Put Item 1 back" }),
  ).toBeVisible();
  expect(await height()).toBe(before);
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

  // The list's ⋮ menu holds the same setting: a tap picks it and closes the menu.
  await page.getByRole("button", { name: "List actions" }).click();
  await page.getByRole("menuitemradio", { name: "Left" }).click();
  await expect(page.getByRole("menu")).toBeHidden();
  expect(await box()).toBeLessThan(right);
  await expect(page.getByRole("radio", { name: "Left" })).toBeChecked();
});

for (const size of [
  { name: "phone", width: 390, height: 700 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test(`ITM-2.3, ITM-6.1, ITM-7.1, ITM-5.1, ORD-5.1, ORD-1.6: the list items journey on a ${size.name}`, async ({
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

test("ORD-1.8: by touch, the first tap after typing opens the drawer from the folded line", async ({
  page,
  hasTouch,
}) => {
  test.skip(!hasTouch, "needs a touch screen");
  await listWith(page, 2);
  await openKeyboard(page);
  await touchTap(
    page,
    page.getByRole("button", { name: /^The haul · 0 of 2/ }),
  );
  await expect(page.getByRole("dialog", { name: "The haul" })).toBeVisible();
});

test("ITM-2.6: by touch, with the keyboard open, a tap on the dimmed list only closes the keyboard", async ({
  page,
  hasTouch,
}) => {
  test.skip(!hasTouch, "needs a touch screen");
  const add = await listWith(page, 16);
  await openKeyboard(page);
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  const item = page.getByRole("checkbox", { name: "Item 16" });
  await touchTap(page, item);
  await expect(add).not.toBeFocused();
  await expect(page.getByRole("region", { name: "The haul" })).toBeVisible();
  await expect(page.getByText("0 of 16 items")).toBeVisible();
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await touchTap(page, item);
  await expect(page.getByText("1 of 16 items")).toBeVisible();
});

test("ORD-1.6: dragging the haul's drawer down closes it (#404)", async ({
  page,
}) => {
  await listWith(page, 2);
  await page.getByRole("checkbox", { name: "Item 1" }).click();
  await page.getByRole("button", { name: /^The haul/ }).click();
  const drawer = page.getByRole("dialog", { name: "The haul" });
  await expect(drawer).toBeVisible();
  // Measured once it has slid in, not on the way.
  await drawer.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)),
  );
  const box = (await drawer.boundingBox()) ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(x, box.y + 110, { steps: 10 });
  // The drawer follows the pointer one to one: without the swipe it stays
  // put, and a release over the dimmed list would close it on its own; at
  // twice the pointer's distance it jumps back up on the release.
  await expect
    .poll(async () => ((await drawer.boundingBox())?.y ?? 0) - box.y)
    .toBeGreaterThan(50);
  expect(((await drawer.boundingBox())?.y ?? 0) - box.y).toBeLessThanOrEqual(
    101,
  );
  // Past half its height, so it closes by the distance, whatever the speed.
  await page.mouse.move(x, box.y + 10 + box.height * 0.6, { steps: 10 });
  await page.mouse.up();
  await expect(drawer).toBeHidden();
});

test("ITM-6.1: on a desktop, Tab after Enter opens Edit item stays in the dialog (#405)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await listWith(page, 3);
  await page.getByRole("button", { name: /Item 1/ }).press("Enter");
  const dialog = page.getByRole("dialog", { name: "Edit item" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    const inside = await dialog.evaluate((el) =>
      el.contains(document.activeElement),
    );
    expect(inside, `Tab ${String(i + 1)}`).toBe(true);
  }
});

test("ITM-6.1: closing Edit item gives the focus back to the item, with a ring only when it was opened from the keyboard (#415)", async ({
  page,
}) => {
  await listWith(page, 1);
  const row = page.getByRole("button", { name: /Item 1/ });
  const ring = () => row.evaluate((el) => el.matches(":focus-visible"));
  const dialog = page.getByRole("dialog", { name: "Edit item" });

  await row.click();
  await dialog.getByRole("textbox", { name: "Name" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
  expect(await ring(), "opened by a click").toBe(false);

  await row.click();
  await dialog.getByRole("textbox", { name: "Name" }).press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
  expect(await ring(), "saved with Enter, the phone's Go").toBe(false);

  await row.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
  expect(await ring(), "opened from the keyboard").toBe(true);
});

test("ITM-6.1: Quantity is as tall as the other fields (#413)", async ({
  page,
}) => {
  await listWith(page, 1);
  await page.getByRole("button", { name: /Item 1/ }).click();
  const dialog = page.getByRole("dialog", { name: "Edit item" });
  // The bordered box around the stepper and the field.
  const quantity = dialog
    .getByRole("textbox", { name: "Quantity" })
    .locator("..");
  const height = async (locator: typeof quantity) =>
    (await locator.boundingBox())?.height;
  expect(await height(quantity)).toBe(
    await height(dialog.getByRole("combobox", { name: "Unit" })),
  );
});

test("ITM-6.1, LST-1.3: on a desktop, the dialogs are centered on the list's column, not the screen (#406)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await listWith(page, 1);
  const center = async (locator: import("@playwright/test").Locator) => {
    await locator.evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished)),
    );
    const box = (await locator.boundingBox()) ?? { x: 0, width: 0 };
    return box.x + box.width / 2;
  };
  const column = await center(page.getByRole("main"));

  await page.getByRole("button", { name: /Item 1/ }).click();
  const edit = page.getByRole("dialog", { name: "Edit item" });
  expect(await center(edit), "Edit item").toBeCloseTo(column, 0);
  await page.getByRole("button", { name: /^Category/ }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search categories" }),
  ).toBeVisible();
  expect(await center(edit), "the picker").toBeCloseTo(column, 0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "List actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("alertdialog");
  expect(await center(confirm), "Delete list").toBeCloseTo(column, 0);
});

test("APP-3.1: the toast is centered on the haul, at 75 % of its width on a phone and 60 % on a desktop (#414)", async ({
  page,
}) => {
  for (const [size, share] of [
    [{ width: 390, height: 700 }, 0.75],
    [{ width: 1280, height: 800 }, 0.6],
  ] as const) {
    await page.setViewportSize(size);
    await listWith(page, 1);
    await page.getByRole("button", { name: /Item 1/ }).click();
    await page
      .getByRole("dialog", { name: "Edit item" })
      .getByRole("button", { name: "Remove" })
      .click();
    // The toast's root holds its description.
    const toast = page.getByText("Removed Item 1").locator("..");
    await expect(toast).toBeVisible();
    const box = (await toast.boundingBox()) ?? { x: 0, width: 0 };
    const haul = (await page.locator("[data-bottom-block]").boundingBox()) ?? {
      x: 0,
      width: 0,
    };
    expect(box.x + box.width / 2, "centered").toBeCloseTo(
      haul.x + haul.width / 2,
      0,
    );
    expect(box.width / haul.width, "width").toBeCloseTo(share, 2);
  }
});

test("ITM-6.1: the category picker keeps its height while searching (#406)", async ({
  page,
}) => {
  for (const size of [
    { width: 390, height: 700 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    if (size.width === 390) await listWith(page, 1);
    await page.getByRole("button", { name: /Item 1/ }).click();
    await page.getByRole("button", { name: /^Category/ }).click();
    const search = page.getByRole("searchbox", { name: "Search categories" });
    const panel = page.getByRole("dialog").filter({ has: search }).last();
    const before = (await panel.boundingBox())?.height ?? 0;
    await search.fill("bread");
    await expect(page.getByRole("radio")).not.toHaveCount(0);
    const after = (await panel.boundingBox())?.height ?? 0;
    expect(after, size.width === 390 ? "phone" : "desktop").toBeCloseTo(
      before,
      0,
    );
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});
