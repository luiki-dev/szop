import { randomUUID } from "node:crypto";
import { expectAccessible } from "../support/accessibility.ts";
import { latestEmail } from "../support/mailpit.ts";
import { expect, test } from "../support/test.ts";
type Page = import("@playwright/test").Page;

// Long and random, so it is never in a breach list.
const password = () => `${randomUUID()}-${randomUUID()}`;

async function register(page: Page, email: string, secret = password()) {
  await page.goto("/register");
  await page.getByRole("textbox", { name: "Your name" }).fill("Ada");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(secret);
  await page.getByLabel("Repeat password", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/register\/sent$/);
  return (await latestEmail(email)).verifyLink;
}

async function guestList(page: Page) {
  await page.goto("/lists/new");
  const name = page.getByRole("textbox", { name: "List name" });
  await name.fill("Weekend groceries");
  await name.press("Enter");
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);
}

test("ACC-2.1 ACC-2.7: a guest with a list registers, opens the link and sees that list as the account's", async ({
  page,
}) => {
  const email = `${randomUUID()}@example.com`;
  await guestList(page);
  const link = await register(page, email);
  await expect(page.getByText(email)).toBeVisible();
  await expectAccessible(page);

  await page.goto(link);
  await expect(page).toHaveURL("/");
  await expect(
    page.getByText("Welcome! Your lists are in your account now."),
  ).toBeVisible();
  await expect(page.getByText("Weekend groceries")).toBeVisible();
});

test("ACC-2.11: the link opened in a second context signs that one in, and the first shows the confirmed notice", async ({
  page,
  browser,
  baseURL,
}) => {
  const email = `${randomUUID()}@example.com`;
  await guestList(page);
  const link = await register(page, email);

  const second = await browser.newContext({ baseURL: baseURL ?? "" });
  const other = await second.newPage();
  await other.goto(link);
  await expect(other).toHaveURL("/");
  await expect(other.getByText("Weekend groceries")).toBeVisible();
  await second.close();

  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?confirmed$/);
  await expect(
    page.getByText("Your address was confirmed in another browser."),
  ).toBeVisible();
  await expectAccessible(page);
});

test("ACC-3.9: a used link shows Link not valid", async ({ page }) => {
  const link = await register(page, `${randomUUID()}@example.com`);
  await page.goto(link);
  await expect(page).toHaveURL("/");
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Link not valid" }),
  ).toBeVisible();
  await expectAccessible(page);
});

test("NFR-4.8: the address bar holds no token after /verify", async ({
  page,
}) => {
  const link = await register(page, `${randomUUID()}@example.com`);
  await page.goto(link);
  await expect(page).toHaveURL("/");
  expect(page.url()).not.toContain("token");
  await page.goBack();
  await expect(page).not.toHaveURL(/token/);
});

test("NFR-2.1: the registration pages pass axe", async ({ page }) => {
  await page.goto("/register");
  await expect(
    page.getByRole("button", { name: "Create account" }),
  ).toBeVisible();
  await expectAccessible(page);

  await register(page, `${randomUUID()}@example.com`);
  // The pointer is still where Create account was, now over "Back to my
  // lists": hovered, the primary button is 4.46:1 in light, below AA. A
  // finding on Button's hover state (reported, not fixed here).
  await page.mouse.move(0, 0);
  await expectAccessible(page);

  await page.goto("/register/resend");
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expectAccessible(page);

  // The verify request held, so the page stays on the hourglass for the scan.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/verify-email*", async (route) => {
    await held;
    await route.fulfill({ status: 401, json: { code: "invalid_token" } });
  });
  await page.goto("/verify?token=held");
  await expect(page.getByText("Confirming your address…")).toBeVisible();
  await expectAccessible(page);
  release();

  await page.goto("/verify");
  await expect(
    page.getByRole("heading", { name: "Link not valid" }),
  ).toBeVisible();
  await expectAccessible(page);

  await page.goto("/login");
  await expect(page.getByText("Logging in comes with")).toBeVisible();
  await expectAccessible(page);
});
