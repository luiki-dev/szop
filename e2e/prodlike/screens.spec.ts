import { expect, test } from "../support/test.ts";

// The router's screens, as in apps/web/src/routes.tsx; /lists/:id is covered
// by session.spec.ts. The CSP guard comes from the fixture.
for (const path of ["/", "/lists/new", "/catalog", "/design"]) {
  test(`${path} logs nothing to the console`, async ({ page }) => {
    const messages: string[] = [];
    page.on("console", (message) => {
      messages.push(`${message.type()}: ${message.text()}`);
    });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(messages).toEqual([]);
  });
}
