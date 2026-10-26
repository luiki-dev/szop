import { test as base, expect } from "@playwright/test";

// What the browser reported about one blocked resource.
export interface CspViolation {
  directive: string;
  blocked: string;
  source: string;
  sample: string;
}

// Every journey imports test and expect from here, never from
// @playwright/test (ESLint enforces it in tests/), so the CSP guard runs in
// every test without being asked for (ADR 0013, decision 9; ADR 0026,
// decision 7). NFR-4.4: a journey fails on any CSP violation.
export const test = base.extend<{ cspViolations: CspViolation[] }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright reads a fixture's dependencies from this pattern, and this one has none.
  cspViolations: async ({}, use) => {
    await use([]);
  },
  // The context, wrapped: Playwright creates page from it, so the listener is
  // in place before the first page opens, on every page and navigation.
  context: async ({ context, cspViolations }, use) => {
    await context.exposeBinding(
      "reportCspViolation",
      (_source, violation: CspViolation) => {
        cspViolations.push(violation);
      },
    );
    await context.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        const page = window as unknown as {
          reportCspViolation: (violation: CspViolation) => Promise<void>;
        };
        void page.reportCspViolation({
          directive: event.effectiveDirective,
          blocked: event.blockedURI,
          source: `${event.sourceFile}:${String(event.lineNumber)}`,
          sample: event.sample,
        });
      });
    });
    await use(context);
    // One round trip per open page, so a report sent in the test's last
    // moment has arrived before the check.
    // A crashed or navigating page must not hide the CSP check below.
    for (const page of context.pages()) {
      await page.evaluate(() => undefined).catch(() => undefined);
    }
    expect(cspViolations, "the browser reported CSP violations").toEqual([]);
  },
});

export { expect };
