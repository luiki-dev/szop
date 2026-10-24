import type { Page } from "@playwright/test";

// An sRGB color, each channel 0 to 255.
export type Rgb = [number, number, number];

// WCAG 2.2's relative luminance of an sRGB color.
function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

// WCAG 2.2's contrast ratio, from 1 (none) to 21 (black on white).
export function contrastRatio(a: Rgb, b: Rgb): number {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

// The current value of each role's custom property (--primary and so on),
// as sRGB. Tailwind's palette is in OKLCH, so the browser converts it: each
// color is painted on a one-pixel canvas and the pixel read back.
export async function readRoleColors(
  page: Page,
  roles: readonly string[],
): Promise<Record<string, Rgb>> {
  return page.evaluate((names) => {
    const style = getComputedStyle(document.documentElement);
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("no 2D canvas");
    const colors: Record<string, [number, number, number]> = {};
    for (const name of names) {
      const value = style.getPropertyValue(`--${name}`).trim();
      if (!value) throw new Error(`--${name} is not defined`);
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
      colors[name] = [r, g, b];
    }
    return colors;
  }, roles);
}
