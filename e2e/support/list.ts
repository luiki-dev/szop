import type { Locator, Page } from "@playwright/test";
import { expect } from "./test.ts";

// A tap by the mouse at an element's center, positioned after the focus moved.
export async function tap(page: Page, target: Locator) {
  const box = (await target.boundingBox()) ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

// A tap by touch: pointerdown and pointerup come first, then the compatibility
// mouse events (where the focus changes), then the click.
export async function touchTap(page: Page, target: Locator) {
  const box = (await target.boundingBox()) ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

export async function listWith(page: Page, count: number) {
  await page.goto("/lists/new");
  const name = page.getByRole("textbox", { name: "List name" });
  await name.fill("Weekend groceries");
  await name.press("Enter");
  const add = page.getByRole("textbox", {
    name: "Add an item to Weekend groceries",
  });
  for (let i = 1; i <= count; i++) {
    await add.fill(`Item ${String(i)}`);
    await add.press("Enter");
  }
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(count);
  return add;
}
