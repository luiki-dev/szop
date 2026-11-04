import { expect, test } from "../support/test.ts";

test("a guest's first change sets a __Host- session cookie", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "New list" }).click();
  const field = page.getByRole("textbox", { name: "List name" });
  await field.fill("Prodlike");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);
  const session = (await context.cookies()).find((c) =>
    c.name.startsWith("__Host-"),
  );
  expect(session).toMatchObject({
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
  });
});
