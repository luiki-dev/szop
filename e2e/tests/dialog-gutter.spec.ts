import { listWith } from "../support/list.ts";
import { expect, test } from "../support/test.ts";

// Headless Chromium hides scrollbars by default, which hides #424 too: the
// gutter is 0 px wide. The flag is dropped to get a desktop's classic scrollbar.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test("#424: a dialog's backdrop dims the whole window, the scrollbar's gutter too", async ({
  page,
  isMobile,
}) => {
  // A phone has overlay scrollbars, and the dialog covers the column.
  test.skip(isMobile, "no gutter on a phone");
  await listWith(page, 30);
  await page.getByRole("button", { name: "List actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();

  // The window's last pixel column, where a classic scrollbar was, is dimmed
  // like the one 40 px in. Polled: the backdrop fades in. A tint rounds off by
  // a level or two; the bug is about 20.
  const width = await page.evaluate(() => window.innerWidth);
  const level = async (x: number) => {
    const png = await page.screenshot({
      clip: { x, y: 100, width: 1, height: 1 },
    });
    return page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes]));
      const context = new OffscreenCanvas(1, 1).getContext("2d");
      context?.drawImage(bitmap, 0, 0);
      return context?.getImageData(0, 0, 1, 1).data[0] ?? 0;
    }, png.toString("base64"));
  };
  await expect(async () => {
    const gutter = await level(width - 1);
    const dimmed = await level(width - 40);
    expect(Math.abs(gutter - dimmed)).toBeLessThanOrEqual(2);
  }).toPass();
});
