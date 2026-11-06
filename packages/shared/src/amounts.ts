import type { ListItem } from "./items.ts";

export type ParsedAmount = { ok: true; value: number | null } | { ok: false };

// Text to whole hundredths (2) or thousandths (3), read from the digits as a
// string so no floating point is involved. The range is the schemas' to check.
export function parseAmount(text: string, decimals: 2 | 3): ParsedAmount {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: null };
  const match = new RegExp(
    `^(\\d+)(?:[.,](\\d{1,${String(decimals)}}))?$`,
  ).exec(trimmed);
  if (!match) return { ok: false };
  return {
    ok: true,
    value: Number((match[1] ?? "") + (match[2] ?? "").padEnd(decimals, "0")),
  };
}

const split = (value: number, decimals: 2 | 3) => {
  const unit = 10 ** decimals;
  return [
    Math.floor(value / unit),
    String(value % unit).padStart(decimals, "0"),
  ] as const;
};

export function formatQuantity(thousandths: number): string {
  const [whole, fraction] = split(thousandths, 3);
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed === "" ? String(whole) : `${String(whole)}.${trimmed}`;
}

export function formatPrice(cents: number): string {
  const [whole, fraction] = split(cents, 2);
  return `€${String(whole)}.${fraction}`;
}

// The text of a field: a price keeps its two decimals, a quantity drops
// trailing zeros.
export function formatAmountInput(value: number, decimals: 2 | 3): string {
  return decimals === 2 ? formatPrice(value).slice(1) : formatQuantity(value);
}

// price x quantity in cents, rounded half up (these values are not negative).
// At the maxima it is about 10^11, past 32 bits but exact as a JS number
// (below 2^53); it is computed, never stored.
export function lineTotal({
  price,
  quantity,
}: Pick<ListItem, "price" | "quantity">): number | null {
  if (price === null) return null;
  if (quantity === null) return price;
  return Math.floor((price * quantity + 500) / 1000);
}
