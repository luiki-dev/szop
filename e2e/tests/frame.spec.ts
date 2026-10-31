import { expect, test } from "../support/test.ts";

// The page frame (visual-design.md, "The page frame"): the title row stands
// at the same place on every screen, so moving between pages does not jump.

async function box(locator: import("@playwright/test").Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error("The element has no box");
  return found;
}

// Where a page's frame puts things: the element that starts the row (☰ or
// ← on a phone; the h1 or ← on a desktop), where the title's text starts, and
// the title's vertical center. Values are rounded to whole pixels.
async function frame(
  page: import("@playwright/test").Page,
  isMobile: boolean,
  listScreen: boolean,
) {
  // Wait for the page's data, so a long page has its scrollbar.
  await page.waitForLoadState("networkidle");
  const title = listScreen
    ? page.getByRole("textbox", { name: "List name" })
    : page.getByRole("heading", { level: 1 });
  const titleBox = await box(title);
  const padding = listScreen
    ? await title.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).paddingLeft),
      )
    : 0;
  const leading = listScreen
    ? page.getByRole("link", { name: "Back to lists" })
    : isMobile
      ? page.getByRole("button", { name: "Open menu" })
      : title;
  const leadingBox = await box(leading);
  return {
    leading: Math.round(leadingBox.x),
    // On a desktop the title follows ← on a list's screen, so only the
    // phone's title, which follows ☰ or ←, starts at one x on every page.
    ...(isMobile && { text: Math.round(titleBox.x + padding) }),
    middle: Math.round(titleBox.y + titleBox.height / 2),
  };
}

test("every page's title row stands at the same place", async ({
  page,
  isMobile,
}) => {
  await page.goto("/lists/new");
  const field = page.getByRole("textbox", { name: "List name" });
  await field.fill("Weekly shop");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);
  await field.blur();
  const list = page.url();

  await page.goto("/");
  const expected = await frame(page, isMobile, false);
  for (const path of ["/catalog", "/design"]) {
    await page.goto(path);
    expect(await frame(page, isMobile, false), path).toEqual(expected);
  }
  await page.goto(list);
  expect(await frame(page, isMobile, true), "a list").toEqual(expected);
});

test("APP-1.8: on a phone, New list fills a bar at the bottom of the screen", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "a desktop shows New list beside the title");
  await page.goto("/");
  const link = await box(page.getByRole("link", { name: "New list" }));
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("The page has no viewport");
  // The bar's py-3 and px-4: 12 px below the link, 16 px on each side.
  expect(Math.round(link.y + link.height)).toBe(viewport.height - 12);
  expect(Math.round(link.x)).toBe(16);
  expect(Math.round(link.width)).toBe(viewport.width - 32);
});
