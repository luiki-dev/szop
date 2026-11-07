import { z } from "zod";

// Names sort by Polish rules, numbers by value (PH-15a spec, decision 13;
// ORD-2 in docs/requirements/ORD-list-display-and-ordering.md): "śmietana"
// falls between "ser" and "tofu", and "Pack 2" before "Pack 10". Case does not
// decide the order: with the default sensitivity "milk" and "Milk" sort next
// to each other, lowercase first, so the result stays deterministic.
const collator = new Intl.Collator("pl", { numeric: true });

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}

// A name: trimmed, NFC-normalized, 1 to 100 Unicode code points (not UTF-16
// units, so one emoji counts once), without control characters. The message
// for an empty name differs per entity.
export const nameSchema = (emptyMessage: string, max = 100) =>
  z
    .string()
    .transform((value) => value.trim().normalize("NFC"))
    .refine((value) => Array.from(value).length >= 1, {
      message: emptyMessage,
    })
    .refine((value) => Array.from(value).length <= max, {
      message: `Name is too long (at most ${String(max)} characters)`,
    })
    // Control and format characters, except the joiner and the tag characters
    // that build emoji sequences (ZWJ families, flags of regions).
    .refine(
      (value) => !/(?![\u200D\u{E0020}-\u{E007F}])[\p{Cc}\p{Cf}]/u.test(value),
      {
        message: "Name can't contain control characters",
      },
    );
