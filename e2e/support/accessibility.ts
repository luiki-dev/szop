import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./test.ts";

// WCAG 2.2 AA (NFR-2; ADR 0013, decision 3).
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

// Scans the page as it is now with axe, in light and then in dark, and fails
// with every violation of both (ADR 0026, decision 3). Call it once the page
// has settled, on every page a journey visits. No rule is turned off for all
// pages: a rule skipped for one page is passed in disableRules at that call,
// with a comment saying why.
export async function expectAccessible(
  page: Page,
  options: { disableRules?: string[] } = {},
): Promise<void> {
  const problems: string[] = [];
  for (const colorScheme of ["light", "dark"] as const) {
    await test.step(`axe (${colorScheme})`, async () => {
      await page.emulateMedia({ colorScheme });
      const results = await new AxeBuilder({ page })
        .withTags(tags)
        .disableRules(options.disableRules ?? [])
        .analyze();
      for (const violation of results.violations) {
        const targets = violation.nodes
          .map((node) => node.target.join(" "))
          .join(", ");
        problems.push(
          `[${colorScheme}] ${violation.id}: ${String(violation.nodes.length)} element(s) — ${targets}`,
        );
      }
    });
  }
  // Back to the projects' default.
  await page.emulateMedia({ colorScheme: "light" });
  expect(problems, "axe found accessibility violations").toEqual([]);
}
