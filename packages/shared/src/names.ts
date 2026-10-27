// Names sort by Polish rules, numbers by value (PH-15a spec, decision 13;
// ORD-2 in docs/requirements/ORD-list-display-and-ordering.md): "śmietana"
// falls between "ser" and "tofu", and "Pack 2" before "Pack 10". Case does not
// decide the order: with the default sensitivity "milk" and "Milk" sort next
// to each other, lowercase first, so the result stays deterministic.
const collator = new Intl.Collator("pl", { numeric: true });

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}
