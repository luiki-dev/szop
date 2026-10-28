import { expectAccessible } from "../support/accessibility.ts";
import { openMenu } from "../support/menu.ts";
import { expect, test } from "../support/test.ts";

// The seed catalog (PH-15a): browsed as a tree and searched. It is served
// from the real seed file, where "Oat milk" sits under Dairy & eggs > Milk >
// Plant-based (the seed's header comment names this test).
test("PRD-2.1, PRD-2.4, PRD-2.6: browse and search the seed catalog", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const menu = await openMenu(page, isMobile);
  await menu.getByRole("link", { name: "Catalog" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Catalog" }),
  ).toBeVisible();

  // The buttons keep their names; only the visible label depends on the width.
  const expandAll = page.getByRole("button", { name: "Expand all" });
  await expect(expandAll).toBeVisible();
  // textContent counts hidden text, so look at the label's visibility.
  const label = expandAll.getByText("Expand all", { exact: true });
  if (isMobile) {
    await expect(label).toBeHidden();
  } else {
    await expect(label).toBeVisible();
  }

  const dairy = page.getByRole("button", { name: /^Dairy & eggs/ });
  await dairy.click();
  await expect(dairy).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: /^Milk/ }).click();
  await expect(page.getByText("Buttermilk")).toBeVisible();
  await expectAccessible(page);

  const search = page.getByRole("searchbox", { name: "Search the catalog" });
  await search.fill("oat milk");
  await expect(page.getByText("Oat milk")).toBeVisible();
  await expect(dairy).toHaveAttribute("aria-expanded", "true");

  await search.clear();
  await expect(page.getByText("Oat milk")).toHaveCount(0);
  await expect(dairy).toHaveAttribute("aria-expanded", "true");
});
