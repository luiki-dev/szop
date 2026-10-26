import { expectAccessible } from "../support/accessibility.ts";
import { contrastRatio, readRoleColors } from "../support/contrast.ts";
import { openMenu } from "../support/menu.ts";
import { expect, test } from "../support/test.ts";

// The shell around every page (PH-14b). The menu's status replaces the
// walking skeleton's health page as the one proof that the SPA, the API and
// PostgreSQL talk to each other (OP-087).
test("APP-1.4: the shell shows the menu, the API's status and the pages", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Start" }),
  ).toBeVisible();

  const menu = await openMenu(page, isMobile);
  const status = menu.getByRole("status");
  await expect(status).toContainText("API: ok");
  await expect(status).toContainText("Database: up");
  await expectAccessible(page);

  await menu.getByRole("link", { name: "Design system" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Design system" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

// The user's color scheme (APR-1): kept on the device, and applied by
// public/color-scheme.js before the app's bundle runs, so the page never
// flashes in the wrong scheme.
test("APR-1.4: the color scheme survives a reload and is set before the app runs", async ({
  page,
  isMobile,
}) => {
  const html = page.locator("html");
  await page.goto("/");

  let menu = await openMenu(page, isMobile);
  await menu.getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  const [background] = Object.values(
    await readRoleColors(page, ["background"]),
  );
  expect(
    contrastRatio(background ?? [255, 255, 255], [255, 255, 255]),
  ).toBeGreaterThan(10);

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  // With the app's bundle blocked, only the script can have set the class.
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.unroute("**/assets/*.js");

  await page.reload();
  menu = await openMenu(page, isMobile);
  await menu.getByRole("radio", { name: "System" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).not.toHaveClass(/\bdark\b/);
});

// Criteria built in PH-14a and PH-14b without a test of their own, covered by
// PH-40 (ADR 0051, decision 18).
const phone = { width: 390, height: 844 };

test("APP-1.7: the content is at most 720 px wide on a wide screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  const box = await page.getByRole("main").boundingBox();
  expect(box?.width).toBeLessThanOrEqual(720);
});

test("NFR-2.3: every button and every link in the menu is at least 48 px high", async ({
  page,
}) => {
  const expectTall = async (selector: string, where: string) => {
    for (const target of await page.locator(selector).all()) {
      if (!(await target.isVisible())) continue;
      const box = await target.boundingBox();
      expect(
        box?.height,
        `${where}: ${(await target.textContent()) ?? ""}`,
      ).toBeGreaterThanOrEqual(48);
    }
  };
  for (const path of ["/", "/design"]) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectTall("main button, nav a, nav button, nav label", path);

    await page.setViewportSize(phone);
    await expectTall("header button, main button", `${path} on a phone`);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectTall(
      "[role=dialog] a, [role=dialog] button, [role=dialog] label",
      `${path}, the drawer`,
    );
  }
});

test("NFR-2.4: everything focused with the keyboard shows a focus ring", async ({
  page,
}) => {
  await page.goto("/design");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (let stop = 0; stop < 12; stop++) {
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      return {
        name: element.textContent.trim() || element.tagName,
        visible:
          (style.outlineStyle !== "none" && style.outlineWidth !== "0px") ||
          style.boxShadow !== "none",
      };
    });
    if (ring) expect(ring.visible, ring.name).toBe(true);
  }
});

test("NFR-2.6: focus stays inside the open menu drawer", async ({ page }) => {
  await page.setViewportSize(phone);
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  // Tabbing past the last element lands on Base UI's focus guard, just
  // outside the drawer, which sends focus back in on the next animation
  // frame: wait for focus to settle rather than read it at once.
  const focusInside = () =>
    drawer.evaluate((node) => node.contains(document.activeElement));
  await expect.poll(focusInside).toBe(true);
  for (let stop = 0; stop < 15; stop++) {
    await page.keyboard.press("Tab");
    await expect.poll(focusInside).toBe(true);
  }
});

test("NFR-2.7: the drawer slides in 200 ms, and not at all with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize(phone);
  for (const [reducedMotion, duration] of [
    ["no-preference", "0.2s"],
    ["reduce", "0s"],
  ] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    expect(
      await drawer.evaluate(
        (node) => getComputedStyle(node).transitionDuration,
      ),
    ).toBe(duration);
  }
});

test("APP-1.1: the drawer opens from the left, and a tap on the dimmed page closes it", async ({
  page,
}) => {
  await page.setViewportSize(phone);
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  // It slides in from the left edge, and stops there.
  await expect.poll(async () => (await drawer.boundingBox())?.x).toBe(0);
  expect((await drawer.boundingBox())?.width).toBeLessThan(phone.width);

  await page.mouse.click(phone.width - 20, phone.height / 2);
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});
