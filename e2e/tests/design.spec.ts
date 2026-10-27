import { expectAccessible } from "../support/accessibility.ts";
import {
  contrastRatio,
  readRoleColors,
  type Rgb,
} from "../support/contrast.ts";
import { openMenu } from "../support/menu.ts";
import { expect, test } from "../support/test.ts";

// The design system page of PH-14a: reachable from the menu, accessible in
// both schemes, and loaded without a CSP violation (the guard in test.ts).
test("the design system page is reachable from the menu and accessible", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const menu = await openMenu(page, isMobile);
  await menu.getByRole("link", { name: "Design system" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Design system" }),
  ).toBeVisible();

  // The page shows Polish characters, so Gabarito's Latin Extended file must
  // have loaded, not only the Latin one (visual-design.md, Typography).
  const gabaritoSubsets = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter(
        (face) => face.family.includes("Gabarito") && face.status === "loaded",
      )
      .map((face) => face.unicodeRange);
  });
  // Browsers write the range as U+100 or U+0100.
  expect(gabaritoSubsets.some((range) => /U\+0*100\b/.test(range))).toBe(true);

  await expectAccessible(page);
});

// Every pair of roles the pages render, with WCAG's minimum: 4.5:1 for text,
// 3:1 for UI parts (NFR-2). axe checks only text it finds on the page; this
// checks the tokens themselves, UI parts included (ADR 0048).
const pairs: [foreground: string, background: string, minimum: number][] = [
  ["foreground", "background", 4.5],
  ["foreground", "card", 4.5],
  ["foreground", "muted", 4.5],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "card", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["primary", "accent", 4.5],
  ["primary", "card", 4.5],
  ["link", "background", 4.5],
  ["link", "card", 4.5],
  ["link", "muted", 3],
  ["destructive-foreground", "destructive", 4.5],
  ["warning-foreground", "warning", 4.5],
  ["haul-foreground", "haul", 4.5],
  ["haul-foreground", "haul-chip", 4.5],
  ["haul-muted", "haul", 4.5],
  ["haul-muted", "haul-chip", 4.5],
  ["input", "card", 3],
  ["input", "background", 3],
  ["ring", "background", 3],
  ["ring", "card", 3],
  ["haul-accent", "haul", 3],
  ["haul-accent", "haul-chip", 3],
];

test("NFR-2.2: every color pair meets its contrast in light and dark", async ({
  page,
}) => {
  expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21);

  const roles = [...new Set(pairs.flatMap(([fg, bg]) => [fg, bg]))];
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/design");
    const colors = await readRoleColors(page, roles);
    // readRoleColors throws for a role it cannot read, so every role is there.
    const color = (role: string): Rgb => colors[role] ?? [0, 0, 0];
    for (const [foreground, background, minimum] of pairs) {
      const ratio = contrastRatio(color(foreground), color(background));
      expect
        .soft(ratio, `${foreground} on ${background} (${colorScheme})`)
        .toBeGreaterThanOrEqual(minimum);
    }
  }
});
