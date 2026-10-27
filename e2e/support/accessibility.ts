import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./test.ts";

// NFR-2.1: WCAG 2.2 AA, in light and dark (ADR 0013, decision 3).
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
      // Switching the scheme starts color transitions (Button's
      // transition-colors); scanning mid-way reads colors that are neither
      // scheme's, so wait for every running animation to finish first. A
      // transition cancelled on the way (a new one replacing it) rejects its
      // finished promise; it is no longer running either. The app switches
      // the scheme in a matchMedia listener (ADR 0049), which the browser
      // calls before the next frame, so the transitions start only then:
      // wait for that frame before collecting them.
      await page.evaluate(async () => {
        await new Promise(requestAnimationFrame);
        await Promise.all(
          document
            .getAnimations()
            .map((animation) => animation.finished.catch(() => undefined)),
        );
      });
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
