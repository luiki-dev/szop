import type { Locator, Page } from "@playwright/test";

// The menu, opened first on a phone, where it is a drawer behind ☰; on a
// desktop it is the sidebar, always there.
export async function openMenu(
  page: Page,
  isMobile: boolean,
): Promise<Locator> {
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }
  return page.getByRole("navigation", { name: "Menu" });
}
