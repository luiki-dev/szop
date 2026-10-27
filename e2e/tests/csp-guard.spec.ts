import { expect, test } from "../support/test.ts";

// The guard catches what it is there for: a <style> element added at run
// time, which the CSP blocks (ADR 0013, decision 9). If the guard stops
// listening, or the built app loses its CSP, this test fails.
test("NFR-4.4: the CSP guard catches an injected style element", async ({
  page,
  cspViolations,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = "body { color: red; }";
    document.head.append(style);
  });
  await expect
    .poll(() => cspViolations.map((violation) => violation.directive))
    .toEqual(["style-src-elem"]);
  // Expected here, so emptied before the guard's own check after the test.
  cspViolations.length = 0;
});
